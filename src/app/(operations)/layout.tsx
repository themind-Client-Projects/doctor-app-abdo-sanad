import { SessionProvider } from "next-auth/react";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Send,
  Route,
  FileHeart,
  Phone,
  Droplets,
  Stethoscope,
  FlaskConical,
  ScanLine,
  Pill,
} from "lucide-react";

const opsMenu = [
  { label: "الرئيسية", icon: <LayoutDashboard size={18} />, href: "/operations" },
  { label: "الطلبات", icon: <ClipboardList size={18} />, href: "/operations/orders" },
  { label: "التوزيع", icon: <Send size={18} />, href: "/operations/dispatch" },
  { label: "المتابعة", icon: <Route size={18} />, href: "/operations/tracking" },
  { label: "الملف الطبي", icon: <FileHeart size={18} />, href: "/operations/medical" },
  { label: "الاتصالات", icon: <Phone size={18} />, href: "/operations/calls" },
  { label: "بنك الدم", icon: <Droplets size={18} />, href: "/operations/blood-bank" },
  { label: "سند", icon: <Stethoscope size={18} />, href: "/operations/sanad" },
  { label: "المختبر", icon: <FlaskConical size={18} />, href: "/operations/lab" },
  { label: "الأشعة", icon: <ScanLine size={18} />, href: "/operations/radiology" },
  { label: "الصيدليات", icon: <Pill size={18} />, href: "/operations/pharmacy" },
];

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background" dir="rtl">
        {/* Operations Sidebar */}
        <aside className="fixed right-0 top-0 z-40 h-screen w-64 border-l border-border bg-card overflow-y-auto">
          {/* Header */}
          <div className="flex h-16 items-center gap-2 border-b border-border px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg">
              و
            </div>
            <span className="text-lg font-bold text-foreground">وريد — العمليات</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1 p-3">
            {opsMenu.map((item) => (
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
