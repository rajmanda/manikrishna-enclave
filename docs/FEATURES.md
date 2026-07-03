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
| Invoices (view) | ✅ | Owner-scoped; Pay button decorative until M2 |
| Payments (view) | ✅ | Manager/auditor |
| Expenses, reserve fund, monthly finance (view) | ✅ | Community-transparent |
| Work orders (view, 7-stage timeline) | ✅ | Mutations/comments/photos 📋 (M3) |
| Vendors (view, GST/AMC/ratings) | ✅ | CRUD 📋 (M3) |
| Reports catalog + live cash-flow chart | 🟡 | Downloads decorative until M2/M4 PDFs |
| Community feed | 🟡 | Posts/reactions/comments UI; backend M3 |
| Polls & voting | 🟡 | Vote UI local-only; backend M4 |
| Maintenance requests (private/community) | 🟡 | Backend M3 |
| Documents (search, versions) | 🟡 | GCS backend M4 |
| Meeting minutes | 🟡 | Backend M4 |
| Notifications | 🟡 | Static bell panel; email/push M4 |
| Global search | 🟡 | Client-side over seed; endpoint M4 |
| Invoice generation, statements, late fees | 📋 | M2 |
| Receipt/photo/document uploads (GCS) | 📋 | M2/M3 |
| CI/CD, Terraform, deployment | 📋 | M1 |
| AI features, mobile app, WhatsApp | 📋 | M5 |
