/**
 * Seed the storefront tables with EXACTLY what the frontend currently hardcodes.
 *
 * The point is that wiring the pages to the API must be visually invisible: the
 * same three plans at the same prices, the same banner copy per storefront. If
 * a seeded value differs from the inline array it replaces, the "no UI change"
 * promise is broken and nobody notices until the client does.
 *
 * Sources:
 *   plans   — src/app/(patient)/page.tsx, the الاشتراكات والباقات array
 *   banners — the same file's ads carousel, and (sanad)/sanad/page.tsx's billboard
 *
 * Idempotent: keyed on `name`/`title`, so re-running updates rather than
 * duplicating.
 *
 *   npx tsx prisma/seed-storefront.ts
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

/** Global — a subscriber uses their plan inside سند and outside it. */
const PLANS = [
  {
    name: "الأساسية",
    description: "رعاية صحية أولية للأفراد",
    monthlyPrice: 15000,
    features: ["كشفية مجانية شهرياً", "خصم 10% على التحاليل"],
    accent: "blue",
    icon: "activity",
    isPopular: false,
    sortOrder: 1,
  },
  {
    name: "الشاملة",
    description: "تغطية متكاملة لجميع احتياجاتك",
    monthlyPrice: 25000,
    features: ["3 كشفيات مجانية", "خصم 25% على التحاليل", "استشارة هاتفية 24/7"],
    accent: "emerald",
    icon: "star",
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: "العائلة",
    description: "رعاية صحية لك ولعائلتك",
    monthlyPrice: 45000,
    features: ["تغطية لـ 4 أفراد", "خصم 30% على التحاليل", "طبيب العائلة المنزلي"],
    accent: "purple",
    icon: "home",
    isPopular: false,
    sortOrder: 3,
  },
];

/** Channel-scoped — each storefront runs its own promo. */
const BANNERS: {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string | null;
  channel: OrderSource;
  sortOrder: number;
}[] = [
  {
    title: "إعلانات وتخفيضات",
    subtitle: "تعرف على أحدث العروض والخدمات في مجمعاتنا",
    imageUrl: "/ads/real_clinic_banner.png",
    href: "/services/offers",
    channel: "DIRECT",
    sortOrder: 1,
  },
  {
    title: "خصم 20% على التحاليل",
    subtitle: "احجز الان من خلال التطبيق في مختبرات الشفاء",
    imageUrl: "/ads/real_clinic_banner.png",
    href: "/sanad/labs",
    channel: "SANAD",
    sortOrder: 1,
  },
];

async function main() {
  for (const plan of PLANS) {
    const existing = await prisma.healthPlan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.healthPlan.update({ where: { id: existing.id }, data: plan });
    } else {
      await prisma.healthPlan.create({ data: plan });
    }
  }

  for (const banner of BANNERS) {
    const existing = await prisma.banner.findFirst({
      where: { title: banner.title, channel: banner.channel },
    });
    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data: banner });
    } else {
      await prisma.banner.create({ data: banner });
    }
  }

  const [plans, banners] = await Promise.all([
    prisma.healthPlan.count(),
    prisma.banner.count(),
  ]);
  console.log(`✓ plans: ${plans}, banners: ${banners}`);

  for (const p of await prisma.healthPlan.findMany({ orderBy: { sortOrder: "asc" } })) {
    console.log(`  ${p.name.padEnd(10)} ${p.monthlyPrice} د.ع  ${(p.features as string[]).length} مزايا`);
  }
  for (const b of await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } })) {
    console.log(`  [${b.channel}] ${b.title}`);
  }
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
