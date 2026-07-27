"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Phone, User, HeartPulse, FlaskConical, Pill, ScanLine, Clock, FileText, PhoneCall } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 7: إدارة الاتصالات (req L421-431) — 8 features
// 5 call targets via tel: links + 3 tracking features
// All calls are click-to-call — NO VoIP (user decision)
// ─────────────────────────────────────────────────────────────

interface CallLog {
  id: string;
  target: string;
  phone: string;
  duration: string;
  notes: string;
  timestamp: string;
  orderId: string;
}

const callTargets = [
  { label: "المريض", icon: <User size={20} />, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  { label: "الممرض", icon: <HeartPulse size={20} />, color: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800" },
  { label: "المختبر", icon: <FlaskConical size={20} />, color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800" },
  { label: "الصيدلية", icon: <Pill size={20} />, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  { label: "مركز الأشعة", icon: <ScanLine size={20} />, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
];

export default function CallsPage() {
  const { data: logs, isLoading } = useDashboardData<CallLog[]>({ url: "/api/call-logs" });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Phone size={22} className="text-primary" /> إدارة الاتصالات</h1>
        <p className="text-sm text-muted-foreground mt-0.5">اتصال مباشر عبر الهاتف (tel: links) — بدون VoIP</p>
      </div>

      {/* 5 Call targets (L425-429) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {callTargets.map((target) => (
          <a key={target.label} href="tel:" className={`flex flex-col items-center gap-2 rounded-xl border p-4 hover:shadow-md transition-all group ${target.color}`}>
            <div className="transition-transform group-hover:scale-110">{target.icon}</div>
            <span className="text-sm font-medium text-foreground">{target.label}</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><PhoneCall size={10} /> اتصال</span>
          </a>
        ))}
      </div>

      {/* 3 Tracking features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground"><FileText size={16} /><span className="text-sm font-semibold text-foreground">سجل المكالمات</span></div>
          <span className="text-2xl font-bold text-foreground">{(logs ?? []).length}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground"><Clock size={16} /><span className="text-sm font-semibold text-foreground">مدة المكالمات</span></div>
          <span className="text-2xl font-bold text-foreground">—</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground"><FileText size={16} /><span className="text-sm font-semibold text-foreground">ملاحظات المكالمات</span></div>
          <span className="text-2xl font-bold text-foreground">{(logs ?? []).filter(l => l.notes).length}</span>
        </div>
      </div>

      {/* Call log table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <h3 className="text-sm font-semibold text-foreground p-4 border-b border-border">سجل المكالمات الأخيرة</h3>
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
        ) : (logs ?? []).length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">لا توجد مكالمات مسجلة</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الجهة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الهاتف</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المدة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الملاحظات</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الوقت</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{log.target}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">{log.phone}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.duration || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs">{log.notes || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString("ar-EG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
