import os

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "uploads")

USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

if not USE_SUPABASE:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_upload(file_obj, filename: str, content_type: str = "application/octet-stream") -> str:
    """Persist an uploaded file and return its URL.

    Local disk: returns a path relative to the API root (e.g. "/uploads/x.jpg"),
    served by the StaticFiles mount in main.py.
    Supabase Storage: returns the full public object URL.
    """
    data = file_obj.read()

    if USE_SUPABASE:
        import requests
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=data,
            timeout=15,
        )
        resp.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"

    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return f"/{UPLOAD_DIR}/{filename}"
