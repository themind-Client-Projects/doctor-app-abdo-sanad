"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { ADMIN_NAV } from "./admin-nav";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

/**
 * Admin shell — sidebar + header.
 *
 * Replaces a fixed 256px sidebar that had no responsive classes at all, so at
 * 360px it covered 71% of the viewport and left the content a 104px column.
 * The sidebar is now a drawer below `lg`, and the collapse state lives here
 * rather than inside the sidebar, where it used to desync from a hardcoded
 * content offset.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Route change should close the drawer, or navigating on a phone leaves the
  // overlay covering the page you just opened.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <AdminSidebar open={navOpen} onClose={() => setNavOpen(false)} pathname={pathname} />

      {/* Offset on the START side — the sidebar docks right in RTL.
          Only applied once it is actually docked. */}
      <div className="lg:ps-72">
        <AdminHeader onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function AdminSidebar({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <>
      {/* Scrim — drawer only, never on desktop */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-border bg-card transition-transform duration-200",
          // Off-canvas by default; docked from lg up. Transforms are physical,
          // not direction-aware, so +X pushes a right-docked panel off-screen.
          open ? "translate-x-0" : "translate-x-full",
          "lg:translate-x-0"
        )}
        aria-label="التنقل الرئيسي"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              و
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-foreground">وريد</span>
              <span className="block text-[11px] text-muted-foreground">لوحة المدير العام</span>
            </span>
          </Link>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {ADMIN_NAV.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  // Not built yet — render disabled rather than as a link that
                  // 404s, so an unbuilt page is distinguishable from a broken one.
                  if (!item.ready) {
                    return (
                      <li key={item.href}>
                        <span
                          className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground/45"
                          title="قيد التطوير"
                        >
                          <Icon size={17} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                          <span className="ms-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px]">
                            قريباً
                          </span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon size={17} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <SidebarFooter />
      </aside>
    </>
  );
}

function SidebarFooter() {
  const { userName, role } = useRole();
  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {userName?.slice(0, 1) ?? "؟"}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-foreground">{userName}</span>
          <span className="block text-[11px] text-muted-foreground">
            {role === "SUPER_ADMIN" ? "مدير عام" : role}
          </span>
        </span>
        {/* Logout actually works now — signOut was exported and never imported,
            so all three logout buttons in the app were dead. */}
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { isDark, toggle, mounted } = useDarkMode();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onOpenNav}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu size={20} />
      </button>

      <form
        role="search"
        className="relative hidden max-w-md flex-1 sm:block"
        onSubmit={(e) => e.preventDefault()}
      >
        <label htmlFor="admin-search" className="sr-only">
          بحث شامل في النظام
        </label>
        <Search
          size={16}
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="admin-search"
          type="search"
          placeholder="بحث شامل في النظام..."
          className="h-10 w-full rounded-xl border border-input bg-background pe-10 ps-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
        />
      </form>

      <div className="ms-auto flex items-center gap-1">
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          // The resolved theme is unknowable during SSR, so the icon and label
          // stay neutral until hydration — otherwise the server and client
          // render different trees and React throws a hydration mismatch.
          aria-label={!mounted ? "تبديل المظهر" : isDark ? "الوضع النهاري" : "الوضع الليلي"}
        >
          {!mounted ? (
            <span className="block h-[18px] w-[18px]" aria-hidden="true" />
          ) : isDark ? (
            <Sun size={18} />
          ) : (
            <Moon size={18} />
          )}
        </button>

        <Link
          href="/admin/monitoring"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="الإشعارات"
        >
          <Bell size={18} />
        </Link>
      </div>
    </header>
  );
}
