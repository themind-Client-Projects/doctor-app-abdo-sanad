import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";
import { unsettledOrderWhere } from "@/server/services/commission";

/**
 * A reversed settlement leaves the order OWED, and the money is visible.
 *
 * Two bugs met here. `settleOrder` treats a REVERSED settlement as settleable
 * again — correct, a dispute resolved in the partner's favour must be payable
 * — but three separate dues queries asked `orderSettlement: null`, and a
 * reversal deliberately LEAVES its row behind as the audit trail. So the
 * instant a settlement was reversed the order fell out of «المستحقات», out of
 * the partner's own earnings screen, and out of every total: the wallet had
 * been debited and the order was worth nothing to anybody.
 *
 * The development database held exactly one reversed settlement, and the
 * platform dues figure for it read 0 of 0 orders.
 *
 * And there was nowhere to act: retry and reversal both existed as endpoints
 * that nothing in the app ever called, so `GET /api/settlements` is what makes
 * a failed settlement something an operator can see and retry.
 */

const createdOrders: string[] = [];

afterAll(async () => {
  if (createdOrders.length) {
    await prisma.orderSettlement.deleteMany({ where: { orderId: { in: createdOrders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrders } } });
  }
});

function req(url: string, bearer: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "GET",
    headers: { authorization: `Bearer ${bearer}` },
  });
}

async function opsBearer() {
  const u = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "OPERATIONS"] }, deletedAt: null, isActive: true },
    select: { id: true, role: true, partner: { select: { id: true } } },
  });
  if (!u) return null;
  return signAccessToken({
    sub: u.id,
    role: u.role,
    partnerId: u.partner?.id ?? null,
    doctorProfileId: null,
  });
}

/** A completed, priced, PAID order carrying a settlement in the given status. */
async function orderWithSettlement(status: "SETTLED" | "REVERSED") {
  const lab = await prisma.partner.findFirst({
    where: { type: "LAB", deletedAt: null },
    select: { id: true },
  });
  if (!lab) return null;

  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-H8-${Date.now()}-${status}`,
      patientId: "test-patient",
      patientName: "اختبار التسويات",
      patientPhone: "9647700000011",
      serviceType: "HOME_LAB_TEST",
      status: "COMPLETED",
      source: "DIRECT",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      totalAmount: 30000,
      assignedLabId: lab.id,
    },
    select: { id: true },
  });
  createdOrders.push(order.id);

  await prisma.orderSettlement.create({
    data: {
      orderId: order.id,
      totalAmount: 30000,
      status,
      ...(status === "REVERSED" ? { reversedAt: new Date() } : {}),
    },
  });

  return order;
}

describe("a reversed settlement leaves the order owed", () => {
  it("the dues predicate counts it; `orderSettlement: null` did not", async () => {
    const order = await orderWithSettlement("REVERSED");
    if (!order) {
      console.warn("SKIP: no LAB fixture");
      return;
    }

    // The shared predicate every dues query now uses.
    const owed = await prisma.order.findFirst({
      where: { AND: [{ id: order.id }, unsettledOrderWhere()] },
      select: { id: true },
    });
    expect(owed?.id).toBe(order.id);

    // The predicate it replaced, pinned so the regression is explicit: this is
    // what made the order invisible.
    const underOldPredicate = await prisma.order.findFirst({
      where: { id: order.id, status: "COMPLETED", totalAmount: { gt: 0 }, orderSettlement: null },
      select: { id: true },
    });
    expect(underOldPredicate).toBeNull();
  });

  it("a LIVE settlement still excludes the order — the rule did not invert", async () => {
    const order = await orderWithSettlement("SETTLED");
    if (!order) {
      console.warn("SKIP: no LAB fixture");
      return;
    }

    const owed = await prisma.order.findFirst({
      where: { AND: [{ id: order.id }, unsettledOrderWhere()] },
      select: { id: true },
    });
    expect(owed).toBeNull();
  });

  it("the predicate composes without a caller's scope clobbering its OR", async () => {
    const order = await orderWithSettlement("REVERSED");
    if (!order) {
      console.warn("SKIP: no LAB fixture");
      return;
    }

    const lab = await prisma.order.findUnique({
      where: { id: order.id },
      select: { assignedLabId: true },
    });

    // A scope carrying its own OR must not displace the settlement condition.
    const scoped = await prisma.order.findFirst({
      where: {
        AND: [
          { id: order.id },
          unsettledOrderWhere({
            OR: [{ assignedLabId: lab!.assignedLabId }, { assignedNurseId: "__never__" }],
          }),
        ],
      },
      select: { id: true },
    });
    expect(scoped?.id).toBe(order.id);
  });
});

describe("GET /api/settlements is the operations surface", () => {
  it("lists the reversed order as pending, and says why", async () => {
    const bearer = await opsBearer();
    const order = await orderWithSettlement("REVERSED");
    if (!bearer || !order) {
      console.warn("SKIP: no ops user or LAB fixture");
      return;
    }

    const { GET } = await import("@/app/api/settlements/route");
    const res = await GET(req("/api/settlements?view=pending&limit=100", bearer), {} as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    const row = (body.data as { id: string; reversedAt: string | null; paymentStatus: string }[]).find(
      (r) => r.id === order.id
    );
    expect(row).toBeDefined();
    // The row must distinguish "reversed" from "never settled" — in a list of
    // unsettled orders the two look identical and mean opposite things.
    expect(row!.reversedAt).not.toBeNull();
    expect(row!.paymentStatus).toBe("PAID");
    // And the summary is over the whole filtered set, not just the page.
    expect(body.meta.summary.orders).toBeGreaterThan(0);
  });

  it("history shows the reversal, and the reversed total is not counted as settled", async () => {
    const bearer = await opsBearer();
    const order = await orderWithSettlement("REVERSED");
    if (!bearer || !order) {
      console.warn("SKIP: no ops user or LAB fixture");
      return;
    }

    const { GET } = await import("@/app/api/settlements/route");
    const res = await GET(
      req("/api/settlements?view=history&status=REVERSED&limit=100", bearer),
      {} as never
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    const rows = body.data as { orderId: string; status: string }[];
    expect(rows.find((r) => r.orderId === order.id)?.status).toBe("REVERSED");
    expect(rows.every((r) => r.status === "REVERSED")).toBe(true);
    expect(body.meta.summary.reversedCount).toBeGreaterThan(0);
  });

  it("refuses a partner — this is platform money", async () => {
    const partner = await prisma.user.findFirst({
      where: { role: "LAB", deletedAt: null, isActive: true },
      select: { id: true, role: true, partner: { select: { id: true } } },
    });
    if (!partner) {
      console.warn("SKIP: no LAB user");
      return;
    }
    const bearer = await signAccessToken({
      sub: partner.id,
      role: partner.role,
      partnerId: partner.partner?.id ?? null,
      doctorProfileId: null,
    });

    const { GET } = await import("@/app/api/settlements/route");
    const res = await GET(req("/api/settlements?view=pending", bearer), {} as never);
    expect(res.status).toBe(403);
  });
});
