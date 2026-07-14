import os
import pytest
from app.notification_service import enqueue_notification
from app.core.config import get_settings
from scripts.whatsapp_notification_poller import resolve_recipient, parse_notification

@pytest.mark.asyncio
async def test_notification_enqueue_captures_environment(db):
    settings = get_settings()
    # Save the original environment to restore it later
    orig_env = settings.environment
    
    try:
        # Test 1: Env set to 'dev'
        settings.environment = "dev"
        doc = await enqueue_notification(
            db,
            community_id="mke",
            recipient_type="group",
            recipient_name="Test Group",
            recipient_phone="group",
            channel="whatsapp",
            event_type="announcement_posted",
            title="Dev Announcement",
            message="This is a dev test",
        )
        assert doc["environment"] == "dev"
        
        # Verify in database
        db_doc = await db.notification_queue.find_one({"notification_id": doc["notification_id"]})
        assert db_doc is not None
        assert db_doc["environment"] == "dev"

        # Test 2: Env set to 'production'
        settings.environment = "production"
        doc_prod = await enqueue_notification(
            db,
            community_id="mke",
            recipient_type="group",
            recipient_name="Test Group",
            recipient_phone="group",
            channel="whatsapp",
            event_type="announcement_posted",
            title="Prod Announcement",
            message="This is a prod test",
        )
        assert doc_prod["environment"] == "production"
        
        # Verify in database
        db_doc_prod = await db.notification_queue.find_one({"notification_id": doc_prod["notification_id"]})
        assert db_doc_prod is not None
        assert db_doc_prod["environment"] == "production"

    finally:
        settings.environment = orig_env


def test_poller_parse_notification_includes_env():
    raw_notification = {
        "notificationId": "ntf-12345",
        "recipientPhone": "group",
        "message": "Hello community",
        "environment": "sandbox"
    }
    nid, phone, message, env = parse_notification(raw_notification)
    assert nid == "ntf-12345"
    assert phone == "group"
    assert message == "Hello community"
    assert env == "sandbox"


def test_poller_resolve_recipient_by_environment():
    # Store original env vars to restore later
    orig_prod_jid = os.environ.get("OPENCLAW_WHATSAPP_GROUP_JID")
    orig_dev_jid = os.environ.get("OPENCLAW_WHATSAPP_DEV_GROUP_JID")

    try:
        # Define some mock group JIDs
        prod_override = "prod-group-override@g.us"
        dev_override = "dev-group-override@g.us"

        # Set env vars
        os.environ["OPENCLAW_WHATSAPP_GROUP_JID"] = prod_override
        os.environ["OPENCLAW_WHATSAPP_DEV_GROUP_JID"] = dev_override

        # Test 1: Production env should use production override
        assert resolve_recipient("group", env="production") == prod_override
        assert resolve_recipient("group", env="PROD") == prod_override
        assert resolve_recipient("group", env=None) == prod_override

        # Test 2: Non-production environments should use dev override
        assert resolve_recipient("group", env="dev") == dev_override
        assert resolve_recipient("group", env="development") == dev_override
        assert resolve_recipient("group", env="sandbox") == dev_override
        assert resolve_recipient("group", env="staging") == dev_override

        # Test 3: Normal phone numbers shouldn't be touched regardless of env
        assert resolve_recipient("+1234567890", env="dev") == "+1234567890"

        # Test 4: Default fallbacks when env vars are unset
        del os.environ["OPENCLAW_WHATSAPP_GROUP_JID"]
        del os.environ["OPENCLAW_WHATSAPP_DEV_GROUP_JID"]
        
        # When env vars are deleted, we should get the defaults from constants
        # Default group and default dev group are configured as "120363426724252289@g.us" in whatsapp_notification_poller.py
        from scripts.whatsapp_notification_poller import DEFAULT_GROUP_JID, DEFAULT_DEV_GROUP_JID
        assert resolve_recipient("group", env="production") == DEFAULT_GROUP_JID
        assert resolve_recipient("group", env="dev") == DEFAULT_DEV_GROUP_JID

    finally:
        # Restore env vars
        if orig_prod_jid is not None:
            os.environ["OPENCLAW_WHATSAPP_GROUP_JID"] = orig_prod_jid
        else:
            os.environ.pop("OPENCLAW_WHATSAPP_GROUP_JID", None)

        if orig_dev_jid is not None:
            os.environ["OPENCLAW_WHATSAPP_DEV_GROUP_JID"] = orig_dev_jid
        else:
            os.environ.pop("OPENCLAW_WHATSAPP_DEV_GROUP_JID", None)
