import { describe, expect, it } from "vitest";
import { createCommissionSchema } from "@/app/api/commissions/route";

/**
 * The body the «قاعدة نسب جديدة» dialog actually sends must parse.
 *
 * `createCommissionSchema` was `.strict()` and declared five shares while the
 * admin form has always sent six — `referralShare`, defaulting to "0". Zod
 * answered `unrecognized_keys`, `parseBody` threw, and every submit came back
 * 400 "بيانات غير صالحة". The consequence was not cosmetic: a service added to
 * a contract after onboarding could never be priced, and a rule deleted (which
 * closes the version rather than removing it) could never be re-added — so
 * those orders hit NO_RULE at settlement and were never paid out.
 *
 * Pure schema parsing, so it runs with the database unavailable.
 */
describe("POST /api/commissions body", () => {
  const base = {
    contractId: "ctr_1",
    serviceType: "IN_PERSON_CONSULT" as const,
    complexShare: 0,
    nurseShare: 0,
    driverShare: 0,
  };

  it("accepts the six-share body the dialog sends", () => {
    const result = createCommissionSchema.safeParse({
      ...base,
      partnerShare: 70,
      waridShare: 25,
      referralShare: 5,
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a body with no referrer cut, defaulting it to 0", () => {
    const result = createCommissionSchema.safeParse({
      ...base,
      partnerShare: 70,
      waridShare: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.referralShare).toBe(0);
  });

  it("counts the referrer cut toward 100%, so a 120% rule cannot be stored", () => {
    // Omitting it from the sum would let POST save a rule PUT's own merged
    // check forbids — and settlement cannot pay out more than it collected.
    const result = createCommissionSchema.safeParse({
      ...base,
      partnerShare: 70,
      waridShare: 30,
      referralShare: 20,
    });
    expect(result.success).toBe(false);
  });

  it("is still strict about keys it does not know", () => {
    const result = createCommissionSchema.safeParse({
      ...base,
      partnerShare: 70,
      waridShare: 30,
      somethingElse: 1,
    });
    expect(result.success).toBe(false);
  });
});
