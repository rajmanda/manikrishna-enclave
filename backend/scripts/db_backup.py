#!/usr/bin/env python3
"""Backup script for Manikrishna Enclave MongoDB database.

Saves all collections in the database to a JSON file using bson.json_util
to preserve BSON types (like dates, numbers, etc.).

Usage:
    cd backend
    python scripts/db_backup.py [--baseline] [custom_name.json]
"""

import asyncio
import datetime
import sys
from pathlib import Path
from bson import json_util

# Allow imports from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings


async def main(backup_path: Path) -> None:
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.db_name]

    print(f"Connecting to database: {settings.db_name}...")
    collections = await db.list_collection_names()

    # Filter out system collections
    collections = [c for c in collections if not c.startswith("system.")]

    backup_data = {}

    for coll_name in collections:
        cursor = db[coll_name].find({})
        docs = await cursor.to_list(length=None)
        backup_data[coll_name] = docs
        print(f"  Collected {len(docs)} documents from '{coll_name}'")

    print(f"Writing backup to {backup_path}...")
    json_data = json_util.dumps(backup_data, indent=2)
    backup_path.write_text(json_data, encoding="utf-8")

    print(f"✅ Backup complete: {backup_path}")
    client.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    is_baseline = "--baseline" in args
    args = [a for a in args if a != "--baseline"]

    # Generate timestamped filename
    date_str = datetime.date.today().isoformat()
    suffix = "_baseline" if is_baseline else ""
    default_filename = f"db_backup_{date_str}{suffix}.json"

    if args:
        provided_path = Path(args[0])
        if is_baseline and "_baseline" not in provided_path.stem:
            filepath = provided_path.with_name(f"{provided_path.stem}_baseline{provided_path.suffix}")
        else:
            filepath = provided_path
    else:
        filepath = Path(default_filename)

    asyncio.run(main(filepath))
