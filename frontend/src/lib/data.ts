// Initial seed data for the first customer: Mani Krishna Enclave.
// This is the only seed dataset — the app itself is community-agnostic
// and every record is keyed by communityId (multi-tenant ready).

import type {
  Apartment,
  Community,
  CommunityDocument,
  Expense,
  FeedPost,
  Invoice,
  MaintenanceRequest,
  Meeting,
  MonthlyFinance,
  Notification,
  Payment,
  Poll,
  ReserveFundEntry,
  User,
  Vendor,
  WorkOrder,
} from "./types";

const CID = "mke";

export const community: Community = {
  id: CID,
  name: "Mani Krishna Enclave",
  address: "Hyderabad, Telangana",
  apartmentCount: 10,
};

export const apartments: Apartment[] = [
  { id: "apt-101", communityId: CID, number: "101", floor: 1, ownerIds: ["u-101"] },
  { id: "apt-102", communityId: CID, number: "102", floor: 1, ownerIds: ["u-102"] },
  { id: "apt-201", communityId: CID, number: "201", floor: 2, ownerIds: ["u-201"] },
  { id: "apt-202", communityId: CID, number: "202", floor: 2, ownerIds: ["u-202"] },
  { id: "apt-301", communityId: CID, number: "301", floor: 3, ownerIds: ["u-301"] },
  { id: "apt-302", communityId: CID, number: "302", floor: 3, ownerIds: ["u-302"] },
  { id: "apt-401", communityId: CID, number: "401", floor: 4, ownerIds: ["u-401"] },
  { id: "apt-402", communityId: CID, number: "402", floor: 4, ownerIds: ["u-402"] },
  { id: "apt-501", communityId: CID, number: "501", floor: 5, ownerIds: ["u-501"] },
  { id: "apt-502", communityId: CID, number: "502", floor: 5, ownerIds: ["u-502"] },
];

export const users: User[] = [
  { id: "u-vishnu", communityId: CID, name: "Vishnu", email: "vishnu@communityhub.app", role: "property_manager", phone: "+91 98xxx xxxxx" },
  { id: "u-101", communityId: CID, name: "M.V. Shanmukha Datta", email: "owner101@example.com", role: "owner", apartmentId: "apt-101" },
  { id: "u-102", communityId: CID, name: "Pasupuleti Ramesh Babu & Anjali", email: "owner102@example.com", role: "owner", apartmentId: "apt-102" },
  { id: "u-201", communityId: CID, name: "B.O. Dharani Kumar", email: "owner201@example.com", role: "owner", apartmentId: "apt-201" },
  { id: "u-202", communityId: CID, name: "Vani Padma Sri Manda", email: "owner202@example.com", role: "owner", apartmentId: "apt-202" },
  { id: "u-301", communityId: CID, name: "Bhupendra Krishna Sangam", email: "owner301@example.com", role: "owner", apartmentId: "apt-301" },
  { id: "u-302", communityId: CID, name: "Subhasri Lakshmi Sangam", email: "owner302@example.com", role: "owner", apartmentId: "apt-302" },
  { id: "u-401", communityId: CID, name: "Kanamatha Reddy & Vani Kanyakaparameswari", email: "owner401@example.com", role: "owner", apartmentId: "apt-401" },
  { id: "u-402", communityId: CID, name: "Vijayaram Sri Venkata Manda & Bhargavi Manda", email: "owner402@example.com", role: "owner", apartmentId: "apt-402" },
  { id: "u-501", communityId: CID, name: "Prof. Dr. Ramakrishna Manda & Smt. Ratnamamba Manda", email: "owner501@example.com", role: "owner", apartmentId: "apt-501" },
  { id: "u-502", communityId: CID, name: "Rajaram Sri Venkata Manda & Sushma Manda", email: "owner502@example.com", role: "owner", apartmentId: "apt-502" },
];

// The demo user for the "owner" role view (apartment 502).
export const currentOwner = users.find((u) => u.id === "u-502")!;
export const propertyManager = users.find((u) => u.id === "u-vishnu")!;

export const vendors: Vendor[] = [
  { id: "v-lift", communityId: CID, name: "Sree Lift Services", service: "Lift AMC", phone: "+91 90000 11111", gst: "36AAACS1111A1Z5", amcExpiry: "2026-12-31", rating: 4.5, activeContracts: 1 },
  { id: "v-elec", communityId: CID, name: "Kumar Electricals", service: "Electrician", phone: "+91 90000 22222", rating: 4.2, activeContracts: 0 },
  { id: "v-plumb", communityId: CID, name: "Srinivas Plumbing Works", service: "Plumber", phone: "+91 90000 33333", rating: 4.0, activeContracts: 0 },
  { id: "v-gen", communityId: CID, name: "PowerGen Solutions", service: "Generator AMC", phone: "+91 90000 44444", gst: "36AABCP2222B1Z8", amcExpiry: "2026-09-30", rating: 4.7, activeContracts: 1 },
  { id: "v-clean", communityId: CID, name: "CleanPro Facility Services", service: "Cleaning", phone: "+91 90000 55555", rating: 3.9, activeContracts: 1 },
  { id: "v-sec", communityId: CID, name: "Guardian Security Agency", service: "Security / Watchman", phone: "+91 90000 66666", gst: "36AADCG3333C1Z2", amcExpiry: "2027-03-31", rating: 4.4, activeContracts: 1 },
  { id: "v-garden", communityId: CID, name: "Green Thumb Gardeners", service: "Gardener", phone: "+91 90000 77777", rating: 4.1, activeContracts: 1 },
  { id: "v-paint", communityId: CID, name: "Rainbow Painters", service: "Painter", phone: "+91 90000 88888", rating: 4.3, activeContracts: 0 },
];

// June 2026 invoices — monthly maintenance ₹3,500 per apartment.
export const invoices: Invoice[] = [
  { id: "inv-2606-101", communityId: CID, apartmentId: "apt-101", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-102", communityId: CID, apartmentId: "apt-102", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-201", communityId: CID, apartmentId: "apt-201", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 0, dueDate: "2026-06-10", status: "overdue" },
  { id: "inv-2606-202", communityId: CID, apartmentId: "apt-202", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-301", communityId: CID, apartmentId: "apt-301", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 2000, dueDate: "2026-06-10", status: "partial" },
  { id: "inv-2606-302", communityId: CID, apartmentId: "apt-302", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-401", communityId: CID, apartmentId: "apt-401", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 0, dueDate: "2026-06-10", status: "overdue" },
  { id: "inv-2606-402", communityId: CID, apartmentId: "apt-402", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-501", communityId: CID, apartmentId: "apt-501", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-06-10", status: "paid" },
  { id: "inv-2606-502", communityId: CID, apartmentId: "apt-502", period: "Jun 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 0, dueDate: "2026-06-10", status: "due" },
  { id: "inv-2607-502", communityId: CID, apartmentId: "apt-502", period: "Jul 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 0, dueDate: "2026-07-10", status: "due" },
  { id: "inv-2605-502", communityId: CID, apartmentId: "apt-502", period: "May 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-05-10", status: "paid" },
  { id: "inv-2604-502", communityId: CID, apartmentId: "apt-502", period: "Apr 2026", description: "Monthly Maintenance", amount: 3500, paidAmount: 3500, dueDate: "2026-04-10", status: "paid" },
];

export const payments: Payment[] = [
  { id: "pay-1", invoiceId: "inv-2606-101", apartmentId: "apt-101", amount: 3500, date: "2026-06-04", method: "UPI", reference: "UPI-8891" },
  { id: "pay-2", invoiceId: "inv-2606-102", apartmentId: "apt-102", amount: 3500, date: "2026-06-05", method: "UPI", reference: "UPI-8934" },
  { id: "pay-3", invoiceId: "inv-2606-202", apartmentId: "apt-202", amount: 3500, date: "2026-06-06", method: "Bank Transfer", reference: "NEFT-1201" },
  { id: "pay-4", invoiceId: "inv-2606-301", apartmentId: "apt-301", amount: 2000, date: "2026-06-08", method: "Cash", reference: "CSH-014" },
  { id: "pay-5", invoiceId: "inv-2606-302", apartmentId: "apt-302", amount: 3500, date: "2026-06-08", method: "UPI", reference: "UPI-9102" },
  { id: "pay-6", invoiceId: "inv-2606-402", apartmentId: "apt-402", amount: 3500, date: "2026-06-09", method: "UPI", reference: "UPI-9188" },
  { id: "pay-7", invoiceId: "inv-2606-501", apartmentId: "apt-501", amount: 3500, date: "2026-06-09", method: "Bank Transfer", reference: "NEFT-1245" },
  { id: "pay-8", invoiceId: "inv-2605-502", apartmentId: "apt-502", amount: 3500, date: "2026-05-07", method: "UPI", reference: "UPI-7756" },
  { id: "pay-9", invoiceId: "inv-2604-502", apartmentId: "apt-502", amount: 3500, date: "2026-04-06", method: "UPI", reference: "UPI-6620" },
];

export const expenses: Expense[] = [
  { id: "exp-1", communityId: CID, category: "Electricity", description: "Common area power bill — June", vendorId: undefined, amount: 4820, paidDate: "2026-06-15", hasReceipt: true },
  { id: "exp-2", communityId: CID, category: "Water", description: "Water tanker × 4", amount: 3200, paidDate: "2026-06-12", hasReceipt: true },
  { id: "exp-3", communityId: CID, category: "Watchman", description: "Watchman salary — June", vendorId: "v-sec", amount: 15000, paidDate: "2026-06-01", hasReceipt: true },
  { id: "exp-4", communityId: CID, category: "Lift", description: "Lift AMC quarterly payment", vendorId: "v-lift", amount: 7500, paidDate: "2026-06-10", hasReceipt: true },
  { id: "exp-5", communityId: CID, category: "Generator", description: "Diesel top-up 40L", vendorId: "v-gen", amount: 3760, paidDate: "2026-06-18", hasReceipt: true },
  { id: "exp-6", communityId: CID, category: "Repairs", description: "Bore motor starter replacement", vendorId: "v-elec", amount: 2850, paidDate: "2026-06-20", hasReceipt: true },
  { id: "exp-7", communityId: CID, category: "Garden", description: "Gardener monthly service", vendorId: "v-garden", amount: 2000, paidDate: "2026-06-05", hasReceipt: false },
  { id: "exp-8", communityId: CID, category: "Cleaning", description: "Common area cleaning — June", vendorId: "v-clean", amount: 4500, paidDate: "2026-06-03", hasReceipt: true },
  { id: "exp-9", communityId: CID, category: "Miscellaneous", description: "Festival decoration supplies", amount: 1200, paidDate: "2026-06-22", hasReceipt: false },
];

export const workOrders: WorkOrder[] = [
  {
    id: "wo-1",
    communityId: CID,
    title: "Lift Repair — door sensor fault",
    description: "Lift door not closing on 3rd floor. Sensor needs replacement. Residents advised to use stairs until fixed.",
    priority: "Urgent",
    stage: "In Progress",
    vendorId: "v-lift",
    assignedTo: "u-vishnu",
    estimate: 8500,
    reportedDate: "2026-06-24",
    photoCount: 3,
    timeline: [
      { stage: "Reported", date: "2026-06-24", note: "Reported by owner 301 via app" },
      { stage: "Estimate Received", date: "2026-06-25", note: "Sree Lift Services quoted ₹8,500" },
      { stage: "Owner Approval", date: "2026-06-26", note: "Approved by majority poll (8/10)" },
      { stage: "In Progress", date: "2026-06-28", note: "Sensor part ordered, technician scheduled" },
    ],
    comments: [
      { authorId: "u-301", date: "2026-06-24", text: "Door stayed open for 5 minutes, had to use stairs with groceries." },
      { authorId: "u-vishnu", date: "2026-06-28", text: "Technician confirmed for Friday morning. Lift will be down 9am–1pm." },
    ],
  },
  {
    id: "wo-2",
    communityId: CID,
    title: "Bore Motor — low water pressure",
    description: "Bore motor tripping intermittently. Starter replaced; monitoring pressure for a week.",
    priority: "High",
    stage: "Inspection",
    vendorId: "v-elec",
    assignedTo: "u-vishnu",
    estimate: 3000,
    finalCost: 2850,
    reportedDate: "2026-06-15",
    photoCount: 2,
    timeline: [
      { stage: "Reported", date: "2026-06-15", note: "Multiple owners reported low pressure" },
      { stage: "Estimate Received", date: "2026-06-16", note: "Kumar Electricals quoted ₹3,000" },
      { stage: "Owner Approval", date: "2026-06-17", note: "Approved by Vishnu (under ₹5,000 limit)" },
      { stage: "In Progress", date: "2026-06-18", note: "Starter replaced" },
      { stage: "Inspection", date: "2026-06-20", note: "Monitoring for one week" },
    ],
    comments: [
      { authorId: "u-102", date: "2026-06-21", text: "Pressure is much better now, thank you." },
    ],
  },
  {
    id: "wo-3",
    communityId: CID,
    title: "Water Tank Cleaning — half-yearly",
    description: "Scheduled half-yearly cleaning of overhead and underground tanks.",
    priority: "Medium",
    stage: "Owner Approval",
    vendorId: "v-clean",
    estimate: 6000,
    reportedDate: "2026-06-27",
    photoCount: 0,
    timeline: [
      { stage: "Reported", date: "2026-06-27", note: "Scheduled maintenance due" },
      { stage: "Estimate Received", date: "2026-06-29", note: "CleanPro quoted ₹6,000 for both tanks" },
    ],
    comments: [],
  },
  {
    id: "wo-4",
    communityId: CID,
    title: "Generator Service — annual",
    description: "Annual generator servicing completed. Oil and filters changed.",
    priority: "Medium",
    stage: "Closed",
    vendorId: "v-gen",
    estimate: 5500,
    finalCost: 5500,
    reportedDate: "2026-05-10",
    photoCount: 4,
    timeline: [
      { stage: "Reported", date: "2026-05-10", note: "Annual service due" },
      { stage: "Estimate Received", date: "2026-05-12", note: "PowerGen quoted ₹5,500" },
      { stage: "Owner Approval", date: "2026-05-13", note: "Approved" },
      { stage: "In Progress", date: "2026-05-16", note: "Service in progress" },
      { stage: "Completed", date: "2026-05-16", note: "Service completed same day" },
      { stage: "Closed", date: "2026-05-20", note: "Invoice paid, closed" },
    ],
    comments: [],
  },
  {
    id: "wo-5",
    communityId: CID,
    title: "Roof Leakage — Block A stairwell",
    description: "Water seepage observed in the 5th floor stairwell ceiling during rains.",
    priority: "High",
    stage: "Estimate Received",
    vendorId: "v-paint",
    estimate: 12000,
    reportedDate: "2026-06-29",
    photoCount: 5,
    timeline: [
      { stage: "Reported", date: "2026-06-29", note: "Reported by owner 501 with photos" },
      { stage: "Estimate Received", date: "2026-07-01", note: "Rainbow Painters quoted ₹12,000 for waterproofing" },
    ],
    comments: [
      { authorId: "u-501", date: "2026-06-29", text: "Seepage getting worse after last week's rain. Photos attached." },
    ],
  },
];

export const maintenanceRequests: MaintenanceRequest[] = [
  { id: "mr-1", communityId: CID, title: "Street light not working near gate", description: "The light at the main gate has been off for 3 days. Safety concern at night.", visibility: "community", status: "In Progress", createdBy: "u-202", createdDate: "2026-06-28" },
  { id: "mr-2", communityId: CID, title: "Lift making noise between floors 2–3", description: "Grinding noise when the lift passes the 2nd floor.", visibility: "community", status: "Open", createdBy: "u-301", createdDate: "2026-06-30" },
  { id: "mr-3", communityId: CID, title: "Parking spot marking faded", description: "Please repaint the parking numbers, causing confusion with visitors.", visibility: "community", status: "Open", createdBy: "u-401", createdDate: "2026-07-01" },
  { id: "mr-4", communityId: CID, title: "Kitchen sink drainage issue", description: "Slow drainage in my kitchen sink, may need the common drain line checked.", visibility: "private", status: "Open", createdBy: "u-502", createdDate: "2026-07-01" },
];

export const feedPosts: FeedPost[] = [
  {
    id: "post-1",
    communityId: CID,
    authorId: "u-vishnu",
    type: "announcement",
    text: "Lift will be under repair this Friday 9am–1pm. Please plan accordingly. The technician from Sree Lift Services will replace the faulty door sensor.",
    date: "2026-07-01",
    pinned: true,
    reactions: { like: 6, heart: 0, thanks: 4 },
    comments: [
      { authorId: "u-301", text: "Thanks for the update Vishnu!", date: "2026-07-01" },
    ],
    attachmentCount: 0,
  },
  {
    id: "post-2",
    communityId: CID,
    authorId: "u-501",
    type: "photo",
    text: "The garden is looking beautiful after the new plants were added. Great work by the gardening team! 🌸",
    date: "2026-06-29",
    pinned: false,
    reactions: { like: 8, heart: 5, thanks: 2 },
    comments: [
      { authorId: "u-202", text: "Lovely! The kids enjoy the space now.", date: "2026-06-29" },
      { authorId: "u-vishnu", text: "Will pass on the appreciation to Green Thumb team.", date: "2026-06-30" },
    ],
    attachmentCount: 3,
  },
  {
    id: "post-3",
    communityId: CID,
    authorId: "u-402",
    type: "suggestion",
    text: "Suggestion: Can we install a small notice board near the lift for physical notices? Some of our elders don't check the app often.",
    date: "2026-06-27",
    pinned: false,
    reactions: { like: 7, heart: 1, thanks: 0 },
    comments: [
      { authorId: "u-101", text: "Good idea, supporting this.", date: "2026-06-27" },
    ],
    attachmentCount: 0,
  },
  {
    id: "post-4",
    communityId: CID,
    authorId: "u-201",
    type: "question",
    text: "Does anyone have the contact of a good AC service person? Mine stopped cooling.",
    date: "2026-06-25",
    pinned: false,
    reactions: { like: 0, heart: 0, thanks: 1 },
    comments: [
      { authorId: "u-302", text: "Try CoolCare on JNTU road, they serviced ours last month.", date: "2026-06-25" },
    ],
    attachmentCount: 0,
  },
];

export const polls: Poll[] = [
  {
    id: "poll-1",
    communityId: CID,
    question: "Approve Lift Door Sensor Replacement (₹8,500)",
    description: "Sree Lift Services has quoted ₹8,500 for replacing the faulty door sensor. Amount will be taken from the reserve fund.",
    openDate: "2026-06-25",
    closeDate: "2026-06-27",
    status: "closed",
    options: [
      { label: "Approve", votes: 8 },
      { label: "Reject", votes: 1 },
      { label: "Need more quotes", votes: 1 },
    ],
    totalEligible: 10,
  },
  {
    id: "poll-2",
    communityId: CID,
    question: "Approve Roof Waterproofing (₹12,000)",
    description: "Waterproofing for the Block A stairwell roof leakage. Rainbow Painters quote attached in work order WO-5.",
    openDate: "2026-07-01",
    closeDate: "2026-07-05",
    status: "open",
    options: [
      { label: "Approve", votes: 5 },
      { label: "Reject", votes: 0 },
      { label: "Get another quote", votes: 2 },
    ],
    totalEligible: 10,
  },
  {
    id: "poll-3",
    communityId: CID,
    question: "Increase Monthly Maintenance to ₹4,000 from August",
    description: "Rising electricity and security costs. Proposal to increase monthly maintenance from ₹3,500 to ₹4,000 effective August 2026.",
    openDate: "2026-06-20",
    closeDate: "2026-07-10",
    status: "open",
    options: [
      { label: "Approve", votes: 4 },
      { label: "Reject", votes: 3 },
    ],
    totalEligible: 10,
  },
];

export const documents: CommunityDocument[] = [
  { id: "doc-1", communityId: CID, title: "Society Rules & Bye-laws", category: "Society Rules", uploadedDate: "2026-01-15", version: 3, sizeKb: 840, fileType: "pdf" },
  { id: "doc-2", communityId: CID, title: "Building Insurance Policy 2026-27", category: "Insurance", uploadedDate: "2026-04-01", version: 1, sizeKb: 1220, fileType: "pdf" },
  { id: "doc-3", communityId: CID, title: "Water Bill — June 2026", category: "Water Bills", uploadedDate: "2026-06-14", version: 1, sizeKb: 180, fileType: "pdf" },
  { id: "doc-4", communityId: CID, title: "Electricity Bill — June 2026", category: "Electric Bills", uploadedDate: "2026-06-16", version: 1, sizeKb: 210, fileType: "pdf" },
  { id: "doc-5", communityId: CID, title: "Audit Report FY 2025-26", category: "Audit Reports", uploadedDate: "2026-05-20", version: 2, sizeKb: 2400, fileType: "pdf" },
  { id: "doc-6", communityId: CID, title: "AGM Minutes — April 2026", category: "AGM Minutes", uploadedDate: "2026-04-28", version: 1, sizeKb: 460, fileType: "pdf" },
  { id: "doc-7", communityId: CID, title: "Approved Building Plan", category: "Building Plans", uploadedDate: "2026-01-10", version: 1, sizeKb: 5300, fileType: "image" },
  { id: "doc-8", communityId: CID, title: "Lift AMC Contract — Sree Lift Services", category: "Contracts", uploadedDate: "2026-01-05", version: 2, sizeKb: 620, fileType: "pdf" },
  { id: "doc-9", communityId: CID, title: "Security Contract — Guardian Agency", category: "Contracts", uploadedDate: "2026-03-28", version: 1, sizeKb: 580, fileType: "pdf" },
];

export const meetings: Meeting[] = [
  {
    id: "meet-1",
    communityId: CID,
    title: "Annual General Meeting 2026",
    date: "2026-04-26",
    attendance: 9,
    agenda: ["FY 2025-26 accounts review", "Election of committee members", "Maintenance charge revision discussion", "Painting project planning"],
    resolutions: ["Accounts approved unanimously", "Vishnu re-appointed as property manager", "Maintenance revision moved to community poll"],
    hasPdf: true,
    hasAudio: true,
  },
  {
    id: "meet-2",
    communityId: CID,
    title: "Emergency Meeting — Lift Breakdown",
    date: "2026-06-26",
    attendance: 7,
    agenda: ["Lift door sensor failure", "Vendor quote review", "Temporary arrangements for senior citizens"],
    resolutions: ["Approved ₹8,500 sensor replacement via poll", "Watchman to assist seniors during lift downtime"],
    hasPdf: true,
    hasAudio: false,
  },
  {
    id: "meet-3",
    communityId: CID,
    title: "Monthly Committee Meeting — July",
    date: "2026-07-06",
    attendance: 0,
    agenda: ["Roof waterproofing decision", "Maintenance increase poll results", "Diwali event planning kickoff"],
    resolutions: [],
    hasPdf: false,
    hasAudio: false,
  },
];

export const reserveFund: ReserveFundEntry[] = [
  { month: "Jan", contributions: 5000, expenses: 0, balance: 118000 },
  { month: "Feb", contributions: 5000, expenses: 8000, balance: 115000 },
  { month: "Mar", contributions: 5000, expenses: 0, balance: 120000 },
  { month: "Apr", contributions: 5000, expenses: 5500, balance: 119500 },
  { month: "May", contributions: 5000, expenses: 0, balance: 124500 },
  { month: "Jun", contributions: 5000, expenses: 8500, balance: 121000 },
];

export const monthlyFinance: MonthlyFinance[] = [
  { month: "Jan", income: 35000, expenses: 31200, collectionRate: 100 },
  { month: "Feb", income: 33250, expenses: 36400, collectionRate: 95 },
  { month: "Mar", income: 35000, expenses: 29800, collectionRate: 100 },
  { month: "Apr", income: 35000, expenses: 38900, collectionRate: 100 },
  { month: "May", income: 31500, expenses: 30500, collectionRate: 90 },
  { month: "Jun", income: 25500, expenses: 44830, collectionRate: 73 },
];

export const notifications: Notification[] = [
  { id: "n-1", text: "Work order 'Lift Repair' moved to In Progress", date: "2026-06-28", read: false, type: "work_order" },
  { id: "n-2", text: "Poll open: Approve Roof Waterproofing (₹12,000)", date: "2026-07-01", read: false, type: "poll" },
  { id: "n-3", text: "Your June maintenance invoice of ₹3,500 is due", date: "2026-06-25", read: false, type: "invoice" },
  { id: "n-4", text: "New announcement: Lift repair scheduled Friday", date: "2026-07-01", read: true, type: "announcement" },
  { id: "n-5", text: "Committee meeting scheduled for 6 July", date: "2026-06-30", read: true, type: "meeting" },
];

// ---------- Lookup helpers ----------

export function userById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function apartmentById(id: string): Apartment | undefined {
  return apartments.find((a) => a.id === id);
}

export function vendorById(id?: string): Vendor | undefined {
  return id ? vendors.find((v) => v.id === id) : undefined;
}

export function ownerNameForApartment(apartmentId: string): string {
  const apt = apartmentById(apartmentId);
  const owner = apt ? userById(apt.ownerIds[0]) : undefined;
  return owner?.name ?? "—";
}
