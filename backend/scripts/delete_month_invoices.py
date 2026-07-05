#!/usr/bin/env python3
"""Delete invoices (and their payments) for a given month/year, with an
optional filter on the ledger type (community or manager_fee).

Detection logic
---------------
An invoice belongs to the target month when:
  • its ``due_date`` starts with ``YYYY-MM``  (e.g. 2026-06-…)
  • OR its ``period`` field matches the month name + year
    (handles "Jun 2026", "June 2026", etc.)

Options
-------
  --ledger community     delete only community invoices (Monthly Maintenance etc.)
  --ledger manager_fee   delete only Manager Service Fee invoices
  (omit --ledger to delete ALL invoices for the month)

Safety features
---------------
- Prints a full preview table before touching any data.
- Asks for an explicit "yes" confirmation.
- Pass  --dry-run  to preview without being prompted.

Usage
-----
    cd backend

    # Delete ALL June 2026 invoices
    python scripts/delete_month_invoices.py 2026-06

    # Delete ONLY Manager Service Fee invoices for June 2026
    python scripts/delete_month_invoices.py 2026-06 --ledger manager_fee

    # Delete ONLY community (Monthly Maintenance etc.) invoices for July 2026
    python scripts/delete_month_invoices.py 2026-07 --ledger community

    # Preview only (no prompt, no deletion)
    python scripts/delete_month_invoices.py 2026-06 --ledger manager_fee --dry-run
"""

import asyncio
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

# ── allow `from app.core.config import …` when run from the backend dir ────
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings


_MONTH_NUM = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

VALID_LEDGERS = ("community", "manager_fee")


def _parse_args() -> tuple[str, str | None, bool]:
    """Return (target_month, ledger_filter, dry_run)."""
    argv = sys.argv[1:]
    dry_run = "--dry-run" in argv
    argv = [a for a in argv if a != "--dry-run"]

    ledger: str | None = None
    if "--ledger" in argv:
        idx = argv.index("--ledger")
        try:
            ledger = argv[idx + 1]
        except IndexError:
            sys.exit("❌  --ledger requires a value: community or manager_fee")
        if ledger not in VALID_LEDGERS:
            sys.exit(f"❌  Unknown ledger '{ledger}'. Choose: community | manager_fee")
        argv = argv[:idx] + argv[idx + 2:]

    positional = [a for a in argv if not a.startswith("--")]
    if not positional:
        sys.exit(
            "Usage: python scripts/delete_month_invoices.py YYYY-MM "
            "[--ledger community|manager_fee] [--dry-run]\n"
            "Examples:\n"
            "  python scripts/delete_month_invoices.py 2026-06\n"
            "  python scripts/delete_month_invoices.py 2026-06 --ledger manager_fee\n"
            "  python scripts/delete_month_invoices.py 2026-07 --ledger community --dry-run"
        )
    return positional[0], ledger, dry_run


def _parse_month(arg: str) -> tuple[str, str]:
    """'2026-06' → (year='2026', due_prefix='2026-06')."""
    parts = arg.strip().split("-")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        sys.exit(f"❌  Invalid format '{arg}'. Use YYYY-MM, e.g. 2026-06")
    year, month = parts
    if len(year) != 4 or not (1 <= int(month) <= 12):
        sys.exit(f"❌  Invalid date '{arg}'.")
    return year, f"{year}-{month}"


def _period_re(year: str, month_num: str) -> re.Pattern:
    """Regex matching "Jun 2026", "June 2026", etc."""
    for abbr, num in _MONTH_NUM.items():
        if num == month_num:
            return re.compile(rf"\b{abbr}\w*\s+{re.escape(year)}\b", re.IGNORECASE)
    return re.compile(r"(?!)")


def _matches(inv: dict, due_prefix: str, period_re: re.Pattern,
             ledger_filter: str | None) -> bool:
    # Month check
    in_month = (
        inv.get("due_date", "").startswith(due_prefix)
        or bool(period_re.search(inv.get("period", "")))
    )
    if not in_month:
        return False
    # Ledger check — no filter means include all
    if ledger_filter is None:
        return True
    inv_ledger = inv.get("ledger") or "community"   # default is community
    return inv_ledger == ledger_filter


async def main() -> None:
    target, ledger_filter, dry_run = _parse_args()
    year, due_prefix = _parse_month(target)
    month_num = due_prefix.split("-")[1]
    pre = _period_re(year, month_num)
    label = date(int(year), int(month_num), 1).strftime("%b %Y")

    ledger_label = (
        f" [{ledger_filter}]" if ledger_filter else " [all ledgers]"
    )

    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    db = client[settings.db_name]

    try:
        # ── 1. Collect matching invoices ──────────────────────────────────
        all_invoices = await db.invoices.find({}).to_list(None)
        target_invoices = [
            inv for inv in all_invoices
            if _matches(inv, due_prefix, pre, ledger_filter)
        ]

        if not target_invoices:
            print(f"✅  No {label}{ledger_label} invoices found — nothing to delete.")
            return

        target_ids = [inv["id"] for inv in target_invoices]

        # ── 2. Collect linked payments ────────────────────────────────────
        target_payments = await db.payments.find(
            {"invoice_id": {"$in": target_ids}}
        ).to_list(None)

        # ── 3. Preview ────────────────────────────────────────────────────
        print(f"\n{'─'*62}")
        print(f"  Month / filter:               {label}{ledger_label}")
        print(f"  Invoices to delete:           {len(target_invoices)}")
        print(f"  Linked payments to delete:    {len(target_payments)}")
        print(f"{'─'*62}")

        by_apt: dict[str, list] = defaultdict(list)
        for inv in target_invoices:
            by_apt[inv.get("apartment_id", "?")].append(inv)

        for apt_id, invs in sorted(by_apt.items()):
            total = sum(i["amount"] for i in invs)
            paid  = sum(i.get("paid_amount", 0) for i in invs)
            print(f"  {apt_id:20s}  {len(invs)} invoice(s)  "
                  f"billed ₹{total:,.0f}  paid ₹{paid:,.0f}")
            for inv in invs:
                ledger_tag = " [mgr]" if inv.get("ledger") == "manager_fee" else ""
                print(f"    • [{inv['status']:8s}] {inv['description']:<35s} "
                      f"due {inv['due_date']}{ledger_tag}")

        print(f"{'─'*62}\n")

        if dry_run:
            print("🔍  DRY RUN — no data was changed.\n")
            return

        # ── 4. Confirm ────────────────────────────────────────────────────
        answer = input(
            f"Type  yes  to permanently delete all {len(target_invoices)} "
            f"invoice(s) and {len(target_payments)} payment(s): "
        ).strip().lower()
        if answer != "yes":
            print("Aborted — nothing deleted.")
            return

        # ── 5. Delete payments first (FK integrity) ───────────────────────
        if target_payments:
            p = await db.payments.delete_many({"invoice_id": {"$in": target_ids}})
            print(f"🗑   Deleted {p.deleted_count} payment(s).")

        # ── 6. Delete invoices ────────────────────────────────────────────
        i = await db.invoices.delete_many({"id": {"$in": target_ids}})
        print(f"🗑   Deleted {i.deleted_count} invoice(s).")
        print("✅  Done.")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
