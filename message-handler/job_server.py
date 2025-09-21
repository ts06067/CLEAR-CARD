# message-handler/job_server.py
import json, os, time, uuid, hashlib
from datetime import datetime, timezone
from concurrent import futures

import grpc, redis, pyodbc
from google.protobuf import timestamp_pb2

# Existing proto bundle (your JobService is in flag*.proto)
import flag_pb2 as pb
import flag_pb2_grpc as pb_grpc

# NEW: SQL streaming controller used by Spring ArticleController
import sql_controller_pb2 as sql_pb2
import sql_controller_pb2_grpc as sql_pb2_grpc

from dotenv import load_dotenv
load_dotenv()

# ---------- ENV ----------
REDIS_URL    = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MSSQL_HOST   = os.getenv("MSSQL_HOST")
MSSQL_DB     = os.getenv("MSSQL_DB")
MSSQL_USER   = os.getenv("MSSQL_USER")
MSSQL_PWD    = os.getenv("MSSQL_PWD")
MSSQL_DRIVER = os.getenv("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")
MSSQL_QUERY_TIMEOUT = int(os.getenv("MSSQL_QUERY_TIMEOUT", "300"))

GCS_BUCKET   = os.getenv("GCS_BUCKET", "clearcard-sql-results")

# ---------- helpers ----------
def _now_ts():
    ts = timestamp_pb2.Timestamp()
    ts.FromDatetime(datetime.now(timezone.utc))
    return ts

def _sql_hash(sql: str) -> str:
    return hashlib.sha256((sql or "").encode("utf-8")).hexdigest()

def _normalize_sql(sql: str) -> str:
    out = []
    for line in (sql or "").splitlines():
        s = line.strip()
        if not s:
            continue
        U = s.upper()
        if U == "GO":
            continue
        if U.startswith("USE "):
            continue
        out.append(line)
    return "\n".join(out)

def _mssql_conn():
    conn_str = (
        f"DRIVER={{{MSSQL_DRIVER}}};SERVER={MSSQL_HOST};DATABASE={MSSQL_DB};"
        f"UID={MSSQL_USER};PWD={MSSQL_PWD};TrustServerCertificate=Yes;"
    )
    print(conn_str, flush=True)  # (kept as-is from your repo)
    # autocommit=True for long streams; timeout is login timeout; statement timeout set on cursor/conn
    return pyodbc.connect(conn_str, autocommit=True, timeout=10)

# ---------- gRPC: JobService (unchanged API) ----------
class JobService(pb_grpc.JobServiceServicer):
    def __init__(self):
        self.r = redis.from_url(REDIS_URL, decode_responses=True)

    def Submit(self, request, context):
        job_id  = str(uuid.uuid4())
        req_id  = request.request_id or str(uuid.uuid4())
        user_id = request.user_id or "anonymous"

        print(f"[broker] Submit job {job_id} for user {user_id} (req {req_id})", flush=True)

        # core fields
        sql_raw   = request.sql or ""
        sql       = _normalize_sql(sql_raw)
        sqlhash   = _sql_hash(sql)
        page_size = request.options.page_size or 5000
        max_rows  = request.options.max_rows or 5_000_000
        fmt       = request.options.format or "csv"

        # metadata
        title      = (request.title or "").strip()
        table_cfg  = request.table_config_json or ""
        chart_cfg  = request.chart_config_json or ""

        print(f"Title: {title}", flush=True)

        # 1) insert row in MSSQL (state=PENDING)
        with _mssql_conn() as cx:
            cx.cursor().execute("""
                INSERT INTO dbo.jobs
                  (job_id,user_id,submitted_at,state,sql_hash,sql_text,format,page_size,max_rows)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, job_id, user_id, datetime.utcnow(), "PENDING", sqlhash, sql, fmt, int(page_size), int(max_rows))

        # 2) push payload to Redis for worker
        payload = {
            "job_id": job_id,
            "user_id": user_id,
            "sql": sql,
            "page_size": int(page_size),
            "max_rows": int(max_rows),
            "format": fmt,
            "gcs_bucket": GCS_BUCKET,
            "title": title,
            "table_config": table_cfg,
            "chart_config": chart_cfg,
        }
        self.r.lpush("jobs:queue", json.dumps(payload))

        # warm cache
        self.r.setex(f"jobs:status:{job_id}", 24*3600,
                     json.dumps({"state": "PENDING", "rows": 0, "bytes": 0, "updated_at": int(time.time())}))

        return pb.JobAck(job_id=job_id, status="PENDING")

    def GetStatus(self, request, context):
        job_id = request.job_id
        cached = self.r.get(f"jobs:status:{job_id}")
        if cached:
            c = json.loads(cached)
            return pb.JobStatus(
                state=c.get("state", "PENDING"),
                row_count=int(c.get("rows", 0)),
                bytes=int(c.get("bytes", 0)),
                error_message=c.get("error", ""),
            )
        with _mssql_conn() as cx:
            row = cx.cursor().execute("""
                SELECT state,row_count,bytes,error_message,submitted_at,started_at,completed_at
                  FROM dbo.jobs WHERE job_id=?
            """, job_id).fetchone()
        if not row:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("job not found")
            return pb.JobStatus()
        st, rc, b, err, sub, sta, cmp = row
        out = pb.JobStatus(state=st or "", row_count=rc or 0, bytes=b or 0, error_message=err or "")
        if sub: out.submitted_at.FromDatetime(sub.replace(tzinfo=timezone.utc))
        if sta: out.started_at.FromDatetime(sta.replace(tzinfo=timezone.utc))
        if cmp: out.completed_at.FromDatetime(cmp.replace(tzinfo=timezone.utc))
        return out

    def GetResultManifest(self, request, context):
        job_id = request.job_id
        with _mssql_conn() as cx:
            row = cx.cursor().execute(
                "SELECT state,gcs_uri,error_message FROM dbo.jobs WHERE job_id=?",
                job_id
            ).fetchone()
        if not row:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("job not found")
            return pb.ResultManifestRef()
        state, uri, err = row
        if state != "SUCCEEDED" or not uri:
            return pb.ResultManifestRef(status="ERROR", error_message=err or f"job state: {state}")
        return pb.ResultManifestRef(gcs_manifest_uri=uri, status="OK")

    def Cancel(self, request, context):
        job_id = request.job_id
        self.r.setex(f"jobs:cancelled:{job_id}", 3600, "1")
        with _mssql_conn() as cx:
            cx.cursor().execute("""
                UPDATE dbo.jobs
                   SET state = CASE WHEN state='PENDING' THEN 'CANCELLED' ELSE state END
                 WHERE job_id=?
            """, job_id)
        return self.GetStatus(request, context)

# ---------- gRPC: SqlController (NEW; used by Article Explorer) ----------
class SqlController(sql_pb2_grpc.SqlControllerServicer):
    """
    Implements SqlController.Run streaming:
      - first chunk sends Schema(columns=[...])
      - then chunks of rows (as strings)
      - ends with last=True
    Respects request.page_size; normalizes SQL (strip GO/USE).
    """
    def Run(self, request, context):
        req_id = request.request_id or str(uuid.uuid4())
        sql = _normalize_sql(request.sql or "")
        page_size = max(1, min(5000, request.page_size or 1000))

        # Optional: get x-request-id from metadata if present
        try:
            md = dict(context.invocation_metadata() or [])
            req_id = md.get('x-request-id', req_id)
        except Exception:
            pass

        t0 = time.time()
        print(f"[sql] Run start req={req_id} pageSize={page_size}", flush=True)
        try:
            with _mssql_conn() as cx:
                try:
                    cx.timeout = MSSQL_QUERY_TIMEOUT
                except Exception:
                    pass

                cur = cx.cursor()
                cur.execute(sql)
                columns = [d[0] for d in (cur.description or [])]

                # send schema once
                yield sql_pb2.SqlChunk(schema=sql_pb2.Schema(columns=columns), status="OK", last=False)

                # stream rows
                while True:
                    if not context.is_active():
                        print(f"[sql] client cancelled req={req_id}", flush=True)
                        break
                    batch = cur.fetchmany(page_size)
                    if not batch:
                        break
                    rows = [sql_pb2.Row(cells=["" if v is None else str(v) for v in r]) for r in batch]
                    yield sql_pb2.SqlChunk(rows=rows, status="OK", last=False)

                yield sql_pb2.SqlChunk(status="OK", last=True)

        except Exception as e:
            print(f"[sql] error req={req_id}: {e}", flush=True)
            yield sql_pb2.SqlChunk(status="ERROR", error_message=str(e), last=True)
        finally:
            print(f"[sql] Run end req={req_id} dur={time.time()-t0:.3f}s", flush=True)

def serve():
    port = int(os.getenv("MH_PORT", "50051"))
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16),
                         options=[('grpc.max_send_message_length', 64*1024*1024),
                                  ('grpc.max_receive_message_length', 64*1024*1024)])
    pb_grpc.add_JobServiceServicer_to_server(JobService(), server)
    sql_pb2_grpc.add_SqlControllerServicer_to_server(SqlController(), server)  # NEW
    server.add_insecure_port(f"[::]:{port}")
    print(f"[broker] JobService + SqlController listening on :{port}")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
