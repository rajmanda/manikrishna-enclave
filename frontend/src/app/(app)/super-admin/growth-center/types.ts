// Growth Center types — isolated from src/lib/types.ts on purpose.
// These mirror backend/app/growth_center/models.py (camelCase on the wire).

export type ContentStatus = "draft" | "under_review" | "approved" | "archived";

export type TemplateType =
  | "first_contact"
  | "no_response_follow_up"
  | "demo_invitation"
  | "post_demo_pitch"
  | "stalled_close"
  | "objection_response"
  | "lead_magnet"
  | "other";

export type FunnelStage =
  | "awareness"
  | "first_contact"
  | "follow_up"
  | "demo"
  | "post_demo"
  | "closing"
  | "objection"
  | "any";

export type Channel = "whatsapp" | "email" | "linkedin" | "facebook" | "any";

export interface PlaybookSection {
  id: string;
  key: string;
  title: string;
  body: string;
  order: number;
}

export interface GrowthPlaybook {
  id: string;
  title: string;
  description: string;
  targetMarket: string;
  targetPersonas: string[];
  geography: string[];
  status: ContentStatus;
  sections: PlaybookSection[];
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  previousVersion: Record<string, unknown> | null;
}

export interface GrowthTemplate {
  id: string;
  playbookId: string | null;
  templateType: TemplateType;
  funnelStage: FunnelStage;
  channel: Channel;
  title: string;
  content: string;
  status: ContentStatus;
  tags: string[];
  targetPersona: string;
  language: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  previousVersion: Record<string, unknown> | null;
}

export interface GrowthPersona {
  id: string;
  name: string;
  description: string;
  portfolioSize: string;
  commonProblems: string[];
  buyingMotivations: string[];
  objections: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GrowthOverview {
  playbookCount: number;
  templateCount: number;
  objectionResponseCount: number;
  personaCount: number;
  draftCount: number;
  underReviewCount: number;
  approvedCount: number;
  archivedCount: number;
  lastEditedPlaybookId: string | null;
  lastEditedPlaybookTitle: string | null;
  lastEditedAt: string | null;
}

export interface GrowthSearchResult {
  entityType: "playbook" | "template" | "persona";
  id: string;
  title: string;
  snippet: string;
  status: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- CRM */

export type LeadStage =
  | "new"
  | "contacted"
  | "responded"
  | "qualified"
  | "demo_scheduled"
  | "demo_done"
  | "pilot_proposed"
  | "won"
  | "lost";

export type LeadSource =
  | "discovery"
  | "manual"
  | "facebook"
  | "linkedin"
  | "whatsapp"
  | "referral"
  | "other";

export type ActivityType =
  | "note"
  | "call"
  | "whatsapp"
  | "email"
  | "linkedin"
  | "facebook"
  | "meeting"
  | "demo"
  | "proposal"
  | "stage_change";

export interface GrowthLead {
  id: string;
  company: string;
  contactName: string;
  roleTitle: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  source: LeadSource;
  sourceUrl: string;
  area: string;
  city: string;
  address: string;
  portfolioSize: string;
  nriOwners: string;
  persona: string;
  notes: string;
  tags: string[];
  stage: LeadStage;
  stageChangedAt: string;
  lostReason: string;
  wonAt: string | null;
  nextFollowUpAt: string | null;
  nextAction: string;
  lastActivityAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthLeadActivity {
  id: string;
  leadId: string;
  activityType: ActivityType;
  summary: string;
  happenedAt: string;
  createdBy: string;
  createdAt: string;
}

export interface LeadCandidate {
  company: string;
  website: string;
  sourceUrl: string;
  snippet: string;
  phones: string[];
  emails: string[];
  area: string;
}

export interface DiscoverResponse {
  queryUsed: string;
  candidates: LeadCandidate[];
}

export interface ImportLeadsResponse {
  imported: GrowthLead[];
  skippedDuplicates: string[];
}

export interface CrmOverview {
  totalLeads: number;
  byStage: Record<string, number>;
  openLeads: number;
  wonCount: number;
  lostCount: number;
  overdueFollowUps: number;
  dueToday: number;
  dueThisWeek: number;
  unscheduledOpen: number;
}

export interface GrowthAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  actorId: string;
  actorEmail: string;
  detail: string;
  timestamp: string;
}
