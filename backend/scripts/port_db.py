#!/usr/bin/env python3
"""Port every collection from one database to another on the same cluster.

Copies all collections (documents + indexes) from --source to --target.
Non-destructive: the source database is never modified. Refuses to write
into a non-empty target collection unless --overwrite is given (which
drops the target collection first).

Usage:
    cd backend
    python scripts/port_db.py --source manikrishna_enclave --target communityhub [--dry-run] [--overwrite]
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Allow imports from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

BATCH = 500


async def copy_collection(src_db, dst_db, name: str, dry_run: bool, overwrite: bool) -> None:
    src = src_db[name]
    dst = dst_db[name]
    total = await src.count_documents({})

    existing = await dst.count_documents({})
    if existing:
        if not overwrite:
            print(f"  SKIP {name}: target already has {existing} docs (use --overwrite)")
            return
        if not dry_run:
            await dst.drop()
        print(f"  DROP {name}: removed {existing} existing target docs")

    if dry_run:
        print(f"  DRY  {name}: would copy {total} docs")
        return

    copied = 0
    batch: list[dict] = []
    async for doc in src.find({}):
        batch.append(doc)
        if len(batch) >= BATCH:
            await dst.insert_many(batch)
            copied += len(batch)
            batch = []
    if batch:
        await dst.insert_many(batch)
        copied += len(batch)

    # Recreate non-default indexes.
    indexes = await src.index_information()
    for idx_name, spec in indexes.items():
        if idx_name == "_id_":
            continue
        keys = spec["key"]
        kwargs = {"name": idx_name}
        if spec.get("unique"):
            kwargs["unique"] = True
        await dst.create_index(list(keys.items()) if isinstance(keys, dict) else keys, **kwargs)

    verified = await dst.count_documents({})
    status = "OK " if verified == total else "MISMATCH"
    print(f"  {status} {name}: {verified}/{total} docs, {max(len(indexes) - 1, 0)} indexes")
    if verified != total:
        raise SystemExit(f"Count mismatch in {name}: source={total} target={verified}")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if args.source == args.target:
        raise SystemExit("Source and target must differ")

    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    src_db = client[args.source]
    dst_db = client[args.target]

    names = sorted(await src_db.list_collection_names())
    if not names:
        raise SystemExit(f"Source database '{args.source}' has no collections")

    print(f"Porting {args.source} -> {args.target} ({len(names)} collections)"
          + (" [DRY RUN]" if args.dry_run else ""))
    for name in names:
        await copy_collection(src_db, dst_db, name, args.dry_run, args.overwrite)
    print("Done." if not args.dry_run else "Dry run complete — nothing written.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
