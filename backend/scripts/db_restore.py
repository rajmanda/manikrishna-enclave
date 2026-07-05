#!/usr/bin/env python3
"""Restore script for Manikrishna Enclave MongoDB database.

Loads a database snapshot JSON file, drops current collections, restores
the data, and rebuilds indexes.

Usage:
    cd backend
    python scripts/db_restore.py [backup_file.json]
"""

import asyncio
import sys
from pathlib import Path
from bson import json_util

# Allow imports from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings
from app.db import ensure_indexes


async def main(backup_path: Path) -> None:
    if not backup_path.exists():
        sys.exit(f"❌ Backup file not found: {backup_path}")

    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.db_name]

    print(f"Reading backup from {backup_path}...")
    try:
        backup_data = json_util.loads(backup_path.read_text(encoding="utf-8"))
    except Exception as e:
        sys.exit(f"❌ Failed to parse backup file: {e}")

    # Confirm with user (skip with --yes for scripted use)
    print(f"\n⚠️ WARNING: This will drop all collections in database '{settings.db_name}' and restore from backup.")
    if "--yes" not in sys.argv:
        confirm = input("Type  yes  to proceed: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            client.close()
            return

    # True snapshot semantics: drop EVERY existing collection, including ones
    # created after the backup was taken (otherwise they'd survive and mix
    # post-backup data into the restored state).
    for existing in await db.list_collection_names():
        if not existing.startswith("system."):
            await db[existing].drop()

    for coll_name, docs in backup_data.items():
        print(f"Restoring '{coll_name}'...")
        if docs:
            await db[coll_name].insert_many(docs)
            print(f"  Restored {len(docs)} documents.")
        else:
            print("  Collection is empty, skipped insertion.")

    # Rebuild indexes
    print("Rebuilding indexes...")
    await ensure_indexes(db)

    print("✅ Restore complete.")
    client.close()


if __name__ == "__main__":
    filepath = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("db_backup.json")
    asyncio.run(main(filepath))
