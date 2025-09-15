# message-handler/app.py  (broker)
import logging
import os
import time
import uuid
from concurrent import futures

import grpc

import flag_pb2 as pb
import flag_pb2_grpc as pb_grpc

# ---- Logging ----
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s.%(msecs)03f %(levelname)s message-handler %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("message-handler")


class FlagController(pb_grpc.FlagControllerServicer):
    def __init__(self, target: str):
        """target like '10.0.0.12:50052' (python-app)"""
        self._target = target
        self._channel = grpc.insecure_channel(target)
        self._flag_stub = pb_grpc.FlagServiceStub(self._channel)
        logger.info("Connected to python-app (flag) target=%s", target)

    def SetAndRead(self, request, context):
        req_id = request.request_id or str(uuid.uuid4())
        t0 = time.perf_counter()
        try:
            resp = self._flag_stub.SetFlagAndGet(
                pb.FlagMutationRequest(target_value=request.target_value, request_id=req_id),
                timeout=5.0,
                metadata=(("x-request-id", req_id),),
            )
            ms = (time.perf_counter() - t0) * 1000.0
            logger.info("flag proxy ok request_id=%s value=%s latency_ms=%.2f", req_id, resp.value, ms)
            return pb.ControllerResponse(value=resp.value, status=resp.status, error_message=resp.error_message)
        except grpc.RpcError as e:
            logger.error("flag proxy error request_id=%s code=%s details=%s", req_id, e.code().name, e.details())
            return pb.ControllerResponse(
                value=0, status="ERROR",
                error_message=f"Downstream error: {e.code().name}: {e.details()}"
            )


class SqlController(pb_grpc.SqlControllerServicer):
    def __init__(self, target: str):
        self._target = target
        self._channel = grpc.insecure_channel(target)
        self._sql_stub = pb_grpc.SqlServiceStub(self._channel)
        logger.info("Connected to python-app (sql) target=%s", target)

    def Run(self, request, context):
        req_id = request.request_id or str(uuid.uuid4())
        logger.info("sql proxy start request_id=%s page_size=%s", req_id, request.page_size or 0)
        try:
            stream = self._sql_stub.Execute(
                pb.SqlRequest(sql=request.sql, page_size=request.page_size, request_id=req_id),
                timeout=300.0,  # overall deadline for long queries
                metadata=(("x-request-id", req_id),),
            )
            for chunk in stream:
                yield chunk
            logger.info("sql proxy done request_id=%s", req_id)
        except grpc.RpcError as e:
            logger.error("sql proxy error request_id=%s code=%s details=%s", req_id, e.code().name, e.details())
            context.set_code(e.code())
            context.set_details(e.details())


def serve():
    port = int(os.getenv("MH_PORT", "50051"))
    py_host = os.getenv("PYAPP_HOST", "127.0.0.1")
    py_port = int(os.getenv("PYAPP_PORT", "50052"))
    target = f"{py_host}:{py_port}"

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16))
    pb_grpc.add_FlagControllerServicer_to_server(FlagController(target), server)
    pb_grpc.add_SqlControllerServicer_to_server(SqlController(target), server)

    server.add_insecure_port(f"[::]:{port}")
    logger.info("Message-handler listening port=%d, upstream target=%s", port, target)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
