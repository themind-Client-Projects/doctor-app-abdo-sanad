"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useRole } from "@/hooks/use-role";
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
// appointments, orders, referrals and prescriptions.
//
// Now shared by five roles, so the appointment half is gated. Only a doctor
// holds appointments; for a lab or a pharmacy `nextAppointment` is null on
// every row, which would render a column of dashes and — worse — a
// "لديه موعد قادم" filter that always returns nothing. A control that can only
// ever say "no results" is a control that lies.
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

/** Where this role's patients actually come from — said accurately, per role. */
const SUBTITLES: Record<string, string> = {
  DOCTOR: "المرضى الذين خدمتهم فعلاً — من مواعيدك وطلباتك ووصفاتك",
  PHARMACY: "المرضى الذين خدمتهم فعلاً — من طلباتك ووصفاتك والإحالات إليك",
  LAB: "المرضى الذين خدمتهم فعلاً — من طلباتك والإحالات إليك",
  RADIOLOGY: "المرضى الذين خدمتهم فعلاً — من طلباتك والإحالات إليك",
  NURSE: "المرضى الذين خدمتهم فعلاً — من طلباتك والإحالات إليك",
};

export default function PatientsPage() {
  const { role, isLoading: isRoleLoading } = useRole();
  const { data, isLoading, error, refetch } = useDashboardData<Patient[]>({
    url: "/api/dashboard/patients",
  });

  // Appointments belong to a DoctorProfile. Platform roles read across every
  // provider, so they keep the column too.
  //
  // `isRoleLoading` keeps the column while the session resolves: `role` is null
  // on the first paint, so without it a doctor watches the الموعد القادم column
  // and its filter option appear a moment after the table does.
  const hasAppointments =
    isRoleLoading || role === "DOCTOR" || role === "SUPER_ADMIN" || role === "OPERATIONS";

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
      ...(hasAppointments
        ? [
            {
              key: "nextAppointment",
              header: "الموعد القادم",
              render: (r: Patient) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {r.nextAppointment ? formatDate(r.nextAppointment) : "—"}
                </span>
              ),
              sortValue: (r: Patient) =>
                r.nextAppointment ? new Date(r.nextAppointment).getTime() : 0,
            },
          ]
        : []),
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
    [hasAppointments]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرضاي"
        subtitle={
          (role && SUBTITLES[role]) ?? "المرضى الذين خدمتهم فعلاً"
        }
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
              // Offered only where it can match: `status: "scheduled"` is set
              // from `nextAppointment`, which is null for every non-doctor row.
              ...(hasAppointments ? [{ value: "scheduled", label: "لديه موعد قادم" }] : []),
              { value: "past", label: "زيارة سابقة" },
              { value: "new", label: "جديد" },
            ],
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage="لا مرضى بعد"
      />
    </div>
  );
}
