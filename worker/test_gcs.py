# test_gcs.py
import os, io, gzip, time
from google.cloud import storage

bucket = os.environ["GCS_BUCKET"]
client = storage.Client()  # uses GOOGLE_APPLICATION_CREDENTIALS
blob_name = f"jobs/_smoke/{int(time.time())}.txt.gz"

buf = io.BytesIO()
with gzip.GzipFile(fileobj=buf, mode="wb") as gz:
    gz.write(b"hello from python worker")

blob = client.bucket(bucket).blob(blob_name)
blob.upload_from_file(io.BytesIO(buf.getvalue()), content_type="application/gzip")
print("Uploaded gs://%s/%s" % (bucket, blob_name))
