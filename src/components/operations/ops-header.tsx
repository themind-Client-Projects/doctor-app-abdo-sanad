"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Clock } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { GlobalSearch, NotificationBell } from "@/components/shared/header-menus";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Section 1: Operations Header (req L273-284) — 9 elements
// اسم الموظف, الدور, الحالة, طلبات جديدة, طلبات متأخرة,
// الوقت والتاريخ, البحث, الإشعارات, الوضع الليلي
// ─────────────────────────────────────────────────────────────

interface OpsHeaderProps {
  employeeName: string;
  role: string;
  newOrders: number;
  delayedOrders: number;
}

type EmployeeStatus = "available" | "busy" | "break";

const statusConfig: Record<EmployeeStatus, { label: string; color: string }> = {
  available: { label: "متاح", color: "bg-emerald-500" },
  busy: { label: "مشغول", color: "bg-red-500" },
  break: { label: "استراحة", color: "bg-amber-500" },
};

export function OpsHeader({ employeeName, role, newOrders, delayedOrders }: OpsHeaderProps) {
  const { isDark, toggle, mounted } = useDarkMode();
  const [status, setStatus] = useState<EmployeeStatus>("available");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const tick = () => setCurrentTime(formatDateTime(new Date()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/95 backdrop-blur-sm px-4 flex items-center justify-between gap-3" dir="rtl">
      {/* Right: employee info (L276-278) */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
          {employeeName.charAt(0)}
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-medium text-foreground block leading-tight">{employeeName}</span>
          <span className="text-[10px] text-muted-foreground">{role}</span>
        </div>
        {/* Status toggle (L278) */}
        <button
          onClick={() => setStatus(status === "available" ? "busy" : status === "busy" ? "break" : "available")}
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-accent transition-colors"
        >
          <span className={`h-2 w-2 rounded-full ${statusConfig[status].color}`} />
          {statusConfig[status].label}
        </button>
      </div>

      {/* Center: counts + time (L279-281) */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{newOrders}</span>
          <span className="text-[10px] text-blue-600 dark:text-blue-400">جديدة</span>
        </div>
        {delayedOrders > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 px-2.5 py-1 animate-pulse">
            <span className="text-xs font-bold text-red-700 dark:text-red-300">{delayedOrders}</span>
            <span className="text-[10px] text-red-600 dark:text-red-400">متأخرة</span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Left: search, notifications, dark mode (L282-284)
          Both were bare buttons with no handler — and the bell carried a REAL
          unread count, so operations saw a red badge it could not open. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <GlobalSearch />
        <NotificationBell />
        <button onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
          {!mounted ? (
            <span className="block h-[16px] w-[16px]" aria-hidden="true" />
          ) : isDark ? (
            <Sun size={16} />
          ) : (
            <Moon size={16} />
          )}
        </button>
      </div>
    </header>
  );
}
