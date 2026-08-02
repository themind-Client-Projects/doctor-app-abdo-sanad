import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { SERVICE_TYPE_LABELS } from "@/lib/labels";

/**
 * GET /api/v1/me/bookings — حجوزاتي, both kinds in one list.
 *
 * A patient's bookings live in TWO tables: `Appointment` (a doctor visit at a
 * time) and `Order` (a lab, pharmacy, nursing or transport job). The screen
 * shows them together because that is how a person thinks about "my bookings",
 * so the merge happens here rather than leaving the client to fetch twice,
 * interleave by date and reconcile two different status vocabularies.
 *
 * GLOBAL: an order booked through سند sits next to one booked outside it, and
 * carries its `source` so the card can say which.
 */

/** Order statuses that mean the job is over, either way. */
const ORDER_TERMINAL = ["COMPLETED", "CANCELLED"] as const;
/** Appointment statuses likewise. */
const APPT_TERMINAL = ["completed", "cancelled", "no_show"];

/** Both vocabularies collapse to what the card actually renders. */
function toCardStatus(raw: string): "confirmed" | "pending" | "completed" | "cancelled" {
  switch (raw) {
    case "COMPLETED":
    case "completed":
      return "completed";
    case "CANCELLED":
    case "cancelled":
    case "no_show":
      return "cancelled";
    case "NEW":
    case "scheduled":
      return "pending";
    default:
      return "confirmed";
  }
}

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const [appointments, orders] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: identity.userId, deletedAt: null },
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true, date: true, time: true, status: true, price: true, type: true,
        doctor: {
          select: {
            specialty: { select: { name: true } },
            user: {
              select: {
                name: true,
                governorate: { select: { name: true } },
                partner: { select: { address: true } },
              },
            },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { patientId: identity.userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, orderNumber: true, serviceType: true, status: true, source: true,
        totalAmount: true, createdAt: true, address: true, area: true,
        governorate: { select: { name: true } },
        assignedLab: { select: { name: true } },
        assignedPharmacy: { select: { name: true } },
        assignedNurse: { select: { name: true } },
        assignedRadiology: { select: { name: true } },
      },
    }),
  ]);

  type Card = {
    id: string;
    kind: "appointment" | "order";
    providerName: string;
    subtitle: string;
    date: string;
    time: string | null;
    location: string;
    type: string;
    status: ReturnType<typeof toCardStatus>;
    price: number | null;
    reference: string;
    source: string | null;
    isPast: boolean;
    sortAt: string;
  };

  const cards: Card[] = [
    ...appointments.map((a) => ({
      id: a.id,
      kind: "appointment" as const,
      providerName: a.doctor?.user.name ?? "طبيب",
      subtitle: a.doctor?.specialty?.name ?? "استشارة طبية",
      date: a.date.toISOString(),
      time: a.time,
      location: a.doctor?.user.partner?.address ?? a.doctor?.user.governorate?.name ?? "",
      type: "doctor",
      status: toCardStatus(a.status),
      price: a.price === null ? null : Number(a.price),
      reference: a.id.slice(-8).toUpperCase(),
      source: null,
      isPast: APPT_TERMINAL.includes(a.status) || a.date.getTime() < Date.now(),
      sortAt: a.date.toISOString(),
    })),
    ...orders.map((o) => ({
      id: o.id,
      kind: "order" as const,
      // Whichever provider was assigned; unassigned orders are still real
      // bookings and must not vanish from the list.
      providerName:
        o.assignedLab?.name ??
        o.assignedPharmacy?.name ??
        o.assignedNurse?.name ??
        o.assignedRadiology?.name ??
        "قيد الإسناد",
      subtitle: SERVICE_TYPE_LABELS[o.serviceType] ?? o.serviceType,
      date: o.createdAt.toISOString(),
      time: null,
      location: [o.governorate?.name, o.area, o.address].filter(Boolean).join(" - "),
      type: o.serviceType,
      status: toCardStatus(o.status),
      price: o.totalAmount === null ? null : Number(o.totalAmount),
      reference: o.orderNumber.slice(-8).toUpperCase(),
      source: o.source,
      isPast: (ORDER_TERMINAL as readonly string[]).includes(o.status),
      sortAt: o.createdAt.toISOString(),
    })),
  ];

  // Upcoming ascending (soonest first) and past descending (most recent first)
  // — a single sort direction would bury tomorrow's appointment under last
  // year's, or vice versa.
  const upcoming = cards
    .filter((c) => !c.isPast)
    .sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  const past = cards
    .filter((c) => c.isPast)
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  return ok({ upcoming, past }, { requestId });
});
