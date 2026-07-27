import { SessionProvider } from "next-auth/react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Handshake,
  FileText,
  Percent,
  DollarSign,
  Wallet,
  Activity,
  BarChart3,
  UserCog,
} from "lucide-react";

const adminMenu = [
  { label: "الرئيسية", icon: <LayoutDashboard size={18} />, href: "/admin" },
  { label: "الشركاء", icon: <Handshake size={18} />, href: "/admin/partners" },
  { label: "الخدمات", icon: <FileText size={18} />, href: "/admin/services" },
  { label: "العقود", icon: <FileText size={18} />, href: "/admin/contracts" },
  { label: "النسب", icon: <Percent size={18} />, href: "/admin/commissions" },
  { label: "الأسعار", icon: <DollarSign size={18} />, href: "/admin/pricing" },
  { label: "المحافظ", icon: <Wallet size={18} />, href: "/admin/wallets" },
  { label: "المراقبة", icon: <Activity size={18} />, href: "/admin/monitoring" },
  { label: "التقارير", icon: <BarChart3 size={18} />, href: "/admin/reports" },
  { label: "المستخدمين", icon: <UserCog size={18} />, href: "/admin/users" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background" dir="rtl">
        {/* Admin Sidebar */}
        <aside className="fixed right-0 top-0 z-40 h-screen w-64 border-l border-border bg-card">
          {/* Header */}
          <div className="flex h-16 items-center gap-2 border-b border-border px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-lg">
              و
            </div>
            <span className="text-lg font-bold text-foreground">وريد — المدير</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1 p-3">
            {adminMenu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="mr-64 min-h-screen flex flex-col">
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
