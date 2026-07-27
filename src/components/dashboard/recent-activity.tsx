"use client";

import type { ActivityItem } from "@/types/dashboard";

interface RecentActivityProps {
  activities: ActivityItem[];
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;
  if (diffHr < 24) return `قبل ${diffHr} ساعة`;
  return `قبل ${Math.floor(diffHr / 24)} يوم`;
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <h3 className="text-sm font-semibold text-foreground mb-3">النشاط الأخير</h3>
      <div className="space-y-0">
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد نشاط حديث</p>
        ) : (
          activities.map((item, idx) => (
            <div key={item.id} className="flex items-start gap-3 py-2.5 relative">
              {/* Connector line */}
              {idx < activities.length - 1 && (
                <div className="absolute right-[7px] top-[22px] w-0.5 h-full bg-border" />
              )}
              {/* Dot */}
              <div className="relative z-10 mt-1.5 h-[10px] w-[10px] flex-shrink-0 rounded-full border-2 border-primary bg-card" />
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  {item.action}
                  {item.userName && (
                    <span className="text-muted-foreground"> — {item.userName}</span>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">{timeAgo(item.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
