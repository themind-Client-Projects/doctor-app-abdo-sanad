"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Save,
  Trash2,
  Ban,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Star,
  Calendar,
  Wallet,
  FileText,
  Settings2,
  Building2,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";

// ─────────────────────────────────────────────────────────────
// Partner Detail — covers all 7 sub-pages (req L130-182)
// Tabs: عام | الخدمات | العقود | النسب | الجدول | الأرباح | الأداء
// ─────────────────────────────────────────────────────────────

type TabKey = "general" | "services" | "contracts" | "commissions" | "schedule" | "earnings" | "performance";

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "general", label: "عام", icon: <Settings2 size={16} /> },
  { key: "services", label: "الخدمات", icon: <CheckCircle2 size={16} /> },
  { key: "contracts", label: "العقود", icon: <FileText size={16} /> },
  { key: "commissions", label: "النسب", icon: <Star size={16} /> },
  { key: "schedule", label: "الجدول", icon: <Calendar size={16} /> },
  { key: "earnings", label: "الأرباح", icon: <Wallet size={16} /> },
  { key: "performance", label: "الأداء", icon: <Star size={16} /> },
];

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [isSaving, setIsSaving] = useState(false);

  const { data: partner, isLoading, refetch } = useDashboardData<Record<string, unknown>>({
    url: `/api/partners/${id}`,
  });

  const { data: services } = useDashboardData<Record<string, unknown>[]>({
    url: `/api/partners/${id}/services`,
  });

  const { data: contract } = useDashboardData<Record<string, unknown>>({
    url: `/api/partners/${id}/contract`,
  });

  const { data: walletData } = useDashboardData<Record<string, unknown>>({
    url: `/api/partners/${id}/wallet`,
  });

  const { data: performance } = useDashboardData<Record<string, unknown>>({
    url: `/api/partners/${id}/performance`,
  });

  const { data: schedule } = useDashboardData<Record<string, unknown>[]>({
    url: `/api/partners/${id}/schedule`,
  });

  // Status actions
  const updateStatus = async (status: string) => {
    setIsSaving(true);
    await fetch(`/api/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refetch();
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" dir="rtl">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/partners")} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{partner?.name as string || "شريك"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={partner?.status as string || "PENDING"} />
              {partner?.type ? <span className="text-xs text-muted-foreground">{String(partner.type)}</span> : null}
            </div>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => updateStatus("ACTIVE")} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
            <PlayCircle size={14} /> تفعيل
          </button>
          <button onClick={() => updateStatus("SUSPENDED")} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
            <Ban size={14} /> تعليق
          </button>
          <button onClick={() => updateStatus("PAUSED")} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
            <PauseCircle size={14} /> إيقاف مؤقت
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* ─── General ─── */}
        {activeTab === "general" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">البيانات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "الاسم", key: "name" },
                { label: "الهاتف", key: "phone" },
                { label: "المحافظة", key: "governorate" },
                { label: "العنوان", key: "address" },
                { label: "التقييم", key: "rating" },
                { label: "المهام المكتملة", key: "totalTasks" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
                  <div className="h-10 rounded-lg border border-input bg-background px-3 flex items-center text-sm text-foreground">
                    {String(partner?.[field.key] ?? "—")}
                  </div>
                </div>
              ))}
            </div>
            {/* Complex linking (req L142, L151-152) */}
            {partner?.complexId ? (
              <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={16} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">مرتبط بمجمع</span>
                </div>
                <span className="text-xs text-muted-foreground">معرف المجمع: {String(partner.complexId)}</span>
              </div>
            ) : null}
            {/* Sanad linking */}
            {partner?.isSanadLinked ? (
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">✓ مرتبط بسند</span>
              </div>
            ) : null}
          </div>
        )}

        {/* ─── Services (req L183-198) ─── */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">إدارة الخدمات — ✅ تفعيل | ❌ تعليق | ⏸ إيقاف | 🔄 إعادة</h2>
            {(services ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">لا توجد خدمات مضافة</p>
            ) : (
              <div className="space-y-3">
                {(services ?? []).map((svc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-foreground block">{svc.serviceType as string}</span>
                      <span className="text-xs text-muted-foreground">الطاقة اليومية: {String(svc.dailyCapacity ?? "غير محدد")}</span>
                    </div>
                    <StatusBadge status={svc.status as string || "ACTIVE"} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Contracts (req L199-209, 8 fields) ─── */}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">العقود</h2>
            {contract ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "تاريخ البداية", value: contract.startDate },
                  { label: "تاريخ الانتهاء", value: contract.endDate },
                  { label: "الخدمات", value: contract.services },
                  { label: "النسب", value: contract.commissionRate },
                  { label: "المحافظات", value: contract.governorates },
                  { label: "ساعات العمل", value: contract.workingHours },
                  { label: "الحد الأدنى للأسعار", value: contract.minPrice },
                  { label: "شروط العقد", value: contract.terms },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
                    <div className="h-10 rounded-lg border border-input bg-background px-3 flex items-center text-sm text-foreground">
                      {String(field.value ?? "—")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">لا يوجد عقد نشط</p>
            )}
          </div>
        )}

        {/* ─── Commissions ─── */}
        {activeTab === "commissions" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">النسب</h2>
            <p className="text-sm text-muted-foreground">يتم تحديد النسب من خلال <Link href="/admin/commissions" className="text-primary hover:underline">محرك النسب</Link></p>
          </div>
        )}

        {/* ─── Schedule ─── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">الجدول الزمني</h2>
            {(schedule ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">لم يتم إعداد الجدول</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(schedule ?? []).map((day, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border">
                    <span className="text-sm font-medium text-foreground block">{day.dayOfWeek as string}</span>
                    <span className="text-xs text-muted-foreground">{day.startTime as string} — {day.endTime as string}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Earnings ─── */}
        {activeTab === "earnings" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">الأرباح</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                <span className="text-xs text-muted-foreground block">الرصيد</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{((walletData?.balance as number) ?? 0).toLocaleString("ar-IQ")} د.ع</span>
              </div>
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                <span className="text-xs text-muted-foreground block">المستحقات</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{((walletData?.pendingAmount as number) ?? 0).toLocaleString("ar-IQ")} د.ع</span>
              </div>
              <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
                <span className="text-xs text-muted-foreground block">إجمالي الأرباح</span>
                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{((walletData?.totalEarnings as number) ?? 0).toLocaleString("ar-IQ")} د.ع</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Performance ─── */}
        {activeTab === "performance" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground mb-4">تقييم الأداء</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "التقييم", value: `⭐ ${performance?.averageRating ?? "—"}`, color: "border-amber-200 dark:border-amber-800" },
                { label: "المهام المكتملة", value: performance?.completedTasks ?? 0, color: "border-emerald-200 dark:border-emerald-800" },
                { label: "المهام الملغاة", value: performance?.cancelledTasks ?? 0, color: "border-red-200 dark:border-red-800" },
                { label: "معدل الاستجابة", value: `${performance?.responseRate ?? 0}%`, color: "border-blue-200 dark:border-blue-800" },
              ].map((stat) => (
                <div key={stat.label} className={`p-4 rounded-lg border ${stat.color}`}>
                  <span className="text-xs text-muted-foreground block mb-1">{stat.label}</span>
                  <span className="text-lg font-bold text-foreground">{String(stat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
