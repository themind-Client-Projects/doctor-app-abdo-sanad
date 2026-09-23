"use client";

import { signOut } from "next-auth/react";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Moon, Sun, ChevronDown, LogOut, Settings } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { NotificationBell } from "@/components/shared/header-menus";

interface HeaderProps {
  entityName: string;
  userName: string;
  avatarUrl?: string;
  /**
   * Where the search box sends a query, e.g. "/dashboard/patients".
   *
   * Omitted for a role with nothing to search — a driver holds trips, not
   * patients — and the box is then not rendered at all. The previous version
   * took an `onSearch` callback that the layout never passed, so every partner
   * had a search field that did nothing on submit. (`/api/search` is not the
   * answer here either: it crosses tenants and is OPERATIONS-only by design.)
   */
  searchHref?: string;
}

export function DashboardHeader({
  entityName,
  userName,
  avatarUrl,
  searchHref,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const { isDark, toggle, mounted } = useDarkMode();
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!searchHref || !q) return;
    router.push(`${searchHref}?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6" dir="rtl">
      {/* Right: Logo + Entity name (req L8-9) */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            و
          </div>
          <span className="text-base font-bold text-foreground hidden sm:inline">وريد</span>
        </Link>
        <span className="text-border hidden md:inline">|</span>
        <span className="text-sm text-muted-foreground hidden md:inline">{entityName}</span>
      </div>

      {/* Center: search within this partner's own records (req L11) */}
      <div className="flex-1 max-w-md mx-4">
        {searchHref ? (
          <form onSubmit={handleSearch} className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="ابحث في مرضاك..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="بحث"
              className="w-full h-9 rounded-lg border border-input bg-background pr-9 pl-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
          </form>
        ) : null}
      </div>

      {/* Left: Actions (req L12-14) */}
      <div className="flex items-center gap-1">
        {/* Notifications (req L12) */}
        <NotificationBell viewAllHref="/dashboard/notifications" />

        {/* Dark mode toggle (req L13) */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={toggle}
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

        {/* Profile dropdown (req L14) */}
        <div ref={profileRef} className="relative mr-1">
          <button
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
            onClick={() => setShowProfile(!showProfile)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
              ) : (
                userName?.charAt(0) || "م"
              )}
            </div>
            <span className="text-sm font-medium text-foreground hidden lg:inline">{userName}</span>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showProfile ? "rotate-180" : ""}`} />
          </button>

          {showProfile && (
            <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
              {/* "الملف الشخصي" pointed at /dashboard/profile, which has never
                  existed — the link 404'd. The account IS the settings page:
                  it shows the name, contact, role and partner record, and is
                  where the password is changed. */}
              <Link
                href="/dashboard/settings"
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <Settings size={14} />
                <span>الإعدادات</span>
              </Link>
              <hr className="my-1 border-border" />
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={14} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
