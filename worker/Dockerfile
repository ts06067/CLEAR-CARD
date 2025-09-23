# Base: Debian 12 (bookworm)
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    ACCEPT_EULA=Y \
    GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp/key.json \
    PATH="/opt/mssql-tools18/bin:${PATH}"

# unixODBC + Microsoft repo (no apt-key) + ODBC Driver 18 (+tools) + build deps for pyodbc
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

# Python deps
RUN pip install --no-cache-dir \
      pyodbc redis google-cloud-storage python-dotenv grpcio grpcio-tools

# (Optional) remove build chain to slim image down
RUN set -eux; \
    apt-get purge -y build-essential || true; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

# App code
COPY worker.py /app/
COPY protos /app/protos

# Generate gRPC stubs from protos
RUN python -m grpc_tools.protoc -I protos --python_out=. --grpc_python_out=. protos/flag.proto protos/sql_controller.proto

EXPOSE 50051
CMD ["python","/app/worker.py"]