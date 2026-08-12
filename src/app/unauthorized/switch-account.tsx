"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * "Sign in with a different account".
 *
 * This was a plain `<Link href="/login">`, which could never work: the proxy
 * redirects any signed-in user away from /login to their own role's home. So
 * the button on the "you don't have permission" page — the one place a person
 * lands precisely BECAUSE they are signed in as the wrong account — bounced
 * them straight back to where they started, with no way out but clearing
 * cookies by hand.
 *
 * Switching accounts means ending the current session first, which is what
 * signOut does; /login is then reachable because the cookie is gone.
 */
export function SwitchAccountButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/login" });
      }}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
      تسجيل الخروج والدخول بحساب آخر
    </button>
  );
}
