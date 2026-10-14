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
import { LoadError, loadFailed } from "@/components/shared/load-error";
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

  // `error` and `refetch` on every panel. This page destructured neither, so
  // a 500 was indistinguishable from an empty clinical queue: section 3 said
  // «لا توجد مهام حالية», and sections 4 and 7 VANISHED outright — two of the
  // eight the requirement is built around, gone with no skeleton and no retry.
  // 48 of the 55 screens using this hook read `error`; this one, the most-used
  // screen in the product, did not.
  const {
    data: alertsData,
    error: alertsError,
    refetch: refetchAlerts,
  } = useDashboardData<Alert[]>({
    url: "/api/dashboard/alerts",
    refreshInterval: 30000,
  });

  const {
    data: activitiesData,
    error: activitiesError,
    refetch: refetchActivities,
  } = useDashboardData<ActivityItem[]>({
    url: "/api/dashboard/recent-activity",
  });

  const {
    data: calendarData,
    error: calendarError,
    refetch: refetchCalendar,
  } = useDashboardData<CalendarItem[]>({
    url: "/api/dashboard/calendar",
  });

  const {
    data: earningsData,
    error: earningsError,
    refetch: refetchEarnings,
  } = useDashboardData<EarningsSummary>({
    url: "/api/dashboard/earnings",
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useDashboardData<Record<string, unknown>[]>({
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
      {loadFailed(tasksError, tasksData?.length ?? 0) ? (
        <LoadError message="تعذّر تحميل المهام الحالية" onRetry={() => void refetchTasks()} />
      ) : (
        <CurrentTasksTable
          title={getTaskTitle(role)}
          columns={taskColumns}
          data={tasksData || []}
          isLoading={tasksLoading}
        />
      )}

      {/* Bottom grid: Alerts + Activity + Calendar + Earnings + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Alerts + Activity */}
        <div className="space-y-6">
          {/* Section 4: Alerts (req L60-68) */}
          {loadFailed(alertsError, alertsData?.length ?? 0) ? (
            <LoadError message="تعذّر تحميل التنبيهات" onRetry={() => void refetchAlerts()} />
          ) : (
            <AlertsPanel alerts={alertsData || []} />
          )}

          {/* Section 5: Recent Activity (req L70-76) */}
          {loadFailed(activitiesError, activitiesData?.length ?? 0) ? (
            <LoadError message="تعذّر تحميل النشاط الأخير" onRetry={() => void refetchActivities()} />
          ) : (
            <RecentActivity activities={activitiesData || []} />
          )}
        </div>

        {/* Column 2: Calendar + Earnings */}
        <div className="space-y-6">
          {/* Section 6: Calendar (req L79-82) */}
          {loadFailed(calendarError, calendarData?.length ?? 0) ? (
            <LoadError message="تعذّر تحميل مواعيد اليوم" onRetry={() => void refetchCalendar()} />
          ) : (
            <CalendarWidget appointments={calendarData || []} />
          )}

          {/* Section 7: Earnings (req L84-89) */}
          {loadFailed(earningsError, earningsData ? 1 : 0) ? (
            <LoadError message="تعذّر تحميل الأرباح" onRetry={() => void refetchEarnings()} />
          ) : earningsData ? (
            <EarningsWidget earnings={earningsData} />
          ) : null}
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
