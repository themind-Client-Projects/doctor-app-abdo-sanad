/**
 * Give every patient a wallet, with movements derived from their real orders.
 *
 * `/wallet` listed five invented transactions and the header showed a fixed
 * "150,000 د.ع". Deriving the movements from `Order` instead means the balance
 * a patient sees can be reconciled against what they actually booked — and each
 * row carries the order's `source`, so one wallet stays legible across both
 * storefronts.
 *
 *   npx tsx prisma/seed-patient-wallets.ts
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(__dirname, "..", ".env.local") });
loadEnv({ path: path.join(__dirname, "..", ".env") });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TOPUP = 150_000; // matches the balance the demo header displayed

async function main() {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT", deletedAt: null },
    select: { id: true, name: true },
  });

  for (const patient of patients) {
    const wallet = await prisma.patientWallet.upsert({
      where: { userId: patient.id },
      update: {},
      create: { userId: patient.id },
    });

    // Rebuild from scratch so re-running cannot double the balance.
    await prisma.patientTransaction.deleteMany({ where: { walletId: wallet.id } });

    const orders = await prisma.order.findMany({
      where: { patientId: patient.id, status: "COMPLETED", totalAmount: { not: null } },
      select: { id: true, totalAmount: true, serviceType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    const rows: { walletId: string; orderId: string | null; amount: number; type: string; reason: string; description: string | null; createdAt: Date }[] = [
      { walletId: wallet.id, orderId: null, amount: TOPUP, type: "CREDIT", reason: "TOPUP",
        description: "إيداع رصيد", createdAt: new Date(Date.now() - 30 * 864e5) },
    ];

    let balance = TOPUP;
    for (const o of orders) {
      const amount = Number(o.totalAmount);
      if (amount <= 0) continue;
      rows.push({ walletId: wallet.id, orderId: o.id, amount, type: "DEBIT", reason: "PAYMENT",
        description: "دفع رسوم خدمة", createdAt: o.createdAt });
      balance -= amount;
    }

    // Never seed a negative balance — a patient cannot spend what they never had.
    if (balance < 0) {
      const extra = Math.ceil((-balance + 50_000) / 10_000) * 10_000;
      rows.push({ walletId: wallet.id, orderId: null, amount: extra, type: "CREDIT", reason: "TOPUP",
        description: "إيداع رصيد", createdAt: new Date(Date.now() - 29 * 864e5) });
      balance += extra;
    }

    await prisma.patientTransaction.createMany({ data: rows });
    await prisma.patientWallet.update({ where: { id: wallet.id }, data: { balance } });
  }

  console.log(`✓ ${patients.length} patient wallets`);
  const check = await prisma.patientWallet.findMany({
    select: { balance: true, user: { select: { name: true } },
      transactions: { select: { amount: true, type: true } } },
  });
  let bad = 0;
  for (const w of check) {
    const sum = w.transactions.reduce((a, t) => a + (t.type === "CREDIT" ? 1 : -1) * Number(t.amount), 0);
    const ok = Math.abs(sum - Number(w.balance)) < 0.001;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${String(w.user.name).padEnd(18)} balance=${w.balance} sum(tx)=${sum} (${w.transactions.length} movements)`);
  }
  if (bad) throw new Error(`${bad} wallet(s) where the balance != sum of its transactions`);
  console.log("✓ every balance equals the sum of its transactions");
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
