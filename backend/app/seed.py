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


MAINTENANCE_REQUESTS = [
    ("mr-1", "Street light not working near gate", "The light at the main gate has been off for 3 days. Safety concern at night.", "community", "In Progress", "u-202", "2026-06-28"),
    ("mr-2", "Lift making noise between floors 2-3", "Grinding noise when the lift passes the 2nd floor.", "community", "Open", "u-301", "2026-06-30"),
    ("mr-3", "Parking spot marking faded", "Please repaint the parking numbers, causing confusion with visitors.", "community", "Open", "u-401", "2026-07-01"),
    ("mr-4", "Kitchen sink drainage issue", "Slow drainage in my kitchen sink, may need the common drain line checked.", "private", "Open", "u-502", "2026-07-01"),
]

FEED_POSTS = [
    ("post-1", "u-vishnu", "announcement", "Lift will be under repair this Friday 9am-1pm. Please plan accordingly.", "2026-07-01", True, {"u-301": "like", "u-102": "thanks", "u-501": "like"}),
    ("post-2", "u-501", "photo", "The garden is looking beautiful after the new plants were added. Great work by the gardening team!", "2026-06-29", False, {"u-202": "heart", "u-302": "like", "u-vishnu": "like"}),
    ("post-3", "u-402", "suggestion", "Suggestion: Can we install a small notice board near the lift for physical notices? Some of our elders don't check the app often.", "2026-06-27", False, {"u-101": "like"}),
    ("post-4", "u-201", "question", "Does anyone have the contact of a good AC service person? Mine stopped cooling.", "2026-06-25", False, {}),
]

FEED_COMMENTS = {
    "post-1": [{"author_id": "u-301", "text": "Thanks for the update Vishnu!", "date": "2026-07-01"}],
    "post-2": [{"author_id": "u-202", "text": "Lovely! The kids enjoy the space now.", "date": "2026-06-29"}],
    "post-4": [{"author_id": "u-302", "text": "Try CoolCare on JNTU road, they serviced ours last month.", "date": "2026-06-25"}],
}


POLLS = [
    ("poll-1", "Approve Lift Door Sensor Replacement (Rs 8,500)", "Sree Lift Services quoted Rs 8,500. Taken from the reserve fund.", "2026-06-25", "2026-06-27", "closed", ["Approve", "Reject", "Need more quotes"],
     {"apt-101": "Approve", "apt-102": "Approve", "apt-201": "Reject", "apt-202": "Approve", "apt-301": "Approve", "apt-302": "Approve", "apt-401": "Need more quotes", "apt-402": "Approve", "apt-501": "Approve", "apt-502": "Approve"}),
    ("poll-2", "Approve Roof Waterproofing (Rs 12,000)", "Waterproofing for the Block A stairwell leakage (see work order wo-5).", "2026-07-01", "2026-07-08", "open", ["Approve", "Reject", "Get another quote"],
     {"apt-101": "Approve", "apt-202": "Approve", "apt-302": "Approve", "apt-402": "Get another quote", "apt-501": "Approve"}),
    ("poll-3", "Increase Monthly Maintenance to Rs 4,000 from August", "Rising electricity and security costs.", "2026-06-20", "2026-07-10", "open", ["Approve", "Reject"],
     {"apt-101": "Approve", "apt-201": "Reject", "apt-301": "Reject", "apt-402": "Approve", "apt-501": "Approve", "apt-502": "Reject"}),
]

DOCUMENTS = [
    ("doc-1", "Society Rules & Bye-laws", "Society Rules", "2026-01-15", 3, 840, "pdf"),
    ("doc-2", "Building Insurance Policy 2026-27", "Insurance", "2026-04-01", 1, 1220, "pdf"),
    ("doc-3", "Water Bill - June 2026", "Water Bills", "2026-06-14", 1, 180, "pdf"),
    ("doc-4", "Electricity Bill - June 2026", "Electric Bills", "2026-06-16", 1, 210, "pdf"),
    ("doc-5", "Audit Report FY 2025-26", "Audit Reports", "2026-05-20", 2, 2400, "pdf"),
    ("doc-6", "AGM Minutes - April 2026", "AGM Minutes", "2026-04-28", 1, 460, "pdf"),
    ("doc-7", "Approved Building Plan", "Building Plans", "2026-01-10", 1, 5300, "image"),
    ("doc-8", "Lift AMC Contract - Sree Lift Services", "Contracts", "2026-01-05", 2, 620, "pdf"),
    ("doc-9", "Security Contract - Guardian Agency", "Contracts", "2026-03-28", 1, 580, "pdf"),
]

MEETINGS = [
    ("meet-1", "Annual General Meeting 2026", "2026-04-26", 9,
     ["FY 2025-26 accounts review", "Election of committee members", "Maintenance charge revision discussion", "Painting project planning"],
     ["Accounts approved unanimously", "Vishnu re-appointed as property manager", "Maintenance revision moved to community poll"]),
    ("meet-2", "Emergency Meeting - Lift Breakdown", "2026-06-26", 7,
     ["Lift door sensor failure", "Vendor quote review", "Temporary arrangements for senior citizens"],
     ["Approved Rs 8,500 sensor replacement via poll", "Watchman to assist seniors during lift downtime"]),
    ("meet-3", "Monthly Committee Meeting - July", "2026-07-06", 0,
     ["Roof waterproofing decision", "Maintenance increase poll results", "Diwali event planning kickoff"],
     []),
]


async def seed_m4(db: Any) -> bool:
    """Seed governance collections if empty (also used by migration 003)."""
    if await db.communities.find_one({"id": CID}) is None:
        return False
    changed = False
    if await db.polls.find_one({"community_id": CID}) is None:
        for pid, q, desc, od, cd, pstatus, options, votes in POLLS:
            await db.polls.insert_one(
                {"id": pid, "community_id": CID, "question": q, "description": desc,
                 "open_date": od, "close_date": cd, "status": pstatus,
                 "option_labels": options, "votes_by": votes}
            )
        changed = True
    if await db.documents.find_one({"community_id": CID}) is None:
        for did, title, cat, up, ver, kb, ft in DOCUMENTS:
            await db.documents.insert_one(
                {"id": did, "community_id": CID, "title": title, "category": cat,
                 "uploaded_date": up, "version": ver, "size_kb": kb,
                 "file_type": ft, "path": None, "uploaded_by": "u-vishnu"}
            )
        changed = True
    if await db.meetings.find_one({"community_id": CID}) is None:
        for mid, title, mdate, att, agenda, resolutions in MEETINGS:
            await db.meetings.insert_one(
                {"id": mid, "community_id": CID, "title": title, "date": mdate,
                 "attendance": att, "agenda": agenda, "resolutions": resolutions,
                 "has_pdf": False, "has_audio": False, "minutes_path": None}
            )
        changed = True
    return changed


async def seed_m3(db: Any) -> bool:
    """Seed M3 collections if empty. Safe to call repeatedly; also used by
    migration 002 to backfill databases seeded before M3 existed."""
    if await db.communities.find_one({"id": CID}) is None:
        return False
    changed = False
    if await db.maintenance_requests.find_one({"community_id": CID}) is None:
        for mid, title, desc, vis, mstatus, creator, created in MAINTENANCE_REQUESTS:
            await db.maintenance_requests.insert_one(
                {"id": mid, "community_id": CID, "title": title, "description": desc,
                 "visibility": vis, "status": mstatus, "created_by": creator,
                 "created_date": created}
            )
        changed = True
    if await db.feed_posts.find_one({"community_id": CID}) is None:
        for pid, author, ptype, text, pdate, pinned, reactions in FEED_POSTS:
            await db.feed_posts.insert_one(
                {"id": pid, "community_id": CID, "author_id": author, "type": ptype,
                 "text": text, "date": pdate, "pinned": pinned,
                 "reactions_by": reactions, "comments": FEED_COMMENTS.get(pid, []),
                 "attachment_count": 0}
            )
        changed = True
    return changed


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

    await seed_m3(db)
    await seed_m4(db)
    return True


async def _main() -> None:
    from app import db as database

    db = database.connect()
    created = await seed(db)
    print("Seeded Mani Krishna Enclave" if created else "Already seeded — skipped")
    database.disconnect()


if __name__ == "__main__":
    asyncio.run(_main())
