"use client";

import Link from "next/link";
import {
  CalendarDays,
  FileText,
  FlaskConical,
  Pill,
  ScanLine,
  Share2,
  Stethoscope,
  Truck,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/types/dashboard";

// ─────────────────────────────────────────────────────────────
// الاختصارات السريعة
//
// All thirteen of these linked to pages that do not exist and never have:
// /dashboard/patients/new, /dashboard/consultation, /dashboard/samples/receive,
// /dashboard/results/upload, /dashboard/trips/start … Every shortcut on every
// role's home page was a 404, which is the worst kind of dead control — it
// looks like the fastest route to the thing you need.
//
// They point at the real screens now. The ones that open a form carry `?new=1`,
// which those pages read to open their dialog on arrival, so "استلام عينة" still
// lands on the intake form in one click rather than on a list you then have to
// find the button in.
//
// Two of the originals had nothing to point at and are gone rather than
// re-aimed at something that merely sounds similar:
//   • "مريض جديد" — creating an account is an administrator's action; a doctor
//     acquires patients by treating them.
//   • "استشارة فيديو" — there is no teleconsultation room in the staff
//     dashboard, only the patient-facing page.
// ─────────────────────────────────────────────────────────────

interface QuickActionsProps {
  role: UserRole;
}

interface ActionConfig {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const BLUE = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
const GREEN = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
const PURPLE = "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";

const roleActions: Record<string, ActionConfig[]> = {
  DOCTOR: [
    { label: "كتابة وصفة", icon: <FileText size={18} />, href: "/dashboard/prescriptions?new=1", color: PURPLE },
    { label: "مواعيدي", icon: <CalendarDays size={18} />, href: "/dashboard/appointments", color: BLUE },
    { label: "مرضاي", icon: <Users size={18} />, href: "/dashboard/patients", color: GREEN },
  ],
  LAB: [
    { label: "استلام عينة", icon: <FlaskConical size={18} />, href: "/dashboard/samples?new=1", color: BLUE },
    { label: "النتائج", icon: <Upload size={18} />, href: "/dashboard/samples", color: GREEN },
    { label: "المالية", icon: <Wallet size={18} />, href: "/dashboard/finance", color: PURPLE },
  ],
  PHARMACY: [
    { label: "الوصفات", icon: <Pill size={18} />, href: "/dashboard/prescriptions", color: BLUE },
    { label: "مرضاي", icon: <Users size={18} />, href: "/dashboard/patients", color: GREEN },
    { label: "المالية", icon: <Wallet size={18} />, href: "/dashboard/finance", color: PURPLE },
  ],
  DRIVER: [
    { label: "رحلاتي", icon: <Truck size={18} />, href: "/dashboard/trips", color: GREEN },
    { label: "المالية", icon: <Wallet size={18} />, href: "/dashboard/finance", color: PURPLE },
  ],
  NURSE: [
    { label: "زياراتي", icon: <Stethoscope size={18} />, href: "/dashboard/visits", color: GREEN },
    { label: "مرضاي", icon: <Users size={18} />, href: "/dashboard/patients", color: BLUE },
    { label: "المالية", icon: <Wallet size={18} />, href: "/dashboard/finance", color: PURPLE },
  ],
  RADIOLOGY: [
    { label: "حجز فحص", icon: <ScanLine size={18} />, href: "/dashboard/imaging?new=1", color: BLUE },
    { label: "التقارير", icon: <Upload size={18} />, href: "/dashboard/imaging", color: GREEN },
    { label: "المالية", icon: <Wallet size={18} />, href: "/dashboard/finance", color: PURPLE },
  ],
};

/** Offered to everyone; the page itself explains it to a non-complex partner. */
const REFERRALS: ActionConfig = {
  label: "الإحالات",
  icon: <Share2 size={18} />,
  href: "/dashboard/referrals",
  color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
};

export function QuickActions({ role }: QuickActionsProps) {
  const actions = roleActions[role] || roleActions.DOCTOR;

  return (
    <div className="rounded-xl border border-border bg-card p-4" dir="rtl">
      <h3 className="text-sm font-semibold text-foreground mb-3">الاختصارات السريعة</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[...actions, ...(role === "DRIVER" ? [] : [REFERRALS])].map((action) => (
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
