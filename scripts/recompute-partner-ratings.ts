/**
 * Replace every seeded `Partner.rating` with the real average of what patients
 * actually said.
 *
 * The column is read on six patient surfaces and was written by nothing, so
 * every score was the one `seed.ts` invented — and inflated: صيدلية الرازي
 * showed 4.7 against a real 3.92, د. علي الجبوري 4.8 against 4.07, and
 * thirty-five of the forty-one partners displayed a rating with no feedback
 * behind it at all.
 *
 * `/api/v1/me/orders/[id]/feedback` keeps the column current from now on. This
 * is the one-off that fixes the history, and it is safe to re-run.
 *
 *   npm run recompute-ratings
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Standalone scripts do not get Next.js's automatic .env loading, and the
// Prisma client reads DATABASE_URL at import time — so the imports below are
// DYNAMIC, after the env is in place.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { readPartnerRating, recomputeAllPartnerRatings } = await import(
    "../src/server/services/partner-rating"
  );

  const before = await prisma.partner.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, type: true, rating: true },
    orderBy: { name: "asc" },
  });

  const changes: string[] = [];
  for (const p of before) {
    const real = await readPartnerRating(p.id);
    if (real.average !== p.rating) {
      changes.push(
        `  ${p.name} (${p.type}): ${p.rating} -> ${real.average}` +
          (real.count === 0 ? "   [nobody has rated them]" : `   [${real.count} ratings]`)
      );
    }
  }

  const { updated, rated } = await recomputeAllPartnerRatings();

  console.log(`${updated} partners recomputed — ${rated} have real feedback.`);
  console.log(`${changes.length} values changed:`);
  changes.forEach((c) => console.log(c));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
