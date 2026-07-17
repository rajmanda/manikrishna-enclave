from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import require_roles
from app.db import get_db, ensure_indexes

router = APIRouter(prefix="/dev", tags=["dev"])

DB = Annotated[Any, Depends(get_db)]
SuperAdmin = Depends(require_roles())


@router.post("/refresh-db", dependencies=[SuperAdmin])
async def refresh_dev_db(db: DB) -> dict[str, str]:
    """DEV ONLY — drops all local dev collections and copies them from prod (communityhub)."""
    settings = get_settings()

    # Safety checks
    if not settings.dev_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev mode is disabled."
        )
    if settings.environment != "dev":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Refusing to refresh database outside of dev environment."
        )
    if settings.db_name == "communityhub":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety check failed: current database is communityhub (prod). Refusing to overwrite production."
        )

    try:
        # Get the same AsyncIOMotorClient instance to access both databases
        client = db.client
        src_db = client["communityhub"]
        dst_db = db

        # Retrieve all collections from production source
        names = sorted(await src_db.list_collection_names())
        names = [n for n in names if not n.startswith("system.")]

        if not names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Production database has no collections or cannot be reached."
            )

        # True mirror: also drop dev-only collections (ones prod doesn't have
        # yet, e.g. a new feature's collection like `credits`) — otherwise
        # their stale data silently survives every refresh.
        dst_names = [
            n for n in await dst_db.list_collection_names()
            if not n.startswith("system.")
        ]
        for name in set(dst_names) - set(names):
            await dst_db[name].drop()

        for name in names:
            # 1. Drop target dev collection
            await dst_db[name].drop()

            # 2. Copy documents in batches of 500
            batch = []
            async for doc in src_db[name].find({}):
                batch.append(doc)
                if len(batch) >= 500:
                    await dst_db[name].insert_many(batch)
                    batch = []
            if batch:
                await dst_db[name].insert_many(batch)

            # 3. Copy indexes
            indexes = await src_db[name].index_information()
            for idx_name, spec in indexes.items():
                if idx_name == "_id_":
                    continue
                keys = spec["key"]
                kwargs = {"name": idx_name}
                if spec.get("unique"):
                    kwargs["unique"] = True
                await dst_db[name].create_index(
                    list(keys.items()) if isinstance(keys, dict) else keys,
                    **kwargs
                )

        # Ensure all standard indexes are built
        await ensure_indexes(dst_db)

        return {
            "status": "success",
            "message": f"Successfully refreshed dev database '{settings.db_name}' with data from 'communityhub'."
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database refresh failed: {str(e)}"
        )
