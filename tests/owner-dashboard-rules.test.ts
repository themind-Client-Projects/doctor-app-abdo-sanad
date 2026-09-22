import { describe, expect, it } from "vitest";
import { couponCode, percentageCap } from "@/server/services/coupon-rules";
import { PASSWORD_ROLES, canHavePassword, passwordSchema } from "@/server/services/user-admin";
import { debtState } from "@/server/services/partner-wallet";

/**
 * The owner-dashboard rules that need no database.
 *
 * Each block pins down a defect the audit found, so the defect cannot quietly
 * come back: a coupon the admin created but no patient could redeem, a staff
 * account that could never sign in, and a debt whose "overdue" depended on a
 * job that did not exist.
 */

describe("coupon codes are stored the way checkout looks them up", () => {
  it("upper-cases on the way in — 'save10' must be redeemable", () => {
    // `validateCoupon` searches code.trim().toUpperCase(). Stored as typed, a
    // lower-case code was listed as live and could never be found.
    expect(couponCode.parse("save10")).toBe("SAVE10");
    expect(couponCode.parse("  Ramadan25 ")).toBe("RAMADAN25");
  });

  it("refuses characters a patient cannot reliably type back", () => {
    for (const bad of ["خصم10", "SAVE 10", "SAVE@10", "ab"]) {
      expect(couponCode.safeParse(bad).success).toBe(false);
    }
  });

  it("allows the separators people actually use", () => {
    expect(couponCode.parse("new-year_26")).toBe("NEW-YEAR_26");
  });
});

describe("a percentage coupon cannot exceed 100%", () => {
  it("refuses 150%, which would silently mean 'free'", () => {
    expect(percentageCap({ discountType: "PERCENTAGE", discountValue: 150 })).toBe(false);
  });

  it("allows exactly 100% — a deliberate free coupon", () => {
    expect(percentageCap({ discountType: "PERCENTAGE", discountValue: 100 })).toBe(true);
  });

  it("does not cap a FIXED amount, which is dinars, not a percentage", () => {
    expect(percentageCap({ discountType: "FIXED", discountValue: 25_000 })).toBe(true);
  });

  it("catches the merged case — switching the TYPE on a large fixed value", () => {
    // The update route checks the merged result, so changing only the type of
    // a 5,000 د.ع coupon to PERCENTAGE cannot slip a 5000% discount through.
    expect(percentageCap({ discountType: "PERCENTAGE", discountValue: 5000 })).toBe(false);
  });
});

describe("who signs in with a password", () => {
  it("gives every staff role a password", () => {
    for (const role of ["SUPER_ADMIN", "OPERATIONS", "DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"] as const) {
      expect(canHavePassword(role)).toBe(true);
    }
  });

  it("never gives a PATIENT one — they sign in by phone code or Google", () => {
    // The password grant does not check role, so a patient password would be
    // a second door onto an account the product never meant to have one.
    expect(canHavePassword("PATIENT")).toBe(false);
    expect(PASSWORD_ROLES).not.toContain("PATIENT");
  });
});

describe("the password policy", () => {
  it("requires ten characters", () => {
    expect(passwordSchema.safeParse("short-pw1").success).toBe(false);
    expect(passwordSchema.safeParse("ten-chars!").success).toBe(true);
  });

  it("stops at bcrypt's 72-byte ceiling instead of silently truncating", () => {
    // bcrypt ignores everything past 72 bytes, so a longer 'password' would be
    // weaker than it looks. Refusing it is honest.
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("does not demand symbols — a long passphrase is the stronger thing", () => {
    expect(passwordSchema.safeParse("correct horse battery staple").success).toBe(true);
  });
});

describe("a debt's state is derived from its date", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const past = new Date("2026-09-01T00:00:00Z");
  const future = new Date("2026-10-01T00:00:00Z");

  it("is overdue once the due date passes, with no job to flip it", () => {
    expect(debtState({ status: "pending", dueDate: past }, now)).toBe("overdue");
  });

  it("is pending before its due date", () => {
    expect(debtState({ status: "pending", dueDate: future }, now)).toBe("pending");
  });

  it("treats a stored 'overdue' the same as pending — the date decides", () => {
    expect(debtState({ status: "overdue", dueDate: future }, now)).toBe("pending");
    expect(debtState({ status: "overdue", dueDate: past }, now)).toBe("overdue");
  });

  it("stays paid regardless of the date", () => {
    // A settled debt past its due date is not overdue — it is settled.
    expect(debtState({ status: "paid", dueDate: past }, now)).toBe("paid");
  });
});
