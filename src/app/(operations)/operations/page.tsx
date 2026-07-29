"use client";

import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Video,
  Droplets,
  FlaskConical,
  ScanLine,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 2: مؤشرات اليوم (req L286-298) — 10 KPI cards
// ─────────────────────────────────────────────────────────────

interface OpsKPIs {
  newOrders: number;
  processing: number;
  completed: number;
  cancelled: number;
  critical: number;
  fieldTasks: number;
  onlineConsults: number;
  bloodDraws: number;
  labInProgress: number;
  radiologyPending: number;
}

export default function OperationsPage() {
  const { data, isLoading } = useDashboardData<OpsKPIs>({
    url: "/api/dashboard/summary",
    params: { role: "OPERATIONS" },
    refreshInterval: 15000,
  });

  const kpis = [
    { label: "الطلبات الجديدة", value: data?.newOrders ?? 0, icon: <ClipboardList size={20} />, color: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20", iconColor: "text-blue-600 dark:text-blue-400" },
    { label: "قيد المعالجة", value: data?.processing ?? 0, icon: <Loader2 size={20} />, color: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20", iconColor: "text-amber-600 dark:text-amber-400" },
    { label: "المنجزة", value: data?.completed ?? 0, icon: <CheckCircle2 size={20} />, color: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "الملغاة", value: data?.cancelled ?? 0, icon: <XCircle size={20} />, color: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20", iconColor: "text-red-600 dark:text-red-400" },
    { label: "الحرجة", value: data?.critical ?? 0, icon: <AlertTriangle size={20} />, color: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20", iconColor: "text-red-600 dark:text-red-400" },
    { label: "المهام الميدانية", value: data?.fieldTasks ?? 0, icon: <MapPin size={20} />, color: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20", iconColor: "text-indigo-600 dark:text-indigo-400" },
    { label: "الاستشارات الأونلاين", value: data?.onlineConsults ?? 0, icon: <Video size={20} />, color: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20", iconColor: "text-purple-600 dark:text-purple-400" },
    { label: "سحب الدم المنزلي", value: data?.bloodDraws ?? 0, icon: <Droplets size={20} />, color: "border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/20", iconColor: "text-pink-600 dark:text-pink-400" },
    { label: "التحاليل قيد الإنجاز", value: data?.labInProgress ?? 0, icon: <FlaskConical size={20} />, color: "border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/20", iconColor: "text-cyan-600 dark:text-cyan-400" },
    { label: "الأشعة بانتظار التقرير", value: data?.radiologyPending ?? 0, icon: <ScanLine size={20} />, color: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20", iconColor: "text-orange-600 dark:text-orange-400" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">لوحة العمليات</h1>
        <p className="text-sm text-muted-foreground mt-0.5">مؤشرات اليوم — تحديث كل 15 ثانية</p>
      </div>

      {/* 10 KPI cards (req L286-298) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className={`rounded-xl border p-4 hover:shadow-md transition-all ${kpi.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={kpi.iconColor}>{kpi.icon}</span>
              {kpi.label === "الحرجة" && (data?.critical ?? 0) > 0 && (
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
              )}
            </div>
            <div className="text-2xl font-bold text-foreground mb-0.5">
              {isLoading ? <div className="h-7 w-12 rounded bg-muted animate-pulse" /> : formatNumber(kpi.value)}
            </div>
            <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
