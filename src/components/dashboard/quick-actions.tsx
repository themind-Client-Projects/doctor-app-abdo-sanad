"use client";

import Link from "next/link";
import {
  UserPlus,
  Video,
  FileText,
  FlaskConical,
  Upload,
  Pill,
  Printer,
  Play,
  StopCircle,
} from "lucide-react";
import type { UserRole } from "@/types/dashboard";

interface QuickActionsProps {
  role: UserRole;
}

interface ActionConfig {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const roleActions: Record<string, ActionConfig[]> = {
  DOCTOR: [
    { label: "مريض جديد", icon: <UserPlus size={18} />, href: "/dashboard/patients/new", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: "استشارة فيديو", icon: <Video size={18} />, href: "/dashboard/consultation", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { label: "كتابة وصفة", icon: <FileText size={18} />, href: "/dashboard/prescriptions/new", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
  ],
  LAB: [
    { label: "استلام عينة", icon: <FlaskConical size={18} />, href: "/dashboard/samples/receive", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: "رفع نتيجة", icon: <Upload size={18} />, href: "/dashboard/results/upload", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  ],
  PHARMACY: [
    { label: "تجهيز وصفة", icon: <Pill size={18} />, href: "/dashboard/prescriptions/prepare", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: "طباعة فاتورة", icon: <Printer size={18} />, href: "/dashboard/invoices/print", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  ],
  DRIVER: [
    { label: "بدء المهمة", icon: <Play size={18} />, href: "/dashboard/trips/start", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { label: "إنهاء المهمة", icon: <StopCircle size={18} />, href: "/dashboard/trips/end", color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
  ],
  NURSE: [
    { label: "بدء الزيارة", icon: <Play size={18} />, href: "/dashboard/visits/start", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { label: "رفع التقرير", icon: <Upload size={18} />, href: "/dashboard/reports/upload", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  ],
  RADIOLOGY: [
    { label: "استلام طلب", icon: <FlaskConical size={18} />, href: "/dashboard/requests/receive", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: "رفع تقرير", icon: <Upload size={18} />, href: "/dashboard/reports/upload", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  ],
};

export function QuickActions({ role }: QuickActionsProps) {
  const actions = roleActions[role] || roleActions.DOCTOR;

  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <h3 className="text-sm font-semibold text-foreground mb-3">الاختصارات السريعة</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 hover:shadow-sm transition-all duration-200 group"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${action.color}`}>
              {action.icon}
            </span>
            <span className="text-xs font-medium text-foreground text-center">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
