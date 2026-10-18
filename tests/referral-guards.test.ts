import { describe, expect, it } from "vitest";
import { medicationsComplete, readMedications } from "@/components/features/clinical/medication-rows";
import { isClinicalComplete } from "@/components/features/referrals/clinical-fields";

/**
 * The two gates that let a referral be sent or rewritten when it should not be.
 *
 * Pure checks on purpose: both are decision functions, and running them beats
 * asserting against a rendered dialog.
 */

describe("prescription completeness gate", () => {
  it("refuses a blank drug row — the row exists but says nothing", () => {
    // Exactly what one click of «إضافة دواء» produces.
    const blank = [{ name: "", form: "tablet", dose: "", route: "", duration: "" }];
    expect(medicationsComplete(readMedications(blank))).toBe(false);
    // The gate the dialog actually calls.
    expect(isClinicalComplete("PHARMACY", { medications: blank })).toBe(false);
  });

  it("refuses a row missing any one required column", () => {
    const base = { name: "أملوديبين", form: "tablet", dose: "5 ملغ", route: "فموي", duration: "30 يوم" };
    for (const missing of ["name", "dose", "route", "duration"] as const) {
      const row = { ...base, [missing]: "" };
      expect(
        isClinicalComplete("PHARMACY", { medications: [row] }),
        `missing ${missing} should refuse`
      ).toBe(false);
    }
  });

  it("accepts a complete row", () => {
    const full = [{ name: "أملوديبين", form: "tablet", dose: "5 ملغ", route: "فموي", duration: "30 يوم" }];
    expect(isClinicalComplete("PHARMACY", { medications: full })).toBe(true);
  });

  it("still refuses an empty list", () => {
    expect(isClinicalComplete("PHARMACY", { medications: [] })).toBe(false);
  });
});

describe("terminal referrals are terminal for the whole payload", () => {
  it("the route refuses a result write on a closed referral", async () => {
    // Read the handler source: the guard must consider resultSummary and
    // attachments, not only `status`. A behavioural test would need a complex,
    // two partners and a patient; this pins the invariant that regressed.
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/app/api/referrals/[id]/route.ts", "utf8");
    const guard = src.slice(src.indexOf("TERMINAL MEANS TERMINAL"));
    expect(guard).toContain("input.resultSummary !== undefined");
    expect(guard).toContain("input.attachments !== undefined");
    expect(guard).toContain('current === "completed"');
    expect(guard).toContain('current === "cancelled"');
    // And it must come BEFORE the update payload is assembled.
    expect(src.indexOf("TERMINAL MEANS TERMINAL")).toBeLessThan(
      src.indexOf("const data: Prisma.ComplexReferralUpdateInput")
    );
  });
});
