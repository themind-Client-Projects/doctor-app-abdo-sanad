"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wallet,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  FlaskConical,
  Pill,
  Truck,
  Stethoscope,
  ScanLine,
} from "lucide-react";

interface SidebarProps {
  role: string;
  userName: string;
  entityName: string;
  avatarUrl?: string;
}

const roleMenus: Record<string, { label: string; icon: React.ReactNode; href: string }[]> = {
  DOCTOR: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "المرضى", icon: <Users size={20} />, href: "/dashboard/patients" },
    { label: "المواعيد", icon: <ClipboardList size={20} />, href: "/dashboard/appointments" },
    { label: "الوصفات", icon: <ClipboardList size={20} />, href: "/dashboard/prescriptions" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
  LAB: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "العينات", icon: <FlaskConical size={20} />, href: "/dashboard/samples" },
    { label: "النتائج", icon: <ClipboardList size={20} />, href: "/dashboard/results" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
  PHARMACY: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "الوصفات", icon: <Pill size={20} />, href: "/dashboard/prescriptions" },
    { label: "المخزون", icon: <ClipboardList size={20} />, href: "/dashboard/inventory" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
  NURSE: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "الزيارات", icon: <Stethoscope size={20} />, href: "/dashboard/visits" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
  DRIVER: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "الرحلات", icon: <Truck size={20} />, href: "/dashboard/trips" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
  RADIOLOGY: [
    { label: "الرئيسية", icon: <LayoutDashboard size={20} />, href: "/dashboard" },
    { label: "الطلبات", icon: <ScanLine size={20} />, href: "/dashboard/requests" },
    { label: "التقارير", icon: <ClipboardList size={20} />, href: "/dashboard/reports" },
    { label: "المالية", icon: <Wallet size={20} />, href: "/dashboard/finance" },
    { label: "الإشعارات", icon: <Bell size={20} />, href: "/dashboard/notifications" },
    { label: "الإعدادات", icon: <Settings size={20} />, href: "/dashboard/settings" },
  ],
};

export function DashboardSidebar({ role, userName, entityName, avatarUrl }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const menu = roleMenus[role] || roleMenus.DOCTOR;

  return (
    <aside
      className={`fixed right-0 top-0 z-40 h-screen border-l border-border bg-card transition-all duration-300 ${
        isCollapsed ? "w-[68px]" : "w-64"
      }`}
      dir="rtl"
    >
      {/* Logo + Toggle */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            و
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold text-foreground">وريد</span>
          )}
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          {isCollapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Entity name (req L9) */}
      {!isCollapsed && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs text-muted-foreground truncate">{entityName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
        {menu.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="h-full w-full rounded-full object-cover" />
                ) : (
                  userName?.charAt(0) || "م"
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{userName}</span>
                <span className="text-xs text-muted-foreground">{role}</span>
              </div>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" aria-label="تسجيل الخروج">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
