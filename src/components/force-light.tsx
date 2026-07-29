"use client";

import { useEffect } from "react";

/**
 * Pin the patient app to light mode.
 *
 * The patient screens are designed light-only — they use literal `bg-gray-50`,
 * `bg-white` and `text-gray-800` rather than theme tokens, so a `dark` class on
 * `<html>` produced white-on-white text rather than a dark theme. Dark mode is
 * a staff-dashboard feature and belongs to those routes alone.
 *
 * The class lives on `<html>`, which is above every layout, so it cannot be
 * scoped with a wrapper element — Tailwind's `dark:` variants resolve against
 * that one ancestor. Removing it on mount and restoring it on unmount is what
 * keeps a staff member who toggled dark on /admin from carrying it into the
 * patient app, and back again when they return.
 */
export function ForceLight() {
  useEffect(() => {
    const el = document.documentElement;
    const hadDark = el.classList.contains("dark");
    const previousScheme = el.style.colorScheme;

    el.classList.remove("dark");
    // Without this, the browser still paints form controls and scrollbars dark.
    el.style.colorScheme = "light";

    return () => {
      if (hadDark) el.classList.add("dark");
      el.style.colorScheme = previousScheme;
    };
  }, []);

  return null;
}
