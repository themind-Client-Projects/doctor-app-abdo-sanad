"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مواعيدي — the doctor's appointment book.
//
// Linked from the doctor's menu and never built. `/api/appointments` exists and
// takes `?doctorId=`, which the identity endpoint supplies.
//
// The statuses here are the API's own vocabulary — `scheduled | completed |
// cancelled | no_show`. The seed used to write "confirmed" and "in_progress",
// values the API rejects, which is why the doctor's "المواعيد القادمة" counter
// read ٠ with twenty appointments in the table.
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: "مجدول",
  completed: "مكتمل",
  cancelled: "ملغي",
  no_show: "لم يحضر",
};

const TONE: Record<string, "positive" | "warning" | "danger" | "neutral"> = {
  scheduled: "warning",
  completed: "positive",
  cancelled: "danger",
  no_show: "danger",
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  price: number | string | null;
  patientId: string;
};

type Me = { user: { doctorProfileId?: string | null } | null };

export default function AppointmentsPage() {
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const { data: me } = useDashboardData<Me>({ url: "/api/v1/me" });
  const doctorId = me?.user?.doctorProfileId ?? null;

  const { data, isLoading, error, refetch } = useDashboardData<Appointment[]>(
    // Waits for the identity: querying without a doctor id would return every
    // doctor's book, and the endpoint would refuse it anyway.
    doctorId ? { url: "/api/appointments", params: { doctorId, limit: "100" } } : { url: "" }
  );

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!upcomingOnly) return all;
    const now = Date.now();
    return all.filter((a) => new Date(a.date).getTime() >= now && a.status === "scheduled");
  }, [data, upcomingOnly]);

  const columns: Column<Appointment>[] = useMemo(
    () => [
      {
        key: "date",
        header: "التاريخ",
        render: (r) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium text-foreground">{formatDate(r.date)}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {r.time}
            </p>
          </div>
        ),
        sortValue: (r) => new Date(r.date).getTime(),
      },
      {
        key: "type",
        header: "النوع",
        render: (r) => (
          <span className="text-foreground">
            {r.type === "ONLINE" ? "أونلاين" : r.type === "HOME_VISIT" ? "زيارة منزلية" : "حضوري"}
          </span>
        ),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={TONE[r.status] ?? "neutral"}>{STATUS_LABELS[r.status] ?? r.status}</Pill>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="مواعيدي"
        subtitle={upcomingOnly ? "المواعيد القادمة فقط" : "كل المواعيد"}
        icon={CalendarDays}
        action={{
          label: upcomingOnly ? "إظهار الكل" : "القادمة فقط",
          onClick: () => setUpcomingOnly((v) => !v),
        }}
      />

      {!doctorId && me ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          هذه الصفحة للأطباء — لا ملف طبيب مرتبط بحسابك.
        </p>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          isLoading={isLoading || !me}
          error={error}
          onRetry={refetch}
          searchable={(r) => `${r.time} ${STATUS_LABELS[r.status] ?? r.status}`}
          searchPlaceholder="بحث بالوقت أو الحالة..."
          filters={[
            {
              key: "status",
              label: "كل الحالات",
              options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              match: (r, v) => r.status === v,
            },
          ]}
          emptyMessage={upcomingOnly ? "لا مواعيد قادمة" : "لا مواعيد بعد"}
        />
      )}
    </div>
  );
}
