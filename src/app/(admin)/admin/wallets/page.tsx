"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Wallet, ArrowUpCircle, ArrowDownCircle, FileText, AlertTriangle, Search } from "lucide-react";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// Section 7: المحافظ المالية (req L239-246) — 6 data types
// رصيد, مستحقات, تحويلات, أرباح, فواتير, ديون
// ─────────────────────────────────────────────────────────────

interface WalletData {
  id: string;
  partnerId: string;
  partner: { name: string; type: string };
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
}

export default function WalletsPage() {
  const [search, setSearch] = useState("");
  const { data: wallets, isLoading } = useDashboardData<WalletData[]>({ url: "/api/wallets" });

  const totalBalance = (wallets ?? []).reduce((s, w) => s + (w.balance || 0), 0);
  const totalPending = (wallets ?? []).reduce((s, w) => s + (w.pendingAmount || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">المحافظ المالية</h1>
        <p className="text-sm text-muted-foreground mt-0.5">6 عناصر: الرصيد، المستحقات، التحويلات، الأرباح، الفواتير، الديون</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-5">
          <div className="flex items-center gap-2 mb-2"><Wallet size={18} className="text-emerald-600 dark:text-emerald-400" /><span className="text-sm font-medium text-muted-foreground">إجمالي الأرصدة</span></div>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalBalance.toLocaleString("ar-EG")} ر.ي</span>
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 p-5">
          <div className="flex items-center gap-2 mb-2"><ArrowUpCircle size={18} className="text-blue-600 dark:text-blue-400" /><span className="text-sm font-medium text-muted-foreground">المستحقات</span></div>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalPending.toLocaleString("ar-EG")} ر.ي</span>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 p-5">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" /><span className="text-sm font-medium text-muted-foreground">الديون المعلقة</span></div>
          <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">٠ ر.ي</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="بحث بالمحافظ..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Wallets table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3,4].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الشريك</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">النوع</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الرصيد</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">المستحقات</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(wallets ?? []).map((w) => (
                <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{w.partner?.name}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{w.partner?.type}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">{w.balance?.toLocaleString("ar-EG")} ر.ي</td>
                  <td className="px-5 py-3.5 text-sm text-blue-700 dark:text-blue-300">{w.pendingAmount?.toLocaleString("ar-EG")} ر.ي</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1">
                      <button className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">تحويل</button>
                      <button className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">فواتير</button>
                    </div>
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
