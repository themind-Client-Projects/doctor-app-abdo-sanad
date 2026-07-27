"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Activity, Server, Users, AlertTriangle, Database, Shield } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 8: مراقبة النظام (req L247-254) — 6 metrics
// سرعة الخادم, المستخدمين, الطلبات المباشرة, الأخطاء, النسخ الاحتياطية, السجل الأمني
// ─────────────────────────────────────────────────────────────

interface SystemMetrics {
  serverSpeed: number;
  activeUsers: number;
  liveRequests: number;
  errors: number;
  lastBackup: string;
  securityLog: unknown[];
}

export default function MonitoringPage() {
  const { data, isLoading } = useDashboardData<SystemMetrics>({
    url: "/api/system-monitoring",
    refreshInterval: 10000,
  });

  const metrics = [
    { label: "سرعة الخادم", value: `${data?.serverSpeed ?? 0}ms`, icon: <Server size={22} />, color: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20", iconColor: "text-blue-600 dark:text-blue-400", status: (data?.serverSpeed ?? 0) < 200 ? "ممتاز" : "بطيء" },
    { label: "المستخدمين النشطين", value: data?.activeUsers ?? 0, icon: <Users size={22} />, color: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "الطلبات المباشرة", value: data?.liveRequests ?? 0, icon: <Activity size={22} />, color: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20", iconColor: "text-purple-600 dark:text-purple-400" },
    { label: "الأخطاء", value: data?.errors ?? 0, icon: <AlertTriangle size={22} />, color: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20", iconColor: "text-red-600 dark:text-red-400" },
    { label: "آخر نسخة احتياطية", value: data?.lastBackup ? new Date(data.lastBackup).toLocaleString("ar-EG") : "—", icon: <Database size={22} />, color: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20", iconColor: "text-amber-600 dark:text-amber-400" },
    { label: "السجل الأمني", value: `${data?.securityLog?.length ?? 0} حدث`, icon: <Shield size={22} />, color: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20", iconColor: "text-indigo-600 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">مراقبة النظام</h1>
        <p className="text-sm text-muted-foreground mt-0.5">6 مؤشرات — تحديث كل 10 ثوانٍ</p>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">مباشر</span>
      </div>

      {/* 6 metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className={`rounded-xl border p-6 ${m.color} hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
              <div className={m.iconColor}>{m.icon}</div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <div className="h-7 w-20 rounded bg-muted animate-pulse" /> : String(m.value)}
            </div>
            {m.status && (
              <span className={`text-xs mt-1 block ${m.status === "ممتاز" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {m.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
