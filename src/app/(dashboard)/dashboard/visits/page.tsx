"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Play, StopCircle, Phone, MapPin, Navigation } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Nurse: Visits List (req L56 "الممرض يرى الزيارات")
// ─────────────────────────────────────────────────────────────

interface Visit {
  id: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  address: string;
  area: string;
  status: string;
  scheduledTime: string;
}

const statusLabels: Record<string, string> = {
  assigned: "تم التعيين",
  en_route: "في الطريق",
  arrived: "وصل",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغية",
};

export default function VisitsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: visits } = useDashboardData<Visit[]>({
    url: "/api/dashboard/visits",
  });

  const filtered = (visits || []).filter((v) => {
    const matchSearch = v.patientName.includes(search) || v.address.includes(search);
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الزيارات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            زيارات التمريض المنزلي — {filtered.length} زيارة
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
          <Play size={16} />
          بدء الزيارة
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالمريض أو العنوان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pr-10 pl-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Visit Cards (mobile-friendly) */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            لا توجد زيارات
          </div>
        ) : (
          filtered.map((visit) => (
            <div key={visit.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                    {visit.patientName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{visit.patientName}</p>
                    <p className="text-xs text-muted-foreground">{visit.serviceType} — {visit.scheduledTime}</p>
                  </div>
                </div>
                <StatusBadge status={statusLabels[visit.status] || visit.status} size="sm" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={12} />
                <span>{visit.area} — {visit.address}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={`tel:${visit.patientPhone}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Phone size={12} />
                  اتصال
                </a>
                {visit.status === "assigned" && (
                  <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">
                    <Navigation size={12} />
                    بدء
                  </button>
                )}
                {visit.status === "in_progress" && (
                  <button className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">
                    <StopCircle size={12} />
                    إنهاء
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
