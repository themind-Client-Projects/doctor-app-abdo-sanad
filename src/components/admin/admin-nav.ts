import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Building2,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  LayoutDashboard,
  Percent,
  Receipt,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";

/**
 * Super Admin navigation, grouped to match the requirement's own sections
 * (req L117-265) rather than one flat list of ten links.
 *
 * `ready: true` marks a destination that does not exist yet. It renders
 * disabled instead of as a working link — 24 of 35 links in the staff sidebars
 * were 404s, which is worse than an honest "coming soon" because the user
 * cannot tell a broken app from an unbuilt one.
 */
export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  ready?: boolean;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "إدارة المنصة",
    items: [{ label: "الرئيسية", href: "/admin", icon: LayoutDashboard, ready: true }],
  },
  {
    title: "الشركاء والخدمات",
    items: [
      { label: "إدارة الشركاء", href: "/admin/partners", icon: Handshake, ready: true },
      { label: "العقود والاتفاقيات", href: "/admin/contracts", icon: FileSignature, ready: true },
      { label: "الخدمات", href: "/admin/services", icon: FileText, ready: true },
      { label: "الأسعار", href: "/admin/pricing", icon: Tags, ready: true },
      { label: "العمولات والنسب", href: "/admin/commissions", icon: Percent, ready: true },
      { label: "المجمعات الطبية", href: "/admin/complexes", icon: Building2, ready: true },
    ],
  },
  {
    title: "الإدارة المالية",
    items: [
      { label: "المحافظ المالية", href: "/admin/wallets", icon: Wallet, ready: true },
      { label: "سجل التحويلات", href: "/admin/transfers", icon: ArrowLeftRight, ready: true },
      { label: "الفواتير والمدفوعات", href: "/admin/invoices", icon: Receipt, ready: true },
    ],
  },
  {
    title: "التقارير والتحليلات",
    items: [
      { label: "التقارير العامة", href: "/admin/reports", icon: BarChart3, ready: true },
      { label: "مراقبة النظام", href: "/admin/monitoring", icon: Gauge, ready: true },
      { label: "مؤشرات الجودة", href: "/admin/quality", icon: Activity, ready: true },
    ],
  },
  {
    title: "إدارة النظام",
    items: [
      { label: "المستخدمون", href: "/admin/users", icon: UserCog, ready: true },
      { label: "الصلاحيات والأدوار", href: "/admin/roles", icon: ShieldCheck, ready: true },
      { label: "سجل النشاطات", href: "/admin/activity", icon: Activity, ready: true },
      { label: "إعدادات النظام", href: "/admin/settings", icon: Settings, ready: true },
    ],
  },
];
