"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserCog, Plus, Search, Shield, Ban, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 10: إدارة المستخدمين (req L265)
// User CRUD, role assignment, enable/disable
// ─────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "مدير النظام",
  OPERATIONS: "عمليات",
  DOCTOR: "طبيب",
  LAB: "مختبر",
  PHARMACY: "صيدلية",
  NURSE: "ممرض",
  DRIVER: "سائق",
  RADIOLOGY: "أشعة",
  PATIENT: "مريض",
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string | null>(null);

  const { data, isLoading } = useDashboardData<{ data: User[]; total: number }>({
    url: "/api/users",
    params: filterRole ? { role: filterRole } : undefined,
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserCog size={22} className="text-primary" />
            إدارة المستخدمين
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">إجمالي: {data?.total ?? 0} مستخدم</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={16} /> إضافة مستخدم
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {Object.entries(roleLabels).map(([key, label]) => (
            <button key={key} onClick={() => setFilterRole(filterRole === key ? null : key)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterRole === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">لا يوجد مستخدمون</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الاسم</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">البريد</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الهاتف</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الدور</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">التسجيل</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {users.filter(u => search ? u.name?.includes(search) || u.phone?.includes(search) : true).map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{user.name}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground" dir="ltr">{user.email || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground" dir="ltr">{user.phone || "—"}</td>
                  <td className="px-5 py-3.5"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"><Shield size={10} />{roleLabels[user.role] || user.role}</span></td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${user.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {user.isActive ? <><CheckCircle2 size={12} />نشط</> : <><Ban size={12} />معطل</>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{user.createdAt ? formatDate(user.createdAt) : "—"}</td>
                  <td className="px-5 py-3.5">
                    <button className="text-xs font-medium text-primary hover:underline">تعديل</button>
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
