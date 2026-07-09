import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from app import db as database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cleanup_sandboxes")

COLLECTIONS_WITH_COMMUNITY_ID = [
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

async def cleanup_expired_sandboxes(db: Any, age_days: int = 30) -> None:
    """Finds all sandbox communities older than age_days and deletes their records."""
    cutoff_time = datetime.utcnow() - timedelta(days=age_days)
    
    # Query for all sandbox communities (id starting with "com-")
    cursor = db.communities.find({"id": {"$regex": "^com-"}})
    communities = await cursor.to_list(length=1000)
    
    expired_count = 0
    for com in communities:
        com_id = com["id"]
        created_at_str = com.get("created_at")
        
        if not created_at_str:
            # If no created_at timestamp is present (older trials), use a default/safe deletion assumption
            created_at = datetime.min
        else:
            try:
                # Parse ISO timestamp (e.g. 2026-07-09T17:24:39Z)
                # Strip 'Z' suffix to parse as datetime
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception as e:
                logger.error(f"Error parsing created_at for community {com_id}: {e}")
                continue
        
        if created_at < cutoff_time:
            logger.info(f"Expiring sandbox community '{com_id}' ('{com.get('name')}') created at {created_at_str}")
            
            # 1. Delete records in all related collections
            for coll_name in COLLECTIONS_WITH_COMMUNITY_ID:
                result = await db[coll_name].delete_many({"community_id": com_id})
                if result.deleted_count > 0:
                    logger.info(f"  Deleted {result.deleted_count} documents from '{coll_name}'")
            
            # 2. Delete the community record itself
            await db.communities.delete_one({"id": com_id})
            logger.info(f"  Deleted community '{com_id}'")
            
            expired_count += 1

    logger.info(f"Cleanup completed. Total sandboxes expired: {expired_count}")


async def main() -> None:
    db = database.connect()
    try:
        await cleanup_expired_sandboxes(db, age_days=30)
    except Exception as e:
        logger.exception(f"Unhandled error in cleanup cron job: {e}")
    finally:
        database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
