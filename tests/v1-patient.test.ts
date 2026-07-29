import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * The /api/v1 patient surface exists so a mobile client can reach data that
 * previously lived only in a frontend demo file, or had no patient filter.
 * These assert the DATA the endpoints read, without going over HTTP.
 */

describe("catalogue is in the database, not a frontend file", () => {
  it("exposes every specialty with a stable slug", async () => {
    const specialties = await prisma.specialty.findMany({ where: { isActive: true } });
    expect(specialties.length).toBeGreaterThanOrEqual(13);
    // Clients branch on slug; name is Arabic display text that will change.
    expect(specialties.every((s) => /^[a-z-]+$/.test(s.slug))).toBe(true);
    expect(new Set(specialties.map((s) => s.slug)).size).toBe(specialties.length);
  });

  it("exposes pharmacy products with a real price", async () => {
    const products = await prisma.product.findMany();
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.price.greaterThan(0))).toBe(true);
  });

  it("links doctors to specialties by foreign key", async () => {
    // specialtyId used to be an unconstrained String referencing nothing.
    const withSpecialty = await prisma.doctorProfile.findFirst({
      where: { specialtyId: { not: null } },
      include: { specialty: true },
    });
    if (withSpecialty) expect(withSpecialty.specialty).not.toBeNull();

    // The relation must be queryable in the direction the directory uses.
    const bySlug = await prisma.doctorProfile.findMany({
      where: { specialty: { slug: "dentistry" } },
      take: 1,
    });
    expect(Array.isArray(bySlug)).toBe(true);
  });
});

describe("patient scoping", () => {
  it("can filter appointments by patient — the query /api/appointments lacked", async () => {
    const patient = await prisma.user.findFirst({ where: { role: "PATIENT" } });
    expect(patient).not.toBeNull();

    const mine = await prisma.appointment.findMany({ where: { patientId: patient!.id } });
    // Every row returned must belong to that patient — no cross-patient leak.
    expect(mine.every((a) => a.patientId === patient!.id)).toBe(true);
  });

  it("can filter orders by patient", async () => {
    const patient = await prisma.user.findFirst({ where: { role: "PATIENT" } });
    const mine = await prisma.order.findMany({ where: { patientId: patient!.id } });
    expect(mine.every((o) => o.patientId === patient!.id)).toBe(true);
  });

  it("DoctorProfile has the createdAt that keyset paging orders on", async () => {
    const doc = await prisma.doctorProfile.findFirst();
    if (doc) expect(doc.createdAt).toBeInstanceOf(Date);
  });
});
