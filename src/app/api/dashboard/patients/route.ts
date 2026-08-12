import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { orderScopeFor } from "@/lib/order-slots";
import { complexContextFor } from "@/server/services/referral";

/**
 * "مرضاي" — the people this provider has actually treated.
 *
 * The only page in the partner dashboard that genuinely needed a new endpoint.
 * The rest were calling `/api/dashboard/*` routes that never existed while a
 * partner-scoped equivalent already sat under a different name; those pages now
 * use the real ones. This one is different: nothing stores "my patients". It is
 * derived — distinct patients across the caller's own appointments and orders,
 * with a visit count and their last and next dates.
 *
 * The page it serves read `lastVisit`, `nextAppointment` and `totalVisits` off
 * a `Patient` row. There is no such model, and no endpoint answered it, so the
 * screen was a permanent skeleton reading three fields that could never arrive.
 *
 * Three sources, because there are three ways a provider comes to hold someone:
 * an order assigned to them, an appointment, and — inside a complex — a
 * referral they are party to.
 *
 * Scoped to the caller: a doctor sees the patients of THEIR appointments, a lab
 * the patients of the orders assigned to it and the cases sent to it.
 * `orderScopeFor` fails closed, and `complexContextFor` returns null outside a
 * complex, so neither widens anything.
 *
 * `totalVisits` counts interactions, not distinct days: an order and a referral
 * for the same person are two, as an order and an appointment already were.
 */
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const now = new Date();

  // A partner inside a complex also holds the patients sent to them. Without
  // this, a lab that received a referral, ran the test and wrote the result
  // still shows "no patients" — and cannot pick that person in the referral
  // form to send them on to the pharmacy.
  const ctx = await complexContextFor(identity);

  // Appointments belong to a DoctorProfile, orders to a Partner — two different
  // ids for the same person, which is why both scopes are resolved separately.
  const [appointments, orders, referrals] = await Promise.all([
    identity.doctorProfileId || isPlatformRole(identity.role)
      ? prisma.appointment.findMany({
          where: {
            deletedAt: null,
            ...(isPlatformRole(identity.role)
              ? {}
              : { doctorId: identity.doctorProfileId ?? "" }),
          },
          select: { patientId: true, date: true, status: true },
        })
      : Promise.resolve([]),
    prisma.order.findMany({
      where: { deletedAt: null, ...orderScopeFor(identity) },
      select: { patientId: true, patientName: true, patientPhone: true, createdAt: true, status: true },
    }),
    ctx
      ? prisma.complexReferral.findMany({
          where: {
            OR: [{ toPartnerId: ctx.partnerId }, { fromPartnerId: ctx.partnerId }],
          },
          select: {
            patientId: true,
            patientName: true,
            patientPhone: true,
            createdAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  type Row = {
    id: string;
    name: string | null;
    phone: string | null;
    lastVisit: Date | null;
    nextAppointment: Date | null;
    totalVisits: number;
  };
  const byPatient = new Map<string, Row>();

  const touch = (id: string): Row => {
    let row = byPatient.get(id);
    if (!row) {
      row = { id, name: null, phone: null, lastVisit: null, nextAppointment: null, totalVisits: 0 };
      byPatient.set(id, row);
    }
    return row;
  };

  for (const o of orders) {
    const row = touch(o.patientId);
    // The order carries the name and phone as given at booking — the most
    // reliable contact details we hold for this person.
    row.name ??= o.patientName;
    row.phone ??= o.patientPhone;
    row.totalVisits += 1;
    if (o.status === "COMPLETED" && (!row.lastVisit || o.createdAt > row.lastVisit)) {
      row.lastVisit = o.createdAt;
    }
  }

  for (const r of referrals) {
    const row = touch(r.patientId);
    row.name ??= r.patientName;
    row.phone ??= r.patientPhone;
    row.totalVisits += 1;
    // A referral counts as a visit once it has actually been acted on. "sent"
    // means the patient has not arrived yet, so it must not become a lastVisit.
    if (r.status === "completed" && (!row.lastVisit || r.createdAt > row.lastVisit)) {
      row.lastVisit = r.createdAt;
    }
  }

  for (const a of appointments) {
    const row = touch(a.patientId);
    row.totalVisits += 1;
    if (a.status === "completed" && (!row.lastVisit || a.date > row.lastVisit)) {
      row.lastVisit = a.date;
    }
    // "Next" means still ahead and not cancelled — the soonest such date.
    if (
      a.date > now &&
      a.status === "scheduled" &&
      (!row.nextAppointment || a.date < row.nextAppointment)
    ) {
      row.nextAppointment = a.date;
    }
  }

  // Fill in names for patients seen only through appointments, which carry no
  // denormalised contact details.
  const missing = [...byPatient.values()].filter((r) => !r.name).map((r) => r.id);
  if (missing.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true, phone: true },
    });
    for (const u of users) {
      const row = byPatient.get(u.id);
      if (!row) continue;
      row.name = u.name;
      row.phone = u.phone;
    }
  }

  const data = [...byPatient.values()]
    .map((r) => ({
      ...r,
      // Someone with a future appointment is active care; otherwise they are
      // simply past. Never invented beyond what the dates support.
      status: r.nextAppointment ? "scheduled" : r.lastVisit ? "past" : "new",
    }))
    .sort((a, b) => {
      const at = a.nextAppointment?.getTime() ?? a.lastVisit?.getTime() ?? 0;
      const bt = b.nextAppointment?.getTime() ?? b.lastVisit?.getTime() ?? 0;
      return bt - at;
    });

  return ok(data, { requestId });
});
