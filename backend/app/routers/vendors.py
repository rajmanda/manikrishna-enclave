from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser
from app.db import get_db
from app.models import Vendor

router = APIRouter(prefix="/vendors", tags=["vendors"])

DB = Annotated[Any, Depends(get_db)]


@router.get("", response_model=list[Vendor])
async def list_vendors(db: DB, user: CurrentUser) -> list[Vendor]:
    docs = await db.vendors.find({"community_id": user.community_id}).to_list(
        length=1000
    )
    return [Vendor.model_validate(d) for d in docs]
