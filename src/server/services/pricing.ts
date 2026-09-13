import { Prisma, type OrderSource, type ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { membershipDiscountFor } from "./membership";

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
  appliedCoupon: { id: string; code: string; maxUses: number } | null;
  /** The coupon's own contribution, distinct from the total discount. */
  couponDiscount: Decimal;
  /** The membership's own contribution — zero when there is none, or when the
   *  provider is not in the programme. Surfaced separately so the checkout can
   *  say "خصم العضوية" rather than folding it into one unexplained number. */
  membershipDiscount: Decimal;
  /** The rate that produced it, for display: "خصم العضوية 10%". */
  membershipPercent: Decimal;
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
 *   3. the patient's membership rate ("نسبة الخصم الأساسية"), but ONLY at a
 *      provider taking part in the programme
 *   4. a coupon, if supplied and valid
 *   5. the partner's contractual minimum, which acts as a FLOOR — a partner
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

  // 3. membership — "نسبة الخصم الأساسية"
  //
  // Gated on the provider taking part: "الخصومات والمزايا متاحة فقط لدى مقدمي
  // الخدمات والمجمعات المشتركين في برنامج وريد وسند". `PartnerChannel` already
  // records exactly that — who is live in which storefront — so participation
  // is read from it rather than from a second flag that could disagree.
  //
  // With no `partnerId` the caller is quoting a service in the abstract (a
  // price list, not a booking), and the rate still applies: refusing it there
  // would advertise one price and charge another.
  let membershipPercent = new D(0);
  if (userId) {
    const eligible = partnerId ? await participatesInProgramme(partnerId, source) : true;
    if (eligible) membershipPercent = await membershipDiscountFor(userId);
  }

  let membershipContribution = new D(0);
  if (membershipPercent.greaterThan(0)) {
    membershipContribution = base
      .times(membershipPercent)
      .dividedBy(100)
      .toDecimalPlaces(MONEY_DP, D.ROUND_DOWN);
    discount = discount.plus(membershipContribution);
  }

  // 4. coupon
  let appliedCoupon: Quote["appliedCoupon"] = null;
  let couponContribution = new D(0);
  if (couponCode) {
    const coupon = await validateCoupon(couponCode, userId ?? null);
    const couponDiscount =
      coupon.discountType === "PERCENTAGE"
        ? base.times(coupon.discountValue).dividedBy(100).toDecimalPlaces(MONEY_DP, D.ROUND_DOWN)
        : coupon.discountValue;

    discount = discount.plus(couponDiscount);
    couponContribution = couponDiscount;
    appliedCoupon = { id: coupon.id, code: coupon.code, maxUses: coupon.maxUses };
  }

  // A discount can never exceed the price.
  if (discount.greaterThan(base)) discount = base;

  let total = base.minus(discount);

  // 5. contract floor
  let minimumApplied = false;
  if (partnerId) {
    const floor = await contractMinimum(partnerId, serviceType);
    if (floor && total.lessThan(floor)) {
      // Clamp to `base`: the floor raises a DISCOUNTED price back up, it must
      // never push the patient above the listed price. Unclamped, a floor
      // greater than base charged more than the advertised price and stored a
      // negative discountTotal.
      total = D.min(floor, base);
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
    couponDiscount: couponContribution,
    membershipDiscount: membershipContribution,
    membershipPercent,
    minimumApplied,
  };
}

/**
 * Is this provider in the وريد وسند programme for this storefront?
 *
 * `PartnerChannel` is that record already — a partner is live per channel, with
 * a status independent of their overall one. Reading it here means the discount
 * follows the same switch operations already use to take a partner in or out of
 * a storefront, instead of a parallel flag that drifts from it.
 */
async function participatesInProgramme(
  partnerId: string,
  source: OrderSource
): Promise<boolean> {
  const channel = await prisma.partnerChannel.findUnique({
    where: { partnerId_channel: { partnerId, channel: source } },
    select: { status: true },
  });
  return channel?.status === "ACTIVE";
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

  // minPrices is a free-form Json column with no validation on write, so a
  // value like "n/a" is possible. `new Decimal()` THROWS on unparseable input
  // rather than yielding NaN, which made every /price call for that partner a
  // 500 — the isFinite() check below could never run.
  try {
    const value = new D(String(raw));
    return value.isFinite() && value.greaterThan(0) ? value : null;
  } catch {
    return null;
  }
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
export async function redeemCoupon(
  params: {
    couponId: string;
    userId: string;
    orderId?: string | null;
    amount: Decimal;
    /** Needed to re-check the cap atomically. 0 means unlimited. */
    maxUses: number;
  },
  /** Runs inside a caller's transaction when supplied, so pricing stays atomic. */
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const redemption = await tx.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        orderId: params.orderId ?? null,
        amount: params.amount,
      },
    });

    // Enforce maxUses INSIDE the transaction. validateCoupon's check happens
    // earlier and per-user, so N different patients priced concurrently all
    // passed it and all redeemed a coupon budgeted for one.
    const claimed = await tx.coupon.updateMany({
      where: {
        id: params.couponId,
        OR: [{ maxUses: 0 }, { usedCount: { lt: params.maxUses } }],
      },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new PricingError("COUPON_EXHAUSTED", "تم استنفاد هذا الكوبون");
    }

    return redemption;
  };

  return "$transaction" in client ? client.$transaction(run) : run(client as Prisma.TransactionClient);
}
