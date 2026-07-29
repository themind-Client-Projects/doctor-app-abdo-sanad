/**
 * Seed a doctor roster with real specialty coverage.
 *
 * The demo shipped 14 doctors spread across the specialty filter row. The
 * database had 2 — so once the frontend is wired, 11 of the 13 specialty chips
 * would filter down to nothing, which reads as a broken page rather than an
 * empty category. Every ACTIVE specialty gets at least one bookable doctor.
 *
 * Each doctor is the full graph the app needs: User + Partner + Wallet +
 * DoctorProfile + PartnerChannel + an IN_PERSON_CONSULT ServiceConfig, because
 * `/api/public/doctors` reports `isAvailable` from that config and a doctor
 * without one renders as permanently unavailable.
 *
 * Idempotent on phone (@unique on User).
 *
 *   npx tsx prisma/seed-doctors.ts
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

type Doc = {
  name: string;
  slug: string; // Specialty.slug
  phone: string;
  area: string;
  clinic: string;
  rating: number;
  reviews: number;
  experience: number;
  gender: "MALE" | "FEMALE";
  channels: OrderSource[];
};

const DOCTORS: Doc[] = [
  { name: "د. سمير محمود", slug: "internal-medicine", phone: "07730000001", area: "بغداد", clinic: "مستشفى السلام", rating: 4.9, reviews: 320, experience: 15, gender: "MALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. رند الحسيني", slug: "gynecology", phone: "07730000002", area: "بغداد", clinic: "مجمع النور الطبي", rating: 4.8, reviews: 210, experience: 12, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. مصطفى العبيدي", slug: "orthopedics", phone: "07730000003", area: "بغداد", clinic: "مركز ابن سينا", rating: 4.7, reviews: 188, experience: 18, gender: "MALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. زينب الساعدي", slug: "pediatrics", phone: "07730000004", area: "بغداد", clinic: "عيادات بغداد", rating: 4.9, reviews: 265, experience: 10, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. حسن الخفاجي", slug: "dermatology", phone: "07730000005", area: "بغداد", clinic: "مجمع الكرخ الطبي", rating: 4.6, reviews: 141, experience: 9, gender: "MALE", channels: ["DIRECT"] },
  { name: "د. آية الربيعي", slug: "ophthalmology", phone: "07730000006", area: "بغداد", clinic: "مركز النور للعيون", rating: 4.8, reviews: 173, experience: 11, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. عمر الدليمي", slug: "ent", phone: "07730000007", area: "بغداد", clinic: "عيادة الشفاء", rating: 4.5, reviews: 98, experience: 8, gender: "MALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. مريم الجنابي", slug: "dentistry", phone: "07730000008", area: "بغداد", clinic: "مركز الابتسامة", rating: 4.9, reviews: 402, experience: 14, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. كرار الموسوي", slug: "urology", phone: "07730000009", area: "بغداد", clinic: "مستشفى السلام", rating: 4.6, reviews: 120, experience: 13, gender: "MALE", channels: ["DIRECT"] },
  { name: "د. هدى العامري", slug: "oncology", phone: "07730000010", area: "بغداد", clinic: "مركز الأورام", rating: 4.9, reviews: 219, experience: 20, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. علي الزبيدي", slug: "mental-health", phone: "07730000011", area: "بغداد", clinic: "عيادة السكينة", rating: 4.7, reviews: 87, experience: 7, gender: "MALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. سارة القيسي", slug: "nutrition", phone: "07730000012", area: "بغداد", clinic: "مركز التغذية", rating: 4.8, reviews: 156, experience: 6, gender: "FEMALE", channels: ["DIRECT", "SANAD"] },
  { name: "د. يوسف البياتي", slug: "palliative-care", phone: "07730000013", area: "بغداد", clinic: "مركز الرعاية", rating: 4.7, reviews: 64, experience: 16, gender: "MALE", channels: ["DIRECT"] },
];

async function main() {
  const gov = await prisma.governorate.findFirst({ where: { name: "بغداد" } });
  const specialties = new Map(
    (await prisma.specialty.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id])
  );

  for (const d of DOCTORS) {
    const specialtyId = specialties.get(d.slug);
    if (!specialtyId) {
      console.warn(`  ! no specialty '${d.slug}' — skipping ${d.name}`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { phone: d.phone },
      update: { name: d.name, role: "DOCTOR", isActive: true },
      create: { name: d.name, phone: d.phone, role: "DOCTOR", isActive: true, governorateId: gov?.id },
    });

    const partner = await prisma.partner.upsert({
      where: { userId: user.id },
      update: {
        name: d.name, status: "ACTIVE", deletedAt: null,
        rating: d.rating, totalTasks: d.reviews, address: d.clinic, governorateId: gov?.id,
      },
      create: {
        userId: user.id, type: "DOCTOR", name: d.name, phone: d.phone, status: "ACTIVE",
        rating: d.rating, totalTasks: d.reviews, address: d.clinic, governorateId: gov?.id,
      },
    });

    await prisma.wallet.upsert({
      where: { partnerId: partner.id },
      update: {},
      create: { partnerId: partner.id },
    });

    await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: { specialtyId, experience: d.experience, gender: d.gender },
      create: { userId: user.id, specialtyId, experience: d.experience, gender: d.gender },
    });

    for (const channel of d.channels) {
      await prisma.partnerChannel.upsert({
        where: { partnerId_channel: { partnerId: partner.id, channel } },
        update: { status: "ACTIVE" },
        create: { partnerId: partner.id, channel, status: "ACTIVE" },
      });
    }

    // `isAvailable` on the public directory reads this row; without it every
    // doctor renders as permanently unavailable.
    for (const serviceType of ["IN_PERSON_CONSULT", "ONLINE_CONSULT"] as const) {
      await prisma.serviceConfig.upsert({
        where: { partnerId_serviceType: { partnerId: partner.id, serviceType } },
        update: { status: "ACTIVE" },
        create: { partnerId: partner.id, serviceType, status: "ACTIVE", governorates: [d.area] },
      });
    }
  }

  console.log(`✓ ${DOCTORS.length} doctors`);

  console.log("\n── SPECIALTY COVERAGE (chips that would filter to nothing) ──");
  let empty = 0;
  for (const s of await prisma.specialty.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })) {
    const n = await prisma.doctorProfile.count({
      where: {
        specialtyId: s.id,
        user: {
          isActive: true, deletedAt: null,
          partner: { status: "ACTIVE", deletedAt: null, channels: { some: { channel: "DIRECT", status: { not: "SUSPENDED" } } } },
        },
      },
    });
    if (n === 0) empty++;
    console.log(`  ${s.slug.padEnd(20)} ${n}${n === 0 ? "  ← empty chip" : ""}`);
  }

  for (const channel of ["DIRECT", "SANAD"] as const) {
    const n = await prisma.doctorProfile.count({
      where: {
        user: {
          isActive: true, deletedAt: null,
          partner: { status: "ACTIVE", deletedAt: null, channels: { some: { channel, status: { not: "SUSPENDED" } } } },
        },
      },
    });
    console.log(`\n  ${channel}: ${n} bookable doctors`);
  }
  console.log(empty === 0 ? "\n✓ every specialty chip has at least one doctor" : `\n! ${empty} empty chip(s)`);
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
