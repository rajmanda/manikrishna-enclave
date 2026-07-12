"""Pydantic schemas.

These mirror frontend/src/lib/types.ts 1:1. Fields are snake_case in Python
and MongoDB, but serialize to camelCase on the wire (alias generator), so the
frontend types work unchanged against this API.
"""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


Role = Literal[
    "super_admin",
    "property_manager",
    "community_admin",
    "owner",
    "tenant",
    "vendor",
    "auditor",
]

WRITE_ROLES: tuple[str, ...] = ("super_admin", "property_manager", "community_admin")


# ---------- Community / Apartment / User ----------


class Community(APIModel):
    id: str = Field(default_factory=lambda: new_id("com"))
    name: str
    address: str = ""
    apartment_count: int = 0
    monthly_maintenance: float = 3500


class CommunityCreate(APIModel):
    name: str
    address: str = ""


class PortfolioCommunityStats(APIModel):
    """Cross-community rollup for the super-admin portfolio console.

    Financial figures cover only the "community" ledger — manager fees and
    reimbursements are the manager's personal streams and stay excluded.
    """

    id: str
    name: str
    address: str = ""
    apartment_count: int = 0
    invoiced_total: float = 0
    collected_total: float = 0
    outstanding_total: float = 0
    collection_rate: float = 0  # percentage, 0-100
    open_invoices: int = 0
    open_work_orders: int = 0


class Apartment(APIModel):
    id: str = Field(default_factory=lambda: new_id("apt"))
    community_id: str
    number: str
    floor: int = 0
    owner_ids: list[str] = []


class ApartmentCreate(APIModel):
    number: str
    floor: int = 0
    owner_ids: list[str] = []


class ApartmentUpdate(APIModel):
    number: str | None = None
    floor: int | None = None
    owner_ids: list[str] | None = None


class Account(APIModel):
    """Billing and portal-access entity — one account may own many apartments."""
    id: str = Field(default_factory=lambda: new_id("acct"))
    community_id: str
    name: str
    apartment_ids: list[str] = []


class AccountCreate(APIModel):
    name: str
    apartment_ids: list[str] = []


class AccountUpdate(APIModel):
    name: str | None = None
    apartment_ids: list[str] | None = None


class LegalOwner(APIModel):
    """Legal title holder for an apartment — separate from portal/billing."""
    id: str = Field(default_factory=lambda: new_id("lo"))
    community_id: str
    apartment_id: str
    name: str
    ownership_percentage: float = 100.0


class LegalOwnerCreate(APIModel):
    apartment_id: str
    name: str
    ownership_percentage: float = 100.0


class LegalOwnerUpdate(APIModel):
    name: str | None = None
    ownership_percentage: float | None = None


class User(APIModel):
    id: str = Field(default_factory=lambda: new_id("u"))
    community_id: str
    # Additional communities this user owns/administers beyond community_id.
    # Super admins are scoped to community_id + community_ids — never the
    # whole platform (multiple independent super admins coexist).
    community_ids: list[str] = []
    name: str
    email: EmailStr
    role: Role  # active role — all RBAC reads this
    roles: list[Role] = []  # roles this user may switch between ([] = just `role`)
    account_id: str | None = None  # links to Account for multi-apartment support
    apartment_id: str | None = None  # primary apartment (legacy, derived from account)
    apartment_ids: list[str] = []  # all apartments via account — populated at login
    phone: str | None = None
    preferred_name: str | None = None  # overrides the derived short name in messages

    @property
    def display_name(self) -> str:
        """Formatted short display name, e.g. 'Vijayaram Manda (401/402)' or 'Vishnu Manchala (Manager)'."""
        if self.preferred_name and self.preferred_name.strip():
            short_name = self.preferred_name.strip()
        else:
            parts = self.name.split()
            if len(parts) >= 2:
                short_name = f"{parts[0]} {parts[-1]}"
            else:
                short_name = self.name

        if self.role in ("property_manager", "community_admin", "super_admin"):
            return f"{short_name} (Manager)"

        apts = [a.replace("apt-", "") for a in self.apartment_ids if a]
        if not apts and self.apartment_id:
            apts = [self.apartment_id.replace("apt-", "")]

        if apts:
            apt_str = "/".join(apts)
            return f"{short_name} ({apt_str})"

        return short_name



class UserCreate(APIModel):
    """Adding a user = whitelisting their Google account email."""

    name: str
    email: EmailStr
    role: Role = "owner"
    account_id: str | None = None
    apartment_id: str | None = None
    phone: str | None = None
    preferred_name: str | None = None


class UserUpdate(APIModel):
    name: str | None = None
    email: EmailStr | None = None  # changing it re-keys the whitelist
    role: Role | None = None
    roles: list[Role] | None = None
    account_id: str | None = None
    apartment_id: str | None = None
    phone: str | None = None
    preferred_name: str | None = None  # "" clears the override


class SwitchRoleRequest(APIModel):
    role: Role


# ---------- Auth ----------


class GoogleLoginRequest(APIModel):
    id_token: str


class DevLoginRequest(APIModel):
    email: EmailStr


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    user: User


# ---------- Finance ----------

InvoiceStatus = Literal["paid", "due", "overdue", "partial"]


class Invoice(APIModel):
    id: str = Field(default_factory=lambda: new_id("inv"))
    community_id: str
    apartment_id: str
    period: str
    description: str
    amount: float
    paid_amount: float = 0
    due_date: str
    status: InvoiceStatus = "due"
    parent_invoice_id: str | None = None  # set on late-fee invoices
    # "community" money vs the manager's personal streams (monthly service
    # fee / flat-specific reimbursements) — never mixed into community funds.
    ledger: Literal["community", "manager_fee", "reimbursement"] = "community"
    line_items: list["InvoiceLineItem"] = []


class InvoiceLineItem(APIModel):
    description: str
    amount: float


class BillOwnerRequest(APIModel):
    """Itemized personal charges the manager collects from one apartment."""

    apartment_id: str
    period: str
    due_date: str
    description: str = "Flat expenses"
    line_items: list[InvoiceLineItem]


class InvoiceCreate(APIModel):
    apartment_id: str
    period: str
    description: str
    amount: float
    due_date: str


class InvoiceUpdate(APIModel):
    description: str | None = None
    period: str | None = None
    amount: float | None = None
    due_date: str | None = None


class GenerateInvoicesRequest(APIModel):
    period: str  # e.g. "Jul 2026"
    due_date: str
    amount: float | None = None  # defaults to community.monthly_maintenance
    description: str = "Monthly Maintenance"
    apartment_ids: list[str] | None = None  # None = all apartments


class ApplyLateFeesRequest(APIModel):
    period: str
    amount: float
    due_date: str


class Payment(APIModel):
    id: str = Field(default_factory=lambda: new_id("pay"))
    community_id: str
    invoice_id: str
    apartment_id: str
    amount: float
    date: str
    # "Credit" records an adjustment (waiver/advance) — counts toward paid.
    method: Literal["UPI", "Bank Transfer", "Cash", "Cheque", "Credit"]
    reference: str = ""
    # Owner-reported payments start pending; only confirmed ones count.
    status: Literal["pending", "confirmed"] = "confirmed"
    reported_by: str | None = None
    ledger: Literal["community", "manager_fee", "reimbursement"] = "community"


class PaymentReport(APIModel):
    """Owner-submitted claim that they paid an invoice offline."""

    invoice_id: str
    amount: float
    date: str
    method: Literal["UPI", "Bank Transfer", "Cash", "Cheque"]
    reference: str = ""


class PaymentCreate(APIModel):
    invoice_id: str
    amount: float
    date: str
    method: Literal["UPI", "Bank Transfer", "Cash", "Cheque", "Credit"]
    reference: str = ""


class Expense(APIModel):
    id: str = Field(default_factory=lambda: new_id("exp"))
    community_id: str
    category: str
    description: str
    vendor_id: str | None = None
    amount: float
    paid_date: str
    has_receipt: bool = False
    receipt_path: str | None = None


class ExpenseCreate(APIModel):
    category: str
    description: str
    vendor_id: str | None = None
    amount: float
    paid_date: str


class ExpenseUpdate(APIModel):
    category: str | None = None
    description: str | None = None
    vendor_id: str | None = None
    amount: float | None = None
    paid_date: str | None = None


class ReserveFundEntry(APIModel):
    month: str
    contributions: float
    expenses: float
    balance: float


class ReserveEntryCreate(APIModel):
    month: str
    contributions: float
    expenses: float = 0


class MonthlyFinance(APIModel):
    month: str
    income: float
    expenses: float
    collection_rate: float


class Vendor(APIModel):
    id: str = Field(default_factory=lambda: new_id("v"))
    community_id: str
    name: str
    service: str
    phone: str
    gst: str | None = None
    amc_expiry: str | None = None
    rating: float = 0
    active_contracts: int = 0


class VendorCreate(APIModel):
    name: str
    service: str
    phone: str
    gst: str | None = None
    amc_expiry: str | None = None
    rating: float = 0
    active_contracts: int = 0


class VendorUpdate(APIModel):
    name: str | None = None
    service: str | None = None
    phone: str | None = None
    gst: str | None = None
    amc_expiry: str | None = None
    rating: float | None = None
    active_contracts: int | None = None


# ---------- Maintenance / Feed / Notifications (M3) ----------


class MaintenanceRequest(APIModel):
    id: str = Field(default_factory=lambda: new_id("mr"))
    community_id: str
    title: str
    description: str = ""
    visibility: Literal["private", "community"] = "community"
    status: Literal["Open", "In Progress", "Resolved"] = "Open"
    created_by: str
    created_date: str


class MaintenanceCreate(APIModel):
    title: str
    description: str = ""
    visibility: Literal["private", "community"] = "community"


class MaintenanceStatusUpdate(APIModel):
    status: Literal["Open", "In Progress", "Resolved"]


class FeedReactions(APIModel):
    like: int = 0
    heart: int = 0
    thanks: int = 0


class FeedComment(APIModel):
    author_id: str
    text: str
    date: str


class FeedPost(APIModel):
    # Stored shape - reactions kept per-user so toggling works.
    id: str = Field(default_factory=lambda: new_id("post"))
    community_id: str
    author_id: str
    type: Literal["announcement", "question", "suggestion", "photo"] = "announcement"
    text: str
    date: str
    pinned: bool = False
    reactions_by: dict[str, str] = {}  # user_id -> like|heart|thanks
    comments: list[FeedComment] = []
    attachment_count: int = 0


class FeedPostOut(APIModel):
    # Wire shape - matches frontend types plus the caller's own reaction.
    id: str
    community_id: str
    author_id: str
    type: str
    text: str
    date: str
    pinned: bool
    reactions: FeedReactions
    comments: list[FeedComment]
    attachment_count: int
    my_reaction: str | None = None


class FeedPostCreate(APIModel):
    type: Literal["announcement", "question", "suggestion", "photo"] = "announcement"
    text: str


class ReactRequest(APIModel):
    kind: Literal["like", "heart", "thanks", "none"]


class Notification(APIModel):
    id: str = Field(default_factory=lambda: new_id("n"))
    community_id: str
    user_id: str
    text: str
    date: str
    read: bool = False
    type: str = "announcement"
    href: str | None = None  # in-app deep link


# ---------- Work orders ----------

WorkOrderStage = Literal[
    "Reported",
    "Estimate Received",
    "Owner Approval",
    "In Progress",
    "Inspection",
    "Completed",
    "Closed",
]


class WorkOrderEvent(APIModel):
    stage: WorkOrderStage
    date: str
    note: str = ""


class WorkOrderComment(APIModel):
    author_id: str
    date: str
    text: str


class WorkOrder(APIModel):
    id: str = Field(default_factory=lambda: new_id("wo"))
    community_id: str
    title: str
    description: str = ""
    priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
    stage: WorkOrderStage = "Reported"
    vendor_id: str | None = None
    assigned_to: str | None = None
    estimate: float | None = None
    final_cost: float | None = None
    reported_date: str
    photo_count: int = 0
    photos: list[str] = []  # GCS object paths
    timeline: list[WorkOrderEvent] = []
    comments: list[WorkOrderComment] = []


class WorkOrderCreate(APIModel):
    title: str
    description: str = ""
    priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
    vendor_id: str | None = None
    estimate: float | None = None


class WorkOrderUpdate(APIModel):
    title: str | None = None
    description: str | None = None
    priority: Literal["Low", "Medium", "High", "Urgent"] | None = None
    vendor_id: str | None = None
    assigned_to: str | None = None
    estimate: float | None = None
    final_cost: float | None = None


class StageUpdate(APIModel):
    stage: WorkOrderStage
    note: str = ""
    final_cost: float | None = None


class CommentCreate(APIModel):
    text: str


# ---------- Dashboard ----------


class OwnerDashboard(APIModel):
    outstanding_balance: float
    open_work_orders: int
    month_expenses: float
    reserve_fund_balance: float


class CommunitySummary(APIModel):
    """HOA-page financial summary — visible to every member (PRD)."""

    month_income: float
    month_expenses: float
    outstanding_dues: float
    reserve_fund_balance: float


class FeeEnrollment(APIModel):
    apartment_id: str
    amount: float
    active: bool = True


class FeeEnrollmentsUpdate(APIModel):
    enrollments: list[FeeEnrollment]


class FeeGenerateRequest(APIModel):
    period: str
    due_date: str


class NavBadges(APIModel):
    """Live counts for navigation badges — state-driven, role-scoped."""

    open_invoices: int = 0
    pending_payment_confirmations: int = 0


class ManagerDashboard(APIModel):
    outstanding_collections: float
    payments_received: float
    month_expenses: float
    reserve_fund_balance: float
    open_work_orders: int
    pending_approvals: int
    overdue_invoices: int
    pending_payment_confirmations: int = 0
    fee_outstanding: float = 0  # manager service-fee ledger (separate money)
    fee_collected: float = 0


# ---------- Audit ----------


class AuditEntry(APIModel):
    id: str = Field(default_factory=lambda: new_id("aud"))
    community_id: str
    user_id: str
    user_name: str
    action: str  # create | update | delete
    entity: str  # collection name
    entity_id: str
    timestamp: str
    details: dict = {}


# ---------- Governance (M4) ----------


class PollOptionOut(APIModel):
    label: str
    votes: int


class Poll(APIModel):
    # Stored shape - one vote per apartment (votes_by: apartment_id -> label).
    id: str = Field(default_factory=lambda: new_id("poll"))
    community_id: str
    question: str
    description: str = ""
    open_date: str
    close_date: str
    status: Literal["open", "closed"] = "open"
    option_labels: list[str] = []
    votes_by: dict[str, str] = {}


class PollOut(APIModel):
    id: str
    community_id: str
    question: str
    description: str
    open_date: str
    close_date: str
    status: str
    options: list[PollOptionOut]
    total_eligible: int
    my_vote: str | None = None


class PollCreate(APIModel):
    question: str
    description: str = ""
    close_date: str
    options: list[str]


class VoteRequest(APIModel):
    option: str


class CommunityDocument(APIModel):
    id: str = Field(default_factory=lambda: new_id("doc"))
    community_id: str
    title: str
    category: str
    uploaded_date: str
    version: int = 1
    size_kb: int = 0
    file_type: Literal["pdf", "image", "sheet"] = "pdf"
    path: str | None = None  # None for legacy metadata-only entries
    uploaded_by: str | None = None


class Meeting(APIModel):
    id: str = Field(default_factory=lambda: new_id("meet"))
    community_id: str
    title: str
    date: str
    attendance: int = 0
    attendees: list[str] = []  # apartment IDs that attended
    agenda: list[str] = []
    resolutions: list[str] = []
    has_pdf: bool = False
    has_audio: bool = False
    minutes_path: str | None = None


class MeetingCreate(APIModel):
    title: str
    date: str
    attendance: int = 0
    attendees: list[str] = []
    agenda: list[str] = []
    resolutions: list[str] = []


class MeetingUpdate(APIModel):
    title: str | None = None
    date: str | None = None
    attendance: int | None = None
    attendees: list[str] | None = None
    agenda: list[str] | None = None
    resolutions: list[str] | None = None


class SearchResult(APIModel):
    category: str
    title: str
    subtitle: str
    href: str


# ---------- Notification Queue (Outbound) ----------

NotificationChannel = Literal["whatsapp", "email", "in_app"]
NotificationStatus = Literal["pending", "processing", "sent", "failed", "cancelled"]

NotificationEventType = Literal[
    "invoice_created",
    "payment_reminder",
    "payment_received",
    "common_expense_created",
    "work_order_created",
    "work_order_status_updated",
    "owner_approval_required",
    "announcement_posted",
    "lead_captured",
]


class NotificationRecord(APIModel):
    """Outbound notification queue entry — polled by OpenClaw for WhatsApp delivery."""

    notification_id: str = Field(default_factory=lambda: new_id("ntf"))
    community_id: str
    recipient_type: str  # e.g. "owner", "tenant", "manager"
    recipient_account_id: str | None = None
    recipient_user_id: str | None = None
    recipient_name: str
    recipient_phone: str | None = None
    channel: NotificationChannel
    event_type: NotificationEventType
    title: str
    message: str
    payload: dict = {}
    status: NotificationStatus = "pending"
    provider: str | None = None  # e.g. "openclaw", "sendgrid"
    retry_count: int = 0
    max_retries: int = 3
    scheduled_at: str | None = None
    sent_at: str | None = None
    failed_at: str | None = None
    error_message: str | None = None
    created_at: str = ""
    updated_at: str = ""


class NotificationRecordCreate(APIModel):
    """API body for manually creating a notification queue entry."""

    recipient_type: str
    recipient_account_id: str | None = None
    recipient_user_id: str | None = None
    recipient_name: str
    recipient_phone: str | None = None
    channel: NotificationChannel
    event_type: NotificationEventType
    title: str
    message: str
    payload: dict = {}
    scheduled_at: str | None = None


class MarkSentRequest(APIModel):
    sent_at: str | None = None


class MarkFailedRequest(APIModel):
    error_message: str


# ---------- Marketing Leads ----------


class Lead(APIModel):
    id: str = Field(default_factory=lambda: new_id("lead"))
    name: str
    phone: str
    email: EmailStr
    community_name: str
    unit_count: int | None = None
    role: str | None = None  # e.g., "manager", "committee_member", "owner"
    created_at: str = ""


class LeadCreate(APIModel):
    name: str
    phone: str
    email: EmailStr
    community_name: str
    unit_count: int | None = None
    role: str | None = None


