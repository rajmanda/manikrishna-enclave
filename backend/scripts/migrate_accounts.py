#!/usr/bin/env python3
"""One-time migration: create Account documents and link users to accounts.

Based on the BOOTSTRAP.md Initial Account Mapping:
  - M.V. Shanmukha Datta → 101
  - Pasupuleti Ramesh Babu & Anjali → 102
  - B.O. Dharani Kumar → 201
  - Vani Padma Sri Manda → 202
  - Bhupendra Krishna Sangam & Subhasri Lakshmi Sangam → 301, 302
  - Kanamatha Reddy & Vani Kanyakaparameswari → 401
  - Vijayaram Sri Venkata Manda & Bhargavi Manda → 402
  - Rajaram Manda Family → 501, 502

Usage:
    python -m scripts.migrate_accounts [--dry-run]
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Allow running as `python -m scripts.migrate_accounts` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

# ── Account definitions ─────────────────────────────────────────────────
COMMUNITY_ID = "mke"

ACCOUNTS = [
    {
        "id": "acct-101",
        "community_id": COMMUNITY_ID,
        "name": "M.V. Shanmukha Datta",
        "apartment_ids": ["apt-101"],
    },
    {
        "id": "acct-102",
        "community_id": COMMUNITY_ID,
        "name": "Pasupuleti Ramesh Babu & Anjali",
        "apartment_ids": ["apt-102"],
    },
    {
        "id": "acct-201",
        "community_id": COMMUNITY_ID,
        "name": "B.O. Dharani Kumar",
        "apartment_ids": ["apt-201"],
    },
    {
        "id": "acct-202",
        "community_id": COMMUNITY_ID,
        "name": "Vani Padma Sri Manda",
        "apartment_ids": ["apt-202"],
    },
    {
        "id": "acct-301",
        "community_id": COMMUNITY_ID,
        "name": "Bhupendra Krishna Sangam & Subhasri Lakshmi Sangam",
        "apartment_ids": ["apt-301", "apt-302"],
    },
    {
        "id": "acct-401",
        "community_id": COMMUNITY_ID,
        "name": "Kanamatha Reddy & Vani Kanyakaparameswari",
        "apartment_ids": ["apt-401"],
    },
    {
        "id": "acct-402",
        "community_id": COMMUNITY_ID,
        "name": "Vijayaram Sri Venkata Manda & Bhargavi Manda",
        "apartment_ids": ["apt-402"],
    },
    {
        "id": "acct-501",
        "community_id": COMMUNITY_ID,
        "name": "Rajaram Manda Family",
        "apartment_ids": ["apt-501", "apt-502"],
    },
]

# Map apartment_id → account_id for user linkage
APT_TO_ACCOUNT = {}
for acct in ACCOUNTS:
    for apt_id in acct["apartment_ids"]:
        APT_TO_ACCOUNT[apt_id] = acct["id"]

# ── Legal owners (title holders) ────────────────────────────────────────
LEGAL_OWNERS = [
    {
        "id": "lo-101-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-101",
        "name": "M.V. Shanmukha Datta",
        "ownership_percentage": 100.0,
    },
    {
        "id": "lo-102-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-102",
        "name": "Pasupuleti Ramesh Babu",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-102-02",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-102",
        "name": "Anjali",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-201-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-201",
        "name": "B.O. Dharani Kumar",
        "ownership_percentage": 100.0,
    },
    {
        "id": "lo-202-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-202",
        "name": "Vani Padma Sri Manda",
        "ownership_percentage": 100.0,
    },
    {
        "id": "lo-301-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-301",
        "name": "Bhupendra Krishna Sangam",
        "ownership_percentage": 100.0,
    },
    {
        "id": "lo-302-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-302",
        "name": "Subhasri Lakshmi Sangam",
        "ownership_percentage": 100.0,
    },
    {
        "id": "lo-401-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-401",
        "name": "Kanamatha Reddy",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-401-02",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-401",
        "name": "Vani Kanyakaparameswari",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-402-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-402",
        "name": "Vijayaram Sri Venkata Manda",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-402-02",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-402",
        "name": "Bhargavi Manda",
        "ownership_percentage": 50.0,
    },
    # Apt 501 & 502 — legal owners preserved separately from the account name
    {
        "id": "lo-501-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-501",
        "name": "Prof. Dr. Ramakrishna Manda",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-501-02",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-501",
        "name": "Smt. Ratnamamba Manda",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-502-01",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-502",
        "name": "Rajaram Sri Venkata Manda",
        "ownership_percentage": 50.0,
    },
    {
        "id": "lo-502-02",
        "community_id": COMMUNITY_ID,
        "apartment_id": "apt-502",
        "name": "Sushma Manda",
        "ownership_percentage": 50.0,
    },
]


async def migrate(dry_run: bool = False) -> None:
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    db = client[settings.db_name]

    # ── Step 1: Create accounts ──────────────────────────────────────────
    print("\n=== Step 1: Creating accounts ===")
    for acct in ACCOUNTS:
        existing = await db.accounts.find_one({"id": acct["id"]})
        if existing:
            print(f"  ⏩ Account {acct['id']} ({acct['name']}) already exists — skipping")
            continue
        print(f"  ✅ Creating account {acct['id']}: {acct['name']} → {acct['apartment_ids']}")
        if not dry_run:
            await db.accounts.insert_one(acct)

    # ── Step 2: Create legal owners ──────────────────────────────────────
    print("\n=== Step 2: Creating legal owners ===")
    for lo in LEGAL_OWNERS:
        existing = await db.legal_owners.find_one({"id": lo["id"]})
        if existing:
            print(f"  ⏩ Legal owner {lo['id']} ({lo['name']}) already exists — skipping")
            continue
        print(f"  ✅ Creating legal owner {lo['id']}: {lo['name']} ({lo['apartment_id']})")
        if not dry_run:
            await db.legal_owners.insert_one(lo)

    # ── Step 3: Link users to accounts ───────────────────────────────────
    print("\n=== Step 3: Linking users to accounts ===")
    users = await db.users.find({"community_id": COMMUNITY_ID}).to_list(100)
    for user in users:
        user_id = user["id"]
        apt_id = user.get("apartment_id")
        existing_acct = user.get("account_id")

        if existing_acct:
            print(f"  ⏩ User {user_id} ({user['name']}) already linked to {existing_acct}")
            continue

        if apt_id and apt_id in APT_TO_ACCOUNT:
            account_id = APT_TO_ACCOUNT[apt_id]
            print(f"  ✅ Linking user {user_id} ({user['name']}) → {account_id}")
            if not dry_run:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"account_id": account_id}},
                )
        else:
            print(f"  ⚠️  User {user_id} ({user['name']}) has no apartment — no account link")

    # ── Summary ──────────────────────────────────────────────────────────
    if dry_run:
        print("\n🔍 DRY RUN — no changes were made to the database.")
    else:
        print("\n✅ Migration complete!")
        acct_count = await db.accounts.count_documents({"community_id": COMMUNITY_ID})
        lo_count = await db.legal_owners.count_documents({"community_id": COMMUNITY_ID})
        linked = await db.users.count_documents(
            {"community_id": COMMUNITY_ID, "account_id": {"$ne": None}}
        )
        print(f"   Accounts: {acct_count}")
        print(f"   Legal owners: {lo_count}")
        print(f"   Users linked to accounts: {linked}")

    client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate: create accounts and link users")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()
    asyncio.run(migrate(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
