import { Prisma, type ServiceType } from "@prisma/client";
import { TX_OPTIONS, prisma } from "@/lib/prisma";
import { InsufficientBalance, creditWallet, debitWallet } from "./patient-wallet";

/**
 * عضويات وريد وسند — buying one, holding one, and spending from it.
 *
 * There is no payment gateway. The admin credits a patient's wallet by hand
 * (`POST /api/patients/[id]/wallet`), and a membership is bought out of that
 * balance. That is not a stopgap shape: the wallet already refuses to overdraw
 * inside its own UPDATE predicate, so "can this patient afford it" is answered
 * by the same mechanism that answers it for every order. When a gateway does
 * arrive it tops the wallet up and nothing here changes.
 *
 * Three rules decide everything below:
 *
 *   1. A membership NEVER reads its terms back through the plan. Price,
 *      discount and every allowance are copied at purchase. The admin edits
 *      plans; a patient keeps the deal they bought.
 *   2. One active membership per patient. Buying again while one runs extends
 *      it rather than stacking a second discount.
 *   3. Spending an allowance is a conditional UPDATE, never read-then-write.
 */

const D = Prisma.Decimal;

export class MembershipError extends Error {
  constructor(
    readonly code:
      | "PLAN_NOT_FOUND"
      | "PLAN_COMING_SOON"
      | "PLAN_INACTIVE"
      | "ALREADY_MEMBER"
      | "REFUND_TOO_LARGE",
    message: string
  ) {
    super(message);
    this.name = "MembershipError";
  }
}

/** The three states the client's card draws per row. */
export const BENEFIT_STATES = ["AVAILABLE", "SUSPENDED", "LOCKED"] as const;
export type BenefitState = (typeof BENEFIT_STATES)[number];

export const BENEFIT_STATE_LABELS: Record<BenefitState, string> = {
  AVAILABLE: "متاح",
  SUSPENDED: "معلق",
  LOCKED: "غير مشمول",
};

/* --------------------------------- reading -------------------------------- */

/** Everything a plan card needs, ordered as the card prints it. */
export const PLAN_INCLUDE = {
  benefits: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.HealthPlanInclude;

export const MEMBERSHIP_INCLUDE = {
  entitlements: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.MembershipInclude;

/**
 * The patient's live membership, or null.
 *
 * Filtered on `expiresAt` rather than on `status`, because a membership expires
 * by the passage of time and nothing runs to rewrite the column at that moment.
 * Trusting `status` alone would keep honouring a discount for as long as no job
 * happened to sweep it.
 */
export async function activeMembershipFor(userId: string, at: Date = new Date()) {
  return prisma.membership.findFirst({
    where: { userId, status: "ACTIVE", expiresAt: { gt: at } },
    include: MEMBERSHIP_INCLUDE,
    orderBy: { expiresAt: "desc" },
  });
}

/**
 * The discount an active membership grants, as a percentage, or zero.
 *
 * Read from the MEMBERSHIP, never from the plan it came from — see rule 1.
 * Returns a plain Decimal so `quoteService` can stay the only place that knows
 * how discounts combine.
 */
export async function membershipDiscountFor(
  userId: string | null | undefined,
  at: Date = new Date()
): Promise<Prisma.Decimal> {
  if (!userId) return new D(0);
  const membership = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE", expiresAt: { gt: at } },
    select: { discountPercent: true },
    orderBy: { expiresAt: "desc" },
  });
  return membership?.discountPercent ?? new D(0);
}

/* -------------------------------- buying ---------------------------------- */

export type PurchaseResult = {
  membership: Prisma.MembershipGetPayload<{ include: typeof MEMBERSHIP_INCLUDE }>;
  /** Balance after the debit, so the client does not have to refetch. Null for
   *  an owner's grant, which takes nothing from the wallet. */
  walletBalance: Prisma.Decimal | null;
  /** True when this extended a membership the patient already held. */
  renewed: boolean;
};

/**
 * Buy a membership out of the wallet.
 *
 * Atomic end to end: the debit, the membership and its allowances are one
 * transaction, so there is no interval in which the patient has been charged
 * and holds nothing.
 *
 * @throws {MembershipError} the plan cannot be sold
 * @throws {InsufficientBalance} the wallet cannot cover it — the caller turns
 *         this into a 422 carrying the shortfall, because "add money and try
 *         again" is a different instruction from "this failed".
 */
export async function purchaseMembership(params: {
  userId: string;
  planId: string;
  /**
   * The owner granting it free — a comp, a staff benefit, a goodwill gesture.
   *
   * The SAME path as a purchase, deliberately: a grant has to obey every rule a
   * sale does — the snapshot, one membership at a time, renewal extending from
   * the end — and a second code path is where those rules would quietly drift.
   * The only differences are that no money moves, the price recorded is zero,
   * and the owner's name goes in the audit log.
   */
  grantedBy?: string;
}): Promise<PurchaseResult> {
  const plan = await prisma.healthPlan.findUnique({
    where: { id: params.planId },
    include: PLAN_INCLUDE,
  });

  if (!plan) throw new MembershipError("PLAN_NOT_FOUND", "الباقة غير موجودة");
  if (!plan.isActive) throw new MembershipError("PLAN_INACTIVE", "هذه الباقة غير متاحة حالياً");
  if (plan.isComingSoon) {
    // Refused here, not only hidden in the UI: the card is deliberately shown
    // with "متوفر قريباً", so its id is public and any client can post it.
    throw new MembershipError("PLAN_COMING_SOON", "هذه الباقة ستتوفر قريباً");
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // Re-read inside the transaction. Checked outside, two taps a moment apart
    // both see "no membership" and both buy one.
    const existing = await tx.membership.findFirst({
      where: { userId: params.userId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: { id: true, planId: true, planName: true, expiresAt: true },
    });

    // Buying a DIFFERENT package while one runs is refused rather than merged.
    //
    // Merging would have to answer questions nobody has decided: does the new
    // discount replace the old one or win only where it is larger, and do the
    // remaining visits carry across? Superseding instead would silently forfeit
    // days already paid for. Refusing costs the patient one message and leaves
    // the money decision with the admin, who can refund by hand.
    if (existing && existing.planId !== plan.id) {
      throw new MembershipError(
        "ALREADY_MEMBER",
        `لديك عضوية «${existing.planName}» سارية حتى ${formatDay(existing.expiresAt)} — ` +
          `يمكنك تجديدها أو انتظار انتهائها قبل الاشتراك بباقة أخرى`
      );
    }

    const granted = params.grantedBy !== undefined;

    // A grant moves no money. A free plan (price 0) cannot be debited either —
    // `debitWallet` refuses a zero amount — so it is treated the same way.
    const wallet =
      granted || plan.price.lte(0)
        ? null
        : await debitWallet(
            {
              userId: params.userId,
              amount: plan.price,
              description: `اشتراك ${plan.name}`,
            },
            tx
          );

    if (granted) {
      await tx.activityLog.create({
        data: {
          userId: params.grantedBy!,
          action: existing ? `تمديد عضوية مجانية — ${plan.name}` : `منح عضوية مجانية — ${plan.name}`,
          entityType: "membership",
          entityId: existing?.id ?? null,
          details: { patientId: params.userId, planId: plan.id, planCode: plan.code },
        },
      });
    }

    // ── Renewal: one row, a longer period, more visits ─────────────────────
    if (existing) {
      // Extended from the END of the current period, not from today, so buying
      // early never throws away days already paid for.
      const expiresAt = addDays(existing.expiresAt, plan.durationDays);

      await tx.membership.update({
        where: { id: existing.id },
        data: { expiresAt },
      });

      // Allowances add up rather than reset: a patient who renews mid-period
      // keeps the visits they have not used.
      for (const benefit of plan.benefits) {
        if (benefit.quota === null || benefit.serviceType === null) continue;
        await tx.membershipEntitlement.updateMany({
          where: { membershipId: existing.id, serviceType: benefit.serviceType },
          data: { quota: { increment: benefit.quota } },
        });
      }

      await notifyMembership(tx, params.userId, plan.name, expiresAt, true);

      return {
        membership: await tx.membership.findUniqueOrThrow({
          where: { id: existing.id },
          include: MEMBERSHIP_INCLUDE,
        }),
        walletBalance: wallet?.balance ?? null,
        renewed: true,
      };
    }

    // ── First purchase ────────────────────────────────────────────────────
    const expiresAt = addDays(now, plan.durationDays);

    const membership = await tx.membership.create({
      data: {
        userId: params.userId,
        planId: plan.id,
        // Snapshots — see rule 1. Read back through `plan` and an admin's price
        // edit would silently rewrite what this patient was sold.
        planName: plan.name,
        // What was actually PAID — zero for a grant, so revenue reports count
        // money received and not the list price of memberships given away.
        pricePaid: granted ? new D(0) : plan.price,
        discountPercent: plan.discountPercent,
        startsAt: now,
        expiresAt,
        status: "ACTIVE",
        transactionId: wallet?.transactionId ?? null,
        entitlements: {
          create: plan.benefits.map((benefit) => ({
            serviceType: benefit.serviceType,
            label: benefit.label,
            quota: benefit.quota,
            state: benefit.state,
            sortOrder: benefit.sortOrder,
          })),
        },
      },
      include: MEMBERSHIP_INCLUDE,
    });

    await notifyMembership(tx, params.userId, plan.name, expiresAt, false);

    return { membership, walletBalance: wallet?.balance ?? null, renewed: false };
  }, TX_OPTIONS);
}

function notifyMembership(
  tx: Prisma.TransactionClient,
  userId: string,
  planName: string,
  expiresAt: Date,
  renewed: boolean
) {
  return tx.notification.create({
    data: {
      userId,
      title: renewed ? "تم تجديد عضويتك" : "تم تفعيل عضويتك",
      body: `${planName} — سارية حتى ${formatDay(expiresAt)}`,
      type: "membership",
    },
  });
}

/** `2026-09-13`. Rendering belongs to the client; this is for a stored string. */
function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * End a membership NOW, on the owner's decision — with or without money back.
 *
 * Replaces a patient-side `cancelMembership` that was never called and whose
 * own comment contradicted what it did: it promised the patient kept their
 * benefits until the period lapsed, but set `status: CANCELLED`, which
 * `activeMembershipFor` stops honouring immediately. Memberships here do not
 * auto-renew — each period is bought out of the wallet — so there is no
 * renewal to cancel, and the only real operation is this one.
 *
 * The refund, when given, goes back to the WALLET the membership was paid
 * from, in the same transaction as the termination. It is capped at what the
 * patient actually paid: a comp membership (pricePaid 0) cannot be "refunded"
 * into money the platform never received.
 *
 * @throws {MembershipError} no such live membership, or refund above the price
 */
export async function terminateMembership(params: {
  membershipId: string;
  adminId: string;
  reason: string;
  refundAmount?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: params.membershipId, status: "ACTIVE" },
      select: { id: true, userId: true, planName: true, pricePaid: true, expiresAt: true },
    });
    if (!membership) {
      throw new MembershipError("PLAN_NOT_FOUND", "العضوية غير موجودة أو منتهية مسبقاً");
    }

    const refund = new D(params.refundAmount ?? 0);
    if (refund.lt(0) || refund.gt(membership.pricePaid)) {
      throw new MembershipError(
        "REFUND_TOO_LARGE",
        `الاسترداد لا يتجاوز المبلغ المدفوع (${membership.pricePaid.toString()} د.ع)`
      );
    }

    const now = new Date();
    const updated = await tx.membership.update({
      where: { id: membership.id },
      // `expiresAt` moves to now as well as the status: the date is what every
      // reader filters on, so the two cannot be allowed to disagree.
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        expiresAt: membership.expiresAt < now ? membership.expiresAt : now,
      },
      include: MEMBERSHIP_INCLUDE,
    });

    if (refund.gt(0)) {
      await creditWallet(
        {
          userId: membership.userId,
          amount: refund,
          reason: "REFUND",
          description: `استرداد عضوية ${membership.planName}`,
        },
        tx
      );
    }

    await tx.activityLog.create({
      data: {
        userId: params.adminId,
        action: `إنهاء عضوية — ${membership.planName}`,
        entityType: "membership",
        entityId: membership.id,
        details: { reason: params.reason, refund: refund.toString(), patientId: membership.userId },
      },
    });

    await tx.notification.create({
      data: {
        userId: membership.userId,
        title: "تم إنهاء عضويتك",
        body:
          refund.gt(0)
            ? `${membership.planName} — أُعيد ${refund.toString()} د.ع إلى محفظتك`
            : membership.planName,
        type: "membership",
      },
    });

    return { membership: updated, refunded: refund };
  }, TX_OPTIONS);
}

/* -------------------------------- spending -------------------------------- */

export type ConsumeResult =
  | { consumed: true; remaining: number | null }
  | { consumed: false; reason: "no_membership" | "not_covered" | "exhausted" };

/**
 * Spend one use of a service against the patient's membership.
 *
 * The guard is in the WHERE clause — `used < quota` — so two bookings placed at
 * the same instant cannot both spend the last visit. An unlimited entitlement
 * (`quota: null`) still increments, because "how many times was this used" is
 * worth knowing even where it is not capped.
 *
 * Returns rather than throws: a patient with no membership, or one whose
 * package does not cover radiology, is booking normally at full price — an
 * ordinary outcome, not an error.
 */
export async function consumeEntitlement(params: {
  userId: string;
  serviceType: ServiceType;
  at?: Date;
}): Promise<ConsumeResult> {
  const membership = await activeMembershipFor(params.userId, params.at ?? new Date());
  if (!membership) return { consumed: false, reason: "no_membership" };

  const entitlement = membership.entitlements.find(
    (e) => e.serviceType === params.serviceType
  );
  if (!entitlement || entitlement.state !== "AVAILABLE") {
    return { consumed: false, reason: "not_covered" };
  }

  const { count } = await prisma.membershipEntitlement.updateMany({
    where: {
      id: entitlement.id,
      // `quota: null` is unlimited, so it has no ceiling to test against.
      ...(entitlement.quota === null ? {} : { used: { lt: entitlement.quota } }),
    },
    data: { used: { increment: 1 } },
  });

  if (count === 0) return { consumed: false, reason: "exhausted" };

  return {
    consumed: true,
    remaining: entitlement.quota === null ? null : entitlement.quota - entitlement.used - 1,
  };
}

/* --------------------------------- shared --------------------------------- */

/**
 * Add whole days without drifting across a DST change.
 *
 * Baghdad has no DST, but `setDate` on a Date is the idiom that breaks
 * elsewhere, and a membership's last day is a commercial promise.
 */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export { InsufficientBalance };
