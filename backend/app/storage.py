"""Receipt/document storage on Google Cloud Storage.

Files are proxied through the API (not signed URLs) — receipts are small,
this keeps auth in one place, and the runtime service account needs no
extra signBlob permissions. Bucket objects are never public.

Local development (DEV_MODE with no GCS_BUCKET) stores files on disk under
backend/.local_media so upload/download flows can be tested end-to-end
without GCS credentials. Production keeps the hard 503 when unconfigured.
"""

from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.core.config import get_settings

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

LOCAL_MEDIA_DIR = Path(__file__).resolve().parent.parent / ".local_media"


def _use_local_disk() -> bool:
    settings = get_settings()
    return not settings.gcs_bucket and settings.dev_mode


def _local_path(path: str) -> Path:
    # Object paths embed user-supplied filenames — never let them escape the
    # media dir on disk.
    target = (LOCAL_MEDIA_DIR / path).resolve()
    if not target.is_relative_to(LOCAL_MEDIA_DIR.resolve()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid file path")
    return target


def _bucket() -> Any:
    from google.cloud import storage as gcs

    settings = get_settings()
    if not settings.gcs_bucket:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage is not configured (GCS_BUCKET unset)",
        )
    return gcs.Client().bucket(settings.gcs_bucket)


def validate_upload(content_type: str | None, size: int) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, JPEG, PNG or WebP receipts are allowed",
        )
    if size > MAX_FILE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10 MB"
        )


def upload_object(path: str, data: bytes, content_type: str) -> None:
    if _use_local_disk():
        target = _local_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.with_suffix(target.suffix + ".ctype").write_text(content_type)
        return
    blob = _bucket().blob(path)
    blob.upload_from_string(data, content_type=content_type)


def download_object(path: str) -> tuple[bytes, str]:
    if _use_local_disk():
        target = _local_path(path)
        if not target.is_file():
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")
        ctype_file = target.with_suffix(target.suffix + ".ctype")
        content_type = (
            ctype_file.read_text() if ctype_file.is_file() else "application/octet-stream"
        )
        return target.read_bytes(), content_type
    blob = _bucket().blob(path)
    if not blob.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")
    blob.reload()
    return blob.download_as_bytes(), blob.content_type or "application/octet-stream"
