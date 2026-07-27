"use client";

import { Check, Circle } from "lucide-react";
import type { TimelineStep } from "@/types/dashboard";

interface TimelineProps {
  steps: TimelineStep[];
}

const defaultStepTitles: string[] = [
  "تم إنشاء الطلب",
  "تم قبول الطلب",
  "تم تعيين منفذ الخدمة",
  "تم التواصل",
  "في الطريق",
  "تم الوصول",
  "بدأ التنفيذ",
  "تم إنهاء الخدمة",
  "تم رفع النتائج",
  "تم إشعار المريض",
  "اكتمل الطلب",
];

export function Timeline({ steps }: TimelineProps) {
  return (
    <div className="space-y-0" dir="rtl">
      {defaultStepTitles.map((title, index) => {
        const step = steps.find((s) => s.step === index + 1);
        const isCompleted = step?.isCompleted ?? false;
        const isCurrent = !isCompleted && (index === 0 || steps.find((s) => s.step === index)?.isCompleted);

        return (
          <div key={index} className="relative flex items-start gap-3 pb-6 last:pb-0">
            {/* Connector */}
            {index < defaultStepTitles.length - 1 && (
              <div className={`absolute right-[11px] top-6 w-0.5 h-full ${
                isCompleted ? "bg-primary" : "bg-border"
              }`} />
            )}
            {/* Marker */}
            <div className={`relative z-10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
              isCompleted
                ? "bg-primary text-primary-foreground"
                : isCurrent
                  ? "border-2 border-primary bg-card"
                  : "border-2 border-border bg-card"
            }`}>
              {isCompleted ? <Check size={12} /> : <Circle size={8} className={isCurrent ? "fill-primary text-primary" : "text-border"} />}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <span className={`text-sm block ${
                isCompleted ? "font-medium text-foreground" : isCurrent ? "font-medium text-primary" : "text-muted-foreground"
              }`}>
                {title}
              </span>
              {step?.completedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(step.completedAt).toLocaleString("ar-EG", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
