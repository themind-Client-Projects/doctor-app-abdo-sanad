"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Droplets } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 8: إدارة بنك الدم (req L433-443) — 8 fields
// الطلبات الجديدة, زمرة الدم, المحافظة, الحالة, المتبرع المقبول,
// موعد السحب, حالة التحاليل, حالة التسليم
// ─────────────────────────────────────────────────────────────

interface BloodRequest {
  id: string;
  bloodType: string;
  governorate: string;
  status: string;
  donorName: string;
  drawDate: string;
  testStatus: string;
  deliveryStatus: string;
  createdAt: string;
}

export default function BloodBankPage() {
  const { data: requests, isLoading } = useDashboardData<BloodRequest[]>({ url: "/api/blood-bank" });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Droplets size={22} className="text-red-500" /> إدارة بنك الدم</h1>
        <p className="text-sm text-muted-foreground mt-0.5">8 حقول لكل طلب دم</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (requests ?? []).length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">لا توجد طلبات</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">زمرة الدم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المحافظة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المتبرع</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">موعد السحب</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التحاليل</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التسليم</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(requests ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 text-sm font-bold text-red-700 dark:text-red-300">{r.bloodType}</span></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.governorate}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-foreground">{r.donorName || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.drawDate ? formatDate(r.drawDate) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.testStatus || "PENDING"} size="sm" /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.deliveryStatus || "PENDING"} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
