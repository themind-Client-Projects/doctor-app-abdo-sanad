import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  InsufficientBalance,
  creditWallet,
  debitWallet,
  ensureWallet,
} from "@/server/services/patient-wallet";

/**
 * The patient wallet has exactly one invariant worth testing:
 *
 *   balance == sum(CREDIT) - sum(DEBIT)
 *
 * Everything else is bookkeeping around it. These cases cover the two ways that
 * invariant breaks in practice: an overdraw that is allowed through, and
 * concurrent debits that both read the same starting balance.
 */

let userId: string;

async function sumOfMovements(walletId: string) {
  const rows = await prisma.patientTransaction.findMany({
    where: { walletId },
    select: { amount: true, type: true },
  });
  return rows.reduce(
    (total, t) => total + (t.type === "CREDIT" ? 1 : -1) * Number(t.amount),
    0
  );
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "اختبار المحفظة", phone: `test-wallet-${Date.now()}`, role: "PATIENT" },
  });
  userId = user.id;
});

afterAll(async () => {
  // Cascades through the wallet and its movements.
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("patient wallet", () => {
  it("creates the wallet on first use rather than 404ing an older account", async () => {
    const wallet = await ensureWallet(userId);
    expect(wallet.userId).toBe(userId);
    expect(Number(wallet.balance)).toBe(0);
  });

  it("credits, and the balance equals the sum of movements", async () => {
    const wallet = await creditWallet({
      userId,
      amount: 100_000,
      reason: "TOPUP",
      description: "إيداع من الإدارة",
    });
    expect(Number(wallet.balance)).toBe(100_000);
    expect(await sumOfMovements(wallet.id)).toBe(100_000);
  });

  it("debits, and the balance still equals the sum of movements", async () => {
    const wallet = await debitWallet({ userId, amount: 25_000, description: "دفع رسوم كشف" });
    expect(Number(wallet.balance)).toBe(75_000);
    expect(await sumOfMovements(wallet.id)).toBe(75_000);
  });

  it("refuses to overdraw", async () => {
    await expect(debitWallet({ userId, amount: 1_000_000 })).rejects.toBeInstanceOf(
      InsufficientBalance
    );

    // The failed attempt must leave nothing behind — no movement, no change.
    const wallet = await ensureWallet(userId);
    expect(Number(wallet.balance)).toBe(75_000);
    expect(await sumOfMovements(wallet.id)).toBe(75_000);
  });

  it("rejects a non-positive amount in either direction", async () => {
    await expect(debitWallet({ userId, amount: 0 })).rejects.toThrow();
    await expect(creditWallet({ userId, amount: -5_000, reason: "TOPUP" })).rejects.toThrow();
  });

  it("keeps the balance correct under concurrent debits", async () => {
    // The regression this guards: a read-then-write debit lets two concurrent
    // requests both see 75,000, both approve a 40,000 charge, and leave the
    // balance at 35,000 having taken 80,000. The guard is in the WHERE clause,
    // so exactly one of these can win.
    const results = await Promise.allSettled([
      debitWallet({ userId, amount: 40_000 }),
      debitWallet({ userId, amount: 40_000 }),
    ]);

    const settled = results.filter((r) => r.status === "fulfilled").length;
    expect(settled).toBe(1);

    const wallet = await ensureWallet(userId);
    expect(Number(wallet.balance)).toBe(35_000);
    expect(await sumOfMovements(wallet.id)).toBe(35_000);
  });
});
