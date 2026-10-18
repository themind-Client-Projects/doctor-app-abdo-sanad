/**
 * Settlements that were paid out on orders whose money never arrived.
 *
 * Until `settleOrder` gained its payment guard, settlement checked only that an
 * order was COMPLETED. `paymentMethod` defaults to CASH, and the only writer of
 * `paymentStatus: "PAID"` anywhere is `payOrderFromWallet` — so no cash order
 * could ever be marked collected, and every one of them still credited every
 * partner's wallet with their share.
 *
 * READ-ONLY. It reverses nothing: a reversal moves money back out of a
 * partner's wallet and is the owner's call, not a script's. Reverse with
 * DELETE /api/orders/[id]/settle once you have decided which of these were in
 * fact collected in cash and simply never recorded.
 *
 *   npm run unpaid-settlements
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const rows = await prisma.orderSettlement.findMany({
    where: { order: { is: { paymentStatus: { not: "PAID" } } } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      totalAmount: true,
      order: {
        select: {
          orderNumber: true,
          serviceType: true,
          paymentMethod: true,
          paymentStatus: true,
          totalAmount: true,
          patientName: true,
        },
      },
      shares: { select: { partnerId: true, amount: true, party: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("No settlement sits on an uncollected order.");
  } else {
    console.log(`${rows.length} settlements were paid out on orders that are not PAID:\n`);
    let leaked = 0;
    for (const r of rows) {
      // Only shares that reached a PARTNER wallet. The WARID share has a null
      // `partnerId` — the platform is not a Partner and holds no wallet row —
      // so counting it would overstate what actually left the company.
      const out = r.shares
        .filter((s) => s.partnerId !== null)
        .reduce((a, s) => a + Number(s.amount), 0);
      leaked += out;
      console.log(
        `  ${r.order.orderNumber}  ${r.order.serviceType}  ${r.order.paymentMethod}/${r.order.paymentStatus}` +
          `  order=${r.order.totalAmount} د.ع  paid out=${out} د.ع  [${r.status}]  ${r.createdAt.toISOString().slice(0, 10)}`
      );
    }
    console.log(`\nTotal credited to partner wallets against uncollected money: ${leaked} د.ع`);
    console.log("Nothing has been reversed. Decide per order, then DELETE /api/orders/[id]/settle.");
  }

  const pending = await prisma.order.count({
    where: { status: "COMPLETED", paymentStatus: { not: "PAID" }, deletedAt: null },
  });
  console.log(`\n${pending} completed orders are still unpaid — these will no longer settle until collected.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
