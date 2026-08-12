import path from "node:path";
import { config as loadEnv } from "dotenv";

// Standalone execution (`tsx prisma/seed.ts`) gets no env injection.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

import { PrismaClient, UserRole, OrderStatus, Priority, OrderSource, PaymentMethod, PaymentStatus, ServiceType, AppointmentType, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { seedOperationalData } from "./seed-operations";
import { normalizePhone } from "../src/lib/phone";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────
// Seed — بيانات تجريبية نظيفة (العراق — بغداد)
// npx tsx prisma/seed.ts
// ─────────────────────────────────────────────────────────────

async function main() {
  // This seed creates a SUPER_ADMIN and prints the account roster. Nothing
  // previously stopped it from being pointed at production.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error(
      "Refusing to seed with NODE_ENV=production.\n" +
        "This creates a SUPER_ADMIN and demo patient data.\n" +
        "Set ALLOW_PROD_SEED=true only if you are certain."
    );
    process.exit(1);
  }

  console.log("🌱 بدء تعبئة البيانات التجريبية...\n");

  // ═══════════════════════════════════════════════════════════
  // 1. المحافظات العراقية
  // ═══════════════════════════════════════════════════════════
  const govNames = [
    "بغداد", "البصرة", "أربيل", "النجف", "كربلاء",
    "الموصل", "السليمانية", "ذي قار", "ديالى", "كركوك",
    "بابل", "الأنبار", "واسط", "ميسان", "صلاح الدين",
    "المثنى", "القادسية", "دهوك",
  ];
  const govs: Record<string, Awaited<ReturnType<typeof prisma.governorate.upsert>>> = {};
  for (const name of govNames) {
    govs[name] = await prisma.governorate.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✅ ${govNames.length} محافظة`);

  // ═══════════════════════════════════════════════════════════
  // 2. المستخدمون
  // ═══════════════════════════════════════════════════════════
  const u = {
    admin: await upsertUser("admin@warid.app", "حسام الراوي", "07701000001", "SUPER_ADMIN", govs["بغداد"].id),
    ops: await upsertUser("ops@warid.app", "زينب العبيدي", "07701000002", "OPERATIONS", govs["بغداد"].id),
    doctor1: await upsertUser("dr.ali@warid.app", "د. علي الجبوري", "07702000001", "DOCTOR", govs["بغداد"].id),
    doctor2: await upsertUser("dr.noor@warid.app", "د. نور الشمري", "07702000002", "DOCTOR", govs["بغداد"].id),
    lab: await upsertUser("lab@warid.app", "مختبرات بغداد المركزية", "07703000001", "LAB", govs["بغداد"].id),
    pharmacy: await upsertUser("pharmacy@warid.app", "صيدلية الرازي", "07704000001", "PHARMACY", govs["بغداد"].id),
    nurse1: await upsertUser("nurse1@warid.app", "هدى الكاظمي", "07705000001", "NURSE", govs["بغداد"].id),
    nurse2: await upsertUser("nurse2@warid.app", "سجاد الموسوي", "07705000002", "NURSE", govs["بغداد"].id),
    driver1: await upsertUser("driver1@warid.app", "حيدر المالكي", "07706000001", "DRIVER", govs["بغداد"].id),
    driver2: await upsertUser("driver2@warid.app", "مصطفى الحسيني", "07706000002", "DRIVER", govs["بغداد"].id),
    radiology: await upsertUser("radiology@warid.app", "مركز دجلة للأشعة", "07707000001", "RADIOLOGY", govs["بغداد"].id),
    complexOwner: await upsertUser("complex@warid.app", "مجمع الكرخ الطبي", "07701500001", "DOCTOR", govs["بغداد"].id),
    patient1: await upsertUser("patient1@warid.app", "أحمد كاظم", "07801000001", "PATIENT", govs["بغداد"].id),
    patient2: await upsertUser("patient2@warid.app", "فاطمة العلي", "07801000002", "PATIENT", govs["بغداد"].id),
    patient3: await upsertUser("patient3@warid.app", "عمر الربيعي", "07801000003", "PATIENT", govs["بغداد"].id),
    patient4: await upsertUser("patient4@warid.app", "زهراء حسين", "07801000004", "PATIENT", govs["بغداد"].id),
    patient5: await upsertUser("patient5@warid.app", "محمد الخفاجي", "07801000005", "PATIENT", govs["البصرة"].id),
  };
  console.log(`✅ ${Object.keys(u).length} مستخدم`);

  // ═══════════════════════════════════════════════════════════
  // 3. الشركاء — كل شريك مرتبط بمستخدم
  // ═══════════════════════════════════════════════════════════
  const p = {
    complexOwner: await upsertPartner(u.complexOwner.id, "مجمع الكرخ الطبي", "DOCTOR", "07701500001", govs["بغداد"].id, "الكرخ — شارع حيفا", { rating: 4.5, totalTasks: 0 }),
    doctor1: await upsertPartner(u.doctor1.id, "د. علي الجبوري", "DOCTOR", "07702000001", govs["بغداد"].id, "المنصور — شارع 14 رمضان", { rating: 4.8, totalTasks: 234, isSanadLinked: true }),
    doctor2: await upsertPartner(u.doctor2.id, "د. نور الشمري", "DOCTOR", "07702000002", govs["بغداد"].id, "الجادرية — قرب جامعة بغداد", { rating: 4.6, totalTasks: 187, isSanadLinked: true }),
    lab: await upsertPartner(u.lab.id, "مختبرات بغداد المركزية", "LAB", "07703000001", govs["بغداد"].id, "الكرادة — شارع أبو نؤاس", { rating: 4.5, totalTasks: 412, isSanadLinked: true }),
    pharmacy: await upsertPartner(u.pharmacy.id, "صيدلية الرازي", "PHARMACY", "07704000001", govs["بغداد"].id, "الأعظمية — شارع عمر بن عبد العزيز", { rating: 4.7, totalTasks: 589 }),
    nurse1: await upsertPartner(u.nurse1.id, "هدى الكاظمي", "NURSE", "07705000001", govs["بغداد"].id, "الكاظمية", { rating: 4.9, totalTasks: 156 }),
    nurse2: await upsertPartner(u.nurse2.id, "سجاد الموسوي", "NURSE", "07705000002", govs["بغداد"].id, "زيونة", { rating: 4.7, totalTasks: 98 }),
    driver1: await upsertPartner(u.driver1.id, "حيدر المالكي", "DRIVER", "07706000001", govs["بغداد"].id, "البياع", { rating: 4.6, totalTasks: 723 }),
    driver2: await upsertPartner(u.driver2.id, "مصطفى الحسيني", "DRIVER", "07706000002", govs["بغداد"].id, "الشعب", { rating: 4.4, totalTasks: 451 }),
    radiology: await upsertPartner(u.radiology.id, "مركز دجلة للأشعة", "RADIOLOGY", "07707000001", govs["بغداد"].id, "الحارثية — قرب مستشفى ابن سينا", { rating: 4.3, totalTasks: 167 }),
  };
  console.log(`✅ ${Object.keys(p).length} شريك`);

  // ═══════════════════════════════════════════════════════════
  // 4. المجمع الطبي — يحتاج partnerId
  // ═══════════════════════════════════════════════════════════
  const complex = await prisma.medicalComplex.upsert({
    where: { partnerId: p.complexOwner.id },
    update: {},
    create: {
      partnerId: p.complexOwner.id,
      name: "مجمع الكرخ الطبي",
    },
  });

  // ربط الأطباء والمختبر والأشعة بالمجمع
  await prisma.partner.update({ where: { id: p.doctor1.id }, data: { complexId: complex.id } });
  await prisma.partner.update({ where: { id: p.lab.id }, data: { complexId: complex.id } });
  await prisma.partner.update({ where: { id: p.radiology.id }, data: { complexId: complex.id } });

  // أقسام
  await prisma.department.upsert({ where: { id: "dept-general" }, update: {}, create: { id: "dept-general", complexId: complex.id, name: "الطب العام" } });
  await prisma.department.upsert({ where: { id: "dept-dental" }, update: {}, create: { id: "dept-dental", complexId: complex.id, name: "طب الأسنان" } });
  await prisma.department.upsert({ where: { id: "dept-internal" }, update: {}, create: { id: "dept-internal", complexId: complex.id, name: "الباطنية" } });
  console.log("✅ 1 مجمع + 3 أقسام + 3 شركاء مرتبطين");

  // ═══════════════════════════════════════════════════════════
  // 5. ملفات الأطباء (DoctorProfile) — مطلوب للمواعيد والوصفات
  // ═══════════════════════════════════════════════════════════
  const dp1 = await prisma.doctorProfile.upsert({
    where: { userId: u.doctor1.id },
    update: {},
    create: { userId: u.doctor1.id, complexId: complex.id, experience: 12, gender: "ذكر" },
  });
  const dp2 = await prisma.doctorProfile.upsert({
    where: { userId: u.doctor2.id },
    update: {},
    create: { userId: u.doctor2.id, experience: 8, gender: "أنثى" },
  });
  console.log("✅ 2 ملف طبيب");

  // ═══════════════════════════════════════════════════════════
  // 6. المحافظ المالية
  // ═══════════════════════════════════════════════════════════
  const walletEntries: [string, number, number, number][] = [
    [p.doctor1.id, 1_250_000, 350_000, 8_500_000],
    [p.doctor2.id, 980_000, 220_000, 6_200_000],
    [p.lab.id, 2_100_000, 680_000, 15_400_000],
    [p.pharmacy.id, 3_450_000, 1_200_000, 28_900_000],
    [p.nurse1.id, 420_000, 85_000, 3_100_000],
    [p.nurse2.id, 310_000, 60_000, 2_400_000],
    [p.driver1.id, 180_000, 45_000, 4_800_000],
    [p.driver2.id, 145_000, 30_000, 3_200_000],
    [p.radiology.id, 890_000, 250_000, 7_600_000],
  ];
  for (const [partnerId, balance, pendingAmount, totalEarnings] of walletEntries) {
    // A wallet may already exist because `settleOrder` created one when it paid
    // this partner. In that case its balance is REAL — the sum of actual
    // settlements — and the demo figure below must not touch it.
    const existing = await prisma.wallet.findUnique({ where: { partnerId }, select: { id: true } });
    if (existing) continue;

    const wallet = await prisma.wallet.create({
      data: { partnerId, balance, pendingAmount, totalEarnings },
    });

    // The opening balance is fabricated for the demo, so it is written as a
    // real ledger entry rather than as a bare number on the wallet.
    //
    // Every wallet here rests on `balance == sum(transactions)`. Seeding
    // `balance` alone broke it: the admin wallets screen showed 980,000 د.ع
    // while the transfers screen — which lists the transactions — explained
    // none of it, and later settlements incremented on top of a figure nothing
    // accounted for.
    await prisma.transaction.create({
      data: {
        id: `seed-open-${partnerId}`,
        walletId: wallet.id,
        amount: balance,
        type: "CREDIT",
        description: "رصيد افتتاحي",
      },
    });
  }
  console.log("✅ محافظ الشركاء + قيد افتتاحي لكل محفظة جديدة");

  // ═══════════════════════════════════════════════════════════
  // 7. العقود + قواعد النسب ⭐
  // ═══════════════════════════════════════════════════════════
  const contractDr1 = await prisma.contract.upsert({
    where: { partnerId: p.doctor1.id },
    update: {},
    create: {
      partnerId: p.doctor1.id,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2026-12-31"),
      services: ["IN_PERSON_CONSULT", "ONLINE_CONSULT", "HOME_VISIT"],
      governorates: ["بغداد", "البصرة", "أربيل"],
      workHours: { start: "09:00", end: "21:00" },
      minPrices: { IN_PERSON_CONSULT: 15000, ONLINE_CONSULT: 10000 },
      terms: "يلتزم الطبيب بمعايير وزارة الصحة العراقية",
      isActive: true,
    },
  });

  const contractLab = await prisma.contract.upsert({
    where: { partnerId: p.lab.id },
    update: {},
    create: {
      partnerId: p.lab.id,
      startDate: new Date("2025-03-01"),
      endDate: new Date("2027-02-28"),
      services: ["LAB_TEST", "HOME_BLOOD_DRAW"],
      governorates: ["بغداد"],
      workHours: { start: "08:00", end: "22:00" },
      minPrices: { LAB_TEST: 5000 },
      terms: "يلتزم المختبر بالاعتماد الدولي ISO 15189",
      isActive: true,
    },
  });

  const contractPharmacy = await prisma.contract.upsert({
    where: { partnerId: p.pharmacy.id },
    update: {},
    create: {
      partnerId: p.pharmacy.id,
      startDate: new Date("2025-06-01"),
      endDate: new Date("2026-05-31"),
      services: ["PHARMACY_DISPENSE", "MEDICINE_DELIVERY"],
      governorates: ["بغداد"],
      workHours: { start: "08:00", end: "00:00" },
      minPrices: { MEDICINE_DELIVERY: 3000 },
      terms: "يلتزم بأسعار نقابة الصيادلة العراقية",
      isActive: true,
    },
  });

  // قواعد النسب — 4 سيناريوهات (req L215-228)
  // استشارة حضورية: طبيب 70%, مجمع 20%, وريد 10%
  await upsertCommission(contractDr1.id, "IN_PERSON_CONSULT", 70, 20, 10, 0, 0);
  // استشارة أونلاين: طبيب 80%, وريد 20%
  await upsertCommission(contractDr1.id, "ONLINE_CONSULT", 80, 0, 20, 0, 0);
  // تحليل منزلي: مختبر 60%, ممرض 15%, سائق 10%, وريد 15%
  await upsertCommission(contractLab.id, "HOME_LAB_TEST", 60, 0, 15, 15, 10);
  // دواء مع توصيل: صيدلية 82%, سائق 8%, وريد 10%
  await upsertCommission(contractPharmacy.id, "MEDICINE_DELIVERY", 82, 0, 10, 0, 8);
  console.log("✅ 3 عقود + 4 قواعد نسب");

  // ── تغطية بقية الشركاء ─────────────────────────────────────
  //
  // The three contracts above are hand-tuned demonstrations. Every OTHER
  // partner had none, and settlement refuses a provider without an active
  // contract carrying a rule for the order's service — so completing an order
  // assigned to any of them succeeded while the revenue split silently failed
  // and nobody was paid. 2 of 35 partners were settleable.
  //
  // These fill-in rules deliberately allocate to the provider and the platform
  // ONLY. A rule that reserves a percentage for a nurse, driver or complex
  // throws PARTY_UNASSIGNED whenever that party is not on the order, so a
  // blanket rule with those shares would trade one failure for another. The
  // percentages are a starting point — the admin contract screen edits them.
  const FILL_IN_SERVICES: Record<string, { services: ServiceType[]; partnerShare: number }> = {
    LAB: { services: ["LAB_TEST", "HOME_LAB_TEST", "HOME_BLOOD_DRAW"], partnerShare: 75 },
    PHARMACY: { services: ["PHARMACY_DISPENSE", "MEDICINE_DELIVERY"], partnerShare: 80 },
    RADIOLOGY: { services: ["RADIOLOGY"], partnerShare: 75 },
    NURSE: {
      services: ["NURSING", "HOME_VISIT", "HOME_BLOOD_DRAW", "PHYSIOTHERAPY", "IN_PERSON_CONSULT", "ONLINE_CONSULT"],
      partnerShare: 70,
    },
    DRIVER: { services: ["TAXI", "MEDICINE_DELIVERY"], partnerShare: 80 },
    DOCTOR: { services: ["IN_PERSON_CONSULT", "ONLINE_CONSULT", "HOME_VISIT"], partnerShare: 75 },
  };

  const allPartners = await prisma.partner.findMany({
    where: { deletedAt: null },
    select: { id: true, type: true, contract: { select: { id: true } } },
  });

  let filledContracts = 0;
  let filledRules = 0;
  for (const partner of allPartners) {
    const plan = FILL_IN_SERVICES[partner.type];
    if (!plan) continue;

    // Leave the three hand-tuned contracts exactly as they are.
    let contractId = partner.contract?.id;
    if (!contractId) {
      const created = await prisma.contract.create({
        data: {
          partnerId: partner.id,
          startDate: new Date("2025-01-01"),
          endDate: new Date("2027-12-31"),
          services: plan.services,
          governorates: [],
          workHours: { start: "08:00", end: "22:00" },
          minPrices: {},
          terms: "عقد قياسي — النسب قابلة للتعديل من لوحة الإدارة",
          isActive: true,
        },
        select: { id: true },
      });
      contractId = created.id;
      filledContracts += 1;
    }

    for (const serviceType of plan.services) {
      // `upsertCommission` does not overwrite, so an existing hand-tuned rule
      // survives and only the gaps are filled.
      const before = await prisma.commissionRule.count({
        where: { contractId, serviceType },
      });
      await upsertCommission(contractId, serviceType, plan.partnerShare, 0, 100 - plan.partnerShare, 0, 0);
      if (before === 0) filledRules += 1;
    }
  }
  console.log(`✅ ${filledContracts} عقد إضافي + ${filledRules} قاعدة نسب لتغطية كل الشركاء`);

  // ── العقود المنتهية ────────────────────────────────────────
  //
  // The three demonstration contracts above carry fixed end dates, and
  // `upsert(..., update: {})` never revisits a row once created — so they rot.
  // صيدلية الرازي's contract ended 2026-05-31 and settlement had begun refusing
  // it with "عقد الشريك منتهي الصلاحية", which reads like a bug in the split
  // rather than a stale seed.
  //
  // Pushing only the already-expired ones forward keeps this idempotent and
  // leaves any deliberate end date in the future untouched.
  const revived = await prisma.contract.updateMany({
    where: { endDate: { lt: new Date() } },
    // `today` is declared further down this function — use the clock directly.
    data: { endDate: new Date(Date.now() + 730 * 86400000) },
  });
  if (revived.count > 0) console.log(`✅ ${revived.count} عقد منتهي تم تمديده`);

  // ═══════════════════════════════════════════════════════════
  // 8. إعدادات الخدمات
  // ═══════════════════════════════════════════════════════════
  const svcConfigs: [string, ServiceType, number][] = [
    [p.doctor1.id, "IN_PERSON_CONSULT", 15], [p.doctor1.id, "ONLINE_CONSULT", 10], [p.doctor1.id, "HOME_VISIT", 3],
    [p.doctor2.id, "IN_PERSON_CONSULT", 12], [p.doctor2.id, "ONLINE_CONSULT", 8],
    [p.lab.id, "HOME_BLOOD_DRAW", 30], [p.lab.id, "HOME_LAB_TEST", 10],
    [p.pharmacy.id, "MEDICINE_DELIVERY", 50],
  ];
  for (const [partnerId, serviceType, dailyCapacity] of svcConfigs) {
    await prisma.serviceConfig.upsert({
      where: { partnerId_serviceType: { partnerId, serviceType } },
      update: {},
      create: { partnerId, serviceType, status: "ACTIVE", dailyCapacity },
    });
  }
  console.log("✅ 8 إعدادات خدمة");

  // ═══════════════════════════════════════════════════════════
  // 9. جدول الطبيب — dayOfWeek is Int (0=Sun, 6=Sat)
  // ═══════════════════════════════════════════════════════════
  const workDays: [number, string, string][] = [
    [0, "09:00", "17:00"], // الأحد
    [1, "09:00", "17:00"], // الاثنين
    [2, "09:00", "17:00"], // الثلاثاء
    [3, "09:00", "17:00"], // الأربعاء
    [4, "09:00", "14:00"], // الخميس
  ];
  for (const [dayOfWeek, startTime, endTime] of workDays) {
    await prisma.doctorSchedule.upsert({
      where: { doctorId_dayOfWeek: { doctorId: dp1.id, dayOfWeek } },
      update: {},
      create: { doctorId: dp1.id, dayOfWeek, startTime, endTime, isActive: true },
    });
  }
  console.log("✅ 5 أيام جدول");

  // ═══════════════════════════════════════════════════════════
  // 10. الأسعار
  // ═══════════════════════════════════════════════════════════
  const prices: [string, ServiceType, number, number, number][] = [
    ["price-consult", "IN_PERSON_CONSULT", 25000, 20000, 18000],
    ["price-online", "ONLINE_CONSULT", 15000, 12000, 10000],
    ["price-homevisit", "HOME_VISIT", 50000, 40000, 35000],
    ["price-cbc", "LAB_TEST", 10000, 8000, 7000],
    ["price-xray", "RADIOLOGY", 30000, 25000, 22000],
    // Every service that has a CommissionRule must also have a price, or the
    // order cannot be priced and therefore can never be settled.
    ["price-home-lab", "HOME_LAB_TEST", 20000, 17000, 15000],
    ["price-med-delivery", "MEDICINE_DELIVERY", 5000, 4000, 3500],
    ["price-blood-draw", "HOME_BLOOD_DRAW", 12000, 10000, 9000],
  ];
  for (const [id, serviceType, basePrice, sanadPrice, complexPrice] of prices) {
    await prisma.priceConfig.upsert({
      where: { id },
      update: {},
      create: { id, serviceType, basePrice, sanadPrice, complexPrice },
    });
  }
  console.log("✅ 5 أسعار");

  // ═══════════════════════════════════════════════════════════
  // 11. الطلبات — سيناريوهات واقعية
  // ═══════════════════════════════════════════════════════════
  const today = new Date();
  const patients = [u.patient1, u.patient2, u.patient3, u.patient4, u.patient5];

  const orders = [
    // 1: أحمد — زيارة منزلية جديدة
    await upsertOrder("ORD-2025-001", u.patient1.id, "أحمد كاظم", "07801000001", "HOME_VISIT", "NEW", "NORMAL", "DIRECT", govs["بغداد"].id, "المنصور", "حي المنصور — زقاق 3، دار 15"),
    // 2: فاطمة — سحب دم (مقبول، تم تعيين ممرض وسائق)
    await upsertOrder("ORD-2025-002", u.patient2.id, "فاطمة العلي", "07801000002", "HOME_BLOOD_DRAW", "ASSIGNED", "URGENT", "SANAD", govs["بغداد"].id, "الكرادة", "الكرادة داخل — شارع 52", { assignedNurseId: p.nurse1.id, assignedDriverId: p.driver1.id }),
    // 3: عمر — استشارة أونلاين (قيد التنفيذ)
    await upsertOrder("ORD-2025-003", u.patient3.id, "عمر الربيعي", "07801000003", "ONLINE_CONSULT", "IN_PROGRESS", "NORMAL", "COMPLEX", govs["بغداد"].id, "الجادرية", "حي الجادرية"),
    // 4: زهراء — توصيل دواء (في الطريق)
    await upsertOrder("ORD-2025-004", u.patient4.id, "زهراء حسين", "07801000004", "MEDICINE_DELIVERY", "IN_TRANSIT", "NORMAL", "DIRECT", govs["بغداد"].id, "الأعظمية", "قرب جامع أبي حنيفة", { assignedDriverId: p.driver2.id, assignedPharmacyId: p.pharmacy.id }),
    // 5: محمد — أشعة (تم تعيين مركز)
    await upsertOrder("ORD-2025-005", u.patient5.id, "محمد الخفاجي", "07801000005", "RADIOLOGY", "ASSIGNED", "URGENT", "SANAD", govs["بغداد"].id, "الحارثية", "شارع الكندي", { assignedRadiologyId: p.radiology.id }),
    // 6: أحمد — تحليل منزلي (مكتمل)
    await upsertOrder("ORD-2025-006", u.patient1.id, "أحمد كاظم", "07801000001", "HOME_LAB_TEST", "COMPLETED", "NORMAL", "DIRECT", govs["بغداد"].id, "المنصور", "حي المنصور — زقاق 3، دار 15", { assignedNurseId: p.nurse2.id, assignedDriverId: p.driver1.id, assignedLabId: p.lab.id }),
    // 7: فاطمة — حضوري (حرج متأخر)
    await upsertOrder("ORD-2025-007", u.patient2.id, "فاطمة العلي", "07801000002", "IN_PERSON_CONSULT", "DELAYED", "CRITICAL", "COMPLEX", govs["بغداد"].id, "الكرادة", "شارع 52"),
    // 8: عمر — زيارة منزلية جديدة
    await upsertOrder("ORD-2025-008", u.patient3.id, "عمر الربيعي", "07801000003", "HOME_VISIT", "NEW", "NORMAL", "SANAD", govs["بغداد"].id, "زيونة", "محلة 710"),
  ];
  console.log(`✅ ${orders.length} طلبات`);

  // ═══════════════════════════════════════════════════════════
  // 12. المواعيد — اليوم لد. علي (doctorId → DoctorProfile)
  // ═══════════════════════════════════════════════════════════
  const aptData: [(typeof patients)[number], string, AppointmentType, string][] = [
    // Statuses must come from the API's own vocabulary —
    // `scheduled | completed | cancelled | no_show` (see api/appointments).
    // This seeded "confirmed" and "in_progress", neither of which exists, so
    // the doctor's "المواعيد القادمة" KPI — which counts `scheduled` — read ٠
    // with twenty appointments in the table, and PATCHing one of these rows
    // through the API would have been a 400.
    [patients[0], "09:00", "IN_PERSON", "completed"],
    [patients[1], "10:30", "IN_PERSON", "completed"],
    [patients[2], "12:00", "ONLINE", "scheduled"],
    [patients[3], "14:00", "IN_PERSON", "scheduled"],
    [patients[4], "16:00", "ONLINE", "scheduled"],
  ];
  for (const [aptIndex, [patient, time, type, status]] of aptData.entries()) {
    const date = new Date(today); const [h, m] = time.split(":").map(Number); date.setHours(h, m, 0, 0);
    await prisma.appointment.upsert({
      where: { id: `seed-apt-${aptIndex}` },
      // Re-anchored to today on every run. With `update: {}` these kept the
      // date of whichever day the seed first ran, so "مواعيد اليوم" was empty
      // on every dashboard from the second day onwards.
      update: { date, time, status },
      create: { id: `seed-apt-${aptIndex}`, doctorId: dp1.id, patientId: patient.id, date, time, type, status },
    });
  }
  console.log("✅ 5 مواعيد");

  // ═══════════════════════════════════════════════════════════
  // 13. عينات المختبر — sampleType (not testType)
  // ═══════════════════════════════════════════════════════════
  const labData: [string, string, string][] = [
    [orders[1].id, "CBC — فحص دم شامل", "received"],
    [orders[5].id, "سكر صائم", "sent_to_patient"],
    [orders[5].id, "وظائف الكلى", "sent_to_doctor"],
    [orders[1].id, "وظائف الكبد", "in_lab"],
    [orders[1].id, "فيتامين D", "testing"],
    [orders[5].id, "TSH — الغدة الدرقية", "ready"],
  ];
  for (const [orderId, sampleType, status] of labData) {
    await prisma.labSample.upsert({ where: { id: `seed-lab-${orderId}` }, update: {}, create: { id: `seed-lab-${orderId}`, orderId, labId: p.lab.id, sampleType, status } });
  }
  console.log("✅ 6 عينات مختبر");

  // ═══════════════════════════════════════════════════════════
  // 14. الوصفات — doctorId→DoctorProfile, patientId→User
  // ═══════════════════════════════════════════════════════════
  const rxData: [string, string, string, string, Prisma.InputJsonValue][] = [
    [dp1.id, u.patient4.id, orders[3].id, "ready", [{ name: "أموكسيسيلين 500mg", qty: 21 }, { name: "باراسيتامول 500mg", qty: 30 }]],
    [dp1.id, u.patient1.id, orders[5].id, "delivered", [{ name: "ميتفورمين 850mg", qty: 60 }, { name: "أتورفاستاتين 20mg", qty: 30 }]],
    [dp2.id, u.patient1.id, orders[0].id, "new", [{ name: "أوميبرازول 20mg", qty: 28 }]],
    [dp1.id, u.patient2.id, orders[6].id, "preparing", [{ name: "أنسولين لانتوس", qty: 5 }, { name: "إبر أنسولين", qty: 100 }]],
  ];
  for (const [doctorId, patientId, orderId, status, medications] of rxData) {
    await prisma.prescription.upsert({
      where: { id: `seed-rx-${orderId}` },
      update: {},
      create: { id: `seed-rx-${orderId}`, doctorId, patientId, pharmacyId: p.pharmacy.id, orderId, status, medications },
    });
  }
  console.log("✅ 4 وصفات");

  // ═══════════════════════════════════════════════════════════
  // 15. طلبات الأشعة
  // ═══════════════════════════════════════════════════════════
  await prisma.radiologyRequest.upsert({ where: { id: "seed-rad-4" }, update: {}, create: { id: "seed-rad-4", orderId: orders[4].id, centerId: p.radiology.id, requestType: "أشعة سينية — صدر", status: "scheduled", appointmentDate: new Date(today.getTime() + 86400000) } });
  await prisma.radiologyRequest.upsert({ where: { id: "seed-rad-6" }, update: {}, create: { id: "seed-rad-6", orderId: orders[6].id, centerId: p.radiology.id, requestType: "أشعة مقطعية — بطن", status: "imaged", appointmentDate: today } });
  await prisma.radiologyRequest.upsert({ where: { id: "seed-rad-5" }, update: {}, create: { id: "seed-rad-5", orderId: orders[5].id, centerId: p.radiology.id, requestType: "سونار — بطن", status: "report_ready", appointmentDate: new Date(today.getTime() - 86400000) } });
  console.log("✅ 3 طلبات أشعة");

  // ═══════════════════════════════════════════════════════════
  // 16. جلسات سند — appointmentTime is DateTime
  // ═══════════════════════════════════════════════════════════
  const sanadTimes = [
    { doctorId: dp1.id, patientId: patients[2].id, hour: 12, status: "in_session" },
    { doctorId: dp2.id, patientId: patients[4].id, hour: 13, status: "waiting" },
    { doctorId: dp1.id, patientId: patients[0].id, hour: 9, status: "ended" },
    { doctorId: dp2.id, patientId: patients[1].id, hour: 11, status: "ended" },
  ];
  for (const [i, s] of sanadTimes.entries()) {
    const aptTime = new Date(today); aptTime.setHours(s.hour, 0, 0, 0);
    await prisma.sanadSession.upsert({
      where: { id: `seed-sanad-${i}` },
      update: {},
      create: { id: `seed-sanad-${i}`, doctorId: s.doctorId, patientId: s.patientId, appointmentTime: aptTime, status: s.status },
    });
  }
  console.log("✅ 4 جلسات سند");

  // ═══════════════════════════════════════════════════════════
  // 17. بنك الدم — bloodType is BloodType enum, needs requestType
  // ═══════════════════════════════════════════════════════════
  await prisma.bloodBankRequest.upsert({ where: { id: "seed-bb-68" }, update: {}, create: { id: "seed-bb-68", requestType: "REQUESTER", fullName: "حيدر عباس كريم", phone: "07701234501", age: 34, gender: "ذكر", residence: "بغداد - الكرادة", landmark: "قرب جامع الرحمن", bloodType: "A_POS", governorateId: govs["بغداد"].id, status: "new", operationType: "عملية قلب مفتوح", bagsNeeded: 3, operationPlace: "مستشفى ابن البيطار" } });
  await prisma.bloodBankRequest.upsert({ where: { id: "seed-bb-851" }, update: {}, create: { id: "seed-bb-851", requestType: "DONOR", fullName: "سعد الجبوري محمد", phone: "07701234502", age: 28, gender: "ذكر", residence: "بغداد - الأعظمية", landmark: "قرب ساحة عنتر", bloodType: "O_NEG", governorateId: govs["بغداد"].id, status: "matched", lastDonation: new Date(today.getTime() - 120 * 86400000), donorName: "سعد الجبوري", drawAppointment: new Date() } });
  await prisma.bloodBankRequest.upsert({ where: { id: "seed-bb-162" }, update: {}, create: { id: "seed-bb-162", requestType: "REQUESTER", fullName: "زينب علي حسن", phone: "07701234503", age: 41, gender: "أنثى", residence: "البصرة - المعقل", landmark: "قرب مستشفى الموانئ", bloodType: "B_POS", governorateId: govs["البصرة"].id, status: "fulfilled", operationType: "ولادة قيصرية", bagsNeeded: 2, operationPlace: "مستشفى البصرة التعليمي", donorName: "كرار العبادي", drawAppointment: new Date(today.getTime() - 2 * 86400000) } });
  console.log("✅ 3 طلبات بنك دم");

  // ═══════════════════════════════════════════════════════════
  // 18. الحملات والكوبونات — discountType + discountValue
  // ═══════════════════════════════════════════════════════════
  await prisma.campaign.upsert({
    where: { id: "campaign-summer" }, update: {},
    create: { id: "campaign-summer", name: "حملة الصيف — تحاليل منزلية", discountType: "PERCENTAGE", discountValue: 20, startDate: new Date("2026-06-01"), endDate: new Date("2026-08-31"), isActive: true },
  });
  await prisma.coupon.upsert({
    where: { code: "WARID25" }, update: {},
    create: { code: "WARID25", discountType: "PERCENTAGE", discountValue: 25, maxUses: 200, usedCount: 67, expiresAt: new Date("2026-12-31"), isActive: true },
  });
  await prisma.coupon.upsert({
    where: { code: "FIRSTVISIT" }, update: {},
    create: { code: "FIRSTVISIT", discountType: "PERCENTAGE", discountValue: 50, maxUses: 500, usedCount: 312, expiresAt: new Date("2026-09-30"), isActive: true },
  });
  console.log("✅ 1 حملة + 2 كوبون");

  // ═══════════════════════════════════════════════════════════
  // 19. الإشعارات + سجل النشاط
  // ═══════════════════════════════════════════════════════════
  const notifications = [
    { userId: u.ops.id, title: "طلب جديد", body: "طلب زيارة منزلية — أحمد كاظم، المنصور", type: "order" },
    { userId: u.ops.id, title: "⚠️ طلب حرج", body: "ORD-2025-007 متأخر — فاطمة العلي", type: "critical" },
    { userId: u.doctor1.id, title: "موعد جديد", body: "الساعة 14:00 — زهراء حسين", type: "appointment" },
    { userId: u.pharmacy.id, title: "وصفة جديدة", body: "من د. علي — أموكسيسيلين + باراسيتامول", type: "prescription" },
    { userId: u.admin.id, title: "تقرير يومي", body: "23 طلب مكتمل — إيرادات 1,250,000 د.ع", type: "report" },
    { userId: u.lab.id, title: "عينة جاهزة", body: "TSH لأحمد كاظم — تحتاج مراجعة", type: "lab" },
  ];
  for (const [nIndex, n] of notifications.entries()) {
    await prisma.notification.upsert({ where: { id: `seed-notif-${nIndex}` }, update: {}, create: { id: `seed-notif-${nIndex}`, ...n, channel: "IN_APP", isRead: false } });
  }

  const activities = [
    { action: "قبول طلب ORD-2025-002 — سحب دم منزلي", userId: u.ops.id },
    { action: "تعيين هدى الكاظمي للطلب ORD-2025-002", userId: u.ops.id },
    { action: "إرسال نتيجة CBC لفاطمة العلي", userId: u.lab.id },
    { action: "صرف وصفة — ميتفورمين + أتورفاستاتين", userId: u.pharmacy.id },
    { action: "إنهاء جلسة سند — د. علي مع أحمد كاظم", userId: u.doctor1.id },
    { action: "رفع تقرير سونار — أحمد كاظم", userId: u.radiology.id },
  ];
  for (const [aIndex, a] of activities.entries()) {
    await prisma.activityLog.upsert({ where: { id: `seed-act-${aIndex}` }, update: {}, create: { id: `seed-act-${aIndex}`, ...a } });
  }
  console.log("✅ 6 إشعارات + 6 سجلات نشاط");

  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // 15. التخصصات الطبية — moved out of the frontend constants file so the
  //     mobile app can list them and DoctorProfile.specialtyId is a real FK
  // ═══════════════════════════════════════════════════════════
  const specialties = [
    { slug: "oncology", name: "أورام وأمراض دم", icon: "Droplet", color: "bg-rose-100 text-rose-600", sortOrder: 0 },
    { slug: "gynecology", name: "أمراض نسائية", icon: "Users", color: "bg-fuchsia-100 text-fuchsia-600", sortOrder: 1 },
    { slug: "urology", name: "مسالك بولية وأمراض الذكورة", icon: "Activity", color: "bg-blue-100 text-blue-600", sortOrder: 2 },
    { slug: "pediatrics", name: "صحة الطفل", icon: "Baby", color: "bg-yellow-100 text-yellow-600", sortOrder: 3 },
    { slug: "internal-medicine", name: "الباطنية والجهاز الهضمي والسكر", icon: "HeartPulse", color: "bg-emerald-100 text-emerald-600", sortOrder: 4 },
    { slug: "nutrition", name: "التغذية", icon: "Salad", color: "bg-lime-100 text-lime-600", sortOrder: 5 },
    { slug: "dermatology", name: "الجلدية والتجميل", icon: "Sparkles", color: "bg-pink-100 text-pink-600", sortOrder: 6 },
    { slug: "palliative-care", name: "التلطيف", icon: "Leaf", color: "bg-teal-100 text-teal-600", sortOrder: 7 },
    { slug: "dentistry", name: "الأسنان", icon: "Stethoscope", color: "bg-cyan-100 text-cyan-600", sortOrder: 8 },
    { slug: "orthopedics", name: "المفاصل والكسور", icon: "Accessibility", color: "bg-orange-100 text-orange-600", sortOrder: 9 },
    { slug: "mental-health", name: "الطب النفسي والإرشاد", icon: "Brain", color: "bg-indigo-100 text-indigo-600", sortOrder: 10 },
    { slug: "ophthalmology", name: "طب العيون", icon: "Eye", color: "bg-sky-100 text-sky-600", sortOrder: 11 },
    { slug: "ent", name: "الأنف والأذن والحنجرة", icon: "Ear", color: "bg-violet-100 text-violet-600", sortOrder: 12 },
  ];
  for (const sp of specialties) {
    await prisma.specialty.upsert({
      where: { slug: sp.slug },
      update: { name: sp.name, icon: sp.icon, color: sp.color, sortOrder: sp.sortOrder },
      create: sp,
    });
  }
  console.log(`✅ ${specialties.length} تخصص`);

  // ═══════════════════════════════════════════════════════════
  // 16. منتجات الصيدلية — the cart could never be priced server-side while
  //     this lived only in demo-data.ts
  // ═══════════════════════════════════════════════════════════
  const products: [string, string, string, number, boolean][] = [
    ["prod-panadol", "بنادول اكسترا", "مسكنات", 3000, false],
    ["prod-augmentin", "أوجمنتين 1g", "مضادات حيوية", 12000, true],
    ["prod-vitc", "فيتامين C 1000", "فيتامينات", 8000, false],
    ["prod-insulin", "أنسولين لانتوس", "أدوية مزمنة", 45000, true],
    ["prod-thermometer", "ميزان حرارة رقمي", "مستلزمات طبية", 15000, false],
    ["prod-bp-monitor", "جهاز قياس ضغط", "مستلزمات طبية", 65000, false],
  ];
  for (const [id, name, category, price, requiresRx] of products) {
    await prisma.product.upsert({
      where: { id },
      update: {},
      create: { id, pharmacyId: p.pharmacy.id, name, category, price, requiresRx },
    });
  }
  console.log(`✅ ${products.length} منتج صيدلية`);


  // ═══════════════════════════════════════════════════════════
  // 17. البيانات التشغيلية — طلبات وتسويات عبر 14 يوماً
  //
  // The dashboards aggregate over time: revenue trend, revenue by service,
  // orders by status, top partners, platform profit, satisfaction. A handful
  // of orders all created at the same instant, none priced and none settled,
  // gives every one of those charts nothing to show.
  // ═══════════════════════════════════════════════════════════
  const ops = await seedOperationalData(prisma, {
    partners: {
      doctor1: p.doctor1.id, doctor2: p.doctor2.id, lab: p.lab.id,
      pharmacy: p.pharmacy.id, nurse1: p.nurse1.id, nurse2: p.nurse2.id,
      driver1: p.driver1.id, driver2: p.driver2.id,
      radiology: p.radiology.id, complexOwner: p.complexOwner.id,
    },
    patientIds: [u.patient1.id, u.patient2.id, u.patient3.id, u.patient4.id, u.patient5.id],
    governorateId: govs["بغداد"].id,
    adminUserId: u.admin.id,
  });
  console.log(
    `✅ ${ops.orders} طلب تشغيلي (${ops.completed} مكتمل) + ${ops.settlements} تسوية + ${ops.transactions} حركة مالية`
  );

  console.log("\n🎉 اكتملت تعبئة البيانات بنجاح!");
  console.log("═══════════════════════════════════════════");
  console.log("👤 حسابات تسجيل الدخول:");
  console.log("   مدير النظام : admin@warid.app");
  console.log("   العمليات    : ops@warid.app");
  console.log("   طبيب 1     : dr.ali@warid.app");
  console.log("   طبيب 2     : dr.noor@warid.app");
  console.log("   مختبر      : lab@warid.app");
  console.log("   صيدلية     : pharmacy@warid.app");
  console.log("   ممرض 1     : nurse1@warid.app");
  console.log("   سائق 1     : driver1@warid.app");
  console.log("   أشعة       : radiology@warid.app");
  console.log("═══════════════════════════════════════════");
}

// ─── Helpers ──────────────────────────────────────────────

async function upsertUser(email: string, name: string, phone: string, role: UserRole, governorateId: string) {
  // Canonical form, because `User.phone` is the OTP sign-in credential: the
  // login path normalises the number it was given and looks it up verbatim.
  // Seeded as "07801000001" it never matched the "9647801000001" that sign-in
  // searches for, so every seeded patient signing in by phone was handed a
  // NEW empty account instead of their own.
  const canonical = normalizePhone(phone);
  if (!canonical) throw new Error(`seed: "${phone}" is not a valid Iraqi mobile (${email})`);

  return prisma.user.upsert({
    where: { email },
    // Re-anchored, so an existing row seeded in local format is corrected.
    update: { phone: canonical },
    create: { email, name, phone: canonical, role, isActive: true, governorateId },
  });
}

async function upsertPartner(
  userId: string, name: string, type: UserRole, phone: string,
  governorateId: string, address: string,
  opts: { rating?: number; totalTasks?: number; isSanadLinked?: boolean } = {}
) {
  return prisma.partner.upsert({
    where: { userId },
    update: {},
    create: {
      userId, name, type, phone, governorateId, address,
      status: "ACTIVE",
      rating: opts.rating ?? 0,
      totalTasks: opts.totalTasks ?? 0,
      // Channel membership is a row per storefront, not a boolean. Everyone
      // sells direct; `isSanadLinked` in the caller's options now means
      // "also in Sanad".
      channels: {
        create: [
          { channel: "DIRECT" as const },
          ...(opts.isSanadLinked ? [{ channel: "SANAD" as const }] : []),
        ],
      },
    },
  });
}

async function upsertOrder(
  orderNumber: string, patientId: string, patientName: string, patientPhone: string,
  serviceType: ServiceType, status: OrderStatus, priority: Priority, source: OrderSource,
  governorateId: string, area: string, address: string,
  assignments: { assignedNurseId?: string; assignedDriverId?: string; assignedLabId?: string; assignedPharmacyId?: string; assignedRadiologyId?: string } = {}
) {
  return prisma.order.upsert({
    where: { orderNumber },
    update: {},
    create: {
      orderNumber, patientId, patientName, patientPhone, serviceType,
      status, priority, source,
      governorateId, area, address,
      paymentMethod: status === "COMPLETED" || status === "ASSIGNED" ? PaymentMethod.CARD : PaymentMethod.CASH,
      paymentStatus: status === "COMPLETED" || status === "IN_TRANSIT" ? PaymentStatus.PAID : PaymentStatus.PENDING,
      ...assignments,
    },
  });
}

/**
 * Ensure an OPEN commission rule exists for this contract + service.
 *
 * No longer an upsert on @@unique([contractId, serviceType]): a contract now
 * holds many historical versions per service and only the one with no
 * `effectiveTo` is in force. Seeding must never close or duplicate a live
 * version, so it looks for an open one and creates it only when absent.
 *
 * `effectiveFrom` is the contract's start date, not now(): a rule dated today
 * would fail to price any order placed before today.
 */
async function upsertCommission(
  contractId: string, serviceType: ServiceType,
  partnerShare: number, complexShare: number, waridShare: number,
  nurseShare: number, driverShare: number
) {
  const open = await prisma.commissionRule.findFirst({
    where: { contractId, serviceType, effectiveTo: null },
    select: { id: true },
  });
  if (open) return open;

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { startDate: true },
  });

  return prisma.commissionRule.create({
    data: {
      contractId, serviceType, partnerShare, complexShare, waridShare, nurseShare, driverShare,
      effectiveFrom: contract.startDate,
    },
  });
}

main()
  .catch((e) => { console.error("❌ خطأ:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
