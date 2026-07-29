/**
 * Seed a realistic provider network across both storefronts.
 *
 * The channel audit found four browse pages that would render EMPTY the moment
 * the frontend stops using demo-data: the only lab was PENDING, the only
 * pharmacy PAUSED, the only ACTIVE nurse was DIRECT-only, and physiotherapy had
 * no providers at all. Wiring on top of that would turn three convincing demo
 * rows into an empty state — a visible regression, which is exactly what the
 * "don't change the UI" constraint forbids.
 *
 * Provider names and cities mirror the ones the demo pages hardcode, so the
 * wired pages look like the demo rather than like a different product.
 *
 * PHYSIOTHERAPY has no `UserRole` member — and should not get one, because the
 * client's own partner taxonomy (req L128-182: مجمعات، أطباء، مختبرات،
 * صيدليات، أشعة، ممرضون، سائقون) does not list it. It is a SERVICE. So physio
 * centres are seeded as care centres (NURSE) carrying a PHYSIOTHERAPY
 * `ServiceConfig`, and /physiotherapy filters by service rather than by type.
 *
 * Idempotent: keyed on phone, which is @unique on User.
 *
 *   npx tsx prisma/seed-network.ts
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });
loadEnv({ path: path.join(__dirname, "..", ".env") });

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type OrderSource,
  type ServiceType,
  type UserRole,
} from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Spec = {
  name: string;
  type: UserRole;
  phone: string;
  governorate: string;
  address: string;
  rating: number;
  totalTasks: number;
  channels: OrderSource[];
  services: { type: ServiceType; isHomeService?: boolean; isBloodDraw?: boolean }[];
};

const NETWORK: Spec[] = [
  // ── المختبرات (/labs · /sanad/labs) ───────────────────────────────────────
  {
    name: "مختبرات الشفاء التخصصية", type: "LAB", phone: "07712345678",
    governorate: "بغداد", address: "بغداد - المنصور", rating: 4.8, totalTasks: 124,
    channels: ["DIRECT", "SANAD"],
    services: [
      { type: "LAB_TEST" },
      { type: "HOME_LAB_TEST", isHomeService: true },
      { type: "HOME_BLOOD_DRAW", isHomeService: true, isBloodDraw: true },
    ],
  },
  {
    name: "مختبر النور للتحاليل", type: "LAB", phone: "07809876543",
    governorate: "بغداد", address: "بغداد - الكرادة", rating: 4.5, totalTasks: 89,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "LAB_TEST" }, { type: "HOME_BLOOD_DRAW", isBloodDraw: true }],
  },
  {
    name: "مختبرات الحياة المتقدمة", type: "LAB", phone: "07501112222",
    governorate: "بغداد", address: "بغداد - زيونة", rating: 4.9, totalTasks: 210,
    channels: ["DIRECT"],
    services: [{ type: "LAB_TEST" }],
  },

  // ── الصيدليات (/pharmacies · /sanad/pharmacies) ───────────────────────────
  {
    name: "صيدلية الرازي الكبرى", type: "PHARMACY", phone: "07700001111",
    governorate: "بغداد", address: "بغداد - اليرموك", rating: 4.7, totalTasks: 156,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "PHARMACY_DISPENSE" }, { type: "MEDICINE_DELIVERY" }],
  },
  {
    name: "صيدلية الشفاء الحديثة", type: "PHARMACY", phone: "07812223333",
    governorate: "بغداد", address: "بغداد - الجادرية", rating: 4.6, totalTasks: 92,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "PHARMACY_DISPENSE" }, { type: "MEDICINE_DELIVERY" }],
  },
  {
    name: "صيدلية بغداد المركزية", type: "PHARMACY", phone: "07904445555",
    governorate: "بغداد", address: "بغداد - الحارثية", rating: 4.9, totalTasks: 340,
    channels: ["DIRECT"],
    services: [{ type: "PHARMACY_DISPENSE" }],
  },

  // ── التمريض (/nursing · /sanad/nursing) ───────────────────────────────────
  {
    name: "مركز الرحمة للعناية المنزلية", type: "NURSE", phone: "07734567890",
    governorate: "بغداد", address: "يغطي بغداد بالكامل", rating: 4.8, totalTasks: 245,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "NURSING", isHomeService: true }, { type: "HOME_VISIT", isHomeService: true }],
  },
  {
    name: "المركز التخصصي للتمريض", type: "NURSE", phone: "07823456789",
    governorate: "بغداد", address: "بغداد - الأعظمية", rating: 4.5, totalTasks: 112,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "NURSING", isHomeService: true }],
  },

  // ── العلاج الطبيعي (/physiotherapy) — a SERVICE, not a partner type ───────
  {
    name: "مركز التأهيل الطبي الشامل", type: "NURSE", phone: "07701234567",
    governorate: "بغداد", address: "بغداد - الكرادة", rating: 4.8, totalTasks: 96,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "PHYSIOTHERAPY" }],
  },
  {
    name: "عيادة الحركة للعلاج الطبيعي", type: "NURSE", phone: "07812345678",
    governorate: "بغداد", address: "بغداد - المنصور", rating: 4.6, totalTasks: 74,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "PHYSIOTHERAPY", isHomeService: true }],
  },
  {
    name: "مركز الحياة لطب المفاصل", type: "NURSE", phone: "07903456789",
    governorate: "بغداد", address: "بغداد - زيونة", rating: 4.9, totalTasks: 131,
    channels: ["DIRECT"],
    services: [{ type: "PHYSIOTHERAPY" }],
  },

  // ── مراكز الأشعة ──────────────────────────────────────────────────────────
  {
    name: "مركز دجلة للأشعة والسونار", type: "RADIOLOGY", phone: "07705556666",
    governorate: "بغداد", address: "بغداد - الكرادة", rating: 4.7, totalTasks: 180,
    channels: ["DIRECT", "SANAD"],
    services: [{ type: "RADIOLOGY" }],
  },
];

/** Sanad discounts the six services that had no `sanadPrice` — without them the
 *  banner promises "وفر حتى 80% على جميع الخدمات" while six fall back to base. */
const SANAD_PRICES: { serviceType: ServiceType; sanad: number; complex: number }[] = [
  { serviceType: "PHARMACY_DISPENSE", sanad: 4000, complex: 3500 },
  { serviceType: "NURSING", sanad: 28000, complex: 25000 },
  { serviceType: "PHYSIOTHERAPY", sanad: 22000, complex: 20000 },
  { serviceType: "SURGERY", sanad: 400000, complex: 350000 },
  { serviceType: "BLOOD_BANK", sanad: 8000, complex: 7000 },
  { serviceType: "TAXI", sanad: 6000, complex: 5000 },
];

const BASE_PRICE: Record<string, number> = {
  PHARMACY_DISPENSE: 5000,
  NURSING: 35000,
  PHYSIOTHERAPY: 28000,
  SURGERY: 500000,
  BLOOD_BANK: 10000,
  TAXI: 7500,
};

async function upsertProvider(spec: Spec) {
  const gov = await prisma.governorate.findFirst({ where: { name: spec.governorate } });

  const user = await prisma.user.upsert({
    where: { phone: spec.phone },
    update: { name: spec.name, role: spec.type, isActive: true },
    create: {
      name: spec.name,
      phone: spec.phone,
      role: spec.type,
      isActive: true,
      governorateId: gov?.id,
    },
  });

  const partner = await prisma.partner.upsert({
    where: { userId: user.id },
    update: {
      name: spec.name,
      status: "ACTIVE",
      deletedAt: null,
      rating: spec.rating,
      totalTasks: spec.totalTasks,
      address: spec.address,
      governorateId: gov?.id,
    },
    create: {
      userId: user.id,
      type: spec.type,
      name: spec.name,
      phone: spec.phone,
      status: "ACTIVE",
      rating: spec.rating,
      totalTasks: spec.totalTasks,
      address: spec.address,
      governorateId: gov?.id,
    },
  });

  // Every partner needs a wallet before their first settled order.
  await prisma.wallet.upsert({
    where: { partnerId: partner.id },
    update: {},
    create: { partnerId: partner.id },
  });

  for (const channel of spec.channels) {
    await prisma.partnerChannel.upsert({
      where: { partnerId_channel: { partnerId: partner.id, channel } },
      update: { status: "ACTIVE" },
      create: { partnerId: partner.id, channel, status: "ACTIVE" },
    });
  }

  for (const svc of spec.services) {
    await prisma.serviceConfig.upsert({
      where: { partnerId_serviceType: { partnerId: partner.id, serviceType: svc.type } },
      update: {
        status: "ACTIVE",
        isHomeService: svc.isHomeService ?? false,
        isBloodDraw: svc.isBloodDraw ?? false,
      },
      create: {
        partnerId: partner.id,
        serviceType: svc.type,
        status: "ACTIVE",
        isHomeService: svc.isHomeService ?? false,
        isBloodDraw: svc.isBloodDraw ?? false,
        governorates: [spec.governorate],
      },
    });
  }

  return partner;
}

async function main() {
  for (const spec of NETWORK) await upsertProvider(spec);
  console.log(`✓ ${NETWORK.length} providers`);

  // Providers the earlier seed left un-activated, so their page rendered empty.
  const woken = await prisma.partner.updateMany({
    where: { deletedAt: null, status: { in: ["PENDING", "PAUSED"] } },
    data: { status: "ACTIVE" },
  });
  console.log(`✓ activated ${woken.count} previously PENDING/PAUSED providers`);

  for (const p of SANAD_PRICES) {
    await prisma.priceConfig.upsert({
      where: { serviceType: p.serviceType },
      update: { sanadPrice: p.sanad, complexPrice: p.complex },
      create: {
        serviceType: p.serviceType,
        basePrice: BASE_PRICE[p.serviceType],
        sanadPrice: p.sanad,
        complexPrice: p.complex,
        isActive: true,
      },
    });
  }
  console.log(`✓ sanad pricing for ${SANAD_PRICES.length} more services`);

  // ── verify every browse page has rows ──────────────────────────────────────
  console.log("\n── WHAT EACH BROWSE PAGE WILL RENDER ──");
  const pages: [string, ServiceType, OrderSource][] = [
    ["/labs", "LAB_TEST", "DIRECT"], ["/sanad/labs", "LAB_TEST", "SANAD"],
    ["/pharmacies", "PHARMACY_DISPENSE", "DIRECT"], ["/sanad/pharmacies", "PHARMACY_DISPENSE", "SANAD"],
    ["/nursing", "NURSING", "DIRECT"], ["/sanad/nursing", "NURSING", "SANAD"],
    ["/physiotherapy", "PHYSIOTHERAPY", "DIRECT"], ["/sanad/physiotherapy", "PHYSIOTHERAPY", "SANAD"],
  ];
  let empty = 0;
  for (const [label, serviceType, channel] of pages) {
    const n = await prisma.partner.count({
      where: {
        status: "ACTIVE", deletedAt: null,
        channels: { some: { channel, status: { not: "SUSPENDED" } } },
        serviceConfigs: { some: { serviceType, status: { in: ["ACTIVE", "REACTIVATED"] } } },
      },
    });
    if (n === 0) empty++;
    console.log(`  ${label.padEnd(22)} ${n}${n === 0 ? "   ← STILL EMPTY" : ""}`);
  }

  for (const channel of ["DIRECT", "SANAD"] as const) {
    const n = await prisma.doctorProfile.count({
      where: {
        user: {
          isActive: true, deletedAt: null,
          partner: {
            status: "ACTIVE", deletedAt: null,
            channels: { some: { channel, status: { not: "SUSPENDED" } } },
          },
        },
      },
    });
    console.log(`  ${(channel === "SANAD" ? "/sanad/doctors" : "/doctors").padEnd(22)} ${n}${n === 0 ? "   ← STILL EMPTY" : ""}`);
    if (n === 0) empty++;
  }

  if (empty > 0) throw new Error(`${empty} browse page(s) would still render empty`);
  console.log("\n✓ no browse page renders empty");
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
