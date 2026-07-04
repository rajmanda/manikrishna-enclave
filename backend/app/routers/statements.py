"""Owner statements (server-side PDF) and CSV export (M2).

Owners/tenants may fetch only their own apartment's statement; managers,
admins and auditors may fetch any apartment in their community.
"""

import csv
import io
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.security import CurrentUser
from app.db import get_db
from app.models import User

router = APIRouter(tags=["statements"])

DB = Annotated[Any, Depends(get_db)]


def _check_apartment_access(user: User, apartment_id: str) -> None:
    if user.role in ("owner", "tenant") and user.apartment_id != apartment_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Not your apartment"
        )


async def _statement_data(db: Any, community_id: str, apartment_id: str) -> dict:
    apartment = await db.apartments.find_one(
        {"id": apartment_id, "community_id": community_id}
    )
    if apartment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    community = await db.communities.find_one({"id": community_id})
    owner = await db.users.find_one({"id": {"$in": apartment.get("owner_ids", [])}})
    invoices = await db.invoices.find(
        {"community_id": community_id, "apartment_id": apartment_id}
    ).to_list(1000)
    payments = await db.payments.find(
        {"community_id": community_id, "apartment_id": apartment_id}
    ).to_list(1000)
    invoices.sort(key=lambda i: i["due_date"])
    payments.sort(key=lambda p: p["date"])
    return {
        "community": community,
        "apartment": apartment,
        "owner": owner,
        "invoices": invoices,
        "payments": payments,
    }


@router.get("/statements/{apartment_id}.pdf")
async def statement_pdf(apartment_id: str, db: DB, user: CurrentUser) -> Response:
    _check_apartment_access(user, apartment_id)
    d = await _statement_data(db, user.community_id, apartment_id)

    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, d["community"]["name"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.cell(
        0, 6,
        f"Account Statement - Apartment {d['apartment']['number']}",
        new_x="LMARGIN", new_y="NEXT",
    )
    if d["owner"]:
        pdf.cell(0, 6, f"Owner: {d['owner']['name']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Invoices table
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, "Invoices", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "B", 9)
    widths = (30, 70, 30, 30, 25)
    for w, h in zip(widths, ("Period", "Description", "Amount", "Paid", "Status")):
        pdf.cell(w, 6, h, border=1)
    pdf.ln()
    pdf.set_font("helvetica", "", 9)
    total_billed = total_paid = 0.0
    for inv in d["invoices"]:
        total_billed += inv["amount"]
        total_paid += inv["paid_amount"]
        cells = (
            inv["period"],
            inv["description"][:40],
            f"Rs {inv['amount']:,.0f}",
            f"Rs {inv['paid_amount']:,.0f}",
            inv["status"],
        )
        for w, c in zip(widths, cells):
            pdf.cell(w, 6, str(c), border=1)
        pdf.ln()
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(100, 6, "Total", border=1)
    pdf.cell(30, 6, f"Rs {total_billed:,.0f}", border=1)
    pdf.cell(30, 6, f"Rs {total_paid:,.0f}", border=1)
    pdf.cell(25, 6, f"Due Rs {total_billed - total_paid:,.0f}", border=1)
    pdf.ln(10)

    # Payments table
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, "Payments Received", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "B", 9)
    pwidths = (35, 35, 40, 50)
    for w, h in zip(pwidths, ("Date", "Amount", "Method", "Reference")):
        pdf.cell(w, 6, h, border=1)
    pdf.ln()
    pdf.set_font("helvetica", "", 9)
    for p in d["payments"]:
        cells = (p["date"], f"Rs {p['amount']:,.0f}", p["method"], p["reference"])
        for w, c in zip(pwidths, cells):
            pdf.cell(w, 6, str(c), border=1)
        pdf.ln()

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="statement-{d["apartment"]["number"]}.pdf"'
        },
    )


@router.get("/invoices/export.csv")
async def invoices_csv(db: DB, user: CurrentUser) -> Response:
    query: dict = {"community_id": user.community_id}
    if user.role in ("owner", "tenant") and user.apartment_id:
        query["apartment_id"] = user.apartment_id
    invoices = await db.invoices.find(query).to_list(10000)
    invoices.sort(key=lambda i: (i["due_date"], i["apartment_id"]))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["Invoice ID", "Apartment", "Period", "Description", "Amount", "Paid", "Due Date", "Status"]
    )
    for i in invoices:
        writer.writerow(
            [
                i["id"],
                i["apartment_id"].replace("apt-", ""),
                i["period"],
                i["description"],
                i["amount"],
                i["paid_amount"],
                i["due_date"],
                i["status"],
            ]
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="invoices.csv"'},
    )
