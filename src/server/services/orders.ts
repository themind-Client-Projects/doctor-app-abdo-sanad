import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { quoteService, redeemCoupon } from "./pricing";
import { settleOrder } from "./commission";

/**
 * Order lifecycle — "متابعة التنفيذ" (req L384-407).
 *
 * The requirement specifies an 11-step timeline. Only 3 steps had a writer, no
 * endpoint ever reached COMPLETED, and `PATCH /api/orders/[id]` could set any
 * status directly — so the ladder was decorative and an order could jump from
 * NEW to COMPLETED without passing through assignment or execution.
 *
 * That also meant settlement could never fire, because the commission engine
 * refuses to settle an order that is not COMPLETED.
 */

const D = Prisma.Decimal;

/** The canonical 11 steps, in requirement order. */
export const TIMELINE_STEPS = [
  { step: 1, code: "CREATED", title: "تم إنشاء الطلب", status: "NEW" },
  { step: 2, code: "ACCEPTED", title: "تم قبول الطلب", status: "ACCEPTED" },
  { step: 3, code: "ASSIGNED", title: "تم تعيين منفذ الخدمة", status: "ASSIGNED" },
  { step: 4, code: "CONTACTED", title: "تم التواصل", status: "ASSIGNED" },
  { step: 5, code: "IN_TRANSIT", title: "في الطريق", status: "IN_TRANSIT" },
  { step: 6, code: "ARRIVED", title: "تم الوصول", status: "ARRIVED" },
  { step: 7, code: "STARTED", title: "بدأ التنفيذ", status: "IN_PROGRESS" },
  { step: 8, code: "SERVICE_DONE", title: "تم إنهاء الخدمة", status: "IN_PROGRESS" },
  { step: 9, code: "RESULTS_UPLOADED", title: "تم رفع النتائج", status: "IN_PROGRESS" },
  { step: 10, code: "PATIENT_NOTIFIED", title: "تم إشعار المريض", status: "IN_PROGRESS" },
  { step: 11, code: "COMPLETED", title: "اكتمل الطلب", status: "COMPLETED" },
] as const;

export type TimelineStepCode = (typeof TIMELINE_STEPS)[number]["code"];

const STEP_BY_CODE = new Map(TIMELINE_STEPS.map((s) => [s.code, s]));

/**
 * Legal status transitions.
 *
 * Anything not listed is rejected, so an order cannot skip execution or be
 * revived after cancellation.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED", "DELAYED"],
  ACCEPTED: ["ASSIGNED", "CANCELLED", "DELAYED"],
  ASSIGNED: ["IN_TRANSIT", "IN_PROGRESS", "CANCELLED", "DELAYED"],
  IN_TRANSIT: ["ARRIVED", "CANCELLED", "DELAYED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED", "DELAYED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "DELAYED"],
  DELAYED: ["ACCEPTED", "ASSIGNED", "IN_TRANSIT", "ARRIVED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

export class OrderError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "INVALID_TRANSITION"
      | "STEP_ALREADY_DONE"
      | "OUT_OF_ORDER"
      | "NO_PROVIDER"
      | "NOT_PRICED"
      | "ALREADY_SETTLED",
    message: string
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Record a timeline step and move the order's status with it.
 *
 * Steps must be completed in order — marking "تم الوصول" before "في الطريق"
 * produces a timeline that reads plausibly but describes something that never
 * happened.
 */
export async function advanceOrder(params: {
  orderId: string;
  stepCode: TimelineStepCode;
  actorId?: string;
  description?: string;
}) {
  const target = STEP_BY_CODE.get(params.stepCode);
  if (!target) throw new OrderError("NOT_FOUND", "خطوة غير معروفة");

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, timeline: { select: { step: true } } },
  });
  if (!order) throw new OrderError("NOT_FOUND", "الطلب غير موجود");

  const done = new Set(order.timeline.map((t) => t.step));
  if (done.has(target.step)) {
    throw new OrderError("STEP_ALREADY_DONE", "تم تسجيل هذه الخطوة مسبقاً");
  }

  // Every earlier step must already be recorded.
  const missing = TIMELINE_STEPS.filter((s) => s.step < target.step && !done.has(s.step));
  if (missing.length > 0) {
    throw new OrderError(
      "OUT_OF_ORDER",
      `يجب إكمال الخطوات السابقة أولاً: ${missing.map((m) => m.title).join("، ")}`
    );
  }

  const nextStatus = target.status as OrderStatus;
  if (!canTransition(order.status, nextStatus)) {
    throw new OrderError(
      "INVALID_TRANSITION",
      `لا يمكن الانتقال من ${order.status} إلى ${nextStatus}`
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.orderTimeline.create({
      data: {
        orderId: order.id,
        step: target.step,
        title: target.title,
        description: params.description ?? null,
        completedAt: new Date(),
        completedBy: params.actorId ?? null,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
      include: { timeline: { orderBy: { step: "asc" } } },
    });
  });
}

/**
 * Price an order and store the amount.
 *
 * `Order.totalAmount` was added in Step 3 but nothing ever populated it, so
 * every order reached settlement with nothing to split.
 */
export async function priceOrder(params: {
  orderId: string;
  couponCode?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      serviceType: true,
      source: true,
      patientId: true,
      assignedLabId: true,
      assignedPharmacyId: true,
      assignedRadiologyId: true,
      assignedNurseId: true,
      assignedDriverId: true,
      orderSettlement: { select: { id: true, status: true } },
    },
  });
  if (!order) throw new OrderError("NOT_FOUND", "الطلب غير موجود");

  // Re-pricing a settled order left OrderSettlement.totalAmount and
  // Order.totalAmount permanently disagreeing — the ledger that moved the
  // money and the figure the finance screen reads, with nothing flagging it.
  if (order.orderSettlement && order.orderSettlement.status !== "REVERSED") {
    throw new OrderError("ALREADY_SETTLED", "لا يمكن تسعير طلب تمت تسويته");
  }
  if (!REPRICEABLE_STATUSES.has(order.status)) {
    throw new OrderError(
      "INVALID_TRANSITION",
      "لا يمكن تسعير الطلب بعد بدء التنفيذ"
    );
  }

  const providerId =
    order.assignedLabId ??
    order.assignedPharmacyId ??
    order.assignedRadiologyId ??
    order.assignedNurseId ??
    order.assignedDriverId;

  // The contract floor is looked up from the provider, so pricing before
  // assignment silently skipped it — a coupon could then cut below what the
  // partner's contract guarantees, and assignment afterwards never re-checked.
  if (!providerId) {
    throw new OrderError("NO_PROVIDER", "يجب تعيين مقدم الخدمة قبل التسعير");
  }

  const quote = await quoteService({
    serviceType: order.serviceType,
    source: order.source,
    couponCode: params.couponCode ?? null,
    partnerId: providerId,
    userId: order.patientId,
  });

  // One transaction: the order's price and the coupon's consumption must not
  // be able to disagree. Previously the update committed first, so a failure
  // in between left the discount applied and the coupon unconsumed — reusable
  // indefinitely.
  const updated = await prisma.$transaction(async (tx) => {
    // Re-pricing with a different coupon used to orphan the first redemption:
    // it stayed recorded against this order at an amount no longer applied,
    // burning the patient's one-per-user allowance for nothing.
    const stale = await tx.couponRedemption.findMany({ where: { orderId: order.id } });
    for (const r of stale) {
      await tx.couponRedemption.delete({ where: { id: r.id } });
      await tx.coupon.update({
        where: { id: r.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    const row = await tx.order.update({
      where: { id: order.id },
      data: {
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
      },
    });

    if (quote.appliedCoupon && order.patientId) {
      await redeemCoupon(
        {
          couponId: quote.appliedCoupon.id,
          userId: order.patientId,
          orderId: order.id,
          // The coupon's OWN contribution, not the total discount — otherwise
          // a standing service discount inflated every coupon-ROI figure.
          amount: quote.couponDiscount,
          maxUses: quote.appliedCoupon.maxUses,
        },
        tx
      );
    }

    return row;
  });

  return { order: updated, quote };
}

/** Pricing is only meaningful before execution starts. */
const REPRICEABLE_STATUSES = new Set<OrderStatus>([
  "NEW",
  "ACCEPTED",
  "ASSIGNED",
  "DELAYED",
]);

/**
 * Complete an order and settle it.
 *
 * This is the only path to COMPLETED, and therefore the only trigger for
 * revenue distribution.
 */
export async function completeOrder(params: {
  orderId: string;
  actorId?: string;
  /** Settlement is best-effort: a completed service must not be un-completed
   *  because a contract is missing. The failure is reported, not swallowed. */
  settle?: boolean;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, totalAmount: true },
  });
  if (!order) throw new OrderError("NOT_FOUND", "الطلب غير موجود");

  if (!order.totalAmount || order.totalAmount.lessThanOrEqualTo(new D(0))) {
    throw new OrderError("NOT_PRICED", "يجب تسعير الطلب قبل إكماله");
  }

  const completed = await advanceOrder({
    orderId: params.orderId,
    stepCode: "COMPLETED",
    actorId: params.actorId,
  });

  if (params.settle === false) return { order: completed, settlement: null, settlementError: null };

  try {
    const settlement = await settleOrder(params.orderId, params.actorId);
    return { order: completed, settlement, settlementError: null };
  } catch (error) {
    return {
      order: completed,
      settlement: null,
      settlementError: error instanceof Error ? error.message : "فشل في التسوية",
    };
  }
}

/** The timeline as the tracking UI needs it: every step, done or pending. */
export async function getTimeline(orderId: string) {
  const rows = await prisma.orderTimeline.findMany({
    where: { orderId },
    orderBy: { step: "asc" },
  });
  const byStep = new Map(rows.map((r) => [r.step, r]));

  return TIMELINE_STEPS.map((s) => {
    const row = byStep.get(s.step);
    return {
      step: s.step,
      code: s.code,
      title: s.title,
      completed: Boolean(row?.completedAt),
      completedAt: row?.completedAt ?? null,
      completedBy: row?.completedBy ?? null,
      description: row?.description ?? null,
    };
  });
}
