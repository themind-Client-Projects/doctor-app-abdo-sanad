import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { CommissionError, settleOrder } from "@/server/services/commission";

/**
 * Money in before money out.
 *
 * Settlement credits every partner's wallet with their share. It never asked
 * whether any money had arrived: `paymentStatus` was not even selected, so a
 * COMPLETED order paid out on its status alone. `paymentMethod` defaults to
 * CASH, the call-centre form defaults to it too, and the only writer of `PAID`
 * in the codebase is `payOrderFromWallet` — so a cash order could never be
 * marked collected and still paid commission. Nine of the sixty-three
 * settlements in the development database had already gone out that way.
 *
 * This is the guard, pinned. It is deliberately a REFUSAL rather than a
 * silent skip: `completeOrder` catches it into `settlementError`, so the order
 * still completes and the retry is `POST /api/orders/[id]/settle` once the
 * cash is recorded.
 */

const created: string[] = [];

afterAll(async () => {
  if (created.length) {
    await prisma.orderSettlement.deleteMany({ where: { orderId: { in: created } } });
    await prisma.order.deleteMany({ where: { id: { in: created } } });
  }
});

async function orderWith(paymentStatus: "PAID" | "PENDING") {
  // Any partner will do — the guard runs before provider resolution.
  const lab = await prisma.partner.findFirst({
    where: { type: "LAB", deletedAt: null },
    select: { id: true },
  });
  if (!lab) return null;

  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-GUARD-${Date.now()}-${paymentStatus}`,
      patientId: "test-patient",
      patientName: "اختبار الدفع",
      patientPhone: "9647700000009",
      serviceType: "HOME_LAB_TEST",
      status: "COMPLETED",
      source: "DIRECT",
      paymentMethod: "CASH",
      paymentStatus,
      totalAmount: 20000,
      assignedLabId: lab.id,
    },
    select: { id: true },
  });
  created.push(order.id);
  return order;
}

describe("settlement refuses an order whose money never arrived", () => {
  it("throws ORDER_NOT_PAID for a completed CASH order still PENDING", async () => {
    const order = await orderWith("PENDING");
    if (!order) {
      console.warn("SKIP: no LAB fixture");
      return;
    }

    await expect(settleOrder(order.id)).rejects.toThrowError(CommissionError);
    await expect(settleOrder(order.id)).rejects.toMatchObject({ code: "ORDER_NOT_PAID" });

    // And nothing was written — no wallet was credited on the way to the throw.
    const settlement = await prisma.orderSettlement.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });
    expect(settlement).toBeNull();
  });

  it("still settles the same order once it is marked collected", async () => {
    const order = await orderWith("PENDING");
    if (!order) {
      console.warn("SKIP: no LAB fixture");
      return;
    }
    await expect(settleOrder(order.id)).rejects.toMatchObject({ code: "ORDER_NOT_PAID" });

    // The retry path: cash recorded, then settle.
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID" },
    });

    // It either settles, or fails for a reason that is NOT payment — a missing
    // contract for this lab is a different defect and must not be read as the
    // guard still firing.
    try {
      const settlement = await settleOrder(order.id);
      expect(settlement.shares.length).toBeGreaterThan(0);
    } catch (e) {
      expect(e).toBeInstanceOf(CommissionError);
      expect((e as CommissionError).code).not.toBe("ORDER_NOT_PAID");
    }
  });
});
