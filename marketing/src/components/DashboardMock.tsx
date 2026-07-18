import { Bell, CheckCircle2, CircleDollarSign, Wrench } from "lucide-react";

/**
 * Hand-built product visualization using ONLY the fictional demo community
 * "Greenwood Residency" (see master brief §10). Never render real community
 * names, residents, balances, or records here.
 */
export default function DashboardMock() {
  return (
    <div
      aria-label="Illustration of the Nivaasos community dashboard showing the fictional Greenwood Residency community"
      role="img"
      className="select-none overflow-hidden rounded-2xl border border-pine-100 bg-white shadow-lift"
    >
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-pine-100 bg-sand px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-pine-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-pine-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-pine-200" />
        <span className="ml-3 hidden rounded-md bg-white px-3 py-0.5 text-[10px] text-pine-500 sm:block">
          app.nivaasos.com/c/greenwood-residency
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pine-500">
              Community dashboard
            </p>
            <p className="text-base font-bold text-pine-950 sm:text-lg">
              Greenwood Residency
            </p>
          </div>
          <span className="relative rounded-full border border-pine-100 p-2 text-pine-600">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amberglow text-[8px] font-bold text-white">
              2
            </span>
          </span>
        </div>

        {/* stat tiles */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            { label: "Apartments", value: "24" },
            { label: "Payments in", value: "21 of 24" },
            { label: "Pending", value: "3" },
            { label: "Open requests", value: "2" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-pine-100 bg-ivory p-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-pine-500">
                {s.label}
              </p>
              <p className="tabular mt-1 text-base font-bold text-pine-950 sm:text-lg">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* collections bar */}
        <div className="mt-4 rounded-xl border border-pine-100 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-pine-800">
            <span className="flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5 text-pine-600" />
              July maintenance collections
            </span>
            <span className="tabular font-bold text-pine-950">21 / 24 paid</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-pine-100"
            aria-hidden
          >
            <div className="h-full w-[87%] rounded-full bg-pine-600" />
          </div>
        </div>

        {/* activity rows */}
        <div className="mt-4 space-y-2">
          {[
            {
              icon: CheckCircle2,
              tone: "text-pine-600",
              text: "Payment confirmed — Apt G-12 · July maintenance",
              meta: "Receipt attached",
            },
            {
              icon: Wrench,
              tone: "text-amberglow",
              text: "Work order in progress — lobby light repair",
              meta: "Vendor visit scheduled",
            },
            {
              icon: CheckCircle2,
              tone: "text-pine-600",
              text: "Expense recorded — water tanker · receipt uploaded",
              meta: "Allocated across 24 apartments",
            },
          ].map((r) => (
            <div
              key={r.text}
              className="flex items-start gap-2.5 rounded-xl border border-pine-100 bg-white px-3.5 py-2.5"
            >
              <r.icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.tone}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-pine-950">
                  {r.text}
                </p>
                <p className="text-[10px] text-pine-500">{r.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
