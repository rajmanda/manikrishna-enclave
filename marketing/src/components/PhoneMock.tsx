import { Bell, FileText, Wrench } from "lucide-react";

/** Mobile visualization — same fictional Greenwood Residency data only. */
export default function PhoneMock() {
  return (
    <div
      role="img"
      aria-label="Illustration of the Nivaasos mobile experience showing a resident's view of the fictional Greenwood Residency community"
      className="mx-auto w-[240px] select-none rounded-[2.2rem] border-[6px] border-pine-950 bg-white shadow-lift"
    >
      <div className="rounded-[1.8rem] bg-white p-4">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-pine-100" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-pine-500">
          Greenwood Residency
        </p>
        <p className="text-sm font-bold text-pine-950">Hi, Resident 👋</p>

        <div className="mt-3 rounded-xl bg-pine-700 p-3 text-white">
          <p className="text-[10px] uppercase tracking-wide text-pine-100/80">
            July maintenance
          </p>
          <p className="tabular text-lg font-bold">Paid ✓</p>
          <p className="text-[10px] text-pine-100/80">Receipt available</p>
        </div>

        <div className="mt-3 space-y-2">
          {[
            {
              icon: Wrench,
              title: "Maintenance request",
              meta: "Tap to report an issue with photos",
            },
            {
              icon: FileText,
              title: "My statements",
              meta: "Invoices, payments & receipts",
            },
            {
              icon: Bell,
              title: "Announcements",
              meta: "2 new community notices",
            },
          ].map((r) => (
            <div
              key={r.title}
              className="flex items-center gap-2.5 rounded-xl border border-pine-100 bg-ivory px-3 py-2.5"
            >
              <r.icon className="h-4 w-4 shrink-0 text-pine-600" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-pine-950">
                  {r.title}
                </p>
                <p className="truncate text-[9px] text-pine-500">{r.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
