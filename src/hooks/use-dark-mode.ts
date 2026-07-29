"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Dark-mode toggle, backed by next-themes.
 *
 * This used to hold its own `isDark` state and toggle the class by hand, so
 * every header that called it had a SEPARATE copy of the state — toggling in
 * the dashboard header did not update the operations header, and neither
 * reacted to a system-preference change. next-themes keeps one source of
 * truth, avoids the SSR flash, and persists the choice.
 *
 * `mounted` matters: the resolved theme is unknowable during SSR, so anything
 * that renders differently per theme (a sun/moon icon, an aria-label) must not
 * render until the client has hydrated — otherwise the server and client trees
 * disagree and React throws a hydration mismatch.
 */
export function useDarkMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return { isDark, toggle, mounted };
}
