from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import CurrentUser, create_access_token
from app.db import get_db
from app.models import Lead, LeadCreate, User, new_id, APIModel
from app.seed import seed_sandbox_community
from app.notification_service import enqueue_notification

router = APIRouter(prefix="/leads", tags=["leads"])

DB = Annotated[Any, Depends(get_db)]

class LeadResponse(APIModel):
    lead: Lead
    access_token: str | None = None
    token_type: str | None = None
    user: User | None = None


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(body: LeadCreate, db: DB) -> LeadResponse:
    """Create a new lead. If it is a Community plan (standard roles), seed a sandbox. If Custom plan ('other' role), skip seeding."""
    # 1. Store Lead
    lead = Lead(
        name=body.name,
        phone=body.phone,
        email=body.email,
        community_name=body.community_name,
        unit_count=body.unit_count,
        role=body.role,
        created_at=datetime.utcnow().isoformat() + "Z",
    )
    await db.leads.insert_one(lead.model_dump())

    # 2. Enqueue WhatsApp notification to Raj Manda
    try:
        lead_type = "Custom Enterprise Plan (No Sandbox)" if body.role == "other" else "Community Plan (Sandbox Seeded)"
        message_body = (
            f"🔔 *New Lead Captured on NivaasOS!*\n\n"
            f"👤 *Name*: {body.name}\n"
            f"📧 *Email*: {body.email}\n"
            f"📞 *Phone*: {body.phone}\n"
            f"🏢 *Society*: {body.community_name}\n"
            f"🔢 *Units*: {body.unit_count or 'N/A'}\n"
            f"💼 *Role*: {body.role or 'N/A'}\n"
            f"💻 *Type*: {lead_type}"
        )
        await enqueue_notification(
            db=db,
            community_id="mke",
            recipient_type="admin",
            recipient_name="Raj Manda",
            channel="whatsapp",
            event_type="lead_captured",
            title="New NivaasOS Lead",
            message=message_body,
            recipient_phone="+13158775699",
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to enqueue WhatsApp notification: {e}")

    # 3. Check if we should skip sandbox spin up (Custom Plan / "other" role)
    if body.role == "other":
        return LeadResponse(lead=lead)

    # 4. Check for existing user with this email to avoid duplicate key errors
    existing_user = await db.users.find_one({"email": body.email})
    if existing_user:
        old_com_id = existing_user.get("community_id")
        if old_com_id == "mke":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already associated with a resident account in Mani Krishna Enclave. Please log in or use a different email to create a sandbox."
            )
        elif old_com_id and old_com_id.startswith("com-"):
            # Purge the old sandbox database contents for this email
            collections_to_clean = [
                "users",
                "apartments",
                "accounts",
                "invoices",
                "expenses",
                "vendors",
                "payments",
                "work_orders",
                "reserve_fund",
                "polls",
                "documents",
                "meetings",
            ]
            for coll_name in collections_to_clean:
                await db[coll_name].delete_many({"community_id": old_com_id})
            await db.communities.delete_one({"id": old_com_id})

    # 5. Generate a custom community ID
    community_id = new_id("com")

    # 4. Seed sandbox community records
    await seed_sandbox_community(
        db=db,
        community_id=community_id,
        community_name=body.community_name,
        admin_email=body.email,
        admin_name=body.name,
        admin_phone=body.phone,
        role=body.role,
        unit_count=body.unit_count,
    )

    # 5. Generate user JWT access token for instant login
    user_role = body.role if body.role in ("property_manager", "community_admin") else "property_manager"
    user = User(
        id="u-admin",
        community_id=community_id,
        name=body.name,
        email=body.email,
        role=user_role,
        roles=[user_role, "owner"],
        phone=body.phone,
        apartment_id=None,
        apartment_ids=[],
    )

    access_token = create_access_token(user)
    return LeadResponse(
        lead=lead,
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


@router.get("", response_model=list[Lead])
async def list_leads(db: DB, user: CurrentUser) -> list[Lead]:
    """Retrieve all leads (Admin/Property Manager only)."""
    if user.role not in ("super_admin", "property_manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators or property managers can retrieve leads.",
        )
        
    cursor = db.leads.find().sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [Lead.model_validate(doc) for doc in docs]
