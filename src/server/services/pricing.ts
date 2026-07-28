import { Prisma, type OrderSource, type ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Price resolution — "إدارة الأسعار" (req L231-238).
 *
 * Two sources of truth previously overlapped with no defined precedence:
 * `PriceConfig` (a global per-service price) and `Contract.minPrices` (a
 * per-partner floor). Nothing consumed either, so an order had no amount at
 * all — which is why the commission engine had nothing to split.
 *
 * The order below is deliberate and documented, because "which discount wins"
 * is exactly the kind of rule that silently diverges between screens.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const MONEY_DP = 3;

export class PricingError extends Error {
  constructor(
    readonly code:
      | "NO_PRICE"
      | "COUPON_INVALID"
      | "COUPON_EXPIRED"
      | "COUPON_EXHAUSTED"
      | "COUPON_ALREADY_USED"
      | "BELOW_MINIMUM",
    message: string
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export type Quote = {
  serviceType: ServiceType;
  /** Before any discount. */
  subtotal: Decimal;
  discountTotal: Decimal;
  /** What the patient pays, and what the commission engine splits. */
  totalAmount: Decimal;
  currency: string;
  appliedCoupon: { id: string; code: string } | null;
  /** Set when the contract floor raised the price above the discounted one. */
  minimumApplied: boolean;
};

/**
 * Quote a service.
 *
 * Precedence:
 *   1. base price by order source — Sanad and complex orders may be priced
 *      differently from a direct booking
 *   2. the service's own standing discount (`PriceConfig.discountPercent`)
 *   3. a coupon, if supplied and valid
 *   4. the partner's contractual minimum, which acts as a FLOOR — a partner
 *      must never be paid below what their contract guarantees, so a discount
 *      cannot cut into it
 */
export async function quoteService(params: {
  serviceType: ServiceType;
  source?: OrderSource;
  couponCode?: string | null;
  /** Needed to enforce the contract floor and per-user coupon limits. */
  partnerId?: string | null;
  userId?: string | null;
}): Promise<Quote> {
  const { serviceType, source = "DIRECT", couponCode, partnerId, userId } = params;

  const config = await prisma.priceConfig.findUnique({ where: { serviceType } });
  if (!config || !config.isActive) {
    throw new PricingError("NO_PRICE", "لا يوجد سعر معرّف لهذه الخدمة");
  }

  // 1. base by source
  const base =
    source === "SANAD"
      ? (config.sanadPrice ?? config.basePrice)
      : source === "COMPLEX"
        ? (config.complexPrice ?? config.basePrice)
        : config.basePrice;

  let discount = new D(0);

  // 2. standing service discount
  if (config.discountPercent && config.discountPercent.greaterThan(0)) {
    discount = discount.plus(
      base.times(config.discountPercent).dividedBy(100).toDecimalPlaces(MONEY_DP, D.ROUND_DOWN)
    );
  }

  // 3. coupon
  let appliedCoupon: Quote["appliedCoupon"] = null;
  if (couponCode) {
    const coupon = await validateCoupon(couponCode, userId ?? null);
    const couponDiscount =
      coupon.discountType === "PERCENTAGE"
        ? base.times(coupon.discountValue).dividedBy(100).toDecimalPlaces(MONEY_DP, D.ROUND_DOWN)
        : coupon.discountValue;

    discount = discount.plus(couponDiscount);
    appliedCoupon = { id: coupon.id, code: coupon.code };
  }

  // A discount can never exceed the price.
  if (discount.greaterThan(base)) discount = base;

  let total = base.minus(discount);

  // 4. contract floor
  let minimumApplied = false;
  if (partnerId) {
    const floor = await contractMinimum(partnerId, serviceType);
    if (floor && total.lessThan(floor)) {
      total = floor;
      discount = base.minus(total);
      minimumApplied = true;
    }
  }

  return {
    serviceType,
    subtotal: base,
    discountTotal: discount,
    totalAmount: total,
    currency: "IQD",
    appliedCoupon,
    minimumApplied,
  };
}

/** The partner's contractual minimum for a service, if their contract sets one. */
async function contractMinimum(
  partnerId: string,
  serviceType: ServiceType
): Promise<Decimal | null> {
  const contract = await prisma.contract.findUnique({
    where: { partnerId },
    select: { minPrices: true, isActive: true, endDate: true },
  });

  if (!contract?.isActive || contract.endDate < new Date()) return null;

  // minPrices is a Json object keyed by ServiceType member name.
  const prices = contract.minPrices as Record<string, unknown> | null;
  const raw = prices?.[serviceType];
  if (raw === undefined || raw === null) return null;

  const value = new D(String(raw));
  return value.isFinite() && value.greaterThan(0) ? value : null;
}

/**
 * Validate a coupon without consuming it.
 *
 * @throws {PricingError}
 */
export async function validateCoupon(code: string, userId: string | null) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!coupon || !coupon.isActive) {
    throw new PricingError("COUPON_INVALID", "كوبون غير صالح");
  }
  if (coupon.expiresAt < new Date()) {
    throw new PricingError("COUPON_EXPIRED", "انتهت صلاحية الكوبون");
  }
  // maxUses 0 means unlimited.
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new PricingError("COUPON_EXHAUSTED", "تم استنفاد هذا الكوبون");
  }
  if (userId) {
    const already = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
    });
    if (already) {
      throw new PricingError("COUPON_ALREADY_USED", "لقد استخدمت هذا الكوبون مسبقاً");
    }
  }

  return coupon;
}

/**
 * Consume a coupon.
 *
 * The unique (couponId, userId) pair makes a concurrent double-redemption a
 * database error rather than a race, and `usedCount` is finally incremented —
 * it was previously never touched, so `maxUses` could not be enforced.
 */
export async function redeemCoupon(params: {
  couponId: string;
  userId: string;
  orderId?: string | null;
  amount: Decimal;
}) {
  return prisma.$transaction(async (tx) => {
    const redemption = await tx.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        orderId: params.orderId ?? null,
        amount: params.amount,
      },
    });

    await tx.coupon.update({
      where: { id: params.couponId },
      data: { usedCount: { increment: 1 } },
    });

    return redemption;
  });
}
