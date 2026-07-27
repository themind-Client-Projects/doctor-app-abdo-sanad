"use client";

import { Calendar, Clock } from "lucide-react";
import type { CalendarItem } from "@/types/dashboard";

interface CalendarWidgetProps {
  appointments: CalendarItem[];
}

const typeLabels: Record<string, string> = {
  IN_PERSON: "حضوري",
  ONLINE: "أونلاين",
  HOME_VISIT: "زيارة منزلية",
  SURGERY: "عمليات",
};

export function CalendarWidget({ appointments }: CalendarWidgetProps) {
  const today = new Date().toLocaleDateString("ar-IQ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calendar size={16} className="text-primary" />
          التقويم
        </h3>
        <span className="text-xs text-muted-foreground">{today}</span>
      </div>

      <div className="space-y-2">
        {appointments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مواعيد اليوم</p>
        ) : (
          appointments.map((apt) => (
            <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                <Clock size={12} />
                <span className="font-medium">{apt.time}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground block truncate">{apt.patientName}</span>
                <span className="text-xs text-muted-foreground">{typeLabels[apt.type] || apt.type}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                apt.status === "confirmed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                apt.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              }`}>
                {apt.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
