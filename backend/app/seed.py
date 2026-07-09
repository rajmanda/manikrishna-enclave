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

RESERVE_OPENING_BALANCE = 113000
# Withdrawals mirror the seeded work orders: May = generator annual service
# (wo-4, ₹5,500), Jun = lift door sensor approved by poll-1 (₹8,500).
RESERVE_WITHDRAWALS = {"Feb": 8000, "May": 5500, "Jun": 8500}
RESERVE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]


def build_reserve_fund(apartment_count: int) -> list[tuple[str, int, int, int]]:
    """Reserve entries at ₹500/apt monthly, with balances derived so the
    ledger always chains regardless of community size."""
    monthly = 500 * apartment_count
    balance = RESERVE_OPENING_BALANCE
    rows = []
    for month in RESERVE_MONTHS:
        withdrawal = RESERVE_WITHDRAWALS.get(month, 0)
        balance += monthly - withdrawal
        rows.append((month, monthly, withdrawal, balance))
    return rows


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
                "ledger": "community",
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

    for wo in WORK_ORDERS:
        await db.work_orders.insert_one({**wo, "community_id": CID})

    for month, contributions, expenses_amt, balance in build_reserve_fund(10):
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


async def seed_sandbox_community(
    db: Any,
    community_id: str,
    community_name: str,
    admin_email: str,
    admin_name: str,
    admin_phone: str | None,
    role: str = "property_manager",
    unit_count: int | None = None,
) -> None:
    """Provisions a sandbox community loaded with realistic Indian RWA data."""
    from datetime import datetime
    
    # Standardize/default unit count to 10 if not provided or less than 1
    final_unit_count = unit_count if (unit_count and unit_count > 0) else 10

    # 1. Insert Community
    await db.communities.insert_one({
        "id": community_id,
        "name": community_name,
        "address": "Mumbai, Maharashtra",
        "apartment_count": final_unit_count,
        "monthly_maintenance": 3500,
        "created_at": datetime.utcnow().isoformat() + "Z",
    })

    # 2. Insert Admin User (configured to switch roles to experience both PM and Owner views)
    user_role = role if role in ("property_manager", "community_admin") else "property_manager"
    await db.users.insert_one({
        "id": "u-admin",
        "community_id": community_id,
        "name": admin_name,
        "email": admin_email.lower().strip(),
        "role": user_role,
        "roles": [user_role, "owner"],
        "phone": admin_phone,
        "preferred_name": admin_name.split()[0] if admin_name else "Admin",
    })

    # 3. Seed Mock Owners (flat 101 to 502, generic Indian names)
    GENERIC_OWNERS = [
        ("101", 1, "Aditya Rao"),
        ("102", 1, "Rohan Malhotra"),
        ("201", 2, "Vikram Sen"),
        ("202", 2, "Karan Mehta"),
        ("301", 3, "Rahul Sharma"),
        ("302", 3, "Suresh Kumar"),
        ("401", 4, "Rajesh Patel"),
        ("402", 4, "Amit Patel"),
        ("501", 5, "Dr. Ram Kumar"),
        ("502", 5, "Sanjay Kapoor"),
    ]

    # Generate custom owners/apartments dynamically matching unit_count
    owners = []
    for idx in range(final_unit_count):
        if idx < len(GENERIC_OWNERS):
            owners.append(GENERIC_OWNERS[idx])
        else:
            floor = (idx // 2) + 1
            number = f"{floor}{'01' if idx % 2 == 0 else '02'}"
            name = f"Mock Resident {idx + 1}"
            owners.append((number, floor, name))

    valid_numbers = {owner[0] for owner in owners}

    for number, floor, name in owners:
        # Create Apartment
        await db.apartments.insert_one({
            "id": f"apt-{number}",
            "community_id": community_id,
            "number": number,
            "floor": floor,
            "owner_ids": [f"acct-{number}"],
        })
        # Create Account
        await db.accounts.insert_one({
            "id": f"acct-{number}",
            "community_id": community_id,
            "name": name,
            "apartment_ids": [f"apt-{number}"],
        })
        # Create Whitelisted User
        email_prefix = name.lower().replace(".", "").replace(" ", "")
        await db.users.insert_one({
            "id": f"u-{number}",
            "community_id": community_id,
            "name": name,
            "email": f"{email_prefix}-{community_id}@demo.nivaasos.com",
            "role": "owner",
            "roles": [],
            "apartment_id": f"apt-{number}",
            "phone": None,
        })

    # 4. June 2026 invoices
    for number, paid, invoice_status in JUNE_INVOICES:
        if number in valid_numbers:
            await db.invoices.insert_one({
                "id": f"inv-2606-{number}-{community_id}",
                "community_id": community_id,
                "apartment_id": f"apt-{number}",
                "period": "Jun 2026",
                "description": "Monthly Maintenance",
                "amount": 3500,
                "paid_amount": paid,
                "due_date": "2026-06-10",
                "status": invoice_status,
                "ledger": "community",
            })

    # 5. Expenses
    for i, (category, desc, vendor_id, amount, paid_date, receipt) in enumerate(EXPENSES, 1):
        await db.expenses.insert_one({
            "id": f"exp-{i}-{community_id}",
            "community_id": community_id,
            "category": category,
            "description": desc,
            "vendor_id": f"{vendor_id}-{community_id}" if vendor_id else None,
            "amount": amount,
            "paid_date": paid_date,
            "has_receipt": receipt,
        })

    # 6. Vendors
    for vid, name, service, phone, gst, amc, rating, contracts in VENDORS:
        await db.vendors.insert_one({
            "id": f"{vid}-{community_id}",
            "community_id": community_id,
            "name": name,
            "service": service,
            "phone": phone,
            "gst": gst,
            "amc_expiry": amc,
            "rating": rating,
            "active_contracts": contracts,
        })

    # 7. Payments
    for i, (number, amount, date, method, reference) in enumerate(PAYMENTS, 1):
        if number in valid_numbers:
            await db.payments.insert_one({
                "id": f"pay-{i}-{community_id}",
                "community_id": community_id,
                "invoice_id": f"inv-2606-{number}-{community_id}",
                "apartment_id": f"apt-{number}",
                "amount": amount,
                "date": date,
                "method": method,
                "reference": reference,
            })

    # 8. Work Orders
    for wo in WORK_ORDERS:
        assigned = "u-admin" if wo.get("assigned_to") == "u-vishnu" else None
        await db.work_orders.insert_one({
            **wo,
            "id": f"{wo['id']}-{community_id}",
            "community_id": community_id,
            "assigned_to": assigned,
            "vendor_id": f"{wo['vendor_id']}-{community_id}" if wo.get("vendor_id") else None,
        })

    # 9. Reserve Fund
    for month, contributions, expenses_amt, balance in build_reserve_fund(final_unit_count):
        await db.reserve_fund.insert_one({
            "community_id": community_id,
            "month": month,
            "contributions": contributions,
            "expenses": expenses_amt,
            "balance": balance,
        })

    # 10. Polls
    for pid, title, desc, op_date, cl_date, status, choices, votes in POLLS:
        # Filter votes to only include seeded apartments to avoid orphan references
        filtered_votes = {apt_id: vote for apt_id, vote in votes.items() if apt_id.replace("apt-", "") in valid_numbers}
        await db.polls.insert_one({
            "id": f"{pid}-{community_id}",
            "community_id": community_id,
            "title": title,
            "description": desc,
            "open_date": op_date,
            "close_date": cl_date,
            "status": status,
            "options": choices,
            "votes": filtered_votes,
        })

    # 11. Documents
    for doc_id, name, cat, date, version, size, ext in DOCUMENTS:
        await db.documents.insert_one({
            "id": f"{doc_id}-{community_id}",
            "community_id": community_id,
            "name": name,
            "category": cat,
            "uploaded_at": date + "T10:00:00Z",
            "uploaded_by": "u-admin",
            "version": version,
            "size_bytes": size * 1024,
            "extension": ext,
            "url": f"https://storage.googleapis.com/demo-bucket/{doc_id}.{ext}",
        })

    # 12. Meetings
    for meet_id, title, date, attendance, agenda, resolutions in MEETINGS:
        await db.meetings.insert_one({
            "id": f"{meet_id}-{community_id}",
            "community_id": community_id,
            "title": title,
            "date": date,
            "agenda": agenda,
            "resolutions": resolutions,
            "attendees_count": min(attendance, final_unit_count), # Attendance cannot exceed unit count
        })


async def _main() -> None:
    from app import db as database

    db = database.connect()
    created = await seed(db)
    print("Seeded Mani Krishna Enclave" if created else "Already seeded — skipped")
    database.disconnect()


if __name__ == "__main__":
    asyncio.run(_main())
