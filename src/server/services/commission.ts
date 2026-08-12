import { Prisma, type ServiceType, type SettlementParty } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The commission engine — "محرك النسب", the platform's core financial rule.
 *
 * Every order's revenue is split between the service provider, optionally a
 * medical complex, the nurse and driver who executed it, and Warid. The
 * percentages live on the partner's contract, never in code: the requirement
 * is explicit that they are per-contract and must be editable.
 *
 * Two properties this module guarantees:
 *
 *  1. **Shares sum to exactly the order total.** Percentages rarely divide
 *     cleanly, so the remainder is assigned deterministically rather than
 *     dropped — otherwise every order would create or destroy a fraction of a
 *     dinar and the books would never balance.
 *  2. **A settlement is recorded, not derived.** CommissionRule is editable,
 *     so recomputing historical orders on read would silently re-split them at
 *     today's percentages.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/** IQD has 3 subunits, matching Decimal(18,3) in the schema. */
const MONEY_DP = 3;

/**
 * Settlement touches one wallet, one Transaction and one share per party, so a
 * 4-way split is well over a dozen sequential round-trips. Prisma's 5s default
 * interactive-transaction timeout is not enough against a remote pooler, and a
 * timeout here means settlement can never succeed at all.
 */
const MONEY_TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

export class CommissionError extends Error {
  constructor(
    readonly code:
      | "NO_CONTRACT"
      | "NO_RULE"
      | "SHARES_INVALID"
      | "ORDER_NOT_COMPLETED"
      | "NO_AMOUNT"
      | "ALREADY_SETTLED"
      | "NOT_SETTLED"
      | "PARTY_UNASSIGNED"
      | "PROVIDER_ALSO_PARTY",
    message: string
  ) {
    super(message);
    this.name = "CommissionError";
  }
}

export type ShareInput = {
  party: SettlementParty;
  partnerId: string | null;
  percentage: Decimal;
};

export type ComputedShare = ShareInput & { amount: Decimal };

/**
 * Split `total` across `shares` so the parts sum to exactly `total`.
 *
 * Each share is rounded down, then the leftover minor units are handed to
 * Warid — the platform absorbs rounding rather than a partner silently losing
 * or gaining money on every order.
 */
export function computeSplit(total: Decimal, shares: ShareInput[]): ComputedShare[] {
  const sum = shares.reduce((acc, s) => acc.plus(s.percentage), new D(0));
  if (!sum.equals(100)) {
    throw new CommissionError(
      "SHARES_INVALID",
      `مجموع النسب يجب أن يساوي 100% (الحالي: ${sum.toString()}%)`
    );
  }

  const computed = shares.map((s) => ({
    ...s,
    amount: total.times(s.percentage).dividedBy(100).toDecimalPlaces(MONEY_DP, D.ROUND_DOWN),
  }));

  const allocated = computed.reduce((acc, s) => acc.plus(s.amount), new D(0));
  const remainder = total.minus(allocated);

  if (!remainder.isZero()) {
    const platform = computed.find((s) => s.party === "WARID");
    // Refuse to guess. Falling back to `computed[0]` silently handed the
    // rounding remainder to the partner, which is a (tiny) systematic overpay
    // and an easy thing to never notice.
    if (!platform) {
      throw new CommissionError(
        "SHARES_INVALID",
        "لا يمكن توزيع الكسور بدون حصة للمنصة"
      );
    }
    platform.amount = platform.amount.plus(remainder);
  }

  return computed;
}

/**
 * Find the commission rule governing a service for a partner, AT A GIVEN TIME.
 *
 * `at` is the moment whose rate applies — the order's creation date, not the
 * day it happens to be settled. Rules are versioned, so an order placed in
 * January and completed in March is paid at January's rate; resolving "the
 * current rule" instead silently re-priced every delivered-but-unsettled order
 * the moment an admin edited a percentage.
 *
 * @throws {CommissionError} when the partner has no active contract, or no
 *   version of a rule for this service was in force at `at`.
 */
export async function resolveCommissionRule(
  partnerId: string,
  serviceType: ServiceType,
  at: Date = new Date()
) {
  const contract = await prisma.contract.findUnique({
    where: { partnerId },
    include: {
      commissionRules: {
        where: {
          serviceType,
          effectiveFrom: { lte: at },
          // Open (still in force) or closed after `at`.
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        // Newest applicable version first — a same-instant re-version is still
        // deterministic.
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  if (!contract || !contract.isActive) {
    throw new CommissionError("NO_CONTRACT", "لا يوجد عقد فعّال لهذا الشريك");
  }
  if (contract.endDate < new Date()) {
    throw new CommissionError("NO_CONTRACT", "عقد الشريك منتهي الصلاحية");
  }

  const rule = contract.commissionRules[0];
  if (!rule) {
    throw new CommissionError(
      "NO_RULE",
      "لا توجد قاعدة نسب سارية لهذه الخدمة بتاريخ الطلب"
    );
  }

  return rule;
}

/** Turn a CommissionRule's five columns into the parties that actually apply. */
function ruleToShares(
  rule: {
    partnerShare: Decimal;
    complexShare: Decimal;
    waridShare: Decimal;
    nurseShare: Decimal;
    driverShare: Decimal;
    referralShare: Decimal;
  },
  order: {
    assignedNurseId: string | null;
    assignedDriverId: string | null;
    referringPartnerId: string | null;
  },
  providerId: string,
  complexPartnerId: string | null
): ShareInput[] {
  const shares: ShareInput[] = [
    { party: "PARTNER", partnerId: providerId, percentage: rule.partnerShare },
    { party: "WARID", partnerId: null, percentage: rule.waridShare },
  ];

  // A rule may prescribe a share for a party that is not on this order — a
  // nurse cut on an order with no nurse assigned. Paying it is impossible
  // (there is no wallet), and recording it as distributed while crediting
  // nobody silently loses that percentage: the ledger claims 100% was paid out
  // while the wallets received less. Refuse instead, so the mismatch surfaces
  // as an operator-visible error rather than a slow leak.
  const unassigned: string[] = [];

  if (rule.complexShare.greaterThan(0)) {
    if (!complexPartnerId) unassigned.push("المجمع");
    shares.push({ party: "COMPLEX", partnerId: complexPartnerId, percentage: rule.complexShare });
  }
  if (rule.nurseShare.greaterThan(0)) {
    if (!order.assignedNurseId) unassigned.push("الممرض");
    shares.push({ party: "NURSE", partnerId: order.assignedNurseId, percentage: rule.nurseShare });
  }
  if (rule.driverShare.greaterThan(0)) {
    if (!order.assignedDriverId) unassigned.push("السائق");
    shares.push({ party: "DRIVER", partnerId: order.assignedDriverId, percentage: rule.driverShare });
  }
  // The complex member who sent the patient here. Same rule as every other
  // optional party: a percentage reserved for someone who is not on the order
  // cannot be paid, so it is refused rather than silently lost.
  if (rule.referralShare.greaterThan(0)) {
    if (!order.referringPartnerId) unassigned.push("المُحيل");
    shares.push({
      party: "REFERRER",
      partnerId: order.referringPartnerId,
      percentage: rule.referralShare,
    });
  }

  if (unassigned.length > 0) {
    throw new CommissionError(
      "PARTY_UNASSIGNED",
      `العقد يخصص نسبة لأطراف غير معيّنة على الطلب: ${unassigned.join("، ")}`
    );
  }

  return shares;
}

/**
 * Settle a completed order: compute the split, credit each party's wallet, and
 * record the ledger — all inside one transaction.
 *
 * Idempotent on `orderId`: a second call returns the existing settlement
 * rather than paying everyone twice.
 */
export async function settleOrder(orderId: string, settledById?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      serviceType: true,
      totalAmount: true,
      currency: true,
      assignedNurseId: true,
      assignedDriverId: true,
      assignedLabId: true,
      assignedPharmacyId: true,
      assignedRadiologyId: true,
      assignedDoctorId: true,
      referringPartnerId: true,
      // The rate that applies is the one in force when the order was PLACED.
      createdAt: true,
      orderSettlement: { select: { id: true, status: true } },
    },
  });

  if (!order) throw new CommissionError("NO_AMOUNT", "الطلب غير موجود");
  // Only a LIVE settlement blocks. A reversed one must be re-settlable —
  // a dispute resolved in the partner's favour previously left the order
  // permanently unpayable, because orderId is unique and status was ignored.
  if (order.orderSettlement && order.orderSettlement.status !== "REVERSED") {
    throw new CommissionError("ALREADY_SETTLED", "تمت تسوية هذا الطلب مسبقاً");
  }
  if (order.status !== "COMPLETED") {
    throw new CommissionError(
      "ORDER_NOT_COMPLETED",
      "لا يمكن تسوية طلب غير مكتمل"
    );
  }
  if (!order.totalAmount || order.totalAmount.lessThanOrEqualTo(0)) {
    throw new CommissionError("NO_AMOUNT", "الطلب لا يحتوي على مبلغ قابل للتسوية");
  }

  // The provider is whichever partner slot the service was assigned to.
  //
  // `assignedDoctorId` comes first because a consultation has no other slot:
  // a referred lab test is a SEPARATE order carrying the lab as provider and
  // the referrer only as `referringPartnerId`, so the two never compete here.
  //
  // Before this existed a doctor could not be a provider at all, and the seed
  // worked around it by writing doctors into `assignedNurseId` — 44 orders
  // paid a doctor through a nurse's commission rule.
  const providerId =
    order.assignedDoctorId ??
    order.assignedLabId ??
    order.assignedPharmacyId ??
    order.assignedRadiologyId ??
    order.assignedNurseId ??
    order.assignedDriverId;

  if (!providerId) {
    throw new CommissionError("NO_CONTRACT", "لم يتم تعيين مقدم خدمة لهذا الطلب");
  }

  const rule = await resolveCommissionRule(providerId, order.serviceType, order.createdAt);

  const provider = await prisma.partner.findUnique({
    where: { id: providerId },
    select: { complexId: true },
  });

  const shares = computeSplit(
    order.totalAmount,
    ruleToShares(rule, order, providerId, provider?.complexId ?? null)
  );

  const previousSettlementId = order.orderSettlement?.id ?? null;

  // Pre-resolve wallets outside the transaction. A wallet row holds no money
  // on creation, so it needs no atomicity — and each upsert is a round-trip to
  // a remote pooler that would otherwise run inside the critical section.
  const walletByPartner = new Map<string, string>();
  for (const share of shares) {
    if (!share.partnerId || walletByPartner.has(share.partnerId)) continue;
    const wallet = await prisma.wallet.upsert({
      where: { partnerId: share.partnerId },
      update: {},
      create: { partnerId: share.partnerId },
      select: { id: true },
    });
    walletByPartner.set(share.partnerId, wallet.id);
  }

  return prisma.$transaction(async (tx) => {
    // Re-read inside the transaction: the reads above are three separate
    // round-trips under READ COMMITTED, so the amount could have changed.
    const fresh = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, totalAmount: true },
    });
    if (fresh.status !== "COMPLETED" || !fresh.totalAmount?.equals(order.totalAmount!)) {
      throw new CommissionError("NO_AMOUNT", "تغيّر الطلب أثناء التسوية، أعد المحاولة");
    }

    // A prior reversed settlement is replaced, not duplicated (orderId unique).
    if (previousSettlementId) {
      await tx.settlementShare.deleteMany({ where: { settlementId: previousSettlementId } });
      await tx.orderSettlement.delete({ where: { id: previousSettlementId } });
    }

    const settlement = await tx.orderSettlement.create({
      data: {
        orderId: order.id,
        totalAmount: order.totalAmount!,
        currency: order.currency,
        commissionRuleId: rule.id,
        settledById: settledById ?? null,
      },
    });

    for (const share of shares) {
      let transactionId: string | null = null;

      // WARID has no wallet row (Wallet.partnerId is required and unique, and
      // the platform is not a Partner), so its share is recorded on the ledger
      // only. A nurse/driver share with no assignee is likewise recorded but
      // unpaid, rather than silently vanishing.
      if (share.partnerId) {
        const walletId = walletByPartner.get(share.partnerId)!;

        const txn = await tx.transaction.create({
          data: {
            walletId,
            orderId: order.id,
            amount: share.amount,
            type: "CREDIT",
            description: `تسوية الطلب — ${share.party}`,
          },
        });
        transactionId = txn.id;

        await tx.wallet.update({
          where: { id: walletId },
          data: {
            balance: { increment: share.amount },
            totalEarnings: { increment: share.amount },
          },
        });
      }

      await tx.settlementShare.create({
        data: {
          settlementId: settlement.id,
          party: share.party,
          partnerId: share.partnerId,
          percentage: share.percentage,
          amount: share.amount,
          transactionId,
        },
      });
    }

    // Financial changes must leave a trace — ActivityLog existed but nothing
    // ever wrote to it.
    if (settledById) {
      await tx.activityLog.create({
        data: {
          userId: settledById,
          action: "ORDER_SETTLED",
          entityType: "Order",
          entityId: order.id,
          details: {
            totalAmount: order.totalAmount!.toString(),
            currency: order.currency,
            shares: shares.map((x) => ({ party: x.party, amount: x.amount.toString() })),
          },
        },
      });
    }

    return tx.orderSettlement.findUniqueOrThrow({
      where: { id: settlement.id },
      include: { shares: true },
    });
  }, MONEY_TX_OPTIONS);
}

/**
 * Reverse a settlement (refund/dispute): debit every credited wallet and mark
 * the ledger reversed. The original rows are kept — a reversal is a new entry,
 * never an edit, so the audit trail stays intact.
 */
export async function reverseSettlement(orderId: string, reversedById?: string) {
  const existing = await prisma.orderSettlement.findUnique({
    where: { orderId },
    select: { id: true, status: true },
  });

  if (!existing) throw new CommissionError("NOT_SETTLED", "لا توجد تسوية لهذا الطلب");
  if (existing.status === "REVERSED") {
    throw new CommissionError("NOT_SETTLED", "تم عكس هذه التسوية مسبقاً");
  }

  return prisma.$transaction(async (tx) => {
    // Claim the reversal FIRST, conditionally on it still being SETTLED.
    //
    // The check above reads outside the transaction, and unlike settleOrder
    // there is no unique constraint to backstop it. Two concurrent reversals
    // both passed it and both ran `decrement`, which compiles to
    // `balance = balance - amount` — so a double-click debited the partner
    // twice and could drive the balance negative. `updateMany` + a count check
    // makes the loser a no-op.
    const claimed = await tx.orderSettlement.updateMany({
      where: { id: existing.id, status: "SETTLED" },
      data: { status: "REVERSED", reversedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new CommissionError("NOT_SETTLED", "تم عكس هذه التسوية مسبقاً");
    }

    const settlement = await tx.orderSettlement.findUniqueOrThrow({
      where: { id: existing.id },
      include: { shares: true },
    });

    for (const share of settlement.shares) {
      if (!share.partnerId) continue;

      const wallet = await tx.wallet.findUnique({ where: { partnerId: share.partnerId } });
      // A missing wallet must not be skipped silently: the money was paid and
      // the ledger is about to claim it was clawed back.
      if (!wallet) {
        throw new CommissionError(
          "NOT_SETTLED",
          `لا توجد محفظة للشريك ${share.partnerId} — تعذّر عكس التسوية`
        );
      }

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          orderId,
          amount: share.amount,
          type: "DEBIT",
          description: `عكس تسوية الطلب — ${share.party}`,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: share.amount },
          totalEarnings: { decrement: share.amount },
        },
      });
    }

    if (reversedById) {
      await tx.activityLog.create({
        data: {
          userId: reversedById,
          action: "SETTLEMENT_REVERSED",
          entityType: "Order",
          entityId: orderId,
          details: { totalAmount: settlement.totalAmount.toString() },
        },
      });
    }

    // Status was already flipped when the reversal was claimed above.
    return tx.orderSettlement.findUniqueOrThrow({
      where: { id: settlement.id },
      include: { shares: true },
    });
  }, MONEY_TX_OPTIONS);
}

/** Preview a split without writing anything — powers the admin simulator. */
export async function previewSplit(
  partnerId: string,
  serviceType: ServiceType,
  totalAmount: number | string
) {
  const rule = await resolveCommissionRule(partnerId, serviceType);
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { complexId: true },
  });

  // Synthetic party ids, because this is a SIMULATION of a settled order.
  //
  // Passing nulls made `ruleToShares` throw PARTY_UNASSIGNED for any rule
  // reserving a cut for a nurse, driver or referring doctor — so the admin
  // simulator could not preview the very rules whose split is worth checking.
  // The real settlement still refuses those parties when they are genuinely
  // absent from the order; here they are stand-ins for "whoever fills that
  // role", which is exactly what a preview is asking about.
  const shares = computeSplit(
    new D(totalAmount),
    ruleToShares(
      rule,
      {
        assignedNurseId: "preview-nurse",
        assignedDriverId: "preview-driver",
        referringPartnerId: "preview-referrer",
      },
      partnerId,
      // Same reasoning for the complex: a rule with a complex cut is previewed
      // as though the provider belongs to one.
      partner?.complexId ?? "preview-complex"
    )
  );

  return {
    ruleId: rule.id,
    serviceType,
    totalAmount: new D(totalAmount).toString(),
    shares: shares.map((s) => ({
      party: s.party,
      partnerId: s.partnerId,
      percentage: s.percentage.toString(),
      amount: s.amount.toString(),
    })),
  };
}
