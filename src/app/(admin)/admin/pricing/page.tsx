"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DollarSign, Tag, Gift, Search } from "lucide-react";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// Section 6: إدارة الأسعار (req L231-238) — 6 features
// السعر الأساسي, سعر سند, سعر المجمع, الخصومات, الحملات, الكوبونات
// ─────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: configs, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/pricing" });
  const { data: campaigns } = useDashboardData<Record<string, unknown>[]>({ url: "/api/campaigns" });
  const { data: coupons } = useDashboardData<Record<string, unknown>[]>({ url: "/api/coupons" });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">إدارة الأسعار</h1>
        <p className="text-sm text-muted-foreground mt-0.5">6 عناصر: السعر الأساسي، سعر سند، سعر المجمع، الخصومات، الحملات، الكوبونات</p>
      </div>

      {/* 3 Pricing types */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-foreground">السعر الأساسي</span>
          </div>
          <p className="text-xs text-muted-foreground">سعر الخدمة الافتراضي لجميع المقدمين</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">سعر سند</span>
          </div>
          <p className="text-xs text-muted-foreground">سعر مخصص لخدمات سند الطبية</p>
        </div>
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-foreground">سعر المجمع</span>
          </div>
          <p className="text-xs text-muted-foreground">سعر خاص حسب عقد المجمع الطبي</p>
        </div>
      </div>

      {/* Campaigns (L237) */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2"><Tag size={18} className="text-primary" /> الحملات</h2>
        {(campaigns ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">لا توجد حملات نشطة</p>
        ) : (
          <div className="space-y-3">
            {(campaigns ?? []).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div>
                  <span className="text-sm font-medium text-foreground block">{c.name as string}</span>
                  <span className="text-xs text-muted-foreground">خصم {c.discountPercent as number}%</span>
                </div>
                <span className={`text-xs font-medium ${c.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {c.isActive ? "نشطة" : "منتهية"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coupons (L238) */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2"><Gift size={18} className="text-primary" /> كوبونات الخصم</h2>
        {(coupons ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">لا توجد كوبونات</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(coupons ?? []).map((c, i) => (
              <div key={i} className="p-4 rounded-lg border border-dashed border-border hover:border-primary transition-colors">
                <span className="text-base font-mono font-bold text-primary block mb-1">{c.code as string}</span>
                <span className="text-xs text-muted-foreground">خصم {c.discountPercent as number}% — استخدم {c.currentUsage as number}/{c.maxUsage as number}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
