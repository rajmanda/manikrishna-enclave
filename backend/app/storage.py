"""Receipt/document storage on Google Cloud Storage.

Files are proxied through the API (not signed URLs) — receipts are small,
this keeps auth in one place, and the runtime service account needs no
extra signBlob permissions. Bucket objects are never public.
"""

from typing import Any

from fastapi import HTTPException, status

from app.core.config import get_settings

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


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
    blob = _bucket().blob(path)
    blob.upload_from_string(data, content_type=content_type)


def download_object(path: str) -> tuple[bytes, str]:
    blob = _bucket().blob(path)
    if not blob.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")
    blob.reload()
    return blob.download_as_bytes(), blob.content_type or "application/octet-stream"
