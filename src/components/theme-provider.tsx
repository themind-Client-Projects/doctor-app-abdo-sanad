"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Single source of truth for light/dark.
 *
 * Tailwind is configured with `darkMode: ["class"]`, so this must run with
 * `attribute="class"` for `dark:` utilities to resolve.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
