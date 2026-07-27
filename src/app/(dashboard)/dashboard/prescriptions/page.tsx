"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Pill, Eye, Printer } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Pharmacy: Prescriptions (req L55 "الصيدلية ترى الوصفات")
// Statuses: الوصفة استلمت, قيد التجهيز, جاهزة للتوصيل, تم التوصيل, المرتجعات
// ─────────────────────────────────────────────────────────────

interface Prescription {
  id: string;
  patientName: string;
  doctorName: string;
  medications: string;
  status: string;
  orderId: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  new: "الوصفة استلمت",
  preparing: "قيد التجهيز",
  ready: "جاهزة للتوصيل",
  delivered: "تم التوصيل",
  returned: "المرتجعات",
};

export default function PrescriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: prescriptions } = useDashboardData<Prescription[]>({
    url: "/api/dashboard/prescriptions",
  });

  const filtered = (prescriptions || []).filter((p) => {
    const matchSearch = p.patientName.includes(search) || p.medications.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">الوصفات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة الوصفات الطبية — {filtered.length} وصفة
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Pill size={16} />
          تجهيز وصفة
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالمريض أو الدواء..."
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

      {/* 5-Status Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = (prescriptions || []).filter((p) => p.status === key).length;
          const colors: Record<string, string> = {
            new: "border-blue-200 dark:border-blue-800",
            preparing: "border-amber-200 dark:border-amber-800",
            ready: "border-emerald-200 dark:border-emerald-800",
            delivered: "border-green-200 dark:border-green-800",
            returned: "border-red-200 dark:border-red-800",
          };
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={`rounded-xl border-2 p-3 text-center transition-all ${
                statusFilter === key
                  ? "ring-2 ring-primary/30 bg-primary/5"
                  : `bg-card hover:bg-muted/50 ${colors[key] || "border-border"}`
              }`}
            >
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المريض</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الطبيب</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الأدوية</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد وصفات</td></tr>
            ) : (
              filtered.map((rx) => (
                <tr key={rx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{rx.patientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rx.doctorName}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{rx.medications}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusLabels[rx.status] || rx.status} size="sm" /></td>
                  <td className="px-4 py-3 text-muted-foreground">{rx.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="عرض"><Eye size={14} className="text-muted-foreground" /></button>
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="طباعة فاتورة"><Printer size={14} className="text-muted-foreground" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
