"""Report PDFs (M4) — manager/admin/auditor only, fpdf2."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response

from app.core.security import require_roles
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/reports", tags=["reports"])

DB = Annotated[Any, Depends(get_db)]
Reader = Depends(
    require_roles("property_manager", "community_admin", "auditor")
)


def _latin1(text: Any) -> str:
    # Core fonts are latin-1; degrade unsupported chars instead of crashing.
    return str(text).encode("latin-1", "replace").decode("latin-1")


def _pdf(title: str) -> Any:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("helvetica", "B", 15)
    pdf.cell(0, 10, _latin1(title), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    return pdf


def _table(pdf: Any, widths: tuple, headers: tuple, rows: list[tuple]) -> None:
    pdf.set_font("helvetica", "B", 9)
    for w, h in zip(widths, headers):
        pdf.cell(w, 6, h, border=1)
    pdf.ln()
    pdf.set_font("helvetica", "", 9)
    for row in rows:
        for w, c in zip(widths, row):
            pdf.cell(w, 6, _latin1(c)[:45], border=1)
        pdf.ln()


def _respond(pdf: Any, filename: str) -> Response:
    return Response(
        content=bytes(pdf.output()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/collection.pdf", dependencies=[Reader])
async def collection_report(
    db: DB, user: Annotated[User, Depends(require_roles("property_manager", "community_admin", "auditor"))]
) -> Response:
    invoices = await db.invoices.find({"community_id": user.community_id}).to_list(10000)
    by_apt: dict[str, dict] = {}
    for i in invoices:
        apt = by_apt.setdefault(i["apartment_id"], {"billed": 0.0, "paid": 0.0})
        apt["billed"] += i["amount"]
        apt["paid"] += i["paid_amount"]
    pdf = _pdf("Collection Report")
    rows = [
        (a.replace("apt-", ""), f"Rs {v['billed']:,.0f}", f"Rs {v['paid']:,.0f}",
         f"Rs {v['billed'] - v['paid']:,.0f}")
        for a, v in sorted(by_apt.items())
    ]
    total_b = sum(v["billed"] for v in by_apt.values())
    total_p = sum(v["paid"] for v in by_apt.values())
    rows.append(("TOTAL", f"Rs {total_b:,.0f}", f"Rs {total_p:,.0f}", f"Rs {total_b - total_p:,.0f}"))
    _table(pdf, (30, 50, 50, 50), ("Apartment", "Billed", "Collected", "Outstanding"), rows)
    if total_b:
        pdf.ln(4)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(0, 8, f"Collection rate: {total_p / total_b * 100:.1f}%")
    return _respond(pdf, "collection-report.pdf")


@router.get("/expenses.pdf", dependencies=[Reader])
async def expense_report(
    db: DB, user: Annotated[User, Depends(require_roles("property_manager", "community_admin", "auditor"))]
) -> Response:
    expenses = await db.expenses.find({"community_id": user.community_id}).to_list(10000)
    by_cat: dict[str, float] = {}
    for e in expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
    pdf = _pdf("Expense Report")
    _table(
        pdf, (70, 60),
        ("Category", "Total"),
        [(k, f"Rs {v:,.0f}") for k, v in sorted(by_cat.items(), key=lambda kv: -kv[1])]
        + [("TOTAL", f"Rs {sum(by_cat.values()):,.0f}")],
    )
    pdf.ln(6)
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(0, 8, "Entries", new_x="LMARGIN", new_y="NEXT")
    _table(
        pdf, (28, 82, 35, 35),
        ("Date", "Description", "Category", "Amount"),
        [(e["paid_date"], e["description"], e["category"], f"Rs {e['amount']:,.0f}")
         for e in sorted(expenses, key=lambda x: x["paid_date"], reverse=True)],
    )
    return _respond(pdf, "expense-report.pdf")


@router.get("/vendor-spend.pdf", dependencies=[Reader])
async def vendor_spend_report(
    db: DB, user: Annotated[User, Depends(require_roles("property_manager", "community_admin", "auditor"))]
) -> Response:
    expenses = await db.expenses.find({"community_id": user.community_id}).to_list(10000)
    vendors = {v["id"]: v["name"] for v in await db.vendors.find(
        {"community_id": user.community_id}).to_list(1000)}
    by_vendor: dict[str, float] = {}
    for e in expenses:
        name = vendors.get(e.get("vendor_id") or "", "(no vendor)")
        by_vendor[name] = by_vendor.get(name, 0) + e["amount"]
    pdf = _pdf("Vendor Spend Report")
    _table(
        pdf, (90, 50),
        ("Vendor", "Total Paid"),
        [(k, f"Rs {v:,.0f}") for k, v in sorted(by_vendor.items(), key=lambda kv: -kv[1])],
    )
    return _respond(pdf, "vendor-spend.pdf")
