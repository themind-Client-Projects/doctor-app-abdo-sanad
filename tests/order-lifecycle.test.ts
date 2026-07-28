import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { CommissionError, reverseSettlement, settleOrder } from "@/server/services/commission";
import {
  OrderError,
  TIMELINE_STEPS,
  advanceOrder,
  completeOrder,
  getTimeline,
  priceOrder,
} from "@/server/services/orders";

const D = Prisma.Decimal;

/**
 * These run against the dev database and clean up after themselves.
 * `fileParallelism: false` in vitest.config.ts keeps them from racing.
 */

let labId: string;
let nurseId: string;
let driverId: string;
const createdOrderIds: string[] = [];

async function makeOrder(status: Prisma.OrderCreateInput["status"] = "NEW") {
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      patientId: "test-patient",
      patientName: "اختبار",
      patientPhone: "9647700000000",
      serviceType: "HOME_LAB_TEST",
      status,
      source: "DIRECT",
      assignedLabId: labId,
      assignedNurseId: nurseId,
      assignedDriverId: driverId,
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

beforeAll(async () => {
  const rule = await prisma.commissionRule.findFirst({
    where: { serviceType: "HOME_LAB_TEST" },
    include: { contract: { select: { partnerId: true } } },
  });
  if (!rule) throw new Error("seed missing a HOME_LAB_TEST commission rule");
  labId = rule.contract.partnerId;

  const nurse = await prisma.partner.findFirst({ where: { type: "NURSE" }, select: { id: true } });
  const driver = await prisma.partner.findFirst({ where: { type: "DRIVER" }, select: { id: true } });
  if (!nurse || !driver) throw new Error("seed missing a NURSE or DRIVER partner");
  nurseId = nurse.id;
  driverId = driver.id;
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.orderSettlement.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.couponRedemption.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.$disconnect();
});

describe("pricing", () => {
  it("stores a positive total on an unpriced order", async () => {
    const order = await makeOrder();
    expect(order.totalAmount).toBeNull();

    const { quote } = await priceOrder({ orderId: order.id });
    expect(quote.totalAmount.greaterThan(0)).toBe(true);

    const priced = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(priced.totalAmount!.equals(quote.totalAmount)).toBe(true);
  });

  it("refuses to price an order with no provider assigned", async () => {
    // Regression guard: pricing without a provider skipped the contract floor
    // entirely, so a coupon could cut below the contractual minimum.
    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-NOPROV-${Date.now()}`,
        patientId: "test-patient",
        patientName: "اختبار",
        patientPhone: "9647700000001",
        serviceType: "HOME_LAB_TEST",
        status: "NEW",
        source: "DIRECT",
      },
    });
    createdOrderIds.push(order.id);

    await expect(priceOrder({ orderId: order.id })).rejects.toThrowError(OrderError);
  });

  it("refuses to re-price an order that has already been settled", async () => {
    // Regression guard: re-pricing left Order.totalAmount and
    // OrderSettlement.totalAmount permanently disagreeing.
    const order = await makeOrder();
    await priceOrder({ orderId: order.id });
    for (const s of TIMELINE_STEPS) {
      await advanceOrder({ orderId: order.id, stepCode: s.code });
    }
    await settleOrder(order.id);

    await expect(priceOrder({ orderId: order.id })).rejects.toThrowError(/تسويته/);
  });
});

describe("lifecycle", () => {
  it("rejects a jump straight to COMPLETED", async () => {
    const order = await makeOrder();
    await priceOrder({ orderId: order.id });
    await expect(completeOrder({ orderId: order.id })).rejects.toThrowError(OrderError);
  });

  it("rejects a step recorded out of order", async () => {
    const order = await makeOrder();
    await expect(
      advanceOrder({ orderId: order.id, stepCode: "ARRIVED" })
    ).rejects.toThrowError(/الخطوات السابقة/);
  });

  it("rejects re-recording a completed step", async () => {
    const order = await makeOrder();
    await advanceOrder({ orderId: order.id, stepCode: "CREATED" });
    await expect(
      advanceOrder({ orderId: order.id, stepCode: "CREATED" })
    ).rejects.toThrowError(OrderError);
  });

  it("walks all 11 steps, completes, and settles", async () => {
    const order = await makeOrder();
    const { quote } = await priceOrder({ orderId: order.id });

    for (const s of TIMELINE_STEPS.slice(0, 10)) {
      await advanceOrder({ orderId: order.id, stepCode: s.code });
    }

    const result = await completeOrder({ orderId: order.id });
    expect(result.order.status).toBe("COMPLETED");
    expect(result.settlement).not.toBeNull();

    const total = (result.settlement?.shares ?? []).reduce(
      (acc, s) => acc.plus(s.amount),
      new D(0)
    );
    expect(total.equals(quote.totalAmount)).toBe(true);

    const timeline = await getTimeline(order.id);
    expect(timeline).toHaveLength(11);
    expect(timeline.every((t) => t.completed)).toBe(true);
  });
});

describe("settlement", () => {
  async function settledOrder() {
    const order = await makeOrder();
    await priceOrder({ orderId: order.id });
    for (const s of TIMELINE_STEPS) {
      await advanceOrder({ orderId: order.id, stepCode: s.code });
    }
    return order;
  }

  it("credits the provider's wallet and records the platform share", async () => {
    const order = await settledOrder();
    const before = await prisma.wallet.findUnique({ where: { partnerId: labId } });
    const beforeBalance = before?.balance ?? new D(0);

    const settlement = await settleOrder(order.id);

    const warid = settlement.shares.find((s) => s.party === "WARID");
    expect(warid).toBeDefined();
    // The platform is not a Partner and has no wallet row.
    expect(warid!.partnerId).toBeNull();

    const after = await prisma.wallet.findUniqueOrThrow({ where: { partnerId: labId } });
    const partnerShare = settlement.shares.find((s) => s.party === "PARTNER")!;
    expect(after.balance.minus(beforeBalance).equals(partnerShare.amount)).toBe(true);
  });

  it("refuses to settle the same order twice", async () => {
    const order = await settledOrder();
    await settleOrder(order.id);
    await expect(settleOrder(order.id)).rejects.toThrowError(CommissionError);
  });

  it("refuses to settle an order that is not completed", async () => {
    const order = await makeOrder();
    await priceOrder({ orderId: order.id });
    await expect(settleOrder(order.id)).rejects.toThrowError(/غير مكتمل/);
  });

  it("restores the exact balance on reversal", async () => {
    const order = await settledOrder();
    const before = await prisma.wallet.findUnique({ where: { partnerId: labId } });
    const beforeBalance = before?.balance ?? new D(0);

    await settleOrder(order.id);
    const reversed = await reverseSettlement(order.id);
    expect(reversed.status).toBe("REVERSED");

    const after = await prisma.wallet.findUniqueOrThrow({ where: { partnerId: labId } });
    expect(after.balance.equals(beforeBalance)).toBe(true);
  });

  it("refuses to reverse the same settlement twice", async () => {
    // Regression guard: the status check read outside the transaction with no
    // unique constraint behind it, so a double-click debited the wallet twice.
    const order = await settledOrder();
    await settleOrder(order.id);
    await reverseSettlement(order.id);
    await expect(reverseSettlement(order.id)).rejects.toThrowError(CommissionError);
  });

  it("allows re-settlement after a reversal", async () => {
    // Regression guard: a reversed settlement used to block the order forever,
    // because orderId is unique and status was never inspected.
    const order = await settledOrder();
    await settleOrder(order.id);
    await reverseSettlement(order.id);

    const resettled = await settleOrder(order.id);
    expect(resettled.status).toBe("SETTLED");
  });
});
