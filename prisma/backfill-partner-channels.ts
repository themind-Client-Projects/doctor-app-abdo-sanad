/**
 * Backfill `PartnerChannel` from the `isSanadLinked` boolean it replaces.
 *
 * Every existing partner is currently visible on every browse page — the demo
 * frontend never filtered by channel — so each one gets DIRECT, plus SANAD
 * where `isSanadLinked` was true, plus COMPLEX where they belong to a complex.
 * That reproduces today's visibility exactly, which is the point: the migration
 * must not silently hide a provider from a storefront they were already in.
 *
 * Idempotent — `@@unique([partnerId, channel])` plus `skipDuplicates` means
 * running it twice is a no-op.
 *
 *   npx tsx prisma/backfill-partner-channels.ts
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });
loadEnv({ path: path.join(__dirname, "..", ".env") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type OrderSource } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // `isSanadLinked` is dropped from the Prisma model, so it is read as raw SQL
  // — this script has to keep working against a database taken before the drop.
  const legacy = await prisma.$queryRawUnsafe<{ id: string; isSanadLinked: boolean }[]>(
    `SELECT id, COALESCE("isSanadLinked", false) AS "isSanadLinked"
       FROM "Partner"
      WHERE "deletedAt" IS NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'Partner' AND column_name = 'isSanadLinked')`
  ).catch(() => [] as { id: string; isSanadLinked: boolean }[]);
  const sanad = new Set(legacy.filter((r) => r.isSanadLinked).map((r) => r.id));

  const partners = await prisma.partner.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, complexId: true },
  });

  const rows: { partnerId: string; channel: OrderSource }[] = [];
  for (const p of partners) {
    // Everyone sells direct today — the browse pages never filtered.
    rows.push({ partnerId: p.id, channel: "DIRECT" });
    if (sanad.has(p.id)) rows.push({ partnerId: p.id, channel: "SANAD" });
    if (p.complexId) rows.push({ partnerId: p.id, channel: "COMPLEX" });
  }

  const { count } = await prisma.partnerChannel.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const byChannel = await prisma.partnerChannel.groupBy({
    by: ["channel"],
    _count: { _all: true },
  });

  console.log(`partners: ${partners.length}`);
  console.log(`rows inserted this run: ${count} (of ${rows.length} intended)`);
  for (const c of byChannel) {
    console.log(`  ${c.channel.padEnd(8)} ${c._count._all}`);
  }

  // Every partner must land in at least one channel, or they vanish from every
  // storefront the moment the frontend starts filtering.
  const orphans = await prisma.partner.count({
    where: { deletedAt: null, channels: { none: {} } },
  });
  if (orphans > 0) throw new Error(`${orphans} partner(s) ended up with no channel`);
  console.log("✓ every partner is in at least one channel");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
