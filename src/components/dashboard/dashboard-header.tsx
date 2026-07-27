"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Moon,
  Sun,
  User,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";

interface HeaderProps {
  entityName: string;
  userName: string;
  avatarUrl?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
}

export function DashboardHeader({
  entityName,
  userName,
  avatarUrl,
  notificationCount = 0,
  onSearch,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const { isDark, toggle } = useDarkMode();
  const profileRef = useRef<HTMLDivElement>(null);

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
    onSearch?.(searchQuery);
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

      {/* Center: Global search (req L11 "البحث الشامل") */}
      <div className="flex-1 max-w-md mx-4">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث الشامل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background pr-9 pl-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
          />
        </form>
      </div>

      {/* Left: Actions (req L12-14) */}
      <div className="flex items-center gap-1">
        {/* Notifications (req L12) */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="الإشعارات">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Dark mode toggle (req L13) */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={toggle}
          aria-label={isDark ? "الوضع النهاري" : "الوضع الليلي"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
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
              <Link href="/dashboard/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                <User size={14} />
                <span>الملف الشخصي</span>
              </Link>
              <Link href="/dashboard/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                <Settings size={14} />
                <span>الإعدادات</span>
              </Link>
              <hr className="my-1 border-border" />
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
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
