"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Pill, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 12: الصيدليات (req L474-477) — 5 statuses
// الوصفة استلمت → قيد التجهيز → جاهزة للتوصيل → تم التوصيل → المرتجعات
// ─────────────────────────────────────────────────────────────

interface PharmacyOrder {
  id: string;
  prescriptionId: string;
  patientName: string;
  pharmacyName: string;
  status: string;
  createdAt: string;
  items: number;
}

const pharmaPipeline = [
  { key: "received", label: "الوصفة استلمت", color: "bg-blue-500" },
  { key: "preparing", label: "قيد التجهيز", color: "bg-amber-500" },
  { key: "ready", label: "جاهزة للتوصيل", color: "bg-emerald-500" },
  { key: "delivered", label: "تم التوصيل", color: "bg-indigo-500" },
  { key: "returned", label: "المرتجعات", color: "bg-red-500" },
];

export default function PharmacyPage() {
  const { data: orders, isLoading } = useDashboardData<PharmacyOrder[]>({ url: "/api/prescriptions", refreshInterval: 15000 });

  const countByStatus = (status: string) => (orders ?? []).filter(o => o.status === status).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Pill size={22} className="text-primary" /> الصيدليات</h1>
        <p className="text-sm text-muted-foreground mt-0.5">5 مراحل: استلام → تجهيز → جاهزة → توصيل → مرتجعات</p>
      </div>

      {/* Pipeline */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2 hide-scrollbar">
        {pharmaPipeline.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 min-w-[120px] hover:shadow-md transition-all">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold mb-2 ${step.color}`}>
                {countByStatus(step.key)}
              </span>
              <span className="text-xs font-medium text-foreground text-center">{step.label}</span>
            </div>
            {i < pharmaPipeline.length - 1 && <ArrowLeft size={16} className="text-muted-foreground mx-1 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (orders ?? []).length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">لا توجد وصفات</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم الوصفة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المريض</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الصيدلية</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العناصر</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(orders ?? []).map((o) => {
                const step = pharmaPipeline.find(p => p.key === o.status);
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-primary">{o.prescriptionId || o.id.slice(0,8)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{o.patientName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{o.pharmacyName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{o.items || "—"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${step?.color || "bg-gray-500"}`}>{step?.label || o.status}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
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
