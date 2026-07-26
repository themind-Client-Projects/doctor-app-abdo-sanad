"use client";

import { KPICards } from "@/components/dashboard/kpi-cards";
import { CurrentTasksTable } from "@/components/dashboard/current-tasks-table";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CalendarWidget } from "@/components/dashboard/calendar-widget";
import { EarningsWidget } from "@/components/dashboard/earnings-widget";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useKPIs } from "@/hooks/use-kpi";
import { useRole } from "@/hooks/use-role";
import { getTaskColumns, getTaskTitle } from "@/lib/task-columns";
import type {
  Alert,
  ActivityItem,
  CalendarItem,
  EarningsSummary,
  UserRole,
} from "@/types/dashboard";

// Role-specific page titles (req L4)
const pageTitles: Record<string, string> = {
  DOCTOR: "لوحة تحكم الطبيب",
  LAB: "لوحة تحكم المختبر",
  PHARMACY: "لوحة تحكم الصيدلية",
  NURSE: "لوحة تحكم الممرض",
  DRIVER: "لوحة تحكم السائق",
  RADIOLOGY: "لوحة تحكم مركز الأشعة",
};

export default function DashboardPage() {
  const { role, partnerId } = useRole();

  // The layout renders a loader until the session resolves, so a null role here
  // means "not signed in" — middleware is already redirecting. Splitting the
  // guard out keeps the data hooks below unconditional (rules of hooks).
  if (!role) return null;

  return <DashboardContent role={role} partnerId={partnerId} />;
}

function DashboardContent({
  role,
  partnerId,
}: {
  role: UserRole;
  partnerId: string | null;
}) {
  // Section 2: KPI Cards — role-specific live data (req L16-46)
  const { kpis, isLoading: kpisLoading } = useKPIs(role, partnerId);

  const { data: alertsData } = useDashboardData<Alert[]>({
    url: "/api/dashboard/alerts",
    refreshInterval: 30000,
  });

  const { data: activitiesData } = useDashboardData<ActivityItem[]>({
    url: "/api/dashboard/recent-activity",
  });

  const { data: calendarData } = useDashboardData<CalendarItem[]>({
    url: "/api/dashboard/calendar",
  });

  const { data: earningsData } = useDashboardData<EarningsSummary>({
    url: "/api/dashboard/earnings",
  });

  const { data: tasksData } = useDashboardData<Record<string, unknown>[]>({
    url: "/api/dashboard/tasks",
    params: { role },
    refreshInterval: 30000,
  });

  // Section 3: Dynamic columns per role (req L48-58 "لكن تصميم الجدول واحد")
  const columns = getTaskColumns(role);
  const taskColumns = columns.map((col) =>
    col.key === "status"
      ? {
          ...col,
          render: (val: unknown) => <StatusBadge status={val as string} size="sm" />,
        }
      : col
  );

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {pageTitles[role] || "لوحة التحكم"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">ملخص اليوم</p>
      </div>

      {/* Section 2: KPI Cards — live role-specific data (req L16-46) */}
      <KPICards kpis={kpis} isLoading={kpisLoading} />

      {/* Section 3: Current Tasks ⭐ (req L48-58) */}
      <CurrentTasksTable
        title={getTaskTitle(role)}
        columns={taskColumns}
        data={tasksData || []}
      />

      {/* Bottom grid: Alerts + Activity + Calendar + Earnings + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Alerts + Activity */}
        <div className="space-y-6">
          {/* Section 4: Alerts (req L60-68) */}
          <AlertsPanel alerts={alertsData || []} />

          {/* Section 5: Recent Activity (req L70-76) */}
          <RecentActivity activities={activitiesData || []} />
        </div>

        {/* Column 2: Calendar + Earnings */}
        <div className="space-y-6">
          {/* Section 6: Calendar (req L79-82) */}
          <CalendarWidget appointments={calendarData || []} />

          {/* Section 7: Earnings (req L84-89) */}
          {earningsData && <EarningsWidget earnings={earningsData} />}
        </div>

        {/* Column 3: Quick Actions */}
        <div>
          {/* Section 8: Quick Actions (req L92-113) */}
          <QuickActions role={role} />
        </div>
      </div>
    </div>
  );
}
