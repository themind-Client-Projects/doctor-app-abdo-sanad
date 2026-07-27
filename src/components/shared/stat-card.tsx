"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  color?: string;
}

export function StatCard({ label, value, icon, trend, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      {icon && (
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color || "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-lg font-bold text-foreground block">
          {typeof value === "number" ? value.toLocaleString("ar-EG") : value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-semibold ${
          trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}>
          {trend >= 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
  );
}
