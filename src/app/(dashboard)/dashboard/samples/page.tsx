"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, FlaskConical, Upload, Eye } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Lab: Samples List (req L54 "المختبر يرى العينات")
// ─────────────────────────────────────────────────────────────

interface LabSample {
  id: string;
  sampleType: string;
  patientName: string;
  orderId: string;
  status: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  received: "استلمت",
  in_lab: "وصلت المختبر",
  testing: "قيد الفحص",
  ready: "النتيجة جاهزة",
  sent_to_doctor: "أرسلت للطبيب",
  sent_to_patient: "أرسلت للمريض",
};

export default function SamplesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: samples } = useDashboardData<LabSample[]>({
    url: "/api/dashboard/samples",
  });

  const filtered = (samples || []).filter((s) => {
    const matchSearch = s.sampleType.includes(search) || s.patientName.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">العينات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة العينات المختبرية — {filtered.length} عينة
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <FlaskConical size={16} />
          استلام عينة
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بنوع التحليل أو اسم المريض..."
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

      {/* 6-Status Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = (samples || []).filter((s) => s.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={`rounded-xl border p-3 text-center transition-all ${
                statusFilter === key
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card hover:bg-muted/50"
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
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">نوع التحليل</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المريض</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الطلب</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد عينات</td></tr>
            ) : (
              filtered.map((sample) => (
                <tr key={sample.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{sample.sampleType}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sample.patientName}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{sample.orderId}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusLabels[sample.status] || sample.status} size="sm" /></td>
                  <td className="px-4 py-3 text-muted-foreground">{sample.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="عرض"><Eye size={14} className="text-muted-foreground" /></button>
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="رفع النتيجة"><Upload size={14} className="text-muted-foreground" /></button>
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
