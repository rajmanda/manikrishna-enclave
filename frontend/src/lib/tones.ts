import type { InvoiceStatus, Priority, WorkOrderStage } from "./types";

type Tone = "green" | "red" | "amber" | "blue" | "slate" | "violet" | "brand";

export function stageTone(stage: WorkOrderStage): Tone {
  switch (stage) {
    case "Reported":
      return "red";
    case "Estimate Received":
      return "amber";
    case "Owner Approval":
      return "violet";
    case "In Progress":
      return "blue";
    case "Inspection":
      return "brand";
    case "Completed":
      return "green";
    case "Closed":
      return "slate";
  }
}

export function priorityTone(priority: Priority): Tone {
  switch (priority) {
    case "Urgent":
      return "red";
    case "High":
      return "amber";
    case "Medium":
      return "blue";
    case "Low":
      return "slate";
  }
}

export function invoiceTone(status: InvoiceStatus): Tone {
  switch (status) {
    case "paid":
      return "green";
    case "overdue":
      return "red";
    case "partial":
      return "amber";
    case "due":
      return "blue";
  }
}


/** Subtle left-edge accent per ledger — scannable without reading badges. */
export function ledgerAccent(ledger?: string): string {
  if (ledger === "manager_fee") return "border-l-[3px] border-l-violet-400";
  if (ledger === "reimbursement") return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-sky-300";
}
