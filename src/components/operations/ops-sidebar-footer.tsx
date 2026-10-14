"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { USER_ROLE_LABELS, labelOf } from "@/lib/labels";

/**
 * Who is signed in, and the way out.
 *
 * The operations portal had neither. `<OpsHeader/>` — which carries the search,
 * the notifications and the employee's own name — is never mounted anywhere:
 * the layout renders a sidebar and a `<main>` and nothing else. So across all
 * eleven operations screens there was **no sign-out at all**, on shared
 * call-centre workstations where the next person inherits the session and the
 * patient data behind it.
 *
 * This is the footer, not the header. Mounting `OpsHeader` is a separate
 * question — it needs `newOrders` / `delayedOrders` counts whose source is not
 * settled — and an employee being unable to log out should not wait on it.
 * Same shape as the admin shell's footer, so the two portals read alike.
 */
export function OpsSidebarFooter() {
  const { userName, role } = useRole();

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/10 text-sm font-bold text-blue-600">
          {userName?.slice(0, 1) ?? "؟"}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-foreground">{userName}</span>
          <span className="block text-[11px] text-muted-foreground">
            {role ? labelOf(USER_ROLE_LABELS, role) : ""}
          </span>
        </span>
        <button
          type="button"
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
