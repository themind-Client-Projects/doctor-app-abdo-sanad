"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  Calendar,
  Wallet,
  FlaskConical,
  Loader2,
  CheckCircle2,
  FileText,
  ClipboardList,
  Truck,
  ScanLine,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// KPI Card Types
// ─────────────────────────────────────────────────────────────

export interface KPICardData {
  key: string;
  label: string;
  value: number;
  change?: number;
  color: "blue" | "green" | "yellow" | "purple" | "red";
  icon: string;
  href: string;
  isCurrency?: boolean;
}

interface KPICardsProps {
  kpis: KPICardData[];
  isLoading?: boolean;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────
// Icon mapping
// ─────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  users: <Users size={22} />,
  "user-check": <UserCheck size={22} />,
  calendar: <Calendar size={22} />,
  wallet: <Wallet size={22} />,
  flask: <FlaskConical size={22} />,
  loader: <Loader2 size={22} />,
  "check-circle": <CheckCircle2 size={22} />,
  "file-text": <FileText size={22} />,
  clipboard: <ClipboardList size={22} />,
  truck: <Truck size={22} />,
  scan: <ScanLine size={22} />,
};

// ─────────────────────────────────────────────────────────────
// Color configurations
// ─────────────────────────────────────────────────────────────

const cardStyles: Record<string, { card: string; icon: string; value: string }> = {
  blue: {
    card: "border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20",
    icon: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  green: {
    card: "border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20",
    icon: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  yellow: {
    card: "border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20",
    icon: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  purple: {
    card: "border-purple-200 dark:border-purple-800/60 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20",
    icon: "bg-purple-500/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  red: {
    card: "border-red-200 dark:border-red-800/60 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20",
    icon: "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
  },
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function KPICards({ kpis, isLoading, currency = "ر.ي" }: KPICardsProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" dir="rtl">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-10 w-10 rounded-lg bg-muted" />
            </div>
            <div className="h-8 w-24 rounded bg-muted mb-2" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  // Format number with Arabic locale
  const formatValue = (value: number, isCurrency?: boolean) => {
    if (isCurrency) {
      return `${value.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
    }
    return value.toLocaleString("ar-EG");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" dir="rtl">
      {kpis.map((kpi) => {
        const style = cardStyles[kpi.color] || cardStyles.blue;

        return (
          <Link
            key={kpi.key}
            href={kpi.href}
            className={`group relative rounded-xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${style.card}`}
          >
            {/* Header: label + icon */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${style.icon}`}>
                {iconMap[kpi.icon] || <Users size={22} />}
              </div>
            </div>

            {/* Value */}
            <div className={`text-2xl sm:text-3xl font-bold mb-1 ${style.value}`}>
              {formatValue(kpi.value, kpi.isCurrency)}
            </div>

            {/* Trend */}
            {kpi.change !== undefined && (
              <div className="flex items-center gap-1">
                {kpi.change >= 0 ? (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp size={12} />
                    +{kpi.change}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    <TrendingDown size={12} />
                    {kpi.change}%
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground mr-1">
                  مقارنة بالأمس
                </span>
              </div>
            )}

            {/* Hover arrow indicator */}
            <div className="absolute left-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
