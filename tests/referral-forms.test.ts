import { describe, expect, it } from "vitest";
import {
  MEDICATION_FORMS,
  REFERRAL_KINDS,
  ageFrom,
  clinicalSchemaFor,
  medicationSchema,
  parseClinical,
  patientNumber,
  radiologyClinicalSchema,
  referralExpiry,
  referralNumber,
  KIND_RECIPIENTS,
} from "@/server/services/referral-forms";

/**
 * The four printed documents, and what each one refuses to be submitted without.
 *
 * These are not schema housekeeping. A radiology request with no answer to the
 * metal-implant question, or a prescription with no dose, is a form that reaches
 * a technician or a pharmacist missing the one thing they needed — so the rules
 * that make those impossible get tested directly.
 */

describe("the number printed on the paper", () => {
  it("matches the client's format per document", () => {
    const at = new Date("2024-05-20T10:30:00Z");
    expect(referralNumber("RADIOLOGY", 5120, at)).toBe("RAD-2024-05120");
    expect(referralNumber("DOCTOR", 5120, at)).toBe("REF-2024-05120");
    expect(referralNumber("PHARMACY", 5120, at)).toBe("RX-2024-05120");
    expect(referralNumber("LAB", 5120, at)).toBe("LAB-2024-05120");
  });

  it("pads short sequences and takes the year from the issue date", () => {
    expect(referralNumber("DOCTOR", 7, new Date("2026-01-02T00:00:00Z"))).toBe("REF-2026-00007");
  });

  it("does not truncate a sequence that outgrows the padding", () => {
    // Five digits is the printed width, not a ceiling — the 100,000th referral
    // must still get a unique number rather than wrap.
    expect(referralNumber("DOCTOR", 123456, new Date("2026-01-01T00:00:00Z"))).toBe(
      "REF-2026-123456"
    );
  });

  it("numbers the patient the same way", () => {
    expect(patientNumber(125, new Date("2024-03-01T00:00:00Z"))).toBe("PNT-2024-00125");
  });
});

describe("the age the form prints", () => {
  it("counts whole years", () => {
    expect(ageFrom(new Date("1996-01-01"), new Date("2024-05-20"))).toBe(28);
  });

  it("does not round up before the birthday", () => {
    expect(ageFrom(new Date("1996-06-01"), new Date("2024-05-31"))).toBe(27);
    expect(ageFrom(new Date("1996-06-01"), new Date("2024-06-01"))).toBe(28);
  });

  it("is null when no date of birth is held, rather than 0", () => {
    // Printing "0 سنة" on a clinical form because a column is empty is worse
    // than printing nothing.
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom(undefined)).toBeNull();
  });
});

describe("validity", () => {
  it("is thirty days from issue", () => {
    const from = new Date("2024-05-20T10:00:00Z");
    expect(referralExpiry(from).toISOString()).toBe("2024-06-19T10:00:00.000Z");
  });
});

describe("طلب أشعة — the safety answers are the point", () => {
  const complete = {
    examTypes: ["CT:brain"],
    contrastAllergy: false,
    possiblePregnancy: false,
    metalImplant: false,
  };

  it("accepts a fully answered form", () => {
    expect(radiologyClinicalSchema.safeParse(complete).success).toBe(true);
  });

  it.each(["contrastAllergy", "possiblePregnancy", "metalImplant"] as const)(
    "refuses a form with no answer for %s",
    (field) => {
      const { [field]: _omitted, ...missing } = complete;
      const result = radiologyClinicalSchema.safeParse(missing);
      expect(result.success).toBe(false);
      // Silence must not read as "no" — an unanswered metal-implant question
      // and an answered NO are different facts to an MRI technician.
      expect(JSON.stringify(result)).toContain(field);
    }
  );

  it("refuses a form that names no exam", () => {
    expect(radiologyClinicalSchema.safeParse({ ...complete, examTypes: [] }).success).toBe(false);
  });

  it("refuses an exam outside the menu", () => {
    // Free text cannot be scheduled onto a machine or priced.
    expect(
      radiologyClinicalSchema.safeParse({ ...complete, examTypes: ["CT:whatever"] }).success
    ).toBe(false);
  });

  it("accepts every exam the client's form lists", () => {
    for (const code of [
      "XRAY:chest", "XRAY:bone", "XRAY:opg",
      "ULTRASOUND:abdomen_pelvis", "ULTRASOUND:thyroid", "ULTRASOUND:breast", "ULTRASOUND:doppler",
      "CT:brain", "CT:chest", "CT:abdomen", "CT:pelvis",
      "PET_CT:pet_ct",
    ]) {
      expect(radiologyClinicalSchema.safeParse({ ...complete, examTypes: [code] }).success).toBe(true);
    }
  });

  it("refuses unknown keys rather than storing them", () => {
    expect(
      radiologyClinicalSchema.safeParse({ ...complete, sneaky: "value" }).success
    ).toBe(false);
  });
});

describe("وصفة طبية — every column the form prints is required", () => {
  const drug = {
    name: "Augmentin 1g / أوجمنتين 1 جم",
    form: "tablet",
    dose: "1 قرص",
    route: "كل 12 ساعة",
    duration: "7 أيام",
  };

  it("accepts a complete row", () => {
    expect(medicationSchema.safeParse(drug).success).toBe(true);
  });

  it.each(["name", "form", "dose", "route", "duration"] as const)(
    "refuses a drug with no %s",
    (field) => {
      const { [field]: _omitted, ...missing } = drug;
      expect(medicationSchema.safeParse(missing).success).toBe(false);
    }
  );

  it("refuses a dosage form outside the vocabulary", () => {
    expect(medicationSchema.safeParse({ ...drug, form: "potion" }).success).toBe(false);
  });

  it("accepts every form the client's table uses", () => {
    for (const form of MEDICATION_FORMS) {
      expect(medicationSchema.safeParse({ ...drug, form }).success).toBe(true);
    }
  });

  it("refuses the shape the old schema accepted", () => {
    // `z.record(z.string(), z.unknown())` took literally any object, so this
    // reached a pharmacy that then had to telephone the doctor.
    expect(medicationSchema.safeParse({ name: "بروفين" }).success).toBe(false);
    expect(medicationSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a prescription with no drugs at all", () => {
    expect(clinicalSchemaFor("PHARMACY").safeParse({ medications: [] }).success).toBe(false);
  });
});

describe("each document goes to the right kind of provider", () => {
  it("sends each REQUEST to the only provider that can perform it", () => {
    expect(KIND_RECIPIENTS.PHARMACY).toEqual(["PHARMACY"]);
    expect(KIND_RECIPIENTS.RADIOLOGY).toEqual(["RADIOLOGY"]);
    expect(KIND_RECIPIENTS.LAB).toEqual(["LAB"]);
  });

  it("leaves the GENERAL referral open to any colleague", () => {
    // "ابو المختبر ارسال حالة مريض عن طريق فورم كذلك ابو صيدلية" — restricting
    // this one to doctors severed the lab → pharmacy chain.
    for (const type of ["DOCTOR", "LAB", "PHARMACY", "RADIOLOGY"]) {
      expect(KIND_RECIPIENTS.DOCTOR).toContain(type);
    }
  });

  it("covers every kind, so none falls through to 'anyone'", () => {
    for (const kind of REFERRAL_KINDS) {
      expect(KIND_RECIPIENTS[kind].length).toBeGreaterThan(0);
    }
  });
});

describe("reading a stored payload back", () => {
  it("returns what was written", () => {
    const stored = {
      examTypes: ["XRAY:chest"],
      contrastAllergy: true,
      possiblePregnancy: false,
      metalImplant: false,
    };
    expect(parseClinical("RADIOLOGY", stored as never)).toEqual(stored);
  });

  it("degrades to empty rather than throwing on a row that predates the schema", () => {
    // One malformed record must not break a whole list.
    expect(parseClinical("RADIOLOGY", { nonsense: true } as never)).toEqual({});
    expect(parseClinical("PHARMACY", null)).toEqual({});
  });
});

describe("every kind has a schema", () => {
  it.each(REFERRAL_KINDS)("%s resolves to one", (kind) => {
    expect(clinicalSchemaFor(kind)).toBeDefined();
  });
});
