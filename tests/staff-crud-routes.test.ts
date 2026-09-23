import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";
import { hashPassword } from "@/server/services/user-admin";

/**
 * The staff dashboards' writes, exercised through the REAL route handlers.
 *
 * Every other test file in this suite queries Prisma directly, because
 * next-auth's ESM does a bare `import "next/server"` that Vite could not
 * resolve — so no test had ever run an endpoint. That is exactly the gap these
 * fill: tsc proves the shapes line up and cannot prove that
 * `Prescription.doctorId` holds a DoctorProfile id rather than a Partner id,
 * or that a Json column round-trips. Those are id-space and SQL-type facts,
 * and only running the query settles them. The doctorId defect below shipped
 * past a green typecheck, a green lint and a green build: no doctor on the
 * platform could write a prescription, on any request, ever.
 *
 * A case whose fixture is absent SKIPS rather than passing — this database is
 * reset from time to time, and a test that quietly passes on missing data is
 * worse than one that says it did not run.
 *
 * Everything created here is torn down: the two collections in `afterAll`, and
 * the throwaway account in its own `finally`.
 */

const created = { prescriptions: [] as string[], samples: [] as string[] };

async function token(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, partner: { select: { id: true } }, doctorProfile: { select: { id: true } } },
  });
  return signAccessToken({
    sub: user.id,
    role: user.role,
    partnerId: user.partner?.id ?? null,
    doctorProfileId: user.doctorProfile?.id ?? null,
  });
}

function req(url: string, init?: { method?: string; body?: unknown; bearer?: string }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init?.bearer ? { authorization: `Bearer ${init.bearer}` } : {}),
    },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function firstUser(role: string) {
  return prisma.user.findFirst({
    where: { role: role as never, deletedAt: null, ...(role === "DOCTOR" ? { doctorProfile: { isNot: null } } : {}) },
    select: { id: true, name: true },
  });
}

afterAll(async () => {
  if (created.prescriptions.length) {
    await prisma.prescription.deleteMany({ where: { id: { in: created.prescriptions } } });
  }
  if (created.samples.length) {
    await prisma.labSample.deleteMany({ where: { id: { in: created.samples } } });
  }
});

describe("doctor: appointments carry the patient", () => {
  it("GET /api/appointments hydrates `patient` from the bare patientId column", async (t) => {
    const doctor = await firstUser("DOCTOR");
    if (!doctor) return t.skip("no DOCTOR with a profile in the database");

    const { GET } = await import("@/app/api/appointments/route");
    const res = await GET(req("/api/appointments?limit=5", { bearer: await token(doctor.id) }), {});
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const row of body.data) {
      // The column exists on every row; `patient` is null only for a deleted
      // account, never absent.
      expect(row).toHaveProperty("patient");
      if (row.patient) expect(row.patient.id).toBe(row.patientId);
    }
  });
});

describe("doctor: writing a prescription", () => {
  it("POST /api/prescriptions accepts the doctor's own profile id", async (t) => {
    const doctor = await prisma.user.findFirst({
      where: { role: "DOCTOR", deletedAt: null, doctorProfile: { isNot: null } },
      select: { id: true, doctorProfile: { select: { id: true } } },
    });
    if (!doctor?.doctorProfile) return t.skip("no DOCTOR with a profile");

    // A patient this doctor actually holds — the endpoint refuses anyone else.
    const appt = await prisma.appointment.findFirst({
      where: { doctorId: doctor.doctorProfile.id, deletedAt: null },
      select: { patientId: true },
    });
    if (!appt) return t.skip("no appointment to source a patient from");

    const { POST } = await import("@/app/api/prescriptions/route");
    const res = await POST(
      req("/api/prescriptions", {
        method: "POST",
        bearer: await token(doctor.id),
        body: {
          doctorId: "ignored-by-the-server",
          patientId: appt.patientId,
          medications: [
            { name: "Augmentin 1g", form: "tablet", dose: "1 قرص", route: "كل 12 ساعة", duration: "7 أيام" },
          ],
        },
      }),
      {}
    );

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    created.prescriptions.push(body.data.id);

    // The id-space bug this closes: `doctorId` is a FK to DoctorProfile, and
    // the route used to write `identity.partnerId` — which failed the
    // constraint on every insert.
    expect(body.data.doctorId).toBe(doctor.doctorProfile.id);
    expect(body.data.expiresAt).not.toBeNull();
  });

  it("refuses a patient the doctor has no relationship with", async (t) => {
    const doctor = await firstUser("DOCTOR");
    const stranger = await prisma.user.findFirst({
      where: { role: "PATIENT", deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!doctor || !stranger) return t.skip("need a doctor and a patient");

    const { POST } = await import("@/app/api/prescriptions/route");
    const res = await POST(
      req("/api/prescriptions", {
        method: "POST",
        bearer: await token(doctor.id),
        body: {
          doctorId: "x",
          patientId: `${stranger.id}-not-a-real-id`,
          medications: [{ name: "X", form: "tablet", dose: "1", route: "يومياً", duration: "يوم" }],
        },
      }),
      {}
    );
    expect([403, 422]).toContain(res.status);
  });

  it("GET /api/prescriptions names the patient even with no order attached", async (t) => {
    const doctor = await firstUser("DOCTOR");
    if (!doctor) return t.skip("no DOCTOR");

    const { GET } = await import("@/app/api/prescriptions/route");
    const res = await GET(req("/api/prescriptions?limit=5", { bearer: await token(doctor.id) }), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const row of body.data) expect(row).toHaveProperty("patient");
  });
});

describe("lab: receiving a sample and recording its result", () => {
  it("POST /api/lab-samples pins the sample to the caller's own lab", async (t) => {
    const lab = await prisma.user.findFirst({
      where: { role: "LAB", deletedAt: null, partner: { isNot: null } },
      select: { id: true, partner: { select: { id: true } } },
    });
    if (!lab?.partner) return t.skip("no LAB with a partner row");

    const { POST } = await import("@/app/api/lab-samples/route");
    const res = await POST(
      req("/api/lab-samples", {
        method: "POST",
        bearer: await token(lab.id),
        // A different lab id in the body must be ignored.
        body: { labId: "some-other-lab", sampleType: "دم وريدي — CBC" },
      }),
      {}
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    created.samples.push(body.data.id);
    expect(body.data.labId).toBe(lab.partner.id);
    expect(body.data.status).toBe("received");
  });

  it("PATCH writes the results Json and reports the linked order's outcome", async (t) => {
    const lab = await prisma.user.findFirst({
      where: { role: "LAB", deletedAt: null, partner: { isNot: null } },
      select: { id: true },
    });
    const sampleId = created.samples[0];
    if (!lab || !sampleId) return t.skip("no sample created");

    const { PATCH } = await import("@/app/api/lab-samples/[id]/route");
    const res = await PATCH(
      req(`/api/lab-samples/${sampleId}`, {
        method: "PATCH",
        bearer: await token(lab.id),
        body: {
          status: "ready",
          results: { Hemoglobin: { value: "13.4", reference: "12 – 16 g/dL" } },
        },
      }),
      ctx(sampleId)
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    // The Json column round-trips as an object, not a string.
    expect(body.data.results).toEqual({
      Hemoglobin: { value: "13.4", reference: "12 – 16 g/dL" },
    });
    // The bridge always reports; this sample has no order, so it did not move.
    expect(body.data.order).toEqual({ advanced: false, reason: null });
  });
});

describe("operations: the phone-in picker and the cancel guard", () => {
  it("GET /api/patients returns patients only, and refuses a partner", async (t) => {
    const ops = await firstUser("OPERATIONS");
    const lab = await firstUser("LAB");
    if (!ops) return t.skip("no OPERATIONS user");

    const { GET } = await import("@/app/api/patients/route");

    const allowed = await GET(req("/api/patients?limit=5", { bearer: await token(ops.id) }), {});
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    const ids = body.data.map((p: { id: string }) => p.id);
    if (ids.length) {
      const roles = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { role: true },
      });
      expect(roles.every((r) => r.role === "PATIENT")).toBe(true);
    }

    if (lab) {
      const denied = await GET(req("/api/patients", { bearer: await token(lab.id) }), {});
      expect(denied.status).toBe(403);
    }
  });

  it("POST /api/orders/[id]/cancel refuses a COMPLETED order", async (t) => {
    const ops = await firstUser("OPERATIONS");
    const done = await prisma.order.findFirst({
      where: { status: "COMPLETED", deletedAt: null },
      select: { id: true },
    });
    if (!ops || !done) return t.skip("need an OPERATIONS user and a completed order");

    const { POST } = await import("@/app/api/orders/[id]/cancel/route");
    const res = await POST(
      req(`/api/orders/${done.id}/cancel`, { method: "POST", bearer: await token(ops.id), body: {} }),
      ctx(done.id)
    );
    // Terminal: the partner has already been paid out of it.
    expect(res.status).toBe(409);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: done.id },
      select: { status: true },
    });
    expect(after.status).toBe("COMPLETED");
  });
});

describe("self-service password change", () => {
  it("a partner may not set another user's password", async (t) => {
    const lab = await firstUser("LAB");
    const other = await firstUser("DOCTOR");
    if (!lab || !other) return t.skip("need two staff users");

    const { POST } = await import("@/app/api/users/[id]/password/route");
    const res = await POST(
      req(`/api/users/${other.id}/password`, {
        method: "POST",
        bearer: await token(lab.id),
        body: { password: "a-very-long-password" },
      }),
      ctx(other.id)
    );
    expect(res.status).toBe(403);
  });

  it("changing your own requires the current one", async (t) => {
    // Only the SUPER_ADMIN account in this database has a hash, and platform
    // roles are exempt from the current-password check — so proving the rule
    // needs a partner account that has one. Created here and deleted below,
    // rather than setting a password on somebody's real account.
    const probe = await prisma.user.create({
      data: {
        role: "LAB",
        name: "probe — password rule",
        phone: `probe-${Date.now()}`,
        passwordHash: await hashPassword("the-current-password"),
      },
      select: { id: true, passwordHash: true },
    });

    try {
      const { POST } = await import("@/app/api/users/[id]/password/route");
      const bearer = await token(probe.id);

      const missing = await POST(
        req(`/api/users/${probe.id}/password`, {
          method: "POST",
          bearer,
          body: { password: "a-very-long-password" },
        }),
        ctx(probe.id)
      );
      expect(missing.status).toBe(400);

      const wrong = await POST(
        req(`/api/users/${probe.id}/password`, {
          method: "POST",
          bearer,
          body: { password: "a-very-long-password", currentPassword: "definitely-not-it" },
        }),
        ctx(probe.id)
      );
      expect(wrong.status).toBe(403);

      // Neither attempt touched the stored hash.
      const untouched = await prisma.user.findUniqueOrThrow({
        where: { id: probe.id },
        select: { passwordHash: true },
      });
      expect(untouched.passwordHash).toBe(probe.passwordHash);

      // And the correct current password goes through.
      const ok = await POST(
        req(`/api/users/${probe.id}/password`, {
          method: "POST",
          bearer,
          body: { password: "a-brand-new-password", currentPassword: "the-current-password" },
        }),
        ctx(probe.id)
      );
      expect(ok.status, JSON.stringify(await ok.clone().json())).toBe(200);

      const changed = await prisma.user.findUniqueOrThrow({
        where: { id: probe.id },
        select: { passwordHash: true },
      });
      expect(changed.passwordHash).not.toBe(probe.passwordHash);
    } finally {
      // The change wrote an audit row, as it should — `ActivityLog.userId` is
      // a hard FK, so that goes first.
      await prisma.activityLog.deleteMany({ where: { userId: probe.id } });
      await prisma.user.delete({ where: { id: probe.id } });
    }
  });
});
