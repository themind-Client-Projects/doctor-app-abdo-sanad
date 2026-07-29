"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScanLine, Calendar, Camera, FileText, Image, Send } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 11: الأشعة (req L465-472) — 5 items
// الموعد, تم التصوير, التقرير الطبي, الصور المرفقة, إرسال للطبيب
// ─────────────────────────────────────────────────────────────

interface RadiologyItem {
  id: string;
  patientName: string;
  requestType: string;
  scheduledDate: string;
  status: string;
  centerName: string;
  hasReport: boolean;
  hasImages: boolean;
  sentToDoctor: boolean;
}

const radSteps = [
  { key: "scheduled", label: "الموعد", icon: <Calendar size={16} />, color: "bg-blue-500" },
  { key: "imaged", label: "تم التصوير", icon: <Camera size={16} />, color: "bg-cyan-500" },
  { key: "report_ready", label: "التقرير الطبي", icon: <FileText size={16} />, color: "bg-emerald-500" },
  { key: "images_attached", label: "الصور المرفقة", icon: <Image size={16} />, color: "bg-purple-500" },
  { key: "sent", label: "إرسال للطبيب", icon: <Send size={16} />, color: "bg-indigo-500" },
];

export default function RadiologyPage() {
  const { data: requests, isLoading } = useDashboardData<RadiologyItem[]>({ url: "/api/radiology-requests", refreshInterval: 15000 });

  const countByStatus = (status: string) => (requests ?? []).filter(r => r.status === status).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><ScanLine size={22} className="text-primary" /> الأشعة</h1>
        <p className="text-sm text-muted-foreground mt-0.5">5 مراحل: الموعد → التصوير → التقرير → الصور → الإرسال</p>
      </div>

      {/* Step summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {radSteps.map((step) => (
          <div key={step.key} className="rounded-xl border border-border bg-card p-4 text-center hover:shadow-md transition-all">
            <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-white mb-2 ${step.color}`}>{step.icon}</div>
            <span className="text-lg font-bold text-foreground block">{countByStatus(step.key)}</span>
            <span className="text-[10px] text-muted-foreground">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Requests table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المريض</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">نوع الأشعة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المركز</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الموعد</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التقرير</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الصور</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(requests ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{r.patientName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.requestType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.centerName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.scheduledDate ? formatDate(r.scheduledDate) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} size="sm" /></td>
                  <td className="px-4 py-3">{r.hasReport ? <span className="text-emerald-600 text-xs">✓ جاهز</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                  <td className="px-4 py-3">{r.hasImages ? <span className="text-emerald-600 text-xs">✓ مرفقة</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
