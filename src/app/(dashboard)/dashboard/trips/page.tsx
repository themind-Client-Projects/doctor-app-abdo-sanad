"use client";

import { useCallback, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useOrderActions } from "@/hooks/use-order-actions";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill, toneForStatus } from "@/components/data/crud-kit";
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// رحلات السائق — this partner's own assigned work.
//
// The page called `/api/dashboard/trips`, a route that was never built, so it
// showed a skeleton forever. `/api/orders` returns exactly this — and is now
// scoped server-side, so a driver receives only the orders assigned
// to them and never another partner's queue.
// ─────────────────────────────────────────────────────────────

type Job = {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  status: string;
  area: string | null;
  address: string | null;
  createdAt: string;
  governorate: { name: string } | null;
};

/** Still to do — a finished job belongs in history, not the worklist. */
const OPEN = "ASSIGNED,IN_TRANSIT,ARRIVED,IN_PROGRESS,DELAYED";

export default function Page() {
  const [showDone, setShowDone] = useState(false);

  const { data, isLoading, error, refetch } = useDashboardData<Job[]>({
    url: "/api/orders",
    params: { limit: "100", ...(showDone ? {} : { status: OPEN }) },
    refreshInterval: 30_000,
  });

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { advance, isPending } = useOrderActions(refresh);

  const columns: Column<Job>[] = useMemo(
    () => [
      {
        key: "patient",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.patientName}</p>
            <a
              href={`tel:${r.patientPhone}`}
              className="truncate text-xs text-primary hover:underline"
              dir="ltr"
            >
              {r.patientPhone}
            </a>
          </div>
        ),
        sortValue: (r) => r.patientName,
      },
      {
        key: "serviceType",
        header: "الخدمة",
        render: (r) => (
          <span className="text-foreground">{labelOf(SERVICE_TYPE_LABELS, r.serviceType)}</span>
        ),
        sortValue: (r) => labelOf(SERVICE_TYPE_LABELS, r.serviceType),
      },
      {
        key: "location",
        header: "الموقع",
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.governorate?.name, r.area, r.address].filter(Boolean).join(" - ") || "بلا عنوان"}
          </span>
        ),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={toneForStatus(r.status)}>{labelOf(ORDER_STATUS_LABELS, r.status)}</Pill>
        ),
      },
      {
        key: "createdAt",
        header: "منذ",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatRelative(r.createdAt)}
          </span>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="رحلاتي"
        subtitle="المهام المسندة إليك — تُحدَّث تلقائياً كل 30 ثانية"
        icon={Truck}
        action={{
          label: showDone ? "إظهار الجارية فقط" : "إظهار المنتهية أيضاً",
          onClick: () => setShowDone((v) => !v),
        }}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.patientName} ${r.patientPhone} ${r.orderNumber} ${r.area ?? ""}`}
        searchPlaceholder="بحث بالمريض أو الهاتف أو المنطقة..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: optionsOf(ORDER_STATUS_LABELS),
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage="لا مهام مسندة إليك حالياً"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === "ASSIGNED" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => void advance(r.id, "IN_TRANSIT")}
                className="whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
              >
                في الطريق
              </button>
            ) : null}
            {r.status === "IN_TRANSIT" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => void advance(r.id, "ARRIVED")}
                className="whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
              >
                وصلت
              </button>
            ) : null}
            {r.status === "ARRIVED" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => void advance(r.id, "STARTED")}
                className="whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
              >
                بدء التنفيذ
              </button>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
