"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, Search } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// The two header controls that were drawn and never wired.
//
// Both headers — the partner one and the operations one — rendered a bell and
// a search box as bare `<button>`s and a `<form>` with no handler. The bell
// even had a badge, so operations saw a red "3" it could not click, over a
// count that was real. Nine months of notifications with no way to open one.
//
// Shared because they are the same two controls in two places, and because the
// bug was exactly that each header had its own dead copy.
// ─────────────────────────────────────────────────────────────

/** Closes the popup on an outside click or Escape. */
function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return ref;
}

/* ------------------------------ الإشعارات --------------------------------- */

export function NotificationBell({ viewAllHref }: { viewAllHref?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(() => setOpen(false));
  const { notifications, unreadCount, markAsRead } = useNotifications(null);

  const recent = notifications.slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `الإشعارات — ${unreadCount} غير مقروء` : "الإشعارات"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          dir="rtl"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground">الإشعارات</p>
          </div>

          {recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">لا إشعارات</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {recent.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    // Opening one marks it read — which is what the badge is
                    // counting, and what nothing could do before.
                    onClick={() => void markAsRead(n.id)}
                    disabled={n.isRead}
                    className="w-full px-3 py-2.5 text-start transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && (
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          aria-label="غير مقروء"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            n.isRead ? "text-muted-foreground" : "font-medium text-foreground"
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {viewAllHref ? (
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-accent"
            >
              عرض كل الإشعارات
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ البحث الشامل ------------------------------ */

type SearchHit = {
  type: "order" | "partner" | "patient";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_LABELS: Record<SearchHit["type"], string> = {
  order: "طلب",
  partner: "شريك",
  patient: "مستخدم",
};

/**
 * البحث الشامل (req L282) — operations only, by design.
 *
 * `/api/search` crosses tenants: it returns any patient's name and phone, any
 * order and any partner. That is exactly what an operations employee needs and
 * exactly what a partner must not have, which is why the endpoint is
 * `ROLES.OPERATIONS` and why the partner header searches its own مرضاي instead.
 *
 * Two characters is the server's own floor, so the request is not sent below
 * it — an empty result set for "a" would read as "nothing found".
 */
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useDismiss(() => setOpen(false));

  // Debounced so a request is not fired per keystroke.
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const enabled = settled.length >= 2;
  const { data, isLoading } = useDashboardData<SearchHit[]>({
    url: "/api/search",
    params: { q: settled },
    enabled,
  });

  const hits = enabled ? (data ?? []) : [];

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="البحث الشامل..."
        aria-label="البحث الشامل"
        className="h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 text-sm text-foreground transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {isLoading && enabled ? (
        <Loader2
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}

      {open && query.trim() !== "" && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          dir="rtl"
        >
          {!enabled ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              اكتب حرفين على الأقل
            </p>
          ) : hits.length === 0 && !isLoading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">لا نتائج</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {hits.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {TYPE_LABELS[hit.type]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
