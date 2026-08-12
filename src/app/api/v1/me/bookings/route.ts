import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { SERVICE_TYPE_LABELS } from "@/lib/labels";
import { nonEmpty, parseBody, serviceTypeSchema } from "@/lib/validation";
import { PROVIDER_SLOT } from "@/lib/order-slots";
import { priceOrder } from "@/server/services/orders";
import { InsufficientBalance, payOrderFromWallet } from "@/server/services/patient-wallet";

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

/**
 * How many of each source the card feed carries.
 *
 * This endpoint is screen-shaped, not list-shaped: it merges appointments and
 * orders into `{ upcoming, past }` for the bookings screen, so it has no cursor
 * and no `meta.page`. That is a deliberate design, but the cap was invisible —
 * a patient with more history than this saw a truncated feed with nothing
 * saying so. `truncated` now tells the client to send them to the paged lists,
 * `/api/v1/me/orders` and `/api/v1/me/appointments`.
 */
const CARD_LIMIT = 50;

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const [appointments, orders] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: identity.userId, deletedAt: null },
      orderBy: { date: "desc" },
      take: CARD_LIMIT + 1,
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
      take: CARD_LIMIT + 1,
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

  // The extra row fetched above exists only to detect truncation; it must not
  // reach the feed, or the cap would silently become 51.
  const cards: Card[] = [
    ...appointments.slice(0, CARD_LIMIT).map((a) => ({
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
    ...orders.slice(0, CARD_LIMIT).map((o) => ({
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

  return ok(
    {
      upcoming,
      past,
      // True when either source hit the cap, so the client can offer "see all"
      // instead of quietly presenting a partial history as the whole of it.
      truncated: appointments.length > CARD_LIMIT || orders.length > CARD_LIMIT,
      limit: CARD_LIMIT,
    },
    { requestId }
  );
});

/* ─────────────────────────────────────────────────────────────
 * POST /api/v1/me/bookings — الحجز
 *
 * The action the whole product exists for, and the one thing a patient could
 * not do. The booking drawer created nothing, `/api/v1` had no create route at
 * all, and `POST /api/orders` is OPERATIONS-only — so every order in the system
 * was seeded or staff-entered. Settlement, commissions, the wallet: all of it
 * processed orders no patient could originate.
 *
 * Three rules govern this handler:
 *
 *   1. The patient is the VERIFIED caller. `patientId` is never read from the
 *      body — that would let anyone book in someone else's name and put the
 *      charge on their wallet.
 *   2. The price is computed server-side by `priceOrder`. A client-supplied
 *      amount is a client-supplied discount.
 *   3. The provider must genuinely offer this service, in this storefront.
 *      Otherwise a booking lands on a partner who cannot serve it and dispatch
 *      discovers it later.
 * ───────────────────────────────────────────────────────────── */

const createBookingSchema = z
  .object({
    serviceType: serviceTypeSchema,
    /** The provider the patient picked. Required: pricing needs a contract. */
    providerId: nonEmpty,
    /** Which storefront this was booked from — decides the channel price. */
    source: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
    governorateId: nonEmpty.optional(),
    area: nonEmpty.optional(),
    address: z.string().trim().min(1).max(240).optional(),
    notes: z.string().trim().max(500).optional(),
    couponCode: z.string().trim().min(1).max(40).optional(),
    /**
     * Settle from the wallet immediately. Honoured only when the
     * `booking.electronic_deduction` flag is on and the balance covers it —
     * `payOrderFromWallet` decides, not the client.
     */
    payFromWallet: z.boolean().default(false),
  })
  .strict();

export const POST = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createBookingSchema);

  // Identity, not input. The patient's own name and phone go on the order so
  // dispatch can act without another lookup.
  const patient = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, name: true, phone: true, governorateId: true, area: true, isActive: true },
  });
  if (!patient?.isActive) {
    return fail(ErrorCode.FORBIDDEN, 403, "الحساب غير مفعّل", { requestId });
  }
  if (!patient.name || !patient.phone) {
    // Dispatch cannot act on an order with nobody to call.
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "أكمل اسمك ورقم هاتفك قبل الحجز", {
      requestId,
    });
  }

  const provider = await prisma.partner.findFirst({
    where: { id: input.providerId, deletedAt: null },
    select: {
      id: true,
      type: true,
      status: true,
      channels: { select: { channel: true, status: true } },
      serviceConfigs: {
        where: { serviceType: input.serviceType },
        select: { status: true },
      },
    },
  });
  if (!provider) {
    return fail(ErrorCode.NOT_FOUND, 404, "مقدم الخدمة غير موجود", { requestId });
  }
  if (provider.status !== "ACTIVE") {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "مقدم الخدمة غير متاح حالياً", {
      requestId,
    });
  }

  // Sells through this storefront? A Sanad-only doctor must not take a booking
  // made from the public app, and vice versa.
  const inChannel = provider.channels.some(
    (c) => c.channel === input.source && c.status !== "SUSPENDED"
  );
  if (!inChannel) {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "مقدم الخدمة لا يعمل ضمن هذه الواجهة", {
      requestId,
    });
  }

  // Offers this service, and it is switched on.
  if (provider.serviceConfigs[0]?.status !== "ACTIVE") {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "مقدم الخدمة لا يقدّم هذه الخدمة", {
      requestId,
    });
  }

  const slot = PROVIDER_SLOT[provider.type as keyof typeof PROVIDER_SLOT];
  if (!slot) {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "نوع مقدم الخدمة لا يقبل الحجز", {
      requestId,
    });
  }

  const order = await prisma.order.create({
    data: {
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      serviceType: input.serviceType,
      source: input.source,
      status: "NEW",
      // Falls back to the patient's saved location, so a home service booked
      // without an explicit address still reaches somebody.
      governorateId: input.governorateId ?? patient.governorateId,
      area: input.area ?? patient.area,
      address: input.address ?? null,
      notes: input.notes ?? null,
      [slot]: provider.id,
      timeline: {
        create: { step: 1, title: "تم إنشاء الطلب", completedAt: new Date() },
      },
    },
    select: { id: true, orderNumber: true },
  });

  // Priced server-side. A failure here leaves a NEW unpriced order rather than
  // losing the booking — operations can price it by hand, and the patient is
  // told the amount is pending instead of being charged a number we invented.
  // Decimals, not strings — `ok()` runs `serializeDecimals`, which turns them
  // into JSON numbers. Calling `.toString()` here defeated it and shipped money
  // as text on this one endpoint while the same field is a number elsewhere, so
  // a client doing `total + balance` concatenated instead of adding.
  let priced: { totalAmount: Prisma.Decimal; discountTotal: Prisma.Decimal } | null = null;
  let pricingError: string | null = null;
  try {
    const result = await priceOrder({ orderId: order.id, couponCode: input.couponCode ?? null });
    priced = {
      totalAmount: result.quote.totalAmount,
      discountTotal: result.quote.discountTotal,
    };
  } catch (error) {
    pricingError = error instanceof Error ? error.message : "تعذّر تسعير الحجز";
  }

  // Wallet payment is best-effort and never blocks the booking: the service is
  // still ordered if the balance is short, and the patient pays another way.
  let paid = false;
  let paymentError: string | null = null;
  if (input.payFromWallet && priced) {
    try {
      paid = (await payOrderFromWallet(order.id)) !== null;
      if (!paid) paymentError = "الخصم الإلكتروني غير مفعّل";
    } catch (error) {
      paymentError = error instanceof InsufficientBalance ? "الرصيد غير كافٍ" : "تعذّر الدفع من المحفظة";
    }
  }

  return ok(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      status: "NEW",
      serviceType: input.serviceType,
      source: input.source,
      totalAmount: priced?.totalAmount ?? null,
      discountTotal: priced?.discountTotal ?? null,
      paid,
      // Reported, never swallowed: the client must be able to say "we could not
      // price this yet" rather than showing a confident zero.
      pricingError,
      paymentError,
    },
    { status: 201, requestId }
  );
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { createBookingSchema };
