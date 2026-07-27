"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Stethoscope, Phone } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 9: إدارة سند (req L445-453) — 4 fields + 3 statuses
// الطبيب, وقت الموعد, حالة الطبيب
// Statuses: انتظار, جاري الاتصال, انتهت الجلسة
// ─────────────────────────────────────────────────────────────

interface SanadSession {
  id: string;
  doctorName: string;
  appointmentTime: string;
  doctorStatus: string;
  patientName: string;
  status: string;
}

const sanadStatuses: Record<string, { label: string; style: string }> = {
  waiting: { label: "انتظار", style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  calling: { label: "جاري الاتصال", style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse" },
  in_session: { label: "في الجلسة", style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ended: { label: "انتهت الجلسة", style: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export default function SanadPage() {
  const { data: sessions, isLoading } = useDashboardData<SanadSession[]>({ url: "/api/sanad-sessions", refreshInterval: 10000 });

  const statusCounts = {
    waiting: (sessions ?? []).filter(s => s.status === "waiting").length,
    calling: (sessions ?? []).filter(s => s.status === "calling").length,
    in_session: (sessions ?? []).filter(s => s.status === "in_session").length,
    ended: (sessions ?? []).filter(s => s.status === "ended").length,
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Stethoscope size={22} className="text-primary" /> إدارة سند</h1>
        <p className="text-sm text-muted-foreground mt-0.5">استشارات طبية — 3 حالات: انتظار، جاري الاتصال، انتهت</p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(sanadStatuses).map(([key, cfg]) => (
          <div key={key} className={`rounded-xl border p-4 ${cfg.style.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-") || c.startsWith("dark:")).join(" ")} border-border`}>
            <span className="text-2xl font-bold text-foreground block">{statusCounts[key as keyof typeof statusCounts]}</span>
            <span className="text-xs text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الطبيب</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المريض</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">وقت الموعد</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">حالة الطبيب</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">اتصال</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(sessions ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{s.doctorName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{s.patientName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{s.appointmentTime}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.doctorStatus || "AVAILABLE"} size="sm" /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sanadStatuses[s.status]?.style || ""}`}>
                      {sanadStatuses[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a href="tel:" className="text-primary hover:underline text-xs flex items-center gap-1"><Phone size={12} /> اتصال</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
