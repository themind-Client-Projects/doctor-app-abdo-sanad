"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { HeartPulse, Truck, FlaskConical, ScanLine, Pill, Send, Star, Clock, MapPin } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 4: مركز توزيع المهام (req L324-382) — 5 entity types
// الممرضين (7 fields + btn), السائقين (6 fields + btn),
// المختبرات (6 fields + btn), الأشعة (5 fields), الصيدليات (4 fields)
// ─────────────────────────────────────────────────────────────

type EntityType = "nurses" | "drivers" | "labs" | "radiology" | "pharmacies";

const entityTabs: { key: EntityType; label: string; icon: React.ReactNode }[] = [
  { key: "nurses", label: "الممرضين", icon: <HeartPulse size={16} /> },
  { key: "drivers", label: "السائقين", icon: <Truck size={16} /> },
  { key: "labs", label: "المختبرات", icon: <FlaskConical size={16} /> },
  { key: "radiology", label: "مراكز الأشعة", icon: <ScanLine size={16} /> },
  { key: "pharmacies", label: "الصيدليات", icon: <Pill size={16} /> },
];

export default function DispatchPage() {
  const [activeTab, setActiveTab] = useState<EntityType>("nurses");

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground">مركز توزيع المهام</h1>
        <p className="text-sm text-muted-foreground mt-0.5">5 فئات — الممرضين، السائقين، المختبرات، الأشعة، الصيدليات</p>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
        {entityTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "nurses" && <NursesPanel />}
      {activeTab === "drivers" && <DriversPanel />}
      {activeTab === "labs" && <LabsPanel />}
      {activeTab === "radiology" && <RadiologyPanel />}
      {activeTab === "pharmacies" && <PharmaciesPanel />}
    </div>
  );
}

// ─── الممرضين (L329-339) — 7 fields + button ───
function NursesPanel() {
  const { data, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/partners", params: { type: "NURSE" } });
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">
            <Th>الاسم</Th><Th>التقييم</Th><Th>المهام الحالية</Th><Th>آخر ظهور</Th><Th>المحافظة</Th><Th>المنطقة</Th><Th>الحالة</Th><Th>إجراء</Th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((n, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <Td bold>{String(n.name ?? "—")}</Td>
                <Td>⭐ {String(n.rating ?? "—")}</Td>
                <Td>{String(n.currentTasks ?? 0)}</Td>
                <Td>{String(n.lastSeen ?? "—")}</Td>
                <Td>{String(n.governorate ?? "—")}</Td>
                <Td>{String(n.area ?? "—")}</Td>
                <Td><StatusBadge status={String(n.status ?? "AVAILABLE")} size="sm" /></Td>
                <Td><ActionBtn label="تعيين المهمة" /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── السائقين (L341-351) — 6 fields + button ───
function DriversPanel() {
  const { data, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/partners", params: { type: "DRIVER" } });
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">
            <Th>الاسم</Th><Th>السيارة</Th><Th>المنطقة</Th><Th>التقييم</Th><Th>متاح الآن</Th><Th>المهام</Th><Th>إجراء</Th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((d, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <Td bold>{String(d.name ?? "—")}</Td>
                <Td>{String(d.vehicleType ?? "—")}</Td>
                <Td>{String(d.area ?? "—")}</Td>
                <Td>⭐ {String(d.rating ?? "—")}</Td>
                <Td>{String(d.status) === "AVAILABLE" ? <span className="text-emerald-600">✓ متاح</span> : <span className="text-red-600">✗ مشغول</span>}</Td>
                <Td>{String(d.currentTasks ?? 0)}</Td>
                <Td><ActionBtn label="إرسال المهمة" /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── المختبرات (L354-364) — 6 fields + button ───
function LabsPanel() {
  const { data, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/partners", params: { type: "LAB" } });
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">
            <Th>اسم المختبر</Th><Th>وقت الاستجابة</Th><Th>الطلبات الحالية</Th><Th>تقييم الجودة</Th><Th>ساعات العمل</Th><Th>المحافظة</Th><Th>إجراء</Th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((l, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <Td bold>{String(l.name ?? "—")}</Td>
                <Td>{String(l.responseTime ?? "—")}</Td>
                <Td>{String(l.currentTasks ?? 0)}</Td>
                <Td>⭐ {String(l.rating ?? "—")}</Td>
                <Td>{String(l.workingHours ?? "—")}</Td>
                <Td>{String(l.governorate ?? "—")}</Td>
                <Td><ActionBtn label="اعتماد المختبر" /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── مراكز الأشعة (L367-374) — 5 fields, NO button ───
function RadiologyPanel() {
  const { data, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/partners", params: { type: "RADIOLOGY" } });
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">
            <Th>اسم المركز</Th><Th>نوع الأجهزة</Th><Th>أقرب موعد</Th><Th>وقت التقرير</Th><Th>التقييم</Th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((r, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <Td bold>{String(r.name ?? "—")}</Td>
                <Td>{String(r.equipmentType ?? "—")}</Td>
                <Td>{String(r.nextSlot ?? "—")}</Td>
                <Td>{String(r.reportTime ?? "—")}</Td>
                <Td>⭐ {String(r.rating ?? "—")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── الصيدليات (L376-382) — 4 fields, NO button ───
function PharmaciesPanel() {
  const { data, isLoading } = useDashboardData<Record<string, unknown>[]>({ url: "/api/partners", params: { type: "PHARMACY" } });
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">
            <Th>الصيدلية</Th><Th>توفر الدواء</Th><Th>التوصيل</Th><Th>ساعات العمل</Th><Th>التقييم</Th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((p, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <Td bold>{String(p.name ?? "—")}</Td>
                <Td>{String(p.availability ?? "—")}</Td>
                <Td>{String(p.hasDelivery) === "true" ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">✗</span>}</Td>
                <Td>{String(p.workingHours ?? "—")}</Td>
                <Td>⭐ {String(p.rating ?? "—")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Shared helpers
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{children}</th>;
}
function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>{children}</td>;
}
function ActionBtn({ label }: { label: string }) {
  return <button className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"><Send size={12} />{label}</button>;
}
function Loading() {
  return <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>;
}
