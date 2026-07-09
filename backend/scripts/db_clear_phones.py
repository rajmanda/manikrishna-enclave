#!/usr/bin/env python3
"""Clear phone numbers for all users except an allowlist.

Sets `phone` to None for every document in the `users` collection whose
`id` is not in KEEP_IDS.

Usage:
    cd backend
    python scripts/db_clear_phones.py [--dry-run] [--yes]
"""

import asyncio
import sys
from pathlib import Path

# Allow imports from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

KEEP_IDS = ["u-raj", "u-402", "u-501", "u-vishnu", "+91 91827 02863"]


async def main() -> None:
    dry_run = "--dry-run" in sys.argv

    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.db_name]

    print(f"Connecting to database: {settings.db_name}...")
    query = {"id": {"$nin": KEEP_IDS}, "phone": {"$ne": None}}
    targets = await db.users.find(query, {"id": 1, "name": 1, "phone": 1}).to_list(length=None)

    if not targets:
        print("No users with phone numbers to clear. Nothing to do.")
        client.close()
        return

    print(f"\nUsers whose phone number will be cleared ({len(targets)}):")
    for u in targets:
        print(f"  {u['id']:<16} {u.get('name', '?')}")
    print(f"\nKeeping phone numbers for: {', '.join(KEEP_IDS)}")

    if dry_run:
        print("\n--dry-run: no changes made.")
        client.close()
        return

    if "--yes" not in sys.argv:
        confirm = input("\nType  yes  to clear these phone numbers: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            client.close()
            return

    result = await db.users.update_many(query, {"$set": {"phone": None}})
    print(f"✅ Cleared phone numbers on {result.modified_count} users.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
