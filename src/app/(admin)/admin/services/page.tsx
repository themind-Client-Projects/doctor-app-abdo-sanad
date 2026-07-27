"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  CheckCircle2,
  Ban,
  PauseCircle,
  RefreshCw,
  Clock,
  MapPin,
  Users,
  Search,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 3: إدارة الخدمات (req L183-198) — "هذه من أهم الصفحات"
// 7 features: تفعيل, تعليق, إيقاف مؤقت, إعادة التفعيل, أوقات العمل, المحافظات, الطاقة اليومية
// ─────────────────────────────────────────────────────────────

interface ServiceConfig {
  id: string;
  partnerId: string;
  partnerName: string;
  serviceType: string;
  status: string;
  dailyCapacity: number | null;
  workingHours: string | null;
  governorates: string[];
}

const serviceTypeLabels: Record<string, string> = {
  IN_PERSON: "حضوري",
  ONLINE: "أونلاين",
  HOME_VISIT: "زيارة منزلية",
  SURGERY: "عمليات",
  BLOOD_DRAW: "سحب دم",
  HOME_TEST: "تحاليل منزلية",
  DELIVERY: "توصيل",
  X_RAY: "أشعة سينية",
  CT_SCAN: "أشعة مقطعية",
  MRI: "رنين مغناطيسي",
};

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: services, isLoading } = useDashboardData<ServiceConfig[]>({
    url: "/api/pricing",
  });

  const updateServiceStatus = async (id: string, status: string) => {
    // Would call API to update service status
    console.log("Update service", id, "to", status);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">إدارة الخدمات</h1>
        <p className="text-sm text-muted-foreground mt-0.5">هذه من أهم الصفحات — تحكم في خدمات كل شريك</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-4 rounded-lg border border-border bg-muted/20">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={14} /> تفعيل</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"><Ban size={14} /> تعليق</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"><PauseCircle size={14} /> إيقاف مؤقت</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300"><RefreshCw size={14} /> إعادة التفعيل</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock size={14} /> أوقات العمل</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MapPin size={14} /> المحافظات</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users size={14} /> الطاقة اليومية</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1">
          {["ACTIVE", "SUSPENDED", "PAUSED"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              <StatusBadge status={s} size="sm" />
            </button>
          ))}
        </div>
      </div>

      {/* Doctor example services (req L194-198) */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">مثال — خدمات الطبيب (L194-198)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { type: "IN_PERSON", label: "☑ حضوري", active: true },
            { type: "ONLINE", label: "☑ أونلاين", active: true },
            { type: "HOME_VISIT", label: "☑ زيارة منزلية", active: true },
            { type: "SURGERY", label: "☐ عمليات", active: false },
          ].map((svc) => (
            <div key={svc.type} className={`p-4 rounded-lg border transition-colors ${svc.active ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-border bg-muted/30"}`}>
              <span className="text-sm font-medium text-foreground">{svc.label}</span>
              <div className="flex gap-1 mt-2">
                <button className="text-[10px] px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">تفعيل</button>
                <button className="text-[10px] px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">تعليق</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
