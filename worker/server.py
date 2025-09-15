# python-app/app.py
import logging
import os
import threading
import time
import uuid
from concurrent import futures
from datetime import datetime, timezone

import grpc
import pyodbc
from google.protobuf import timestamp_pb2

import flag_pb2 as pb
import flag_pb2_grpc as pb_grpc

from dotenv import load_dotenv
load_dotenv()

# ---- Logging setup ----
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s.%(msecs)03f %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("python-app")

# ---- In-memory flag (keep from your prototype) ----
_FLAG_LOCK = threading.Lock()
_FLAG_VALUE = 0

# ---- MSSQL connection pool (single shared connection) ----
_CONN_LOCK = threading.Lock()
_CONN = None

def _connect_mssql():
    """
    Build a single shared pyodbc connection.
    Env:
      MSSQL_HOST (required) e.g. 35.184.80.250
      MSSQL_DB   (required) e.g. scopus
      MSSQL_USER (required)
      MSSQL_PWD  (required)
      MSSQL_DRIVER (optional) default: ODBC Driver 17 for SQL Server
      MSSQL_TIMEOUT (optional) connect timeout seconds (default 10)
    """
    global _CONN
    with _CONN_LOCK:
        if _CONN is not None:
            return _CONN
        host = os.getenv("MSSQL_HOST", "127.0.0.1")
        db   = os.getenv("MSSQL_DB", "")
        user = os.getenv("MSSQL_USER", "")
        pwd  = os.getenv("MSSQL_PWD", "")
        driver = os.getenv("MSSQL_DRIVER", "ODBC Driver 17 for SQL Server")
        timeout = int(os.getenv("MSSQL_TIMEOUT", "10"))
        if not (host and db and user and pwd):
            raise RuntimeError("MSSQL env vars (MSSQL_HOST/DB/USER/PWD) are required")

        conn_str = (
            f"DRIVER={{{driver}}};SERVER={host};DATABASE={db};UID={user};PWD={pwd};"
            f"TrustServerCertificate=Yes;ApplicationIntent=ReadOnly;"
        )
        logger.info("Opening MSSQL connection host=%s db=%s driver='%s'", host, db, driver)
        _CONN = pyodbc.connect(conn_str, timeout=timeout, autocommit=True)
        return _CONN

def _normalize_sql(sql_text: str) -> str:
    """Remove 'USE ...' and 'GO' batch separators; run within the configured DB."""
    out_lines = []
    for line in sql_text.splitlines():
        s = line.strip()
        if not s:
            continue
        u = s.upper()
        if u == "GO":
            continue
        if u.startswith("USE "):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)

def _cell_to_str(x) -> str:
    if x is None:
        return ""
    # datetime/date/time
    try:
        from datetime import datetime as _dt, date as _d, time as _t
        if isinstance(x, (_dt, _d, _t)):
            return x.isoformat()
    except Exception:
        pass
    # bytes -> utf-8
    if isinstance(x, (bytes, bytearray)):
        try:
            return bytes(x).decode("utf-8", errors="replace")
        except Exception:
            return repr(x)
    return str(x)

class FlagService(pb_grpc.FlagServiceServicer):
    def SetFlagAndGet(self, request, context):
        global _FLAG_VALUE

        started = time.perf_counter()
        peer = context.peer()  # e.g., "ipv4:10.0.0.5:56312"

        # Prefer request.request_id; fallback to incoming metadata; else generate one
        try:
            md = {k.lower(): v for k, v in (context.invocation_metadata() or [])}
        except Exception:
            md = {}
        req_id = request.request_id or md.get("x-request-id") or str(uuid.uuid4())

        logger.info(
            "Inbound SetFlagAndGet start request_id=%s peer=%s target_value=%s",
            req_id, peer, request.target_value
        )

        try:
            with _FLAG_LOCK:
                old_val = _FLAG_VALUE
                _FLAG_VALUE = int(request.target_value)
                changed = (old_val != _FLAG_VALUE)

            ts = timestamp_pb2.Timestamp()
            ts.FromDatetime(datetime.now(timezone.utc))

            total_ms = (time.perf_counter() - started) * 1000.0
            logger.info(
                "SetFlagAndGet ok request_id=%s old_value=%s new_value=%s changed=%s latency_ms=%.2f",
                req_id, old_val, _FLAG_VALUE, changed, total_ms
            )

            return pb.FlagState(
                value=_FLAG_VALUE,
                updated_at=ts,
                status="OK",
                error_message=""
            )

        except Exception as e:
            total_ms = (time.perf_counter() - started) * 1000.0
            logger.error(
                "SetFlagAndGet error request_id=%s error=%s latency_ms=%.2f",
                req_id, repr(e), total_ms
            )
            return pb.FlagState(
                value=_FLAG_VALUE,
                status="ERROR",
                error_message=str(e)
            )

class SqlService(pb_grpc.SqlServiceServicer):
    def Execute(self, request, context):
        req_id = request.request_id or str(uuid.uuid4())
        peer = context.peer()
        sql = _normalize_sql(request.sql or "")
        page_size = int(request.page_size or 500)
        if page_size <= 0:
            page_size = 500

        t0 = time.perf_counter()
        logger.info("sql start request_id=%s peer=%s page_size=%d", req_id, peer, page_size)

        try:
            conn = _connect_mssql()
            cur = conn.cursor()
            # Optional query timeout per request
            try:
                cur.timeout = int(os.getenv("MSSQL_QUERY_TIMEOUT", "60"))
            except Exception:
                pass

            cur.execute(sql)

            # Build schema
            cols = [d[0] for d in (cur.description or [])]
            schema = pb.TableSchema(columns=cols)

            # Stream rows in chunks
            total = 0
            while True:
                rows = cur.fetchmany(page_size)
                if not rows:
                    break
                chunk_rows = [pb.SqlRow(cells=[_cell_to_str(c) for c in row]) for row in rows]
                total += len(chunk_rows)
                yield pb.SqlChunk(schema=schema, rows=chunk_rows, status="OK", error_message="", last=False)

            ms = (time.perf_counter() - t0) * 1000.0
            logger.info("sql done request_id=%s rows=%d latency_ms=%.2f", req_id, total, ms)
            yield pb.SqlChunk(schema=schema, rows=[], status="OK", error_message="", last=True)

        except Exception as e:
            ms = (time.perf_counter() - t0) * 1000.0
            logger.error("sql error request_id=%s err=%s latency_ms=%.2f", req_id, repr(e), ms)
            # Send an ERROR chunk then end stream
            yield pb.SqlChunk(schema=pb.TableSchema(columns=[]), rows=[], status="ERROR",
                              error_message=str(e), last=True)

def serve():
    port = int(os.getenv("APP_PORT", "50052"))
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16))
    pb_grpc.add_FlagServiceServicer_to_server(FlagService(), server)
    pb_grpc.add_SqlServiceServicer_to_server(SqlService(), server)
    server.add_insecure_port(f"[::]:{port}")
    logger.info("Services listening port=%d", port)
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
