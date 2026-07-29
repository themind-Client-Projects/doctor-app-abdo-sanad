"use client";

import { useState } from "react";
import Link from "next/link";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Check, X, Pause, ArrowLeftRight, Eye, Search, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 3: الطلبات الجديدة (req L300-322) — 12 fields + 5 buttons
// ─────────────────────────────────────────────────────────────

interface Order {
  id: string;
  orderNumber: string;
  patientName: string;
  phone: string;
  governorate: string;
  area: string;
  address: string;
  serviceType: string;
  priority: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  notes: string;
  status: string;
}

const serviceLabels: Record<string, string> = {
  HOME_VISIT: "زيارة منزلية", ONLINE: "أونلاين", IN_PERSON: "حضوري",
  BLOOD_DRAW: "سحب دم", HOME_TEST: "تحليل منزلي", DELIVERY: "توصيل دواء",
  X_RAY: "أشعة", SURGERY: "عملية",
};

const priorityStyles: Record<string, string> = {
  NORMAL: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  URGENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  CRITICAL: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200 animate-pulse",
};

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useDashboardData<Order[]>({
    url: "/api/orders",
    params: { status: "NEW" },
    refreshInterval: 10000,
  });

  const handleAction = async (orderId: string, action: string) => {
    await fetch(`/api/orders/${orderId}/${action}`, { method: "POST" });
    refetch();
  };

  const filtered = (orders ?? []).filter((o) => {
    if (search && !o.patientName.includes(search) && !o.orderNumber.includes(search)) return false;
    if (filterPriority && o.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">الطلبات الجديدة</h1>
        <p className="text-sm text-muted-foreground mt-0.5">12 حقل لكل طلب + 5 أزرار (قبول، رفض، تعليق، تحويل، تفاصيل)</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="بحث برقم الطلب أو اسم المريض..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1">
          {["NORMAL", "URGENT", "CRITICAL"].map((p) => (
            <button key={p} onClick={() => setFilterPriority(filterPriority === p ? null : p)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filterPriority === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              {p === "NORMAL" ? "عادي" : p === "URGENT" ? "عاجل" : "حرج"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders cards */}
      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">لا توجد طلبات جديدة</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-primary">#{order.orderNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityStyles[order.priority] || priorityStyles.NORMAL}`}>
                    {order.priority === "NORMAL" ? "عادي" : order.priority === "URGENT" ? "عاجل" : "حرج"}
                  </span>
                  <StatusBadge status={order.status} size="sm" />
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
              </div>

              {/* 12 fields grid (L304-316 minus map) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                <Field label="اسم المريض" value={order.patientName} />
                <Field label="رقم الهاتف" value={order.phone} dir="ltr" />
                <Field label="المحافظة" value={order.governorate} />
                <Field label="المنطقة" value={order.area} />
                <Field label="العنوان" value={order.address} />
                <Field label="نوع الخدمة" value={serviceLabels[order.serviceType] || order.serviceType} />
                <Field label="طريقة الدفع" value={order.paymentMethod === "CASH" ? "نقداً" : order.paymentMethod === "CARD" ? "بطاقة" : "محفظة"} />
                <Field label="حالة الدفع" value={order.paymentStatus} />
                {order.notes && <Field label="ملاحظات" value={order.notes} className="col-span-2" />}
              </div>

              {/* 5 Action buttons (L318-322) */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button onClick={() => handleAction(order.id, "accept")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                  <Check size={14} /> قبول
                </button>
                <button onClick={() => handleAction(order.id, "reject")} className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                  <X size={14} /> رفض
                </button>
                <button onClick={() => handleAction(order.id, "hold")} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                  <Pause size={14} /> تعليق
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                  <ArrowLeftRight size={14} /> تحويل
                </button>
                <Link href={`/operations/orders/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                  <Eye size={14} /> التفاصيل
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, dir, className }: { label: string; value: string; dir?: string; className?: string }) {
  return (
    <div className={className}>
      <span className="text-[10px] text-muted-foreground block">{label}</span>
      <span className="text-sm text-foreground" dir={dir}>{value || "—"}</span>
    </div>
  );
}
