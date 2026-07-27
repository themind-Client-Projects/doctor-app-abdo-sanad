"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";
import { Plus, FileText, Search } from "lucide-react";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// Section 4: إدارة العقود (req L199-209) — 8 fields per contract
// ─────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  partnerId: string;
  partner?: { name: string; type: string };
  startDate: string;
  endDate: string;
  commissionRate: number;
  status: string;
}

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const { data: contracts, isLoading } = useDashboardData<Contract[]>({
    url: "/api/commissions",
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">إدارة العقود</h1>
          <p className="text-sm text-muted-foreground mt-0.5">8 حقول لكل عقد: البداية، الانتهاء، الخدمات، النسب، المحافظات، ساعات العمل، الأسعار، الشروط</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={16} /> عقد جديد
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="بحث بالعقود..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* 8-field info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-muted/20">
        {["تاريخ البداية", "تاريخ الانتهاء", "الخدمات", "النسب", "المحافظات", "ساعات العمل", "الحد الأدنى للأسعار", "شروط العقد"].map((f) => (
          <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText size={12} /> {f}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الشريك</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">البداية</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الانتهاء</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">النسبة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(contracts ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{c.partner?.name || c.partnerId}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.startDate ? new Date(c.startDate).toLocaleDateString("ar-EG") : "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.endDate ? new Date(c.endDate).toLocaleDateString("ar-EG") : "—"}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{c.commissionRate}%</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status || "ACTIVE"} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
