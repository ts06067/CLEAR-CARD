import json, os, time, uuid, hashlib
from datetime import datetime, timezone
from concurrent import futures

import grpc, redis, pyodbc
from google.protobuf import timestamp_pb2

import flag_pb2 as pb
import flag_pb2_grpc as pb_grpc

from dotenv import load_dotenv
load_dotenv()

# ---------- ENV ----------
REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MSSQL_HOST  = os.getenv("MSSQL_HOST")
MSSQL_DB    = os.getenv("MSSQL_DB")
MSSQL_USER  = os.getenv("MSSQL_USER")
MSSQL_PWD   = os.getenv("MSSQL_PWD")
MSSQL_DRIVER= os.getenv("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")

GCS_BUCKET  = os.getenv("GCS_BUCKET", "clearcard-sql-results")

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
    print(conn_str, flush=True)
    return pyodbc.connect(conn_str, autocommit=True, timeout=10)

# ---------- gRPC servicer ----------
class JobService(pb_grpc.JobServiceServicer):
    def __init__(self):
        self.r = redis.from_url(REDIS_URL, decode_responses=True)

    def Submit(self, request, context):
        job_id = str(uuid.uuid4())
        req_id = request.request_id or str(uuid.uuid4())
        user_id = request.user_id or "anonymous"
        sql_raw = request.sql or ""
        sql = _normalize_sql(sql_raw)
        sqlhash = _sql_hash(sql)
        page_size = request.options.page_size or 5000
        max_rows  = request.options.max_rows or 5_000_000
        fmt       = request.options.format or "csv"

        # 1) insert metadata row in MSSQL (state=PENDING)
        with _mssql_conn() as cx:
            cx.cursor().execute("""
                INSERT INTO jobs(job_id,user_id,submitted_at,state,sql_hash,sql_text,format,page_size,max_rows)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, job_id, user_id, datetime.utcnow(), "PENDING", sqlhash, sql, fmt, int(page_size), int(max_rows))

        # 2) push payload to Redis queue
        payload = {
            "job_id": job_id, "user_id": user_id, "sql": sql,
            "page_size": int(page_size), "max_rows": int(max_rows),
            "format": fmt, "gcs_bucket": GCS_BUCKET
        }
        self.r.lpush("jobs:queue", json.dumps(payload))
        # cache status
        self.r.setex(f"jobs:status:{job_id}",
                     24*3600,
                     json.dumps({"state":"PENDING","rows":0,"bytes":0,"updated_at":int(time.time())}))

        return pb.JobAck(job_id=job_id, status="PENDING")

    def GetStatus(self, request, context):
        job_id = request.job_id
        # try Redis first
        cached = self.r.get(f"jobs:status:{job_id}")
        if cached:
            c = json.loads(cached)
            return pb.JobStatus(
                state=c.get("state","PENDING"),
                row_count=int(c.get("rows",0)),
                bytes=int(c.get("bytes",0)),
                error_message=c.get("error",""),
            )
        # fallback to MSSQL
        with _mssql_conn() as cx:
            row = cx.cursor().execute("""
                SELECT state,row_count,bytes,error_message,submitted_at,started_at,completed_at
                FROM jobs WHERE job_id=?
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
            row = cx.cursor().execute("SELECT state,gcs_uri,error_message FROM jobs WHERE job_id=?", job_id).fetchone()
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
        # signal cancel to workers
        self.r.setex(f"jobs:cancelled:{job_id}", 3600, "1")
        # best-effort state update if still pending
        with _mssql_conn() as cx:
            cx.cursor().execute("""
                UPDATE jobs SET state = CASE WHEN state='PENDING' THEN 'CANCELLED' ELSE state END
                WHERE job_id=?
            """, job_id)
        return self.GetStatus(request, context)

def serve():
    port = int(os.getenv("MH_PORT","50051"))
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16))
    pb_grpc.add_JobServiceServicer_to_server(JobService(), server)
    # (You can also keep/add FlagController/SqlController here.)
    server.add_insecure_port(f"[::]:{port}")
    print(f"[broker] JobService listening on :{port}")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
