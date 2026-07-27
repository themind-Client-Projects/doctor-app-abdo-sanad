"use client";

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
 * The `{ isDark, toggle }` shape is unchanged, so existing callers stay as-is.
 */
export function useDarkMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return { isDark, toggle };
}
