import { Prisma, type PrismaClient, type ServiceType, type OrderStatus } from "@prisma/client";
import { computeSplit, type ShareInput } from "../src/server/services/commission";

/**
 * Operational seed data — orders, settlements, feedback and activity.
 *
 * The dashboards read aggregates: revenue over the last 7 days, revenue split
 * by service, orders by status, top partners by revenue, the platform's own
 * cut, customer satisfaction. None of that can come from 8 orders all created
 * at the same instant with no amount and no settlement, so the charts would
 * have had nothing real to show.
 *
 * Two rules this module holds to:
 *
 *  1. **Deterministic.** No Math.random, no Date.now in identifiers. Re-running
 *     the seed produces the same rows, so it is idempotent by construction
 *     rather than by luck.
 *  2. **Consistent with the engine.** Splits are computed with the real
 *     `computeSplit`, so seeded money obeys the same conservation rule as money
 *     created through the API. A seed that fakes its arithmetic would make the
 *     dashboards agree with nothing.
 */

const D = Prisma.Decimal;

/** Days of history to generate. The revenue chart shows 7; 14 gives it context. */
const HISTORY_DAYS = 14;

/**
 * Deterministic pseudo-randomness.
 *
 * A mulberry32 PRNG seeded from a constant: varied-looking data that is
 * identical on every run, which `Math.random()` could never be.
 */
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export type SeedPartners = {
  doctor1: string;
  doctor2: string;
  lab: string;
  pharmacy: string;
  nurse1: string;
  nurse2: string;
  driver1: string;
  driver2: string;
  radiology: string;
  complexOwner: string;
};

/**
 * Only these four services have a CommissionRule, so only they can be settled.
 * Each lists the partner slots the rule requires — a rule that allocates a
 * nurse share cannot settle on an order with no nurse, by design.
 */
const SETTLEABLE: {
  serviceType: ServiceType;
  provider: keyof SeedPartners;
  nurse?: keyof SeedPartners;
  driver?: keyof SeedPartners;
}[] = [
  { serviceType: "IN_PERSON_CONSULT", provider: "doctor1" },
  { serviceType: "ONLINE_CONSULT", provider: "doctor1" },
  { serviceType: "HOME_LAB_TEST", provider: "lab", nurse: "nurse1", driver: "driver1" },
  { serviceType: "MEDICINE_DELIVERY", provider: "pharmacy", driver: "driver2" },
];

/** Extra services for status variety — priced, but with no rule to settle by. */
const UNSETTLEABLE: { serviceType: ServiceType; provider: keyof SeedPartners }[] = [
  { serviceType: "HOME_VISIT", provider: "doctor2" },
  { serviceType: "RADIOLOGY", provider: "radiology" },
  { serviceType: "HOME_BLOOD_DRAW", provider: "lab" },
];

const OPEN_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "ASSIGNED", "IN_PROGRESS", "DELAYED"];

/**
 * Which order column each seeded provider belongs in.
 *
 * Derived from WHO the provider is, never from the service. The old mapping
 * switched on `serviceType` with a `default:` of `assignedNurseId`, so every
 * consultation and home visit — all provided by doctors — was written into the
 * nurse slot: 44 orders in which a DOCTOR sat in `assignedNurseId`. The assign
 * endpoint refuses that combination outright (`partner.type !== slot.partnerType`),
 * so the seed was creating data the API itself would reject.
 */
const PROVIDER_COLUMN = {
  doctor1: "assignedDoctorId",
  doctor2: "assignedDoctorId",
  complexOwner: "assignedDoctorId",
  lab: "assignedLabId",
  pharmacy: "assignedPharmacyId",
  radiology: "assignedRadiologyId",
  nurse1: "assignedNurseId",
  nurse2: "assignedNurseId",
  driver1: "assignedDriverId",
  driver2: "assignedDriverId",
} as const satisfies Record<keyof SeedPartners, string>;

export async function seedOperationalData(
  prisma: PrismaClient,
  ctx: { partners: SeedPartners; patientIds: string[]; governorateId: string; adminUserId: string }
) {
  const rng = makeRng(20260729);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const prices = new Map<ServiceType, Prisma.Decimal>();
  for (const p of await prisma.priceConfig.findMany()) prices.set(p.serviceType, p.basePrice);

  // Wipe previously seeded operational rows so a re-run replaces rather than
  // accumulates. Scoped to the `seed-` id prefix, so anything created through
  // the app is left alone.
  const priorOrderIds = (
    await prisma.order.findMany({ where: { id: { startsWith: "seed-ord-" } }, select: { id: true } })
  ).map((o) => o.id);

  if (priorOrderIds.length) {
    await prisma.transaction.deleteMany({ where: { orderId: { in: priorOrderIds } } });
    await prisma.settlementShare.deleteMany({
      where: { settlement: { orderId: { in: priorOrderIds } } },
    });
    await prisma.orderSettlement.deleteMany({ where: { orderId: { in: priorOrderIds } } });
    await prisma.patientFeedback.deleteMany({ where: { orderId: { in: priorOrderIds } } });
    await prisma.orderTimeline.deleteMany({ where: { orderId: { in: priorOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: priorOrderIds } } });
  }

  type Built = {
    id: string;
    createdAt: Date;
    serviceType: ServiceType;
    status: OrderStatus;
    total: Prisma.Decimal;
    providerId: string;
    providerColumn: (typeof PROVIDER_COLUMN)[keyof SeedPartners];
    nurseId?: string;
    driverId?: string;
    settle: boolean;
  };

  const built: Built[] = [];
  let n = 0;

  for (let day = HISTORY_DAYS - 1; day >= 0; day--) {
    const createdBase = new Date(today);
    createdBase.setDate(createdBase.getDate() - day);

    // Volume rises toward the present, so the trend line has a shape rather
    // than being flat noise.
    const volume = 4 + Math.floor(rng() * 5) + Math.floor((HISTORY_DAYS - day) / 4);

    for (let i = 0; i < volume; i++) {
      const createdAt = new Date(createdBase);
      createdAt.setHours(8 + Math.floor(rng() * 11), Math.floor(rng() * 60), 0, 0);

      // Older orders are mostly finished; today's are mostly still moving.
      const settleable = rng() > 0.25;
      const spec = settleable ? pick(rng, SETTLEABLE) : pick(rng, UNSETTLEABLE);
      const finished = settleable && day >= 1 && rng() > 0.2;

      const status: OrderStatus = finished
        ? "COMPLETED"
        : rng() > 0.94
          ? "CANCELLED"
          : pick(rng, OPEN_STATUSES);

      const base = prices.get(spec.serviceType) ?? new D(20000);
      // A little price dispersion, still deterministic.
      const total = base.times(new D(90 + Math.floor(rng() * 25))).dividedBy(100)
        .toDecimalPlaces(3, D.ROUND_DOWN);

      built.push({
        id: `seed-ord-${String(++n).padStart(4, "0")}`,
        createdAt,
        serviceType: spec.serviceType,
        status,
        total,
        providerId: ctx.partners[spec.provider as keyof SeedPartners],
        providerColumn: PROVIDER_COLUMN[spec.provider as keyof SeedPartners],
        nurseId: "nurse" in spec && spec.nurse ? ctx.partners[spec.nurse as keyof SeedPartners] : undefined,
        driverId: "driver" in spec && spec.driver ? ctx.partners[spec.driver as keyof SeedPartners] : undefined,
        settle: status === "COMPLETED",
      });
    }
  }

  // ── orders ──────────────────────────────────────────────────────────────
  const providerColumn = (b: Built) => ({ [b.providerColumn]: b.providerId });

  await prisma.order.createMany({
    data: built.map((b, idx) => ({
      id: b.id,
      orderNumber: `WR-${b.id.slice(-4)}`,
      patientId: ctx.patientIds[idx % ctx.patientIds.length],
      patientName: `مريض ${idx + 1}`,
      patientPhone: `96477${String(10000000 + idx).slice(0, 8)}`,
      serviceType: b.serviceType,
      status: b.status,
      source: idx % 3 === 0 ? "SANAD" : idx % 3 === 1 ? "COMPLEX" : "DIRECT",
      priority: idx % 11 === 0 ? "URGENT" : idx % 23 === 0 ? "CRITICAL" : "NORMAL",
      paymentStatus: b.status === "COMPLETED" ? "PAID" : "PENDING",
      paymentMethod: idx % 2 === 0 ? "CASH" : "WALLET",
      governorateId: ctx.governorateId,
      subtotal: b.total,
      discountTotal: new D(0),
      totalAmount: b.total,
      currency: "IQD",
      createdAt: b.createdAt,
      ...providerColumn(b),
      ...(b.nurseId && b.serviceType === "HOME_LAB_TEST" ? { assignedNurseId: b.nurseId } : {}),
      ...(b.driverId ? { assignedDriverId: b.driverId } : {}),
    })),
    skipDuplicates: true,
  });

  // ── timelines ───────────────────────────────────────────────────────────
  const STEPS = [
    "تم إنشاء الطلب", "تم قبول الطلب", "تم تعيين منفذ الخدمة", "تم التواصل",
    "في الطريق", "تم الوصول", "بدأ التنفيذ", "تم إنهاء الخدمة",
    "تم رفع النتائج", "تم إشعار المريض", "اكتمل الطلب",
  ];
  const stepsFor = (s: OrderStatus) =>
    s === "COMPLETED" ? 11 : s === "CANCELLED" ? 2 : 2 + Math.floor(rng() * 7);

  await prisma.orderTimeline.createMany({
    data: built.flatMap((b) =>
      Array.from({ length: stepsFor(b.status) }, (_, i) => ({
        orderId: b.id,
        step: i + 1,
        title: STEPS[i],
        completedAt: new Date(b.createdAt.getTime() + i * 15 * 60 * 1000),
      }))
    ),
    skipDuplicates: true,
  });

  // ── settlements, using the real split arithmetic ────────────────────────
  const rules = new Map(
    (await prisma.commissionRule.findMany()).map((r) => [r.serviceType, r])
  );
  const complexByPartner = new Map(
    (await prisma.partner.findMany({ select: { id: true, complexId: true } })).map((p) => [
      p.id,
      p.complexId,
    ])
  );
  const wallets = new Map(
    (await prisma.wallet.findMany({ select: { id: true, partnerId: true } })).map((w) => [
      w.partnerId,
      w.id,
    ])
  );

  const settlementRows: Prisma.OrderSettlementCreateManyInput[] = [];
  const shareRows: Prisma.SettlementShareCreateManyInput[] = [];
  const txRows: Prisma.TransactionCreateManyInput[] = [];
  const walletTotals = new Map<string, Prisma.Decimal>();

  for (const b of built.filter((x) => x.settle)) {
    const rule = rules.get(b.serviceType);
    if (!rule) continue;

    const shares: ShareInput[] = [
      { party: "PARTNER", partnerId: b.providerId, percentage: rule.partnerShare },
      { party: "WARID", partnerId: null, percentage: rule.waridShare },
    ];
    if (rule.complexShare.greaterThan(0)) {
      const complexId = complexByPartner.get(b.providerId) ?? null;
      if (!complexId) continue; // the engine would refuse this too
      shares.push({ party: "COMPLEX", partnerId: complexId, percentage: rule.complexShare });
    }
    if (rule.nurseShare.greaterThan(0)) {
      if (!b.nurseId) continue;
      shares.push({ party: "NURSE", partnerId: b.nurseId, percentage: rule.nurseShare });
    }
    if (rule.driverShare.greaterThan(0)) {
      if (!b.driverId) continue;
      shares.push({ party: "DRIVER", partnerId: b.driverId, percentage: rule.driverShare });
    }

    let computed;
    try {
      computed = computeSplit(b.total, shares);
    } catch {
      continue; // shares don't total 100 — skip rather than write bad money
    }

    const settlementId = `seed-stl-${b.id.slice(-4)}`;
    settlementRows.push({
      id: settlementId,
      orderId: b.id,
      totalAmount: b.total,
      currency: "IQD",
      commissionRuleId: rule.id,
      status: "SETTLED",
      settledAt: b.createdAt,
      createdAt: b.createdAt,
    });

    computed.forEach((s, i) => {
      const walletId = s.partnerId ? wallets.get(s.partnerId) : null;
      const txId = walletId ? `seed-tx-${b.id.slice(-4)}-${i}` : null;

      if (walletId && txId) {
        txRows.push({
          id: txId,
          walletId,
          orderId: b.id,
          amount: s.amount,
          type: "CREDIT",
          description: `تسوية الطلب — ${s.party}`,
          createdAt: b.createdAt,
        });
        walletTotals.set(walletId, (walletTotals.get(walletId) ?? new D(0)).plus(s.amount));
      }

      shareRows.push({
        id: `seed-shr-${b.id.slice(-4)}-${i}`,
        settlementId,
        party: s.party,
        partnerId: s.partnerId,
        percentage: s.percentage,
        amount: s.amount,
        transactionId: txId,
        createdAt: b.createdAt,
      });
    });
  }

  await prisma.orderSettlement.createMany({ data: settlementRows, skipDuplicates: true });
  await prisma.settlementShare.createMany({ data: shareRows, skipDuplicates: true });
  await prisma.transaction.createMany({ data: txRows, skipDuplicates: true });

  // Balances are derived from the LEDGER, not from the credits this function
  // happens to have written.
  //
  // Setting `balance` to the sum of our own credits ignored everything else in
  // the wallet: an opening entry, and — the case that actually broke — the
  // DEBIT rows a settlement reversal writes. Five wallets ended up holding more
  // than their transactions could account for, overstated by exactly the sum of
  // the reversals. `balance == sum(transactions)` is the invariant the whole
  // money model rests on, so it is computed from the transactions.
  for (const walletId of Array.from(walletTotals.keys())) {
    const [credits, debits] = await Promise.all([
      prisma.transaction.aggregate({ where: { walletId, type: "CREDIT" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { walletId, type: "DEBIT" }, _sum: { amount: true } }),
    ]);
    const balance = new D(credits._sum.amount ?? 0).minus(new D(debits._sum.amount ?? 0));
    await prisma.wallet.update({
      where: { id: walletId },
      // `totalEarnings` is lifetime gross — reversals do not un-earn it.
      data: { balance, totalEarnings: new D(credits._sum.amount ?? 0) },
    });
  }

  // ── satisfaction ────────────────────────────────────────────────────────
  const completed = built.filter((b) => b.status === "COMPLETED");
  await prisma.patientFeedback.createMany({
    data: completed.slice(0, Math.floor(completed.length * 0.7)).map((b, i) => ({
      id: `seed-fb-${b.id.slice(-4)}`,
      orderId: b.id,
      // The patient who PLACED this order — the same index the order rows use.
      // This read `patientIds[i % n]` with `i` counted over the completed subset,
      // so a rating was credited to a different patient than the one served:
      // "patient 3 rated patient 7's lab test".
      patientId: ctx.patientIds[built.indexOf(b) % ctx.patientIds.length],
      // Skewed high, with a realistic tail — a flat 5.0 average would tell the
      // dashboard nothing.
      rating: [5, 5, 5, 4, 4, 4, 3, 5, 4, 2][i % 10],
      comment: i % 4 === 0 ? "خدمة ممتازة وسريعة" : null,
      createdAt: b.createdAt,
    })),
    skipDuplicates: true,
  });

  // ── partner status variety, so the status breakdown is not one bar ──────
  const allPartners = await prisma.partner.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  const statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "PENDING", "PAUSED", "SUSPENDED"] as const;
  for (const [i, p] of Array.from(allPartners.entries())) {
    await prisma.partner.update({
      where: { id: p.id },
      data: { status: statuses[i % statuses.length] },
    });
  }

  return {
    orders: built.length,
    settlements: settlementRows.length,
    shares: shareRows.length,
    transactions: txRows.length,
    completed: completed.length,
  };
}
