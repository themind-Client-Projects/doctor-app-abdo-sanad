"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatDate, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مرضاي — derived, because nothing stores "my patients".
//
// The page read `lastVisit`, `nextAppointment` and `totalVisits` off a
// `Patient` row. There is no such model, and `/api/dashboard/patients` did not
// exist either, so the screen was a permanent skeleton reading three fields
// that could never arrive. The endpoint now derives them from the caller's own
// appointments and orders.
// ─────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  name: string | null;
  phone: string | null;
  lastVisit: string | null;
  nextAppointment: string | null;
  totalVisits: number;
  status: "scheduled" | "past" | "new";
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "لديه موعد قادم",
  past: "زيارة سابقة",
  new: "جديد",
};

export default function PatientsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Patient[]>({
    url: "/api/dashboard/patients",
  });

  const columns: Column<Patient>[] = useMemo(
    () => [
      {
        key: "name",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.name ?? "بلا اسم"}</p>
            {r.phone ? (
              <a
                href={`tel:${r.phone}`}
                className="truncate text-xs text-primary hover:underline"
                dir="ltr"
              >
                {r.phone}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">لا يوجد رقم</span>
            )}
          </div>
        ),
        sortValue: (r) => r.name ?? "",
      },
      {
        key: "totalVisits",
        header: "عدد الزيارات",
        align: "end",
        render: (r) => formatNumber(r.totalVisits),
        sortValue: (r) => r.totalVisits,
      },
      {
        key: "lastVisit",
        header: "آخر زيارة",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {/* Only a COMPLETED visit counts as one — an order still in flight
                is not a visit that happened. */}
            {r.lastVisit ? formatDate(r.lastVisit) : "لا زيارة مكتملة"}
          </span>
        ),
        sortValue: (r) => (r.lastVisit ? new Date(r.lastVisit).getTime() : 0),
      },
      {
        key: "nextAppointment",
        header: "الموعد القادم",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {r.nextAppointment ? formatDate(r.nextAppointment) : "—"}
          </span>
        ),
        sortValue: (r) => (r.nextAppointment ? new Date(r.nextAppointment).getTime() : 0),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={r.status === "scheduled" ? "positive" : "neutral"}>
            {STATUS_LABELS[r.status] ?? r.status}
          </Pill>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرضاي"
        subtitle="المرضى الذين خدمتهم فعلاً — من مواعيدك وطلباتك"
        icon={Users}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name ?? ""} ${r.phone ?? ""}`}
        searchPlaceholder="بحث بالاسم أو الهاتف..."
        filters={[
          {
            key: "status",
            label: "كل المرضى",
            options: [
              { value: "scheduled", label: "لديه موعد قادم" },
              { value: "past", label: "زيارة سابقة" },
            ],
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage="لا مرضى بعد"
      />
    </div>
  );
}
