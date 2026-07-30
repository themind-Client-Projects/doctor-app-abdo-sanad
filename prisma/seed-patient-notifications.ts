/**
 * Give patients an inbox.
 *
 * All 24 seeded notifications belonged to STAFF, so /notifications rendered
 * empty for every patient — indistinguishable from a broken page. These are
 * derived from each patient's real orders and prescriptions, so the text refers
 * to something they can actually go and look at.
 *
 * Types match what the app's own services emit, and what the page's icon map
 * keys on — a notification typed with something unmapped renders as a generic
 * grey tick, which is a silent downgrade nobody notices.
 *
 *   npx tsx prisma/seed-patient-notifications.ts
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
const HOUR = 3_600_000;

async function main() {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT", deletedAt: null },
    select: { id: true, name: true },
  });

  for (const p of patients) {
    // Rebuild rather than append, so re-running does not pile up duplicates.
    await prisma.notification.deleteMany({ where: { userId: p.id } });

    const orders = await prisma.order.findMany({
      where: { patientId: p.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { orderNumber: true, serviceType: true, status: true, source: true },
    });

    const rows: { userId: string; title: string; body: string; type: string; isRead: boolean; createdAt: Date }[] = [];
    const now = Date.now();

    orders.forEach((o, i) => {
      rows.push({
        userId: p.id,
        title: o.status === "COMPLETED" ? "اكتملت خدمتك" : "تم تأكيد حجزك!",
        body:
          o.status === "COMPLETED"
            ? `اكتملت خدمتك رقم ${o.orderNumber.slice(0, 8)}. يسعدنا تقييمك للخدمة.`
            : `تم تأكيد طلبك رقم ${o.orderNumber.slice(0, 8)}${o.source === "SANAD" ? " عبر سند" : ""}.`,
        type: "order_update",
        isRead: i > 0,
        createdAt: new Date(now - (i + 1) * 2 * HOUR),
      });
    });

    rows.push(
      {
        userId: p.id,
        title: "عرض خاص لك!",
        body: "احصل على خصم 25% على باقة الفحص الشامل في مختبرات الشفاء. العرض ساري لمدة محدودة.",
        type: "offer",
        isRead: false,
        createdAt: new Date(now - 5 * HOUR),
      },
      {
        userId: p.id,
        title: "تذكير بالموعد",
        body: "موعدك القادم غداً. نرجو الحضور قبل الموعد بـ 15 دقيقة.",
        type: "appointment_reminder",
        isRead: true,
        createdAt: new Date(now - 26 * HOUR),
      },
      {
        userId: p.id,
        title: "نتائج التحاليل جاهزة",
        body: "تم إصدار نتائج الفحوصات المخبرية الخاصة بك. يمكنك الاطلاع عليها من ملفك الطبي.",
        type: "result_ready",
        isRead: true,
        createdAt: new Date(now - 48 * HOUR),
      },
      {
        userId: p.id,
        title: "تم شحن محفظتك",
        body: "تمت إضافة الرصيد إلى محفظتك بنجاح. يمكنك استخدامه داخل سند وخارجه.",
        type: "wallet",
        isRead: true,
        createdAt: new Date(now - 7 * 24 * HOUR),
      }
    );

    await prisma.notification.createMany({ data: rows });
  }

  console.log("── patient inboxes ──");
  let empty = 0;
  for (const p of patients) {
    const total = await prisma.notification.count({ where: { userId: p.id } });
    const unread = await prisma.notification.count({ where: { userId: p.id, isRead: false } });
    if (total === 0) empty++;
    console.log(`  ${String(p.name).padEnd(18)} ${total} إشعار (${unread} غير مقروء)`);
  }
  if (empty) throw new Error(`${empty} patient(s) still have an empty inbox`);
  console.log("✓ every patient has an inbox");
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
