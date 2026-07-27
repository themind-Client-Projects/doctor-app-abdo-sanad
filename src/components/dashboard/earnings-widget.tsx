"use client";

import { Wallet, TrendingUp, Clock } from "lucide-react";
import type { EarningsSummary } from "@/types/dashboard";

interface EarningsWidgetProps {
  earnings: EarningsSummary;
}

export function EarningsWidget({ earnings }: EarningsWidgetProps) {
  const fmt = (v: number) => `${v.toLocaleString("ar-IQ")} ${earnings.currency}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
        <Wallet size={16} className="text-primary" />
        الأرباح
      </h3>

      <div className="space-y-3">
        {/* أرباح اليوم (req L87) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={16} />
          </div>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">أرباح اليوم</span>
            <span className="text-sm font-bold text-foreground">{fmt(earnings.today)}</span>
          </div>
        </div>

        {/* أرباح الشهر (req L88) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Wallet size={16} />
          </div>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">أرباح الشهر</span>
            <span className="text-sm font-bold text-foreground">{fmt(earnings.month)}</span>
          </div>
        </div>

        {/* مستحقات قادمة (req L89) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Clock size={16} />
          </div>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">مستحقات قادمة</span>
            <span className="text-sm font-bold text-foreground">{fmt(earnings.upcoming)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
