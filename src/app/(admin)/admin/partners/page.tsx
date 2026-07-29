"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Stethoscope,
  FlaskConical,
  Pill,
  ScanLine,
  HeartPulse,
  Truck,
  Plus,
  Search,
  Filter,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 2: إدارة الشركاء (req L128-182) — 7 partner types
// ─────────────────────────────────────────────────────────────

const partnerTabs = [
  { key: "ALL", label: "الكل", icon: <Building2 size={16} /> },
  { key: "COMPLEX", label: "المجمعات الطبية", icon: <Building2 size={16} /> },
  { key: "DOCTOR", label: "الأطباء", icon: <Stethoscope size={16} /> },
  { key: "LAB", label: "المختبرات", icon: <FlaskConical size={16} /> },
  { key: "PHARMACY", label: "الصيدليات", icon: <Pill size={16} /> },
  { key: "RADIOLOGY", label: "مراكز الأشعة", icon: <ScanLine size={16} /> },
  { key: "NURSE", label: "الممرضون", icon: <HeartPulse size={16} /> },
  { key: "DRIVER", label: "السائقون", icon: <Truck size={16} /> },
];

interface Partner {
  id: string;
  name: string;
  type: string;
  status: string;
  rating: number;
  totalTasks: number;
  phone?: string;
  user?: { name: string };
}

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data: partners, isLoading } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: activeTab !== "ALL" ? { type: activeTab } : undefined,
  });

  const filtered = (partners ?? []).filter((p) =>
    search ? p.name.includes(search) || p.user?.name?.includes(search) : true
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">إدارة الشركاء</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة جميع مقدمي الخدمات في المنصة</p>
        </div>
        <Link
          href="/admin/partners/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          إضافة شريك
        </Link>
      </div>

      {/* Tabs (7 partner types) */}
      <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
        {partnerTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث عن شريك..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">لا يوجد شركاء</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الاسم</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">النوع</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">التقييم</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">المهام</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((partner) => (
                  <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-foreground">{partner.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-muted-foreground">
                        {partnerTabs.find((t) => t.key === partner.type)?.label || partner.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={partner.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-foreground">⭐ {partner.rating?.toFixed(1) || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-muted-foreground">{formatNumber(partner.totalTasks) || "0"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        عرض التفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
