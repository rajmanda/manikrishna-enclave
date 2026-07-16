# FEATURES.md

Last updated: 2026-07-03

Status legend: ✅ live end-to-end · 🟡 UI on seed data (backend pending) ·
📋 planned

| Feature | Status | Notes |
|---|---|---|
| Google OAuth login + whitelist | ✅* | Backend complete + tested; *needs OAuth client ID (M1). Dev-login works today |
| JWT sessions, immediate revocation | ✅ | Removing a user invalidates tokens on next request |
| RBAC (7 roles, auditor read-only) | ✅ | Enforced server-side, mirrored in nav/UI |
| Multi-tenant isolation | ✅ | Tested with a second community |
| Audit log on every write + viewer page | ✅ | M4 |
| Owner dashboard | ✅ | Live aggregates + invoice/payment/WO lists |
| Manager dashboard + charts | ✅ | Cash flow, collection %, reserve fund from API |
| Community/HOA page | ✅ | Summary, expense breakdown + ledger, directory with dues |
| Apartments & owners CRUD | ✅ | API complete; admin UI screens 📋 |
| Whitelist management API | ✅ | Admin UI screen 📋 |
| Invoices (full: generate/bulk/late fees/CRUD) | ✅ | M2 |
| Payments (record/reverse, credits) | ✅ | M2; owner online payment still 📋 (gateway TBD) |
| Expenses (CRUD + GCS receipts), reserve fund entries | ✅ | M2; community-transparent |
| Work orders (full lifecycle: create/stage/comments/photos) | ✅ | M3; members notified on stage changes |
| Vendors (full CRUD, delete guard) | ✅ | M3 |
| Statements + report PDFs (collection/expense/vendor-spend) + CSV | ✅ | M2/M4 |
| Community feed (posts/reactions/comments/pin) | ✅ | M3 |
| Polls & voting (one vote/apartment, results, close) | ✅ | M4 |
| Maintenance requests (private/community, status flow) | ✅ | M3 |
| Direct messages (resident ↔ manager, WhatsApp fan-out) | ✅ | One thread per resident; manager inbox with unread counts |
| Tenant lite experience (no money data server-side) | ✅ | Tenants see Maintenance + Messages only; 403 on all finance reads |
| Documents (versioned GCS uploads, search) | ✅ | M4 |
| Meeting minutes (CRUD + PDF upload) | ✅ | M4 |
| In-app notifications (live bell, read state) | ✅ | M3; email/push 📋 (needs provider decision) |
| Global search (server endpoint, all modules) | ✅ | M4 |

| CI/CD, Terraform, deployment, custom domain | ✅ | M1 |
| AI features, mobile app, WhatsApp | 📋 | M5 |
