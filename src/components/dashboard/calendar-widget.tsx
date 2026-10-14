"use client";

import { Calendar, Clock } from "lucide-react";
import type { CalendarItem } from "@/types/dashboard";
import { LOCALE } from "@/lib/format";
import { APPOINTMENT_TYPE_LABELS, labelOf } from "@/lib/labels";
import { StatusBadge } from "@/components/shared/status-badge";

interface CalendarWidgetProps {
  appointments: CalendarItem[];
}

export function CalendarWidget({ appointments }: CalendarWidgetProps) {
  const today = new Date().toLocaleDateString(LOCALE, {
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
                <span className="text-xs text-muted-foreground">{labelOf(APPOINTMENT_TYPE_LABELS, apt.type)}</span>
              </div>
              {/* Was an inline chip comparing against "confirmed"/"pending",
                  neither of which is in the appointment vocabulary
                  (scheduled | completed | cancelled | no_show) — so every
                  appointment fell through to grey and printed its raw English
                  status. StatusBadge already maps the real values. */}
              <StatusBadge status={apt.status} size="sm" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
