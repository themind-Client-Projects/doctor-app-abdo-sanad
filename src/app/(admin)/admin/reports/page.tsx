"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { BarChart3, TrendingUp, Users, Star, Building2, FlaskConical, Pill, Stethoscope, HeartPulse } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 9: التقارير (req L255-264) — 9 report types
// الإيرادات, الأرباح, الطلبات, أفضل الأطباء/المختبرات/الصيدليات/المجمعات, أداء سند, رضا العملاء
// ─────────────────────────────────────────────────────────────

interface ReportsData {
  totalOrders: number;
  completedOrders: number;
  avgSatisfaction: number;
  topDoctors: { name: string; rating: number; totalTasks: number }[];
  topLabs: { name: string; rating: number; totalTasks: number }[];
  topPharmacies: { name: string; rating: number; totalTasks: number }[];
}

export default function ReportsPage() {
  const { data, isLoading } = useDashboardData<ReportsData>({ url: "/api/reports" });

  const reportCards = [
    { label: "الإيرادات", value: "—", icon: <TrendingUp size={18} />, color: "border-emerald-200 dark:border-emerald-800" },
    { label: "الأرباح", value: "—", icon: <BarChart3 size={18} />, color: "border-blue-200 dark:border-blue-800" },
    { label: "الطلبات", value: `${data?.totalOrders ?? 0}`, icon: <BarChart3 size={18} />, color: "border-purple-200 dark:border-purple-800" },
    { label: "رضا العملاء", value: `⭐ ${data?.avgSatisfaction?.toFixed(1) ?? "—"}`, icon: <Star size={18} />, color: "border-amber-200 dark:border-amber-800" },
  ];

  const topLists = [
    { title: "أفضل الأطباء", icon: <Stethoscope size={16} />, data: data?.topDoctors ?? [] },
    { title: "أفضل المختبرات", icon: <FlaskConical size={16} />, data: data?.topLabs ?? [] },
    { title: "أفضل الصيدليات", icon: <Pill size={16} />, data: data?.topPharmacies ?? [] },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">التقارير</h1>
        <p className="text-sm text-muted-foreground mt-0.5">9 أنواع: الإيرادات، الأرباح، الطلبات، أفضل الأطباء/المختبرات/الصيدليات/المجمعات، أداء سند، رضا العملاء</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((r, i) => (
          <div key={i} className={`rounded-xl border p-5 bg-card hover:shadow-md transition-all ${r.color}`}>
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">{r.icon}<span className="text-sm font-medium">{r.label}</span></div>
            <span className="text-2xl font-bold text-foreground">{isLoading ? "..." : r.value}</span>
          </div>
        ))}
      </div>

      {/* Top partner lists (L259-261) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {topLists.map((list) => (
          <div key={list.title} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">{list.icon} {list.title}</h3>
            {list.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">لا توجد بيانات</p>
            ) : (
              <div className="space-y-2">
                {list.data.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{item.totalTasks} مهمة</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">⭐ {item.rating?.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
