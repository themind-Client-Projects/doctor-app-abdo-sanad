"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { KPICards, type KPICardData } from "@/components/dashboard/kpi-cards";
import { PageHeader } from "@/components/data/crud-kit";

// ─────────────────────────────────────────────────────────────
// لوحة العمليات — مؤشرات اليوم (req L286-298)
//
// The page declared an `OpsKPIs` interface — `newOrders`, `processing`,
// `completed`, … — and read those ten fields off /api/dashboard/summary. That
// endpoint answers `{ role, kpis: [] }`, and it had no OPERATIONS branch at
// all, so it returned an empty list and all ten cards read ٠ regardless of what
// was in the queue. The endpoint now has the branch, and this renders what it
// actually sends.
// ─────────────────────────────────────────────────────────────

type Summary = { role: string; kpis: KPICardData[] };

const SHORTCUTS = [
  { href: "/operations/orders", label: "الطلبات" },
  { href: "/operations/dispatch", label: "توزيع المهام" },
  { href: "/operations/tracking", label: "متابعة التنفيذ" },
  { href: "/operations/calls", label: "الاتصالات" },
];

export default function OperationsPage() {
  const { data, isLoading } = useDashboardData<Summary>({
    url: "/api/dashboard/summary",
    // The role comes from the verified session — the query parameter this used
    // to send was ignored by the endpoint anyway.
    refreshInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="لوحة العمليات"
        subtitle="مؤشرات اليوم — تُحدَّث تلقائياً كل 30 ثانية"
        icon={LayoutDashboard}
      />

      <KPICards kpis={data?.kpis ?? []} isLoading={isLoading} columns={5} />

      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            {s.label}
            <ArrowLeft size={14} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
