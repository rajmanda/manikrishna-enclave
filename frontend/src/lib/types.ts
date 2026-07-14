// Core domain types — mirrors the planned MongoDB schema so the FastAPI
// backend can adopt these shapes 1:1 (API-first design).

export type Role =
  | "super_admin"
  | "property_manager"
  | "community_admin"
  | "owner"
  | "tenant"
  | "vendor"
  | "auditor";

export interface Community {
  id: string;
  name: string;
  address: string;
  apartmentCount: number;
}

// Community setup progress for the guided Setup Assistant.
export interface SetupStatus {
  apartments: number;
  households: number;
  flatsWithHousehold: number;
  owners: number;
  tenants: number;
  managers: number;
}

export interface SetupResidentResult {
  apartmentId: string;
  ok: boolean;
  error: string | null;
}

// One community membership of the signed-in person (same email).
export interface MembershipInfo {
  userId: string;
  communityId: string;
  communityName: string;
  role: Role;
}

// Super-admin portfolio console rollup (community ledger only).
export interface PortfolioCommunityStats {
  id: string;
  name: string;
  address: string;
  apartmentCount: number;
  invoicedTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  collectionRate: number; // percentage, 0-100
  openInvoices: number;
  openWorkOrders: number;
}

export interface Apartment {
  id: string;
  communityId: string;
  number: string;
  floor: number;
  ownerIds: string[];
}

export interface Account {
  id: string;
  communityId: string;
  name: string;
  apartmentIds: string[];
}

export interface LegalOwner {
  id: string;
  communityId: string;
  apartmentId: string;
  name: string;
  ownershipPercentage: number;
}

export interface User {
  id: string;
  communityId: string;
  /** Extra communities a super admin owns (portfolio scope). */
  communityIds?: string[];
  name: string;
  email: string;
  role: Role;
  roles?: Role[];
  accountId?: string;
  apartmentId?: string;
  apartmentIds?: string[];
  phone?: string;
  preferredName?: string;
}

export type InvoiceStatus = "paid" | "due" | "overdue" | "partial";

export interface Invoice {
  id: string;
  communityId: string;
  apartmentId: string;
  period: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: InvoiceStatus;
  ledger?: "community" | "manager_fee" | "reimbursement";
  lineItems?: { description: string; amount: number }[];
  parentInvoiceId?: string | null;
  workOrderId?: string | null;
  costCaseId?: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  apartmentId: string;
  amount: number;
  date: string;
  method: "UPI" | "Bank Transfer" | "Cash" | "Cheque" | "Credit";
  reference: string;
  status?: "pending" | "confirmed";
  reportedBy?: string | null;
  ledger?: "community" | "manager_fee" | "reimbursement";
}

export type ExpenseCategory =
  | "Electricity"
  | "Water"
  | "Watchman"
  | "Lift"
  | "Generator"
  | "Repairs"
  | "Garden"
  | "Cleaning"
  | "Miscellaneous";

export interface Expense {
  id: string;
  communityId: string;
  category: ExpenseCategory;
  description: string;
  vendorId?: string;
  amount: number;
  paidDate: string;
  hasReceipt: boolean;
  workOrderId?: string | null;
  costCaseId?: string | null;
  // draft = vendor bill under financial review (not yet in the books)
  status?: "draft" | "posted";
  reversalOf?: string | null;
  reversedBy?: string | null;
}

export type WorkOrderStage =
  | "Reported"
  | "Estimate Received"
  | "Owner Approval"
  | "In Progress"
  | "Inspection"
  | "Completed"
  | "Closed";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export interface WorkOrderEvent {
  stage: WorkOrderStage;
  date: string;
  note: string;
}

export interface WorkOrderComment {
  authorId: string;
  date: string;
  text: string;
}

export interface WorkOrder {
  id: string;
  communityId: string;
  title: string;
  description: string;
  priority: Priority;
  stage: WorkOrderStage;
  vendorId?: string;
  assignedTo?: string;
  estimate?: number;
  finalCost?: number;
  reportedDate: string;
  photoCount: number;
  photos?: string[];
  timeline: WorkOrderEvent[];
  comments: WorkOrderComment[];
  maintenanceRequestId?: string | null;
  costCaseId?: string | null;
}

export interface ReserveReconciliation {
  anchorMonth: string | null;
  anchorCutoff: string | null;
  anchoredContributions?: number;
  anchoredExpenses?: number;
  recordedContributions?: number;
  recordedExpenses?: number;
  unanchoredContributions?: number;
  unanchoredExpenses?: number;
  collectionsWithoutExpense?: {
    description: string;
    period?: string | null;
    workOrderId?: string | null;
    costCaseId?: string | null;
    billed: number;
    collected: number;
  }[];
}

export interface CostCaseSummary {
  estimatedCost: number;
  approvedBudget?: number | null;
  actualCost: number;
  draftBills: number;
  draftBillAmount: number;
  billedToOwners: number;
  collectedFromOwners: number;
  outstandingFromOwners: number;
  reserveFunded: number;
  surplusCollected: number;
  awaitingVendorBill: boolean;
}

export interface CostCase {
  id: string;
  communityId: string;
  title: string;
  description: string;
  status: "open" | "review" | "closed";
  approvedBudget?: number | null;
  fundingMethod?: string | null;
  maintenanceRequestId?: string | null;
  createdDate: string;
  closedDate?: string | null;
  closeNote?: string;
  summary: CostCaseSummary;
}

export interface CostCaseDetail extends CostCase {
  maintenanceRequest?: MaintenanceRequest | null;
  workOrders: WorkOrder[];
  expenses: Expense[];
  invoices: Invoice[];
  payments: Payment[];
  timeline: { date: string; kind: string; label: string }[];
}

export interface MaintenanceRequest {
  id: string;
  communityId: string;
  title: string;
  description: string;
  visibility: "private" | "community";
  status: "Open" | "In Progress" | "Resolved";
  createdBy: string;
  createdDate: string;
}

export interface FeedPost {
  id: string;
  communityId: string;
  authorId: string;
  type: "announcement" | "question" | "suggestion" | "photo";
  text: string;
  date: string;
  pinned: boolean;
  reactions: { like: number; heart: number; thanks: number };
  comments: { authorId: string; text: string; date: string }[];
  attachmentCount: number;
  myReaction?: "like" | "heart" | "thanks" | null;
}

export interface PollOption {
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  communityId: string;
  question: string;
  description: string;
  openDate: string;
  closeDate: string;
  status: "open" | "closed";
  options: PollOption[];
  totalEligible: number;
  myVote?: string | null;
}

export interface Vendor {
  id: string;
  communityId: string;
  name: string;
  service: string;
  phone: string;
  gst?: string;
  amcExpiry?: string;
  rating: number;
  activeContracts: number;
}

export interface PlatformInsights {
  generatedAt: string;
  totals: {
    communities: number;
    apartments: number;
    users: number;
    activatedUsers: number;
    active7d: number;
    active30d: number;
    actions30d: number;
    logins: number;
    billed: number;
    collected: number;
    collectionRate: number;
  };
  funnel: { stage: string; count: number }[];
  roles: { role: string; count: number; activated: number }[];
  activitySeries: { date: string; actions: number; activeUsers: number }[];
  moduleUsage: { module: string; actions: number }[];
  communities: {
    id: string;
    name: string;
    apartments: number;
    users: number;
    activatedUsers: number;
    active7d: number;
    actions30d: number;
    lastActivity?: string | null;
    billed: number;
    collected: number;
    collectionRate: number;
  }[];
  userAdoption: {
    id: string;
    name: string;
    email: string;
    role: string;
    communityId: string;
    communityName: string;
    lastLogin?: string | null;
    loginCount: number;
  }[];
}

export interface CommunityDocument {
  id: string;
  communityId: string;
  title: string;
  category: string;
  uploadedDate: string;
  version: number;
  sizeKb: number;
  fileType: "pdf" | "image" | "sheet";
  path?: string | null;
  // Visibility scope: empty/undefined = whole community; otherwise only
  // owners/tenants of these apartments (managers always see everything).
  apartmentIds?: string[] | null;
  invoiceId?: string | null;
}

export interface Meeting {
  id: string;
  communityId: string;
  title: string;
  date: string;
  attendance: number;
  attendees: string[];  // apartment IDs
  agenda: string[];
  resolutions: string[];
  hasPdf: boolean;
  hasAudio: boolean;
  minutesPath?: string | null;
}

export interface ReserveFundEntry {
  month: string;
  contributions: number;
  expenses: number;
  balance: number;
}

export interface MonthlyFinance {
  month: string;
  income: number;
  expenses: number;
  collectionRate: number;
}

export interface OwnerDashboardData {
  outstandingBalance: number;
  openWorkOrders: number;
  monthExpenses: number;
  reserveFundBalance: number;
}

export interface ManagerDashboardData {
  outstandingCollections: number;
  paymentsReceived: number;
  monthExpenses: number;
  reserveFundBalance: number;
  openWorkOrders: number;
  pendingApprovals: number;
  overdueInvoices: number;
  pendingPaymentConfirmations: number;
  feeOutstanding: number;
  feeCollected: number;
}

export interface FeeEnrollment {
  apartmentId: string;
  amount: number;
  active: boolean;
}

export interface CommunitySummary {
  monthIncome: number;
  monthExpenses: number;
  outstandingDues: number;
  reserveFundBalance: number;
}

export interface LegalOwner {
  id: string;
  communityId: string;
  apartmentId: string;
  name: string;
  ownershipPercentage: number;
}

export interface SearchResult {
  category: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface AuditEntry {
  id: string;
  communityId: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface NavBadges {
  openInvoices: number;
  pendingPaymentConfirmations: number;
}

export interface Notification {
  id: string;
  text: string;
  date: string;
  read: boolean;
  type: "invoice" | "work_order" | "poll" | "announcement" | "meeting";
  href?: string | null;
}
