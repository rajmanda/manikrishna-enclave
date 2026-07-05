#!/usr/bin/env python3
"""Delete all July 2026 invoices (and their payments) for every apartment.

Detection logic
---------------
An invoice belongs to July 2026 when its ``due_date`` starts with ``2026-07``
OR its ``period`` field contains the word ``Jul`` and ``2026``
(handles "Jul 2026", "July 2026", etc.).  Both conditions are OR'd so nothing
slips through.

Safety features
---------------
- Prints a full preview table before touching any data.
- Asks for an explicit "yes" confirmation.
- Pass  --dry-run  to preview without being prompted.

Usage
-----
    cd backend
    python scripts/delete_july_invoices.py          # interactive
    python scripts/delete_july_invoices.py --dry-run
"""

import asyncio
import re
import sys
from pathlib import Path

# ── allow `from app.core.config import …` when run from the repo root ──────
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings


def _is_july_2026(inv: dict) -> bool:
    """Return True if the invoice is for July 2026."""
    due = inv.get("due_date", "")
    period = inv.get("period", "")
    if due.startswith("2026-07"):
        return True
    # Normalise period text: "July 2026", "Jul 2026", "jul 2026", …
    if re.search(r"\bjul\w*\s+2026\b", period, re.IGNORECASE):
        return True
    return False


async def main(dry_run: bool) -> None:
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    db = client[settings.db_name]

    try:
        # ── 1. Collect July invoices ──────────────────────────────────────
        all_invoices = await db.invoices.find({}).to_list(None)
        july_invoices = [inv for inv in all_invoices if _is_july_2026(inv)]

        if not july_invoices:
            print("✅  No July 2026 invoices found — nothing to delete.")
            return

        july_ids = [inv["id"] for inv in july_invoices]

        # ── 2. Collect linked payments ────────────────────────────────────
        july_payments = await db.payments.find(
            {"invoice_id": {"$in": july_ids}}
        ).to_list(None)

        # ── 3. Preview ────────────────────────────────────────────────────
        print(f"\n{'─'*60}")
        print(f"  July 2026 invoices to delete: {len(july_invoices)}")
        print(f"  Linked payments to delete:    {len(july_payments)}")
        print(f"{'─'*60}")

        # Group by apartment for a readable summary
        from collections import defaultdict
        by_apt: dict[str, list] = defaultdict(list)
        for inv in july_invoices:
            by_apt[inv.get("apartment_id", "?")].append(inv)

        for apt_id, invs in sorted(by_apt.items()):
            total = sum(i["amount"] for i in invs)
            paid  = sum(i.get("paid_amount", 0) for i in invs)
            print(f"  {apt_id:20s}  {len(invs)} invoice(s)  "
                  f"billed ₹{total:,.0f}  paid ₹{paid:,.0f}")
            for inv in invs:
                print(f"    • [{inv['status']:8s}] {inv['description']:<35s} "
                      f"due {inv['due_date']}")

        print(f"{'─'*60}\n")

        if dry_run:
            print("🔍  DRY RUN — no data was changed.\n")
            return

        # ── 4. Confirm ────────────────────────────────────────────────────
        answer = input("Type  yes  to permanently delete all of the above: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing deleted.")
            return

        # ── 5. Delete payments first (FK integrity) ───────────────────────
        if july_payments:
            p_result = await db.payments.delete_many(
                {"invoice_id": {"$in": july_ids}}
            )
            print(f"🗑   Deleted {p_result.deleted_count} payment(s).")

        # ── 6. Delete invoices ────────────────────────────────────────────
        i_result = await db.invoices.delete_many({"id": {"$in": july_ids}})
        print(f"🗑   Deleted {i_result.deleted_count} invoice(s).")
        print("✅  Done.")

    finally:
        client.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(main(dry_run))
