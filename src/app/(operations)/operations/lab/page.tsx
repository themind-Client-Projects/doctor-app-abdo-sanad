"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 10: المختبر (req L455-463) — 6 statuses pipeline
// استلمت → وصلت المختبر → قيد الفحص → جاهزة → أرسلت للطبيب → أرسلت للمريض
// ─────────────────────────────────────────────────────────────

interface LabSample {
  id: string;
  sampleId: string;
  patientName: string;
  testType: string;
  status: string;
  labName: string;
  createdAt: string;
}

const pipeline = [
  { key: "received", label: "استلمت", color: "bg-blue-500" },
  { key: "in_lab", label: "وصلت المختبر", color: "bg-cyan-500" },
  { key: "testing", label: "قيد الفحص", color: "bg-amber-500" },
  { key: "ready", label: "النتيجة جاهزة", color: "bg-emerald-500" },
  { key: "sent_to_doctor", label: "أرسلت للطبيب", color: "bg-indigo-500" },
  { key: "sent_to_patient", label: "أرسلت للمريض", color: "bg-emerald-600" },
];

export default function LabPage() {
  const { data: samples, isLoading } = useDashboardData<LabSample[]>({ url: "/api/lab-samples", refreshInterval: 15000 });

  const countByStatus = (status: string) => (samples ?? []).filter(s => s.status === status).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><FlaskConical size={22} className="text-primary" /> المختبر</h1>
        <p className="text-sm text-muted-foreground mt-0.5">6 مراحل للعينة</p>
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2 hide-scrollbar">
        {pipeline.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div className={`flex flex-col items-center rounded-xl border border-border p-4 min-w-[120px] ${countByStatus(step.key) > 0 ? "bg-card" : "bg-muted/30"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold mb-2 ${step.color}`}>
                {countByStatus(step.key)}
              </span>
              <span className="text-xs font-medium text-foreground text-center">{step.label}</span>
            </div>
            {i < pipeline.length - 1 && <ArrowLeft size={16} className="text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Samples table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم العينة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المريض</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">نوع التحليل</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المختبر</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(samples ?? []).map((s) => {
                const step = pipeline.find(p => p.key === s.status);
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-primary">{s.sampleId || s.id.slice(0,8)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{s.patientName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.testType}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.labName}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${step?.color || "bg-gray-500"}`}>{step?.label || s.status}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(s.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
