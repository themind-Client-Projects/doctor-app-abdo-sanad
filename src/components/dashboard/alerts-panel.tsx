"use client";

import { AlertTriangle, Clock, Calendar, FileWarning, Zap, X } from "lucide-react";
import type { Alert } from "@/types/dashboard";

interface AlertsPanelProps {
  alerts: Alert[];
  onDismiss?: (id: string) => void;
}

const alertConfig: Record<string, { icon: React.ReactNode; label: string; style: string }> = {
  critical: { icon: <AlertTriangle size={14} />, label: "نتيجة حرجة", style: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 text-red-800 dark:text-red-200" },
  delay:    { icon: <Clock size={14} />,         label: "تأخير",       style: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200" },
  upcoming: { icon: <Calendar size={14} />,      label: "موعد قريب",   style: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200" },
  missing:  { icon: <FileWarning size={14} />,   label: "وصفة ناقصة",  style: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200" },
  urgent:   { icon: <Zap size={14} />,           label: "طلب عاجل",    style: "border-red-400 bg-red-100 dark:border-red-700 dark:bg-red-900/40 text-red-900 dark:text-red-100" },
};

export function AlertsPanel({ alerts, onDismiss }: AlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <h3 className="text-sm font-semibold text-foreground mb-3">التنبيهات</h3>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const config = alertConfig[alert.type] || alertConfig.urgent;
          return (
            <div key={alert.id} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${config.style}`}>
              <span className="mt-0.5 flex-shrink-0">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs block mb-0.5">{config.label}</span>
                <span className="text-xs opacity-90 block truncate">{alert.description}</span>
              </div>
              {onDismiss && (
                <button onClick={() => onDismiss(alert.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="إغلاق">
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
