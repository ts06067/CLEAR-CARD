# Base: Debian 12 (bookworm)
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    ACCEPT_EULA=Y \
    PATH="/opt/mssql-tools18/bin:${PATH}"

# unixODBC + Microsoft repo (no apt-key) + msodbcsql18 + build tools for pyodbc
RUN set -eux; \
    apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
        unixodbc unixodbc-dev \
        build-essential \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/msprod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/msprod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends msodbcsql18 mssql-tools18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (grpc + pyodbc, etc.)
RUN pip install --no-cache-dir \
      grpcio grpcio-tools protobuf \
      pyodbc redis python-dotenv

# App code + protos
COPY job_server.py /app/
COPY protos /app/protos

# Generate gRPC stubs from protos
RUN python -m grpc_tools.protoc -I protos --python_out=. --grpc_python_out=. protos/flag.proto protos/sql_controller.proto

EXPOSE 50051
CMD ["python", "-X", "dev", "/app/job_server.py"]