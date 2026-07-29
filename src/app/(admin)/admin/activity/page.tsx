"use client";

import { Activity } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader, Pill } from "@/components/admin/crud-kit";
import { USER_ROLE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatDateTime, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// سجل النشاطات (req L70)
//
// Read-only, deliberately: an audit log an administrator can edit or delete is
// not an audit log. Entries are written by the services that perform the
// action — there is no POST endpoint a client could use to forge one.
// ─────────────────────────────────────────────────────────────

type ActivityLog = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; role: string } | null;
};

/** `entityType` is a free-form string written by each service. */
const ENTITY_LABELS: Record<string, string> = {
  order: "طلب",
  lab_sample: "عيّنة مختبرية",
  prescription: "وصفة",
  appointment: "موعد",
  partner: "شريك",
  user: "مستخدم",
  invoice: "فاتورة",
  radiology_request: "طلب أشعة",
  blood_bank_request: "طلب بنك دم",
};

export default function ActivityPage() {
  const { data, isLoading, error, refetch } = useDashboardData<ActivityLog[]>({
    url: "/api/activity-logs",
    params: { limit: "100" },
  });

  const columns: Column<ActivityLog>[] = [
    {
      key: "createdAt",
      header: "الوقت",
      render: (r) => (
        <div className="min-w-0 whitespace-nowrap">
          <p className="text-xs text-foreground">{formatRelative(r.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
        </div>
      ),
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "user",
      header: "المستخدم",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {r.user?.name ?? r.user?.email ?? "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {labelOf(USER_ROLE_LABELS, r.user?.role)}
          </p>
        </div>
      ),
      sortValue: (r) => r.user?.name ?? "",
    },
    {
      key: "action",
      header: "الإجراء",
      render: (r) => <span className="text-foreground">{r.action}</span>,
    },
    {
      key: "entityType",
      header: "السجل",
      secondary: true,
      render: (r) =>
        r.entityType ? (
          <div className="flex flex-col gap-1">
            <Pill>{labelOf(ENTITY_LABELS, r.entityType)}</Pill>
            {r.entityId ? (
              <span className="text-[11px] tabular-nums text-muted-foreground" dir="ltr">
                {r.entityId.slice(0, 10)}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="سجل النشاطات"
        subtitle="من فعل ماذا ومتى — سجل للقراءة فقط، لا يمكن تعديله أو حذفه"
        icon={Activity}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.action} ${r.user?.name ?? ""} ${r.user?.email ?? ""} ${r.entityId ?? ""}`
        }
        searchPlaceholder="بحث بالإجراء أو المستخدم..."
        filters={[
          {
            key: "role",
            label: "كل الأدوار",
            options: optionsOf(USER_ROLE_LABELS),
            match: (r, v) => r.user?.role === v,
          },
          {
            key: "entityType",
            label: "كل السجلات",
            options: optionsOf(ENTITY_LABELS),
            match: (r, v) => r.entityType === v,
          },
        ]}
        emptyMessage="لا توجد نشاطات مسجّلة بعد"
      />
    </div>
  );
}
