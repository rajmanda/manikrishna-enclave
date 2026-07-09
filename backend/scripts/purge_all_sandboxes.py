#!/usr/bin/env python3
"""Purge all sandbox communities (ID starting with 'com-') and all their associated records.

WARNING: This will completely delete all sandbox data from the database.
"""

import asyncio
import os
import sys

# Add parent directory to sys.path to allow running from scripts/ directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Programmatically load .env from the parent directory so configuration resolves correctly
from dotenv import load_dotenv
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path)

from app import db as database

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

async def purge_all_sandboxes() -> None:
    db = database.connect()
    try:
        # Find all communities starting with "com-"
        cursor = db.communities.find({"id": {"$regex": "^com-"}})
        communities = await cursor.to_list(length=1000)
        
        if not communities:
            print("No sandbox communities found. Database is already clean.")
            return

        print(f"Found {len(communities)} sandbox communities to delete:")
        for com in communities:
            print(f"  - {com['id']} ({com.get('name', 'Unnamed')})")
        
        # Check for force flag
        force = "--force" in sys.argv or "-y" in sys.argv
        if not force:
            print("\nWARNING: This will permanently delete all records for these communities.")
            try:
                confirm = input("Are you sure you want to proceed? (yes/no): ").strip().lower()
            except KeyboardInterrupt:
                print("\nPurge cancelled.")
                return
            if confirm != "yes":
                print("Purge cancelled.")
                return

        print("\nStarting purge...")
        for com in communities:
            com_id = com["id"]
            print(f"Purging community '{com_id}'...")
            
            # Delete from related collections
            for coll in COLLECTIONS_WITH_COMMUNITY_ID:
                res = await db[coll].delete_many({"community_id": com_id})
                if res.deleted_count > 0:
                    print(f"  - Deleted {res.deleted_count} documents from '{coll}'")
            
            # Delete from communities collection
            res = await db.communities.delete_one({"id": com_id})
            print(f"  - Deleted community record '{com_id}'")

        print("\nPurge completed successfully.")
    except Exception as e:
        print(f"Error executing purge: {e}", file=sys.stderr)
    finally:
        database.disconnect()

if __name__ == "__main__":
    asyncio.run(purge_all_sandboxes())
