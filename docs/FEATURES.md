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
| Audit log on every write | ✅ | `audit_log` collection; viewer UI 📋 (M4) |
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
| Statements PDF + invoices CSV | ✅ | M2; full report catalog PDFs 📋 M4 |
| Community feed (posts/reactions/comments/pin) | ✅ | M3 |
| Polls & voting | 🟡 | Vote UI local-only; backend M4 |
| Maintenance requests (private/community, status flow) | ✅ | M3 |
| Documents (search, versions) | 🟡 | GCS backend M4 |
| Meeting minutes | 🟡 | Backend M4 |
| In-app notifications (live bell, read state) | ✅ | M3; email/push 📋 M4 |
| Global search | 🟡 | Client-side over seed; endpoint M4 |
| Document uploads (society records) | 📋 | M4 (receipts + WO photos done) |
| CI/CD, Terraform, deployment, custom domain | ✅ | M1 |
| AI features, mobile app, WhatsApp | 📋 | M5 |
