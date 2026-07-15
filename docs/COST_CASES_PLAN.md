# Cost Cases — Connected Financial Workflow

Tracking doc for the connected-money feature (branch `feature/cost-cases`).
One **Cost Case** = one complete financial event (bore well repair, lift
repair, tanker expense…) connecting: Maintenance Request → Work Order →
Vendor Bill/Expense → Owner Assessment Invoices → Owner Payments →
Reconciliation.

**Architecture decisions (reuse over duplication):**
- `CostCase` is a new lean entity; all links live on the CHILD records
  (`work_orders.cost_case_id`, `expenses.cost_case_id`,
  `invoices.cost_case_id`) so existing collections are extended, not
  duplicated. The case's financial summary is always **computed live** from
  its children — no stored totals to drift.
- **Vendor Bill = an `Expense` in `draft` status** (payable awaiting
  review), not a new collection. Only a **`posted`** expense hits the
  reserve/ledger; drafts never do. This gives the estimate-vs-actual split
  with one entity. Legacy expenses are backfilled as `posted`.
- **Assessment Batch = the set of invoices sharing a `cost_case_id`**
  (grouped per generate call); batch totals are computed, not stored.
- Reserve stays anchor + live-computed from **posted** community money
  (posted-only is the new part). A double-entry ledger with reversal
  entries is out of scope for this phase (documented as future work).

## Phase 1 — Backend core

- [x] `CostCase` model (id `cc-*`, title, description, status
      `open|review|closed`, approved_budget, funding_method,
      maintenance_request_id, created_by/date, closed notes)
- [x] Link fields: `work_orders.cost_case_id`, `expenses.cost_case_id`,
      `invoices.cost_case_id` (+ generate/create request models)
- [x] `expenses.status` (`draft|posted`) — only `posted` counts in reserve,
      monthly finance, summary, reconciliation; `POST /expenses/{id}/post`
      (Writer, audited); draft = vendor bill under financial review
- [x] Cost-cases router: create (standalone or from WO), list w/ live
      summaries, detail (linked MR/WOs/expenses/invoices/payments +
      timeline), close with reconciliation guard (refuse while draft
      expenses exist or owner balances outstanding; `force` + reason,
      audited)
- [x] Automation: WO stage → `Completed` auto-creates a **draft** vendor
      bill/expense linked to WO + case (idempotent — skips if one exists);
      WO created with cost_case_id links back; generate-invoices with
      workOrderId inherits the WO's case
- [x] Reconciliation upgrade: `collectionsWithoutExpense` counts only
      POSTED expenses, carries `costCaseId`, and the warning is actionable
- [x] Migration 007: backfill `expenses.status=posted`; create the
      **Bore well repair work** cost case; link its 10 invoices/payments;
      create a `[Migrated]` work order labeled as reconstructed from
      historical data; NO expense fabricated (collected money ≠ spend)
- [x] Tests: link integrity, draft-vs-posted reserve math, auto vendor
      bill idempotency, close guard, migration on seeded data

## Phase 2 — UI

- [x] Cost Cases page (list, open/closed, live summary chips) + detail
      screen: financial summary (estimate/approved/posted/collected/
      outstanding/surplus-shortfall), Related Records (MR, WOs, expenses,
      invoices, payments), chronological timeline
- [x] Reserve warning becomes actionable: "₹X collected for … — no final
      vendor expense posted" with **Add expense**, **Open cost case**
- [x] Work order screen: cost-case link (create-case action deferred to
      Phase 3); draft bills badged in the expense ledger
- [x] Expense dialog: cost-case link via prefill from case/WO pages
      (explicit dropdown selector deferred to Phase 3); post-to-books
      action on the case screen
- [x] Nav entry (Money → Cost Cases); dashboard pointer deferred

## Phase 3 — Assessments & funding (next session)

- [x] Funding method on cost case (reserve / collect-first / pay-then-
      collect / split / selected apartments / no recovery) driving the
      assessment generator defaults — selected_apartments starts unticked;
      reserve/no-recovery cases warn before billing owners
- [x] Per-apartment allocation editor — Bill owners dialog on the case page: equal-split default of the approved budget, editable rows, tick apartments in/out, over/under-budget warning, idempotent POST /cost-cases/{id}/assessments (skips already-assessed apartments per period)
- [x] Installment plans — per-apartment installment count (once/2x/3x/6x/12x) in the Bill owners dialog; N monthly invoices per apartment ("Jul 2026 - 2/3" periods, whole-rupee split, month-end clamping), idempotent; partial payments already supported
- [x] Payment allocation across multiple invoices in one entry — Combined payment button on Invoices page: tick open invoices, live oldest-first preview, POST /payments/allocate
- [x] Credit settlement — Apply to next invoice button on the case: records a linked Credit payment (settles_cost_case_id) on the apartment's oldest open invoice outside the case; badge flips to 'credit applied' when settled; partial/repeat application supported
- [x] Waivers/adjustments — the existing Credit payment method covers waivers (counts toward paid, audited, reference note required by convention); available in Record Payment and Combined Payment dialogs. Formal approval workflow deferred to Phase 4 hardening if needed

## Phase 4 — Reports & hardening (next session)

- [x] Reports — GET /reports/money-health + "Money health" section on the
      Reports page: open cost cases (outstanding / reserve-funded shortfall /
      surplus / no-expense-posted flags), completed jobs missing their
      expense, draft vendor bills awaiting posting, outstanding assessments;
      all rows deep-link to the case/work order
- [x] Expense edit-lock once posted — amount/date/category frozen (409), delete refused; POST /expenses/{id}/reverse creates a negative offsetting entry (links preserved, pair nets to zero, reversal itself irreversible); financial edits on posted rows auto-correct (system posts reversal + corrected replacement in one step — pencil icon); trash = full cancellation via reversal; ledger badges reversed/reversal
- [x] Recurring expenses — DESCOPED by design: monthly recurring spend
      (electricity/water/watchman) is funded by monthly maintenance
      collections and needs no cost case; cases are for special-purpose
      drives. Revisit only if a recurring drive (e.g. tanker seasons)
      proves otherwise
- [x] Audit surfacing on the case timeline — expense entries show who
      created/posted them (from audit_log)

## Migration & safety checklist

- [x] DB backup before migration runs in prod (db_backup_communityhub_pre_costcases_2026-07-13.json, 1,068 docs/22 collections, local+gitignored)
- [ ] Reconciliation snapshot before/after migration (reserve, per-case
      totals) reported
- [x] No posted history modified; links added only; audit entries recorded
