"""Seed the initial customer: Mani Krishna Enclave.

Idempotent — skips if the community already exists. Run standalone with
`python -m app.seed` or set SEED_ON_START=true.

Owner emails are placeholders; replace them with real Google account emails
via PATCH /users/{id} (login is whitelisted by email).
"""

import asyncio
from typing import Any

CID = "mke"

COMMUNITY = {
    "id": CID,
    "name": "Mani Krishna Enclave",
    "address": "Hyderabad, Telangana",
    "apartment_count": 10,
    "monthly_maintenance": 3500,
}

OWNERS = [
    ("101", 1, "M.V. Shanmukha Datta"),
    ("102", 1, "Pasupuleti Ramesh Babu & Anjali"),
    ("201", 2, "B.O. Dharani Kumar"),
    ("202", 2, "Vani Padma Sri Manda"),
    ("301", 3, "Bhupendra Krishna Sangam"),
    ("302", 3, "Subhasri Lakshmi Sangam"),
    ("401", 4, "Kanamatha Reddy & Vani Kanyakaparameswari"),
    ("402", 4, "Vijayaram Sri Venkata Manda & Bhargavi Manda"),
    ("501", 5, "Prof. Dr. Ramakrishna Manda & Smt. Ratnamamba Manda"),
    ("502", 5, "Rajaram Sri Venkata Manda & Sushma Manda"),
]

# June 2026 invoices: (apartment, paid_amount, status)
JUNE_INVOICES = [
    ("101", 3500, "paid"),
    ("102", 3500, "paid"),
    ("201", 0, "overdue"),
    ("202", 3500, "paid"),
    ("301", 2000, "partial"),
    ("302", 3500, "paid"),
    ("401", 0, "overdue"),
    ("402", 3500, "paid"),
    ("501", 3500, "paid"),
    ("502", 0, "due"),
]

EXPENSES = [
    ("Electricity", "Common area power bill — June", None, 4820, "2026-06-15", True),
    ("Water", "Water tanker × 4", None, 3200, "2026-06-12", True),
    ("Watchman", "Watchman salary — June", "v-sec", 15000, "2026-06-01", True),
    ("Lift", "Lift AMC quarterly payment", "v-lift", 7500, "2026-06-10", True),
    ("Generator", "Diesel top-up 40L", "v-gen", 3760, "2026-06-18", True),
    ("Repairs", "Bore motor starter replacement", "v-elec", 2850, "2026-06-20", True),
    ("Garden", "Gardener monthly service", "v-garden", 2000, "2026-06-05", False),
    ("Cleaning", "Common area cleaning — June", "v-clean", 4500, "2026-06-03", True),
    ("Miscellaneous", "Festival decoration supplies", None, 1200, "2026-06-22", False),
]

# (id, name, service, phone, gst, amc_expiry, rating, active_contracts)
VENDORS = [
    ("v-lift", "Sree Lift Services", "Lift AMC", "+91 90000 11111", "36AAACS1111A1Z5", "2026-12-31", 4.5, 1),
    ("v-elec", "Kumar Electricals", "Electrician", "+91 90000 22222", None, None, 4.2, 0),
    ("v-plumb", "Srinivas Plumbing Works", "Plumber", "+91 90000 33333", None, None, 4.0, 0),
    ("v-gen", "PowerGen Solutions", "Generator AMC", "+91 90000 44444", "36AABCP2222B1Z8", "2026-09-30", 4.7, 1),
    ("v-clean", "CleanPro Facility Services", "Cleaning", "+91 90000 55555", None, None, 3.9, 1),
    ("v-sec", "Guardian Security Agency", "Security / Watchman", "+91 90000 66666", "36AADCG3333C1Z2", "2027-03-31", 4.4, 1),
    ("v-garden", "Green Thumb Gardeners", "Gardener", "+91 90000 77777", None, None, 4.1, 1),
    ("v-paint", "Rainbow Painters", "Painter", "+91 90000 88888", None, None, 4.3, 0),
]

# (invoice apartment, amount, date, method, reference)
PAYMENTS = [
    ("101", 3500, "2026-06-04", "UPI", "UPI-8891"),
    ("102", 3500, "2026-06-05", "UPI", "UPI-8934"),
    ("202", 3500, "2026-06-06", "Bank Transfer", "NEFT-1201"),
    ("301", 2000, "2026-06-08", "Cash", "CSH-014"),
    ("302", 3500, "2026-06-08", "UPI", "UPI-9102"),
    ("402", 3500, "2026-06-09", "UPI", "UPI-9188"),
    ("501", 3500, "2026-06-09", "Bank Transfer", "NEFT-1245"),
]

MONTHLY_FINANCE = [
    ("Jan", 35000, 31200, 100),
    ("Feb", 33250, 36400, 95),
    ("Mar", 35000, 29800, 100),
    ("Apr", 35000, 38900, 100),
    ("May", 31500, 30500, 90),
    ("Jun", 25500, 44830, 73),
]

WORK_ORDERS = [
    {
        "id": "wo-1",
        "title": "Lift Repair — door sensor fault",
        "description": "Lift door not closing on 3rd floor. Sensor needs replacement.",
        "priority": "Urgent",
        "stage": "In Progress",
        "vendor_id": "v-lift",
        "assigned_to": "u-vishnu",
        "estimate": 8500,
        "final_cost": None,
        "reported_date": "2026-06-24",
        "photo_count": 3,
        "timeline": [
            {"stage": "Reported", "date": "2026-06-24", "note": "Reported by owner 301"},
            {"stage": "Estimate Received", "date": "2026-06-25", "note": "Quoted ₹8,500"},
            {"stage": "Owner Approval", "date": "2026-06-26", "note": "Approved by poll (8/10)"},
            {"stage": "In Progress", "date": "2026-06-28", "note": "Technician scheduled"},
        ],
        "comments": [],
    },
    {
        "id": "wo-2",
        "title": "Bore Motor — low water pressure",
        "description": "Starter replaced; monitoring pressure for a week.",
        "priority": "High",
        "stage": "Inspection",
        "vendor_id": "v-elec",
        "assigned_to": "u-vishnu",
        "estimate": 3000,
        "final_cost": 2850,
        "reported_date": "2026-06-15",
        "photo_count": 2,
        "timeline": [
            {"stage": "Reported", "date": "2026-06-15", "note": "Low pressure reported"},
            {"stage": "In Progress", "date": "2026-06-18", "note": "Starter replaced"},
            {"stage": "Inspection", "date": "2026-06-20", "note": "Monitoring one week"},
        ],
        "comments": [],
    },
    {
        "id": "wo-3",
        "title": "Water Tank Cleaning — half-yearly",
        "description": "Scheduled cleaning of overhead and underground tanks.",
        "priority": "Medium",
        "stage": "Owner Approval",
        "vendor_id": "v-clean",
        "assigned_to": None,
        "estimate": 6000,
        "final_cost": None,
        "reported_date": "2026-06-27",
        "photo_count": 0,
        "timeline": [
            {"stage": "Reported", "date": "2026-06-27", "note": "Scheduled maintenance due"},
            {"stage": "Estimate Received", "date": "2026-06-29", "note": "Quoted ₹6,000"},
        ],
        "comments": [],
    },
    {
        "id": "wo-4",
        "title": "Generator Service — annual",
        "description": "Annual servicing completed. Oil and filters changed.",
        "priority": "Medium",
        "stage": "Closed",
        "vendor_id": "v-gen",
        "assigned_to": None,
        "estimate": 5500,
        "final_cost": 5500,
        "reported_date": "2026-05-10",
        "photo_count": 4,
        "timeline": [
            {"stage": "Reported", "date": "2026-05-10", "note": "Annual service due"},
            {"stage": "Closed", "date": "2026-05-20", "note": "Invoice paid, closed"},
        ],
        "comments": [],
    },
    {
        "id": "wo-5",
        "title": "Roof Leakage — Block A stairwell",
        "description": "Water seepage in the 5th floor stairwell ceiling during rains.",
        "priority": "High",
        "stage": "Estimate Received",
        "vendor_id": "v-paint",
        "assigned_to": None,
        "estimate": 12000,
        "final_cost": None,
        "reported_date": "2026-06-29",
        "photo_count": 5,
        "timeline": [
            {"stage": "Reported", "date": "2026-06-29", "note": "Reported by owner 501"},
            {"stage": "Estimate Received", "date": "2026-07-01", "note": "Quoted ₹12,000"},
        ],
        "comments": [],
    },
]

RESERVE_FUND = [
    ("Jan", 5000, 0, 118000),
    ("Feb", 5000, 8000, 115000),
    ("Mar", 5000, 0, 120000),
    ("Apr", 5000, 5500, 119500),
    ("May", 5000, 0, 124500),
    ("Jun", 5000, 8500, 121000),
]


async def seed(db: Any) -> bool:
    """Insert the Mani Krishna Enclave dataset. Returns False if it exists."""
    if await db.communities.find_one({"id": CID}):
        return False

    await db.communities.insert_one(dict(COMMUNITY))

    await db.users.insert_one(
        {
            "id": "u-vishnu",
            "community_id": CID,
            "name": "Vishnu",
            "email": "vishnu@communityhub.app",
            "role": "property_manager",
            "apartment_id": None,
            "phone": None,
        }
    )
    await db.users.insert_one(
        {
            "id": "u-auditor",
            "community_id": CID,
            "name": "Community Auditor",
            "email": "auditor@communityhub.app",
            "role": "auditor",
            "apartment_id": None,
            "phone": None,
        }
    )

    for number, floor, name in OWNERS:
        await db.apartments.insert_one(
            {
                "id": f"apt-{number}",
                "community_id": CID,
                "number": number,
                "floor": floor,
                "owner_ids": [f"u-{number}"],
            }
        )
        await db.users.insert_one(
            {
                "id": f"u-{number}",
                "community_id": CID,
                "name": name,
                "email": f"owner{number}@example.com",
                "role": "owner",
                "apartment_id": f"apt-{number}",
                "phone": None,
            }
        )

    for number, paid, invoice_status in JUNE_INVOICES:
        await db.invoices.insert_one(
            {
                "id": f"inv-2606-{number}",
                "community_id": CID,
                "apartment_id": f"apt-{number}",
                "period": "Jun 2026",
                "description": "Monthly Maintenance",
                "amount": 3500,
                "paid_amount": paid,
                "due_date": "2026-06-10",
                "status": invoice_status,
            }
        )

    for i, (category, desc, vendor_id, amount, paid_date, receipt) in enumerate(EXPENSES, 1):
        await db.expenses.insert_one(
            {
                "id": f"exp-{i}",
                "community_id": CID,
                "category": category,
                "description": desc,
                "vendor_id": vendor_id,
                "amount": amount,
                "paid_date": paid_date,
                "has_receipt": receipt,
            }
        )

    for vid, name, service, phone, gst, amc, rating, contracts in VENDORS:
        await db.vendors.insert_one(
            {
                "id": vid,
                "community_id": CID,
                "name": name,
                "service": service,
                "phone": phone,
                "gst": gst,
                "amc_expiry": amc,
                "rating": rating,
                "active_contracts": contracts,
            }
        )

    for i, (number, amount, date, method, reference) in enumerate(PAYMENTS, 1):
        await db.payments.insert_one(
            {
                "id": f"pay-{i}",
                "community_id": CID,
                "invoice_id": f"inv-2606-{number}",
                "apartment_id": f"apt-{number}",
                "amount": amount,
                "date": date,
                "method": method,
                "reference": reference,
            }
        )

    for month, income, expenses_amt, rate in MONTHLY_FINANCE:
        await db.monthly_finance.insert_one(
            {
                "community_id": CID,
                "month": month,
                "income": income,
                "expenses": expenses_amt,
                "collection_rate": rate,
            }
        )

    for wo in WORK_ORDERS:
        await db.work_orders.insert_one({**wo, "community_id": CID})

    for month, contributions, expenses_amt, balance in RESERVE_FUND:
        await db.reserve_fund.insert_one(
            {
                "community_id": CID,
                "month": month,
                "contributions": contributions,
                "expenses": expenses_amt,
                "balance": balance,
            }
        )

    return True


async def _main() -> None:
    from app import db as database

    db = database.connect()
    created = await seed(db)
    print("Seeded Mani Krishna Enclave" if created else "Already seeded — skipped")
    database.disconnect()


if __name__ == "__main__":
    asyncio.run(_main())
