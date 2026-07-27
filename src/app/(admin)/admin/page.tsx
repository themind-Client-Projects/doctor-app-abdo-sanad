"use client";

import {
  ClipboardList,
  Activity,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Users,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";

// ─────────────────────────────────────────────────────────────
// Super Admin — Command Center (req L118-127, 8 KPIs)
// ─────────────────────────────────────────────────────────────

interface AdminSummary {
  todayOrders: number;
  activeOrders: number;
  delayedOrders: number;
  totalRevenue: number;
  waridProfit: number;
  totalPatients: number;
  activeUsers: number;
  servicesStatus: { active: number; suspended: number; total: number };
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useDashboardData<AdminSummary>({
    url: "/api/dashboard/summary",
    params: { role: "SUPER_ADMIN" },
    refreshInterval: 30000,
  });

  const kpis = [
    { label: "إجمالي الطلبات اليوم", value: data?.todayOrders ?? 0, icon: <ClipboardList size={22} />, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
    { label: "الطلبات النشطة", value: data?.activeOrders ?? 0, icon: <Activity size={22} />, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
    { label: "الطلبات المتأخرة", value: data?.delayedOrders ?? 0, icon: <AlertTriangle size={22} />, color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
    { label: "إجمالي الإيرادات", value: `${(data?.totalRevenue ?? 0).toLocaleString("ar-IQ")} د.ع`, icon: <DollarSign size={22} />, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
    { label: "صافي أرباح وريد", value: `${(data?.waridProfit ?? 0).toLocaleString("ar-IQ")} د.ع`, icon: <TrendingUp size={22} />, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
    { label: "عدد المرضى", value: data?.totalPatients ?? 0, icon: <Users size={22} />, color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" },
    { label: "المستخدمين النشطين", value: data?.activeUsers ?? 0, icon: <UserCheck size={22} />, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
    { label: "حالة الخدمات", value: `${data?.servicesStatus?.active ?? 0}/${data?.servicesStatus?.total ?? 0}`, icon: <CheckCircle2 size={22} />, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">لوحة التحكم — المدير</h1>
        <p className="text-sm text-muted-foreground mt-0.5">مركز القيادة</p>
      </div>

      {/* 8 KPIs (req L118-127) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className={`rounded-xl border p-5 bg-gradient-to-br from-card to-muted/20 ${kpi.border} hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}>{kpi.icon}</div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? (
                <div className="h-7 w-20 rounded bg-muted animate-pulse" />
              ) : (
                typeof kpi.value === "number" ? kpi.value.toLocaleString("ar-IQ") : kpi.value
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
