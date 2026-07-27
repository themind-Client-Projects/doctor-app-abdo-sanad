"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Timeline } from "@/components/shared/timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { Search, Eye } from "lucide-react";
import type { TimelineStep } from "@/types/dashboard";

// ─────────────────────────────────────────────────────────────
// Section 5: متابعة التنفيذ (req L384-407) — 11 steps
// ─────────────────────────────────────────────────────────────

interface TrackedOrder {
  id: string;
  orderNumber: string;
  patientName: string;
  serviceType: string;
  status: string;
  assignedTo: string;
  timeline: TimelineStep[];
}

export default function TrackingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useDashboardData<TrackedOrder[]>({
    url: "/api/orders",
    params: { status: "IN_PROGRESS,ASSIGNED,IN_TRANSIT,ARRIVED" },
    refreshInterval: 15000,
  });

  const selected = (orders ?? []).find((o) => o.id === selectedId);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">متابعة التنفيذ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">11 خطوة لكل طلب — من الإنشاء حتى الاكتمال</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="بحث برقم الطلب..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)
          ) : (orders ?? []).filter(o => !search || o.orderNumber.includes(search) || o.patientName.includes(search)).map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className={`w-full text-right rounded-xl border p-4 transition-all hover:shadow-md ${selectedId === order.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono font-bold text-primary">#{order.orderNumber}</span>
                <StatusBadge status={order.status} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{order.patientName}</span>
                <span className="text-xs text-muted-foreground">{order.assignedTo || "غير معين"}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Timeline panel */}
        <div className="rounded-xl border border-border bg-card p-5">
          {selected ? (
            <>
              <h3 className="text-sm font-semibold text-foreground mb-1">تتبع الطلب #{selected.orderNumber}</h3>
              <p className="text-xs text-muted-foreground mb-4">{selected.patientName}</p>
              <Timeline steps={selected.timeline ?? []} />
            </>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm">
              اختر طلباً لعرض مراحل التنفيذ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
