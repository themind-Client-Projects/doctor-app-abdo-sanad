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
import { PrismaClient, type OrderSource, type ServiceType } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * عضويات وريد وسند — the client's four packages, exactly as the card prints them.
 *
 * Prices, durations, discount rates and per-service allowances all come from
 * the approved design. The three "معلق" rows and the locked yearly package are
 * reproduced as states rather than omitted, because the card shows them
 * deliberately: a package that lists a benefit it does not yet honour has to
 * say so on the row, not hide the row.
 *
 * Idempotent on `code`.
 */
type SeedBenefit = {
  serviceType: ServiceType | null;
  label: string;
  quota: number | null;
  state: "AVAILABLE" | "SUSPENDED" | "LOCKED";
};

/** The eight rows every card prints, in the card's own order. */
function benefits(
  bookings: number | null,
  calls: number | null,
  rides: number | null,
  imaging: "AVAILABLE" | "SUSPENDED" | "LOCKED",
  surgery: "AVAILABLE" | "SUSPENDED" | "LOCKED",
  openAccess: "AVAILABLE" | "LOCKED"
): SeedBenefit[] {
  return [
    { serviceType: "IN_PERSON_CONSULT", label: "حجز الأطباء", quota: bookings, state: bookings === null ? "LOCKED" : "AVAILABLE" },
    { serviceType: "ONLINE_CONSULT", label: "مكالمة / استشارة هاتفية", quota: calls, state: calls === null ? "LOCKED" : "AVAILABLE" },
    { serviceType: "TAXI", label: "رحلة التاكسي", quota: rides, state: rides === null ? "LOCKED" : "AVAILABLE" },
    { serviceType: "RADIOLOGY", label: "أشعة وسونار", quota: null, state: imaging },
    { serviceType: "SURGERY", label: "عمليات داخل العيادة", quota: null, state: surgery },
    { serviceType: "LAB_TEST", label: "التحاليل والمختبرات", quota: null, state: openAccess },
    { serviceType: "PHARMACY_DISPENSE", label: "الصيدليات", quota: null, state: openAccess },
    { serviceType: "HOME_VISIT", label: "الرعاية المنزلية (سند)", quota: null, state: openAccess },
  ];
}

const PLANS: {
  code: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  discountPercent: number;
  accent: string;
  icon: string;
  isPopular: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  benefits: SeedBenefit[];
}[] = [
  {
    code: "DAILY",
    name: "باقة يومي",
    description: "صالح لمدة يوم واحد — استفادة سريعة ومرنة في يومك",
    price: 5000,
    durationDays: 1,
    discountPercent: 2.5,
    accent: "emerald",
    icon: "calendar",
    isPopular: false,
    isComingSoon: false,
    sortOrder: 1,
    benefits: benefits(1, 1, 1, "SUSPENDED", "SUSPENDED", "AVAILABLE"),
  },
  {
    code: "WEEKLY",
    name: "باقة أسبوعي",
    description: "صالح لمدة 7 أيام — رعاية جيدة طوال الأسبوع",
    price: 15000,
    durationDays: 7,
    discountPercent: 5,
    accent: "blue",
    icon: "calendar",
    isPopular: false,
    isComingSoon: false,
    sortOrder: 2,
    benefits: benefits(2, 2, 2, "SUSPENDED", "SUSPENDED", "AVAILABLE"),
  },
  {
    code: "MONTHLY",
    name: "باقة شهري",
    description: "صالح لمدة 30 يوم — خطة متكاملة لشهر كامل",
    price: 30000,
    durationDays: 30,
    discountPercent: 10,
    accent: "amber",
    icon: "star",
    isPopular: true,
    isComingSoon: false,
    sortOrder: 3,
    benefits: benefits(4, 4, 4, "AVAILABLE", "AVAILABLE", "AVAILABLE"),
  },
  {
    code: "YEARLY",
    name: "باقة سنوي",
    description: "صالح لمدة 12 شهر",
    price: 225000,
    durationDays: 365,
    discountPercent: 15,
    accent: "slate",
    icon: "shield",
    isPopular: false,
    // "متوفر قريباً" on the card — listed, and refused at purchase.
    isComingSoon: true,
    sortOrder: 4,
    benefits: benefits(12, 12, 12, "LOCKED", "LOCKED", "LOCKED"),
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
  for (const { benefits: rows, ...plan } of PLANS) {
    // Keyed on `code`, not `name`: the admin may reword a card, and a rename
    // would otherwise seed a duplicate package rather than update the one it
    // meant to.
    const existing = await prisma.healthPlan.findUnique({ where: { code: plan.code } });

    // Benefits are replaced wholesale so a re-run reflects the current design
    // rather than appending a second set of rows. Safe because a live
    // `Membership` holds its own copy and never reads these back.
    const benefitRows = rows.map((row, index) => ({ ...row, sortOrder: index }));

    if (existing) {
      await prisma.healthPlanBenefit.deleteMany({ where: { planId: existing.id } });
      await prisma.healthPlan.update({
        where: { id: existing.id },
        data: { ...plan, benefits: { create: benefitRows } },
      });
    } else {
      await prisma.healthPlan.create({ data: { ...plan, benefits: { create: benefitRows } } });
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

  for (const p of await prisma.healthPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { benefits: true },
  })) {
    const coming = p.isComingSoon ? "  (متوفر قريباً)" : "";
    console.log(
      `  ${p.name.padEnd(14)} ${String(p.price).padStart(7)} د.ع  ` +
        `${String(p.durationDays).padStart(3)} يوم  خصم ${p.discountPercent}%  ` +
        `${p.benefits.length} مزايا${coming}`
    );
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
