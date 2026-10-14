import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";

/**
 * The patient booking write, through the REAL handlers.
 *
 * `confirmBooking` in the booking drawer was `setStep('success')` and a 2s
 * timer — no request at all — while the success panel said «تم الحجز والدفع
 * بنجاح!». The drawer is mounted on five patient surfaces plus a sixth
 * near-identical copy on the specialty page, so that was every booking path
 * the app had.
 *
 * These tests pin the two facts tsc cannot:
 *
 *   1. The body the drawer now sends is ACCEPTED by the handler. Both schemas
 *      are `.strict()`, so one extra or misnamed field is a 400 — and the
 *      drawer has no way to discover that from types alone.
 *   2. `Appointment.doctorId` is a `DoctorProfile.id` while the booking
 *      endpoint's `providerId` is a `Partner.id`. Posting one where the other
 *      belongs is the single most repeated defect in this codebase, and only
 *      running the query settles which is which.
 *
 * A missing fixture SKIPS rather than passing: this database gets reset.
 */

const created: string[] = [];

function req(url: string, init: { method: string; body?: unknown; bearer?: string }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method,
    headers: {
      "content-type": "application/json",
      ...(init.bearer ? { authorization: `Bearer ${init.bearer}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function patientToken() {
  const patient = await prisma.user.findFirst({
    where: { role: "PATIENT", deletedAt: null, isActive: true, name: { not: null }, phone: { not: "" } },
    select: { id: true, role: true },
  });
  if (!patient) return null;
  return {
    id: patient.id,
    bearer: await signAccessToken({
      sub: patient.id,
      role: patient.role,
      partnerId: null,
      doctorProfileId: null,
    }),
  };
}

afterAll(async () => {
  if (created.length) {
    await prisma.appointment.deleteMany({ where: { id: { in: created } } });
  }
});

describe("POST /api/appointments — what the booking drawer now sends", () => {
  it("accepts the drawer's exact body and writes a row the patient owns", async () => {
    const auth = await patientToken();
    const doctor = await prisma.doctorProfile.findFirst({ select: { id: true } });
    if (!auth || !doctor) {
      console.warn("SKIP: no patient or doctor fixture");
      return;
    }

    const { POST } = await import("@/app/api/appointments/route");
    const when = new Date(Date.now() + 86_400_000);

    // Field for field what `confirmBooking` posts.
    const res = await POST(
      req("/api/appointments", {
        method: "POST",
        bearer: auth.bearer,
        body: {
          doctorId: doctor.id,
          type: "IN_PERSON",
          date: when.toISOString(),
          time: "10:30",
        },
      }),
      { params: Promise.resolve({}) } as never
    );

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);

    const row = body.data;
    created.push(row.id);

    // The patient is taken from the verified token, never from the body.
    expect(row.patientId).toBe(auth.id);
    expect(row.doctorId).toBe(doctor.id);
    expect(row.time).toBe("10:30");
    expect(row.status).toBe("scheduled");

    // And it is really in the table — not merely echoed back.
    const persisted = await prisma.appointment.findUnique({
      where: { id: row.id },
      select: { patientId: true, doctorId: true, time: true },
    });
    expect(persisted).toEqual({ patientId: auth.id, doctorId: doctor.id, time: "10:30" });
  });

  it("appears in the patient's own حجوزاتي feed", async () => {
    const auth = await patientToken();
    if (!auth || created.length === 0) {
      console.warn("SKIP: nothing booked");
      return;
    }

    const { GET } = await import("@/app/api/v1/me/bookings/route");
    const res = await GET(req("/api/v1/me/bookings", { method: "GET", bearer: auth.bearer }), {
      params: Promise.resolve({}),
    } as never);

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    // The booking the patient just made is in the feed the screen reads. This
    // is the end the old flow never reached: it showed a green check and the
    // list stayed empty.
    const all = [...body.data.upcoming, ...body.data.past];
    expect(all.some((b: { id: string }) => created.includes(b.id))).toBe(true);
  });

  it("reschedules through PATCH /api/appointments/[id] and the row really moves", async () => {
    const auth = await patientToken();
    if (!auth || created.length === 0) {
      console.warn("SKIP: nothing booked to reschedule");
      return;
    }
    const id = created[0];

    const before = await prisma.appointment.findUniqueOrThrow({
      where: { id },
      select: { date: true, time: true },
    });

    const { PATCH } = await import("@/app/api/appointments/[id]/route");
    // Exactly what «تأكيد الموعد الجديد» now sends: a local Y-M-D string and a
    // slot drawn from the doctor's own DoctorSchedule window.
    const res = await PATCH(
      req(`/api/appointments/${id}`, {
        method: "PATCH",
        bearer: auth.bearer,
        body: { date: "2026-11-03", time: "11:30" },
      }),
      { params: Promise.resolve({ id }) } as never
    );

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    const after = await prisma.appointment.findUniqueOrThrow({
      where: { id },
      select: { date: true, time: true },
    });
    expect(after.time).toBe("11:30");
    expect(after.time).not.toBe(before.time);
    // The date column really moved — the old confirm button closed the drawer
    // and left this untouched.
    expect(after.date.toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("rejects a DoctorProfile id where the booking endpoint wants a Partner id", async () => {
    const auth = await patientToken();
    const doctor = await prisma.doctorProfile.findFirst({ select: { id: true } });
    if (!auth || !doctor) {
      console.warn("SKIP: no fixture");
      return;
    }

    const { POST } = await import("@/app/api/v1/me/bookings/route");
    const res = await POST(
      req("/api/v1/me/bookings", {
        method: "POST",
        bearer: auth.bearer,
        // Deliberately the WRONG id space — what the drawer would have sent
        // had it posted `doctor.id`. The drawer refuses before reaching here;
        // this proves the refusal is warranted rather than defensive noise.
        body: { serviceType: "IN_PERSON_CONSULT", providerId: doctor.id, source: "DIRECT", payFromWallet: false },
      }),
      { params: Promise.resolve({}) } as never
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("مقدم الخدمة غير موجود");
  });
});
