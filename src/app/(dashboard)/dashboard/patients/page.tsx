"use client";

import { useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Filter, UserPlus, Phone, FileText, Calendar } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Doctor: Patient List (req L53 "الطبيب يرى المرضى")
// ─────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  lastVisit: string;
  nextAppointment: string;
  status: string;
  totalVisits: number;
}

export default function PatientsPage() {
  const { partnerId } = useRole();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: patients } = useDashboardData<Patient[]>({
    url: "/api/dashboard/patients",
    params: { partnerId: partnerId || "" },
  });

  const filtered = (patients || []).filter((p) => {
    const matchSearch = p.name.includes(search) || p.phone.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">المرضى</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            قائمة المرضى — {filtered.length} مريض
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <UserPlus size={16} />
          مريض جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
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
          <option value="active">نشط</option>
          <option value="completed">مكتمل</option>
          <option value="scheduled">مجدول</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المريض</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الهاتف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">آخر زيارة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموعد القادم</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  لا يوجد مرضى
                </td>
              </tr>
            ) : (
              filtered.map((patient) => (
                <tr key={patient.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.totalVisits} زيارة</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">{patient.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{patient.lastVisit}</td>
                  <td className="px-4 py-3 text-muted-foreground">{patient.nextAppointment || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={patient.status} size="sm" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="اتصال">
                        <a href={`tel:${patient.phone}`}><Phone size={14} className="text-muted-foreground" /></a>
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="وصفة">
                        <FileText size={14} className="text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors" title="موعد">
                        <Calendar size={14} className="text-muted-foreground" />
                      </button>
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
