/**
 * Seed the admin-controlled switches.
 *
 * Keys are seeded rather than created from the UI, because a flag the code does
 * not read is a switch that silently does nothing — the admin would toggle it,
 * see no effect, and have no way to tell whether that is a bug or the intent.
 * Every key below is branched on somewhere.
 *
 *   npx tsx prisma/seed-flags.ts
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

const FLAGS = [
  {
    key: "booking.electronic_deduction",
    label: "الاستقطاع الإلكتروني",
    description: "خصم قيمة الخدمة من محفظة المريض تلقائياً عند الحجز",
    group: "booking",
    isEnabled: false,
    numericValue: null,
  },
  {
    key: "booking.electronic_booking",
    label: "الحجز الإلكتروني",
    description: "السماح للمريض بإتمام الحجز داخل التطبيق دون تدخل موظف",
    group: "booking",
    isEnabled: false,
    numericValue: null,
  },
  {
    key: "taxi.nursing_addon",
    label: "الخدمة التمريضية مع رحلة التاكسي",
    description: "إضافة ممرض إلى الرحلة بسعر محدّد مسبقاً ضمن خيارات نوع الرحلة",
    group: "taxi",
    isEnabled: false,
    numericValue: 15000,
  },
  {
    key: "sanad.in_doctor_booking",
    label: "خدمات سند داخل حجز الأطباء",
    description: "إظهار زر تفعيل أسعار سند أعلى صفحة حجز الأطباء",
    group: "sanad",
    isEnabled: false,
    numericValue: null,
  },
] as const;

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      // Only metadata is refreshed — re-seeding must never flip a switch an
      // administrator deliberately turned on.
      update: { label: f.label, description: f.description, group: f.group },
      create: { ...f },
    });
  }
  for (const f of await prisma.featureFlag.findMany({ orderBy: { group: "asc" } })) {
    console.log(`  [${f.group.padEnd(8)}] ${f.isEnabled ? "ON " : "OFF"}  ${f.key.padEnd(32)} ${f.numericValue ?? ""}`);
  }
  console.log(`✓ ${FLAGS.length} flags`);
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
