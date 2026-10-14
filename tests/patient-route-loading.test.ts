import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every patient route must ship a route-level loading UI.
 *
 * Without a `loading.tsx`, a tap on a patient screen paints nothing until that
 * route's JavaScript has downloaded and its first fetch has resolved — on a
 * slow Iraqi mobile connection the previous screen simply freezes, with no
 * sign the tap registered. 21 of the 33 patient routes had no such file, the
 * main home and the سند home among them.
 *
 * This is a structural guard, not a style check: a new patient route added
 * without a loading state fails here rather than being noticed on a phone.
 */

const PATIENT_ROOT = path.join(process.cwd(), "src/app/(patient)");

function routeDirs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) routeDirs(path.join(dir, entry.name), out);
  }
  if (fs.existsSync(path.join(dir, "page.tsx"))) out.push(dir);
  return out;
}

/** The URL a directory serves, with the (group) segments removed. */
function routeOf(dir: string): string {
  const rel = path.relative(PATIENT_ROOT, dir);
  const parts = rel.split(path.sep).filter((p) => p && !(p.startsWith("(") && p.endsWith(")")));
  return "/" + parts.join("/");
}

describe("patient routes have a clean loading state", () => {
  const dirs = routeDirs(PATIENT_ROOT);

  it("finds the patient routes at all", () => {
    // Guards the guard: a refactor that moves the patient app must not turn
    // this file into a vacuous pass over an empty list.
    expect(dirs.length).toBeGreaterThan(25);
  });

  /**
   * Routes known to be missing a loading state, pending the skeleton work.
   *
   * A BASELINE, not an exemption: the assertion below fails the moment a route
   * outside this list ships without a loading.tsx, and fails again when a
   * route on the list gains one and is not removed from it. The list is meant
   * to shrink to empty — it is visible here precisely so it cannot be
   * forgotten.
   */
  const KNOWN_MISSING = new Set([
    "/",
    "/bookings",
    "/complexes/[id]",
    "/doctors/[id]",
    "/doctors/profile/[id]",
    "/homecare",
    "/memberships",
    "/notifications",
    "/pharmacies/[id]",
    "/profile",
    "/sanad",
    "/sanad/doctors/profile/[id]",
    "/sanad/pharmacies/[id]",
    "/search",
    "/services",
    "/services/blood-bank",
    "/services/packages",
    "/services/surgeries",
    "/services/taxi",
    "/teleconsultation",
    "/wallet",
  ]);

  it("no route is missing a loading.tsx outside the known-gap baseline", () => {
    const missing = dirs
      .filter((d) => !fs.existsSync(path.join(d, "loading.tsx")))
      .map(routeOf);
    expect(missing.filter((r) => !KNOWN_MISSING.has(r))).toEqual([]);
  });

  it("the known-gap baseline has no stale entries", () => {
    const stale = [...KNOWN_MISSING].filter((route) =>
      dirs.some((d) => routeOf(d) === route && fs.existsSync(path.join(d, "loading.tsx")))
    );
    expect(stale).toEqual([]);
  });

  it("every loading.tsx is a server component", () => {
    // A `"use client"` here defeats the entire purpose: the file exists to
    // paint BEFORE the route's client bundle is parsed, so it must ship with
    // the server shell.
    const offenders: string[] = [];
    for (const dir of dirs) {
      const file = path.join(dir, "loading.tsx");
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (/^\s*['"]use client['"]/m.test(src)) offenders.push(routeOf(dir));
    }
    expect(offenders).toEqual([]);
  });

  it("no loading.tsx asserts data", () => {
    // A skeleton that prints a number, a currency or an empty-state sentence
    // is making a claim about data nobody has fetched yet.
    const offenders: string[] = [];
    for (const dir of dirs) {
      const file = path.join(dir, "loading.tsx");
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (/د\.ع|لا توجد|لا يوجد|نتيجة|[0-9]{2,}(?!\s*\})/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))) {
        offenders.push(routeOf(dir));
      }
    }
    expect(offenders).toEqual([]);
  });
});
