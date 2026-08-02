"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Activity, Server, Users, AlertTriangle, Database, Shield } from "lucide-react";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 8: مراقبة النظام (req L247-254) — 6 metrics
// سرعة الخادم, المستخدمين, الطلبات المباشرة, الأخطاء, النسخ الاحتياطية, السجل الأمني
// ─────────────────────────────────────────────────────────────

/** Each metric says whether it is genuinely measured. */
type Metric<T> = { value: T; measured: boolean };

interface SystemMetrics {
  dbLatencyMs: Metric<number>;
  activeSessions: Metric<number>;
  activityLast24h: Metric<number>;
  errors: Metric<number | null>;
  lastBackup: Metric<string | null>;
  requestsPerMinute: Metric<number | null>;
  securityLog: Metric<unknown[]>;
}

export default function MonitoringPage() {
  const { data, isLoading } = useDashboardData<SystemMetrics>({
    url: "/api/system-monitoring",
    refreshInterval: 10000,
  });

  // An UNMEASURED metric renders as "غير مُفعّل", never as 0 or a date. A zero
  // beside "الأخطاء" reads as "no errors" — a claim this system cannot make —
  // and `lastBackup` used to report "just now" on every call, so the dashboard
  // certified a backup that had never run.
  const metrics = [
    { label: "زمن استجابة قاعدة البيانات", value: `${data?.dbLatencyMs.value ?? 0}ms`, measured: data?.dbLatencyMs.measured ?? false, icon: <Server size={22} />, color: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20", iconColor: "text-blue-600 dark:text-blue-400", status: (data?.dbLatencyMs.value ?? 0) < 200 ? "ممتاز" : "بطيء" },
    { label: "الجلسات النشطة", value: data?.activeSessions.value ?? 0, measured: data?.activeSessions.measured ?? false, icon: <Users size={22} />, color: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "النشاطات خلال 24 ساعة", value: data?.activityLast24h.value ?? 0, measured: data?.activityLast24h.measured ?? false, icon: <Activity size={22} />, color: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20", iconColor: "text-purple-600 dark:text-purple-400" },
    { label: "الأخطاء", value: data?.errors.value ?? 0, measured: data?.errors.measured ?? false, icon: <AlertTriangle size={22} />, color: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20", iconColor: "text-red-600 dark:text-red-400" },
    { label: "آخر نسخة احتياطية", value: data?.lastBackup.value ? formatDateTime(data.lastBackup.value) : "—", measured: data?.lastBackup.measured ?? false, icon: <Database size={22} />, color: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20", iconColor: "text-amber-600 dark:text-amber-400" },
    { label: "السجل الأمني", value: `${data?.securityLog.value?.length ?? 0} حدث`, measured: data?.securityLog.measured ?? false, icon: <Shield size={22} />, color: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20", iconColor: "text-indigo-600 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">مراقبة النظام</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          تحديث كل 10 ثوانٍ — المؤشرات غير المقاسة معلّمة بوضوح
        </p>
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
            {!m.measured ? (
              <span className="mb-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                غير مُفعّل — يحتاج ربطاً بالبنية التحتية
              </span>
            ) : null}
            <div className={`text-2xl font-bold ${m.measured ? "text-foreground" : "text-muted-foreground/40"}`}>
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
