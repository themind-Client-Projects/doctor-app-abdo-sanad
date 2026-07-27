"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Play, StopCircle, Phone, MapPin, Navigation, Package } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Driver: Trips List (req L57 "السائق يرى الرحلات")
// ─────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  pickupAddress: string;
  deliveryAddress: string;
  area: string;
  status: string;
  assignedAt: string;
}

const statusLabels: Record<string, string> = {
  assigned: "تم التعيين",
  picking_up: "في طريق الاستلام",
  picked_up: "تم الاستلام",
  delivering: "في طريق التوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغية",
};

export default function TripsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: trips } = useDashboardData<Trip[]>({
    url: "/api/dashboard/trips",
  });

  const filtered = (trips || []).filter((t) => {
    const matchSearch = t.orderNumber.includes(search) || t.patientName.includes(search) || t.area.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = (trips || []).filter((t) => ["assigned", "picking_up", "picked_up", "delivering"].includes(t.status)).length;
  const completedCount = (trips || []).filter((t) => t.status === "delivered").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الرحلات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} نشطة · {completedCount} مكتملة
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold text-foreground">{(trips || []).length}</p>
          <p className="text-xs text-muted-foreground">إجمالي اليوم</p>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-card p-3 text-center">
          <p className="text-lg font-bold text-amber-600">{activeCount}</p>
          <p className="text-xs text-muted-foreground">قيد التنفيذ</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-card p-3 text-center">
          <p className="text-lg font-bold text-emerald-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground">مكتملة</p>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-card p-3 text-center">
          <p className="text-lg font-bold text-red-600">{(trips || []).filter((t) => t.status === "cancelled").length}</p>
          <p className="text-xs text-muted-foreground">ملغية</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالطلب أو المريض أو المنطقة..."
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

      {/* Trip Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            لا توجد رحلات
          </div>
        ) : (
          filtered.map((trip) => (
            <div key={trip.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Package size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{trip.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{trip.patientName} — {trip.serviceType}</p>
                  </div>
                </div>
                <StatusBadge status={statusLabels[trip.status] || trip.status} size="sm" />
              </div>

              {/* Route */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>من: {trip.pickupAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>إلى: {trip.deliveryAddress}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <a
                  href={`tel:${trip.patientPhone}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Phone size={12} />
                  اتصال
                </a>
                {trip.status === "assigned" && (
                  <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                    <Play size={12} />
                    بدء المهمة
                  </button>
                )}
                {["picking_up", "picked_up", "delivering"].includes(trip.status) && (
                  <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">
                    <StopCircle size={12} />
                    إنهاء المهمة
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
