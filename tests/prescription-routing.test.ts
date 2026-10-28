import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";

/**
 * A prescription can be routed to a pharmacy, and the pharmacy then sees it.
 *
 * `Prescription.pharmacyId` is the tenant key for the pharmacy's prescription
 * list, three of its four KPI cards and its home task table — and nothing in
 * the product ever wrote it. The doctor's dialog omits it deliberately
 * (`/api/partners` is operations-only), and `POST /api/orders/[id]/assign`
 * never touches Prescription. So every pharmacy's inbound queue was empty by
 * construction, however much work existed.
 *
 * The capability was already there and already role-gated; it was a missing
 * dropdown on العمليات. These pin both halves: that routing works for a
 * platform role, and that a pharmacy cannot reassign its own work.
 */

let prescriptionId: string | null = null;
let originalPharmacyId: string | null = null;

function req(url: string, init: { method: string; body?: unknown; bearer: string }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method,
    headers: { "content-type": "application/json", authorization: `Bearer ${init.bearer}` },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function tokenFor(where: object) {
  const u = await prisma.user.findFirst({
    where: where as never,
    select: { id: true, role: true, partner: { select: { id: true } }, doctorProfile: { select: { id: true } } },
  });
  if (!u) return null;
  return {
    partnerId: u.partner?.id ?? null,
    token: await signAccessToken({
      sub: u.id,
      role: u.role,
      partnerId: u.partner?.id ?? null,
      doctorProfileId: u.doctorProfile?.id ?? null,
    }),
  };
}

afterAll(async () => {
  if (prescriptionId) {
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: { pharmacyId: originalPharmacyId },
    });
  }
});

describe("routing a prescription to a pharmacy", () => {
  it("operations can assign one, and it lands on the row", async () => {
    const ops = await tokenFor({ role: "SUPER_ADMIN", deletedAt: null, isActive: true });
    const pharmacy = await prisma.partner.findFirst({
      where: { type: "PHARMACY", deletedAt: null },
      select: { id: true },
    });
    const rx = await prisma.prescription.findFirst({ select: { id: true, pharmacyId: true } });
    if (!ops || !pharmacy || !rx) {
      console.warn("SKIP: no ops, pharmacy or prescription fixture");
      return;
    }
    prescriptionId = rx.id;
    originalPharmacyId = rx.pharmacyId;

    const { PATCH } = await import("@/app/api/prescriptions/[id]/route");
    const res = await PATCH(
      req(`/api/prescriptions/${rx.id}`, {
        method: "PATCH",
        bearer: ops.token,
        body: { pharmacyId: pharmacy.id },
      }),
      { params: Promise.resolve({ id: rx.id }) } as never
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    const after = await prisma.prescription.findUniqueOrThrow({
      where: { id: rx.id },
      select: { pharmacyId: true },
    });
    expect(after.pharmacyId).toBe(pharmacy.id);
  });

  it("the pharmacy's own list then returns it — the queue is no longer empty by construction", async () => {
    if (!prescriptionId) {
      console.warn("SKIP: nothing routed");
      return;
    }
    const assigned = await prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      select: { pharmacyId: true },
    });
    const owner = await prisma.partner.findUniqueOrThrow({
      where: { id: assigned.pharmacyId! },
      select: { user: { select: { id: true, role: true } } },
    });
    const bearer = await signAccessToken({
      sub: owner.user.id,
      role: owner.user.role,
      partnerId: assigned.pharmacyId,
      doctorProfileId: null,
    });

    const { GET } = await import("@/app/api/prescriptions/route");
    const res = await GET(
      new NextRequest("http://localhost/api/prescriptions?limit=100", {
        headers: { authorization: `Bearer ${bearer}` },
      }),
      { params: Promise.resolve({}) } as never
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.data.some((p: { id: string }) => p.id === prescriptionId)).toBe(true);
  });

  it("a pharmacy cannot reassign the work it holds", async () => {
    const pharmacy = await tokenFor({ role: "PHARMACY", deletedAt: null, isActive: true });
    if (!pharmacy || !prescriptionId) {
      console.warn("SKIP: no pharmacy fixture");
      return;
    }
    const other = await prisma.partner.findFirst({
      where: { type: "PHARMACY", deletedAt: null, id: { not: pharmacy.partnerId ?? "" } },
      select: { id: true },
    });
    if (!other) {
      console.warn("SKIP: only one pharmacy");
      return;
    }

    const before = await prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      select: { pharmacyId: true },
    });

    const { PATCH } = await import("@/app/api/prescriptions/[id]/route");
    const res = await PATCH(
      req(`/api/prescriptions/${prescriptionId}`, {
        method: "PATCH",
        bearer: pharmacy.token,
        body: { pharmacyId: other.id },
      }),
      { params: Promise.resolve({ id: prescriptionId }) } as never
    );
    // Either refused outright, or the field is ignored — never applied.
    const after = await prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      select: { pharmacyId: true },
    });
    expect(after.pharmacyId, `status ${res.status} must not move the work`).toBe(before.pharmacyId);
  });
});
