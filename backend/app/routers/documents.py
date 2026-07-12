"""Community documents (M4) — versioned files on GCS."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile, status

from app import storage
from app.audit import record_audit
from app.core.security import CurrentUser, require_roles
from app.db import get_db
from app.models import WRITE_ROLES, CommunityDocument

router = APIRouter(prefix="/documents", tags=["documents"])

DB = Annotated[Any, Depends(get_db)]
Writer = Depends(require_roles(*WRITE_ROLES))

DOC_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "text/csv": "sheet",
    "application/vnd.ms-excel": "sheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "sheet",
}


def doc_file_type(content_type: str | None) -> str:
    ft = DOC_CONTENT_TYPES.get(content_type or "")
    if ft is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed: PDF, images, CSV/Excel",
        )
    return ft


def visibility_query(user: Any) -> dict:
    """Community docs (no apartment scope) are visible to everyone; docs
    scoped to specific apartments only to their owners/tenants. Managers,
    admins and the auditor see everything."""
    query: dict = {"community_id": user.community_id}
    if user.role in ("owner", "tenant"):
        apts = user.apartment_ids or (
            [user.apartment_id] if user.apartment_id else []
        )
        # $in with None also matches docs missing the field (legacy rows).
        query["$or"] = [
            {"apartment_ids": None},
            {"apartment_ids": []},
            {"apartment_ids": {"$in": apts}},
        ]
    return query


@router.get("", response_model=list[CommunityDocument])
async def list_documents(db: DB, user: CurrentUser) -> list[CommunityDocument]:
    docs = await db.documents.find(visibility_query(user)).to_list(1000)
    docs.sort(key=lambda d: d["uploaded_date"], reverse=True)
    return [CommunityDocument.model_validate(d) for d in docs]


@router.post(
    "",
    response_model=CommunityDocument,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Writer],
)
async def upload_document(
    db: DB,
    user: CurrentUser,
    file: UploadFile,
    title: Annotated[str, Form()],
    category: Annotated[str, Form()],
    apartment_ids: Annotated[str, Form()] = "",
    invoice_id: Annotated[str, Form()] = "",
) -> CommunityDocument:
    data = await file.read()
    if len(data) > storage.MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max 10 MB")
    file_type = doc_file_type(file.content_type)
    scope = [a.strip() for a in apartment_ids.split(",") if a.strip()]
    doc = CommunityDocument(
        community_id=user.community_id,
        title=title.strip(),
        category=category.strip(),
        uploaded_date=date.today().isoformat(),
        size_kb=max(1, len(data) // 1024),
        file_type=file_type,  # type: ignore[arg-type]
        uploaded_by=user.id,
        apartment_ids=scope or None,
        invoice_id=invoice_id.strip() or None,
    )
    path = f"{user.community_id}/documents/{doc.id}/v1-{file.filename or 'file'}"
    storage.upload_object(path, data, file.content_type or "application/octet-stream")
    doc.path = path
    await db.documents.insert_one(doc.model_dump())
    await record_audit(db, user, "create", "documents", doc.id, {"title": doc.title})
    return doc


@router.post(
    "/{document_id}/file",
    response_model=CommunityDocument,
    dependencies=[Writer],
)
async def upload_new_version(
    document_id: str, file: UploadFile, db: DB, user: CurrentUser
) -> CommunityDocument:
    doc = await db.documents.find_one(
        {"id": document_id, "community_id": user.community_id}
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found")
    data = await file.read()
    if len(data) > storage.MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max 10 MB")
    file_type = doc_file_type(file.content_type)
    version = doc.get("version", 1) + 1
    path = f"{user.community_id}/documents/{document_id}/v{version}-{file.filename or 'file'}"
    storage.upload_object(path, data, file.content_type or "application/octet-stream")
    result = await db.documents.find_one_and_update(
        {"id": document_id},
        {
            "$set": {
                "path": path,
                "version": version,
                "file_type": file_type,
                "size_kb": max(1, len(data) // 1024),
                "uploaded_date": date.today().isoformat(),
                "uploaded_by": user.id,
            }
        },
        return_document=True,
    )
    await record_audit(db, user, "update", "documents", document_id, {"version": version})
    return CommunityDocument.model_validate(result)


@router.get("/{document_id}/file")
async def download_document(document_id: str, db: DB, user: CurrentUser) -> Response:
    doc = await db.documents.find_one({"id": document_id, **visibility_query(user)})
    if doc is None or not doc.get("path"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No file attached")
    data, content_type = storage.download_object(doc["path"])
    return Response(content=data, media_type=content_type)


@router.delete(
    "/{document_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Writer]
)
async def delete_document(document_id: str, db: DB, user: CurrentUser) -> None:
    result = await db.documents.delete_one(
        {"id": document_id, "community_id": user.community_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found")
    await record_audit(db, user, "delete", "documents", document_id)
