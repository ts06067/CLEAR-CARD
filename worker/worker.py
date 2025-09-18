# worker/worker.py
import csv, gzip, io, json, os, time
from datetime import datetime

import pyodbc, redis
from google.cloud import storage
from dotenv import load_dotenv
load_dotenv()

REDIS_URL    = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MSSQL_HOST   = os.getenv("MSSQL_HOST")
MSSQL_DB     = os.getenv("MSSQL_DB")
MSSQL_USER   = os.getenv("MSSQL_USER")
MSSQL_PWD    = os.getenv("MSSQL_PWD")
MSSQL_DRIVER = os.getenv("MSSQL_DRIVER","ODBC Driver 18 for SQL Server")
MSSQL_QUERY_TIMEOUT = int(os.getenv("MSSQL_QUERY_TIMEOUT","300"))

GCS_BUCKET   = os.getenv("GCS_BUCKET","clearcard-sql-results")
CHUNK_MB     = 0.1*int(os.getenv("RESULT_CHUNK_MAX_MB","100"))  # 1 MB for testing; raise to 100 in prod

def _set_cache_status(r, job_id, state, rows=0, bytes_=0, error=""):
    r.setex(
        f"jobs:status:{job_id}",
        24 * 3600,
        json.dumps({"state": state, "rows": int(rows), "bytes": int(bytes_),
                    "error": error, "updated_at": int(time.time())})
    )

def _short_err(e, limit=1900):
    s = str(e)
    return s[:limit]

def _record_event(cx, job_id, event, detail=None):
    cx.cursor().execute(
        "INSERT INTO dbo.job_events(job_id, event, detail) VALUES (?,?,?)",
        job_id, event, detail
    )

def _normalize_sql(sql: str) -> str:
    out = []
    for line in (sql or "").splitlines():
        s = line.strip()
        if not s: continue
        U = s.upper()
        if U == "GO": continue
        if U.startswith("USE "): continue
        out.append(line)
    return "\n".join(out)

def _mssql_conn():
    conn_str = (
        f"DRIVER={{{MSSQL_DRIVER}}};SERVER={MSSQL_HOST};DATABASE={MSSQL_DB};"
        f"UID={MSSQL_USER};PWD={MSSQL_PWD};TrustServerCertificate=Yes;"
    )
    return pyodbc.connect(conn_str, autocommit=True, timeout=10)

def _update_sql_status(cx, job_id, **kwargs):
    sets, vals = [], []
    for k,v in kwargs.items():
        sets.append(f"{k}=?")
        vals.append(v)
    if not sets: return
    vals.append(job_id)
    cx.cursor().execute(f"UPDATE dbo.jobs SET {', '.join(sets)} WHERE job_id=?", *vals)

def run_once():
    r = redis.from_url(REDIS_URL, decode_responses=True)
    msg = r.brpop("jobs:queue", timeout=5)
    if not msg:
        return

    _, payload = msg
    job = json.loads(payload)
    job_id   = job["job_id"]
    sql      = _normalize_sql(job["sql"])
    page_sz  = int(job.get("page_size", 5000))
    max_rows = int(job.get("max_rows", 5_000_000))
    bucket   = job.get("gcs_bucket", GCS_BUCKET)

    # NEW meta (optional)
    title         = (job.get("title") or "").strip()
    table_config  = job.get("table_config") or ""
    chart_config  = job.get("chart_config") or ""
    def _parse_json(s):
        try:
            return json.loads(s) if s else None
        except Exception:
            return s  # keep as string if not valid JSON

    row_count = 0
    total_bytes = 0
    columns = []
    chunks_meta = []

    try:
        with _mssql_conn() as cx:
            # Mark RUNNING immediately in both DB and Redis
            try:
                cx.timeout = MSSQL_QUERY_TIMEOUT  # query timeout (driver-dependent)
            except Exception:
                pass

            _record_event(cx, job_id, "RUNNING", None)
            _update_sql_status(cx, job_id, state="RUNNING", started_at=datetime.utcnow())
            _set_cache_status(r, job_id, "RUNNING", rows=0, bytes_=0)

            cur = cx.cursor()
            cur.execute(sql)
            columns = [d[0] for d in (cur.description or [])]

            client = storage.Client()
            bucket_ref = client.bucket(bucket)
            base_path = f"jobs/{job_id}/"

            def upload_chunk(buf: bytes, idx: int, rows_in_chunk: int):
                nonlocal total_bytes
                if rows_in_chunk <= 0 or not buf:
                    return
                name = f"{base_path}part-{idx:05d}.csv.gz"
                blob = bucket_ref.blob(name)
                blob.upload_from_file(io.BytesIO(buf), size=len(buf), content_type="application/gzip")
                total_bytes += len(buf)
                chunks_meta.append({"uri": f"gs://{bucket}/{name}", "rows": rows_in_chunk, "bytes": len(buf)})

            # --- chunk state ---
            idx = 0
            out = io.BytesIO()
            gz = gzip.GzipFile(fileobj=out, mode="wb")
            text = io.TextIOWrapper(gz, encoding="utf-8", newline="")
            writer = csv.writer(text)
            # writer.writerow(columns)  # header

            rows_in_chunk = 0
            last_flush = time.time()

            def rotate_chunk():
                nonlocal out, gz, text, writer, idx, rows_in_chunk
                text.flush()
                gz.close()
                data = out.getvalue()
                upload_chunk(data, idx, rows_in_chunk)
                idx += 1
                out = io.BytesIO()
                gz = gzip.GzipFile(fileobj=out, mode="wb")
                text = io.TextIOWrapper(gz, encoding="utf-8", newline="")
                writer = csv.writer(text)
                rows_in_chunk = 0

            while True:
                # cooperative cancel
                if r.get(f"jobs:cancelled:{job_id}") == "1":
                    text.flush()
                    gz.close()
                    data = out.getvalue()
                    upload_chunk(data, idx, rows_in_chunk)
                    _record_event(cx, job_id, "CANCELLED", "cancel flag set")
                    _update_sql_status(cx, job_id, state="CANCELLED", completed_at=datetime.utcnow())
                    _set_cache_status(r, job_id, "CANCELLED", rows=row_count, bytes_=total_bytes)
                    return

                batch = cur.fetchmany(page_sz)
                if not batch:
                    break

                for row in batch:
                    writer.writerow(["" if v is None else str(v) for v in row])
                rows_in_chunk += len(batch)
                row_count += len(batch)

                # periodic status cache
                if time.time() - last_flush > 2:
                    _set_cache_status(r, job_id, "RUNNING", rows=row_count, bytes_=total_bytes)
                    last_flush = time.time()

                # rotate chunk by size or max_rows
                text.flush()
                gz.flush()
                if out.tell() >= CHUNK_MB * 1024 * 1024 or row_count >= max_rows:
                    rotate_chunk()
                    if row_count >= max_rows:
                        break

            # finalize last chunk
            text.flush()
            gz.close()
            data = out.getvalue()
            upload_chunk(data, idx, rows_in_chunk)

            # write manifest (now includes meta)
            manifest = {
                "columns": columns,
                "row_count": row_count,
                "format": "csv",
                "compression": "gzip",
                "chunks": chunks_meta,
                "meta": {
                    "title": title,
                    "table_config": _parse_json(table_config),
                    "chart_config": _parse_json(chart_config),
                }
            }
            mblob = storage.Client().bucket(bucket).blob(f"{base_path}manifest.json")
            mbuf = json.dumps(manifest, ensure_ascii=False).encode("utf-8")
            mblob.upload_from_file(io.BytesIO(mbuf), size=len(mbuf), content_type="application/json")

            _record_event(cx, job_id, "SUCCEEDED", None)
            _update_sql_status(cx, job_id,
                               state="SUCCEEDED",
                               completed_at=datetime.utcnow(),
                               row_count=row_count,
                               bytes=total_bytes,
                               gcs_uri=f"gs://{bucket}/{base_path}manifest.json")
            _set_cache_status(r, job_id, "SUCCEEDED", rows=row_count, bytes_=total_bytes)

    except Exception as e:
        err = _short_err(e)
        try:
            with _mssql_conn() as cx2:
                _record_event(cx2, job_id, "FAILED", err)
                _update_sql_status(cx2, job_id,
                                   state="FAILED",
                                   completed_at=datetime.utcnow(),
                                   error_message=err)
        except Exception:
            pass
        _set_cache_status(r, job_id, "FAILED", rows=row_count, bytes_=total_bytes, error=err)
        print(f"job {job_id} FAILED: {err}")

def main():
    while True:
        try:
            run_once()
        except Exception as e:
            print("worker error:", e)
            time.sleep(1)

if __name__ == "__main__":
    main()
