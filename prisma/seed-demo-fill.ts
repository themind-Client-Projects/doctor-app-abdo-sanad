/**
 * Top every thin table up to a level where the UI can actually be judged.
 *
 * A census after wiring found nine tables at 0–2 rows: banners (so the home
 * carousel rendered a single card instead of a strip), campaigns (so /services
 * /offers had one offer), complexes, radiology equipment, addresses, invoices,
 * debts, call logs, and doctor schedules — five schedules across fifteen
 * doctors, so ten of them offered no bookable times.
 *
 * Everything here mirrors what the demo pages hardcoded, so a wired screen
 * looks like the product the client signed off rather than like a thinner
 * version of it.
 *
 * Idempotent throughout — keyed on natural keys, so re-running updates.
 *
 *   npx tsx prisma/seed-demo-fill.ts
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

const DAY = 86_400_000;
const now = Date.now();

/* ─────────────────────────── banners (the carousel) ─────────────────────── */

const BANNERS: {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string | null;
  channel: OrderSource;
  sortOrder: number;
}[] = [
  // The home strip scrolls horizontally — one card is not a carousel.
  { title: "إعلانات وتخفيضات", subtitle: "تعرف على أحدث العروض والخدمات في مجمعاتنا", imageUrl: "/ads/real_clinic_banner.png", href: "/services/offers", channel: "DIRECT", sortOrder: 1 },
  { title: "رعاية منزلية على مدار الساعة", subtitle: "ممرضون معتمدون يصلون إليك خلال ساعة", imageUrl: "/complexes/real_complex_1.png", href: "/homecare", channel: "DIRECT", sortOrder: 2 },
  { title: "تحاليل منزلية بأسعار مخفّضة", subtitle: "سحب العينة من منزلك ونتائج خلال 24 ساعة", imageUrl: "/complexes/real_complex_2.png", href: "/labs", channel: "DIRECT", sortOrder: 3 },

  { title: "خصم 20% على التحاليل", subtitle: "احجز الان من خلال التطبيق في مختبرات الشفاء", imageUrl: "/ads/real_clinic_banner.png", href: "/sanad/labs", channel: "SANAD", sortOrder: 1 },
  { title: "استشارات سند بنصف السعر", subtitle: "أطباء سند بأسعار مخفّضة تصل إلى 50%", imageUrl: "/complexes/real_complex_3.png", href: "/sanad/doctors", channel: "SANAD", sortOrder: 2 },
  { title: "صيدليات سند المعتمدة", subtitle: "أدويتك بخصم حصري عبر وصفة إلكترونية", imageUrl: "/complexes/real_complex_1.png", href: "/sanad/pharmacies", channel: "SANAD", sortOrder: 3 },
];

/* ───────────────────────────── offers (Campaign) ────────────────────────── */

const OFFERS: {
  name: string;
  description: string;
  discountType: string;
  discountValue: number;
  targetServices: ServiceType[];
  channel: OrderSource | null;
  days: number;
}[] = [
  { name: "خصم الأسنان", description: "تنظيف وتبييض بأسعار مخفّضة", discountType: "PERCENTAGE", discountValue: 30, targetServices: ["IN_PERSON_CONSULT"], channel: "DIRECT", days: 30 },
  { name: "باقة الفحص الشامل", description: "تحاليل شاملة بسعر موحّد", discountType: "PERCENTAGE", discountValue: 25, targetServices: ["LAB_TEST", "HOME_LAB_TEST"], channel: null, days: 45 },
  { name: "عروض التجميل والليزر", description: "جلسات ليزر بخصم خاص", discountType: "PERCENTAGE", discountValue: 40, targetServices: ["IN_PERSON_CONSULT"], channel: "DIRECT", days: 20 },
  { name: "خصم العيون", description: "فحص نظر مجاني مع كل استشارة", discountType: "FIXED", discountValue: 10000, targetServices: ["IN_PERSON_CONSULT"], channel: "SANAD", days: 25 },
  { name: "العلاج الطبيعي", description: "خمس جلسات بسعر أربع", discountType: "PERCENTAGE", discountValue: 20, targetServices: ["PHYSIOTHERAPY"], channel: null, days: 60 },
  { name: "توصيل الأدوية مجاناً", description: "توصيل مجاني لكل طلب فوق 25 ألف", discountType: "FIXED", discountValue: 5000, targetServices: ["MEDICINE_DELIVERY"], channel: "SANAD", days: 15 },
];

async function main() {
  /* ── banners ── */
  for (const b of BANNERS) {
    const existing = await prisma.banner.findFirst({ where: { title: b.title, channel: b.channel } });
    if (existing) await prisma.banner.update({ where: { id: existing.id }, data: b });
    else await prisma.banner.create({ data: b });
  }

  /* ── offers ── */
  for (const o of OFFERS) {
    const data = {
      name: o.name,
      description: o.description,
      discountType: o.discountType,
      discountValue: o.discountValue,
      targetServices: o.targetServices,
      channel: o.channel,
      // Started yesterday so every one of them is live right now — an offer
      // that begins tomorrow is invisible and looks like a seeding failure.
      startDate: new Date(now - DAY),
      endDate: new Date(now + o.days * DAY),
      isActive: true,
    };
    const existing = await prisma.campaign.findFirst({ where: { name: o.name } });
    if (existing) await prisma.campaign.update({ where: { id: existing.id }, data });
    else await prisma.campaign.create({ data });
  }

  /* ── coupons ── */
  for (const c of [
    { code: "WARID10", discountType: "PERCENTAGE", discountValue: 10, maxUses: 0 },
    { code: "SANAD25", discountType: "PERCENTAGE", discountValue: 25, maxUses: 100 },
    { code: "FIRST5000", discountType: "FIXED", discountValue: 5000, maxUses: 500 },
    { code: "HOMECARE15", discountType: "PERCENTAGE", discountValue: 15, maxUses: 200 },
  ]) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: true, expiresAt: new Date(now + 90 * DAY) },
      create: { ...c, isActive: true, expiresAt: new Date(now + 90 * DAY) },
    });
  }

  /* ── complexes + departments ── */
  // A complex IS a partner that owns one, so the owner must exist first.
  //
  // Capped at TARGET_COMPLEXES total rather than "create 3": the owner query
  // selects partners that own none, so every re-run would find three fresh ones
  // and the count would grow without bound — which it did, 1 → 10.
  const TARGET_COMPLEXES = 4;
  const existingComplexes = await prisma.medicalComplex.count();
  const complexOwners =
    existingComplexes >= TARGET_COMPLEXES
      ? []
      : await prisma.partner.findMany({
          where: { deletedAt: null, ownedComplex: null, type: "DOCTOR" },
          take: TARGET_COMPLEXES - existingComplexes,
          select: { id: true },
        });
  const COMPLEX_NAMES = ["مجمع النور الطبي", "عيادات السلام", "مركز ابن سينا"];
  const DEPARTMENTS = ["قسم الباطنية", "قسم الأطفال", "قسم النسائية", "قسم العظام", "قسم الجلدية"];

  for (const [i, owner] of complexOwners.entries()) {
    const name = COMPLEX_NAMES[i];
    if (!name) break;
    const complex = await prisma.medicalComplex.upsert({
      where: { partnerId: owner.id },
      update: { name },
      create: { partnerId: owner.id, name },
    });
    for (const dept of DEPARTMENTS.slice(0, 3 + i)) {
      const has = await prisma.department.findFirst({ where: { complexId: complex.id, name: dept } });
      if (!has) await prisma.department.create({ data: { complexId: complex.id, name: dept } });
    }
  }

  /* ── doctor schedules — 10 of 15 doctors had none, so no bookable times ── */
  const doctors = await prisma.doctorProfile.findMany({ select: { id: true } });
  for (const d of doctors) {
    // Sunday–Thursday, the Iraqi working week.
    for (const dayOfWeek of [0, 1, 2, 3, 4]) {
      const has = await prisma.doctorSchedule.findFirst({ where: { doctorId: d.id, dayOfWeek } });
      if (!has) {
        await prisma.doctorSchedule.create({
          data: { doctorId: d.id, dayOfWeek, startTime: "09:00", endTime: "17:00", isActive: true },
        });
      }
    }
  }

  /* ── radiology equipment ── */
  const centres = await prisma.partner.findMany({ where: { type: "RADIOLOGY", deletedAt: null }, select: { id: true } });
  for (const c of centres) {
    for (const eq of [
      { name: "جهاز أشعة سينية رقمي", type: "X-Ray" },
      { name: "جهاز رنين مغناطيسي 1.5 تسلا", type: "MRI" },
      { name: "جهاز أشعة مقطعية 64 شريحة", type: "CT" },
      { name: "جهاز سونار رباعي الأبعاد", type: "Ultrasound" },
    ]) {
      const has = await prisma.radiologyEquipment.findFirst({ where: { centerId: c.id, name: eq.name } });
      if (!has) await prisma.radiologyEquipment.create({ data: { centerId: c.id, ...eq, isActive: true } });
    }
  }

  /* ── pharmacy products ── */
  const pharmacies = await prisma.partner.findMany({ where: { type: "PHARMACY", deletedAt: null }, select: { id: true } });
  const PRODUCTS = [
    { name: "باراسيتامول 500 ملغ", category: "مسكنات", price: 2500, requiresRx: false },
    { name: "أموكسيسيلين 500 ملغ", category: "مضادات حيوية", price: 7500, requiresRx: true },
    { name: "فيتامين د 50000 وحدة", category: "فيتامينات", price: 12000, requiresRx: false },
    { name: "أنسولين طويل المفعول", category: "السكري", price: 45000, requiresRx: true },
    { name: "شراب سعال للأطفال", category: "أدوية الأطفال", price: 4000, requiresRx: false },
    { name: "جهاز قياس ضغط رقمي", category: "أجهزة طبية", price: 65000, requiresRx: false },
    { name: "كمامات طبية (50 قطعة)", category: "مستلزمات", price: 6000, requiresRx: false },
    { name: "مرهم مضاد للالتهاب", category: "جلدية", price: 8500, requiresRx: false },
  ];
  for (const ph of pharmacies) {
    for (const prod of PRODUCTS) {
      const has = await prisma.product.findFirst({ where: { pharmacyId: ph.id, name: prod.name } });
      if (!has) await prisma.product.create({ data: { pharmacyId: ph.id, ...prod, inStock: true } });
    }
  }

  /* ── patient addresses ── */
  const patients = await prisma.user.findMany({ where: { role: "PATIENT" }, select: { id: true, governorateId: true } });
  const AREAS = ["الكرادة", "المنصور", "زيونة", "الأعظمية", "اليرموك"];
  for (const [i, pt] of patients.entries()) {
    const has = await prisma.address.findFirst({ where: { userId: pt.id } });
    if (!has) {
      await prisma.address.create({
        data: {
          userId: pt.id,
          label: "المنزل",
          governorateId: pt.governorateId,
          area: AREAS[i % AREAS.length],
          street: `شارع ${10 + i}`,
          landmark: "قرب الجامع",
          isDefault: true,
        },
      });
    }
  }

  /* ── invoices + debts (the finance screens were empty) ── */
  const partners = await prisma.partner.findMany({ where: { deletedAt: null }, take: 8, select: { id: true } });
  for (const [i, pt] of partners.entries()) {
    const has = await prisma.invoice.findFirst({ where: { partnerId: pt.id } });
    if (!has) {
      await prisma.invoice.createMany({
        data: [
          { partnerId: pt.id, amount: 120_000 + i * 15_000, status: "paid", dueDate: new Date(now - 20 * DAY), paidAt: new Date(now - 18 * DAY) },
          { partnerId: pt.id, amount: 85_000 + i * 10_000, status: "pending", dueDate: new Date(now + 10 * DAY) },
          // Deliberately past due, so the "متأخر" tile is not always zero.
          ...(i % 3 === 0 ? [{ partnerId: pt.id, amount: 60_000, status: "pending", dueDate: new Date(now - 5 * DAY) }] : []),
        ],
      });
    }
    const hasDebt = await prisma.debt.findFirst({ where: { partnerId: pt.id } });
    if (!hasDebt && i % 2 === 0) {
      await prisma.debt.create({
        data: { partnerId: pt.id, amount: 40_000 + i * 5_000, reason: "سلفة مستحقة", dueDate: new Date(now + 15 * DAY), status: "pending" },
      });
    }
  }

  /* ── call logs ── */
  const ops = await prisma.user.findFirst({ where: { role: "OPERATIONS" }, select: { id: true } });
  const orders = await prisma.order.findMany({ take: 10, select: { id: true, patientId: true }, orderBy: { createdAt: "desc" } });
  if (ops) {
    for (const o of orders) {
      const has = await prisma.callLog.findFirst({ where: { orderId: o.id } });
      if (!has) {
        await prisma.callLog.create({
          data: {
            orderId: o.id,
            callerId: ops.id,
            receiverId: o.patientId,
            // Who was called — the log is useless for dispute resolution if it
            // records a number without saying whose it was.
            receiverType: "PATIENT",
            duration: 60 + Math.floor(Math.random() * 240),
            notes: "تأكيد موعد الخدمة مع المريض",
          },
        });
      }
    }
  }

  /* ── report ── */
  const counts = {
    banners: await prisma.banner.count(),
    campaigns: await prisma.campaign.count(),
    coupons: await prisma.coupon.count(),
    complexes: await prisma.medicalComplex.count(),
    departments: await prisma.department.count(),
    doctorSchedules: await prisma.doctorSchedule.count(),
    equipment: await prisma.radiologyEquipment.count(),
    products: await prisma.product.count(),
    addresses: await prisma.address.count(),
    invoices: await prisma.invoice.count(),
    debts: await prisma.debt.count(),
    callLogs: await prisma.callLog.count(),
  };
  console.log("── after fill ──");
  const thin = Object.entries(counts).filter(([, v]) => v < 3);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(4)}  ${k}`);

  console.log("\n── banners per channel (the home carousel) ──");
  for (const ch of ["DIRECT", "SANAD"] as const) {
    const n = await prisma.banner.count({ where: { isActive: true, OR: [{ channel: ch }, { channel: null }] } });
    console.log(`  ${ch}: ${n}`);
    if (n < 2) throw new Error(`${ch} would render a single card, not a carousel`);
  }

  if (thin.length) throw new Error(`still thin: ${thin.map(([k]) => k).join(", ")}`);
  console.log("\n✓ nothing left below 3 rows");
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
