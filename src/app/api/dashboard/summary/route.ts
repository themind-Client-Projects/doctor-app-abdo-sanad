import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { decimalToNumber } from "@/lib/validation";
import { startOfBaghdadDay } from "@/lib/time";

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/summary — Role-specific KPIs
// Returns exactly 4 KPIs per role (req L16-46)
//
// `role` and `partnerId` used to be read from the query string, so any caller
// could render (and read the numbers behind) any other role's dashboard, for
// any partner. Both now come from the verified session only; the query
// parameters the web client still sends are ignored.
// ─────────────────────────────────────────────────────────────


type Kpi = {
  key: string;
  label: string;
  value: number;
  /** Always present — never `undefined`, which `JSON.stringify` would drop. */
  change: number | null;
  color: string;
  icon: string;
  href: string;
  isCurrency?: boolean;
};

export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const role = identity.role;
  const partnerId = identity.partnerId;

  // Fail closed: a partner-scoped user with no partner row must see nothing
  // rather than everything. No cuid is the empty string, so this matches no rows.
  const scopeId = partnerId ?? "";
  // Appointment.doctorId FKs DoctorProfile.id, NOT Partner.id — using partnerId
  // here silently matched zero rows, so doctor KPIs were always ٠.
  const doctorScopeId = identity.doctorProfileId ?? "";

  const today = startOfBaghdadDay();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  let kpis: Kpi[];

  switch (role) {
    // ─── DOCTOR (req L21-25) ───────────────────────────────
    case "DOCTOR": {
      const [todayPatients, currentPatients, upcomingAppointments, todayEarnings,
             yesterdayPatients, yesterdayAppointments] = await Promise.all([
        // مرضى اليوم
        prisma.appointment.count({
          where: {
            date: { gte: today },
            doctorId: doctorScopeId,
          },
        }),
        // المرضى الحاليون (in-progress appointments)
        prisma.appointment.count({
          where: {
            status: "in_progress",
            doctorId: doctorScopeId,
          },
        }),
        // المواعيد القادمة — Appointment.status only ever holds
        // scheduled | completed | cancelled | no_show, so the previous
        // { in: ["confirmed", "pending"] } filter matched nothing and this KPI
        // was permanently 0.
        prisma.appointment.count({
          where: {
            date: { gt: new Date() },
            status: "scheduled",
            doctorId: doctorScopeId,
          },
        }),
        // الأرباح اليومية — from wallet transactions
        partnerId
          ? prisma.transaction.aggregate({
              where: {
                wallet: { partnerId },
                type: "CREDIT",
                createdAt: { gte: today },
              },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        // Yesterday comparison
        prisma.appointment.count({
          where: {
            date: { gte: yesterday, lt: today },
            doctorId: doctorScopeId,
          },
        }),
        prisma.appointment.count({
          where: {
            date: { gte: yesterday, lt: today },
            status: "scheduled",
            doctorId: doctorScopeId,
          },
        }),
      ]);

      kpis = [
        {
          key: "todayPatients",
          label: "مرضى اليوم",
          value: todayPatients,
          change: calcChange(todayPatients, yesterdayPatients),
          color: "blue",
          icon: "users",
          href: "/dashboard/patients",
        },
        {
          key: "currentPatients",
          label: "المرضى الحاليون",
          value: currentPatients,
          change: null,
          color: "green",
          icon: "user-check",
          href: "/dashboard/patients?status=current",
        },
        {
          key: "upcomingAppointments",
          label: "المواعيد القادمة",
          value: upcomingAppointments,
          change: calcChange(upcomingAppointments, yesterdayAppointments),
          color: "yellow",
          icon: "calendar",
          href: "/dashboard/appointments",
        },
        {
          key: "todayEarnings",
          label: "الأرباح اليومية",
          value: decimalToNumber(todayEarnings._sum.amount),
          change: null,
          color: "purple",
          icon: "wallet",
          href: "/dashboard/finance",
          isCurrency: true,
        },
      ];
      break;
    }

    // ─── LAB (req L28-32) ─────────────────────────────────
    // Every count is scoped to the caller's own lab — these queries used to run
    // unfiltered, so each lab saw the whole platform's sample counts.
    case "LAB": {
      const [todaySamples, inTesting, readyResults, labEarnings,
             yesterdaySamples] = await Promise.all([
        // عينات اليوم
        prisma.labSample.count({
          where: { labId: scopeId, createdAt: { gte: today } },
        }),
        // قيد الفحص
        prisma.labSample.count({
          where: { labId: scopeId, status: "testing" },
        }),
        // النتائج الجاهزة
        prisma.labSample.count({
          where: {
            labId: scopeId,
            status: { in: ["ready", "sent_to_doctor", "sent_to_patient"] },
          },
        }),
        // الأرباح
        partnerId
          ? prisma.transaction.aggregate({
              where: { wallet: { partnerId }, type: "CREDIT", createdAt: { gte: today } },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        prisma.labSample.count({
          where: { labId: scopeId, createdAt: { gte: yesterday, lt: today } },
        }),
      ]);

      kpis = [
        { key: "todaySamples", label: "عينات اليوم", value: todaySamples, change: calcChange(todaySamples, yesterdaySamples), color: "blue", icon: "flask", href: "/dashboard/samples" },
        { key: "inTesting", label: "قيد الفحص", value: inTesting, change: null, color: "yellow", icon: "loader", href: "/dashboard/samples?status=testing" },
        { key: "readyResults", label: "النتائج الجاهزة", value: readyResults, change: null, color: "green", icon: "check-circle", href: "/dashboard/results" },
        { key: "labEarnings", label: "الأرباح", value: decimalToNumber(labEarnings._sum.amount), change: null, color: "purple", icon: "wallet", href: "/dashboard/finance", isCurrency: true },
      ];
      break;
    }

    // ─── PHARMACY (req L35-39) ────────────────────────────
    case "PHARMACY": {
      const [newPrescriptions, inPreparation, completed, pharmEarnings,
             yesterdayPrescriptions] = await Promise.all([
        // الوصفات الجديدة — Prescription.status holds
        // new | preparing | ready | delivered | returned; the previous
        // "received" filter matched nothing, so this KPI was permanently 0.
        prisma.prescription.count({ where: { pharmacyId: scopeId, status: "new", createdAt: { gte: today } },
        }),
        // قيد التجهيز
        prisma.prescription.count({ where: { pharmacyId: scopeId, status: "preparing" },
        }),
        // المكتملة
        prisma.prescription.count({ where: { pharmacyId: scopeId, status: "delivered", createdAt: { gte: today } },
        }),
        // الأرباح
        partnerId
          ? prisma.transaction.aggregate({
              where: { wallet: { partnerId }, type: "CREDIT", createdAt: { gte: today } },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        prisma.prescription.count({ where: { pharmacyId: scopeId, status: "new", createdAt: { gte: yesterday, lt: today } },
        }),
      ]);

      kpis = [
        { key: "newPrescriptions", label: "الوصفات الجديدة", value: newPrescriptions, change: calcChange(newPrescriptions, yesterdayPrescriptions), color: "blue", icon: "file-text", href: "/dashboard/prescriptions" },
        { key: "inPreparation", label: "قيد التجهيز", value: inPreparation, change: null, color: "yellow", icon: "loader", href: "/dashboard/prescriptions?status=preparing" },
        { key: "completed", label: "المكتملة", value: completed, change: null, color: "green", icon: "check-circle", href: "/dashboard/prescriptions?status=delivered" },
        { key: "pharmEarnings", label: "الأرباح", value: decimalToNumber(pharmEarnings._sum.amount), change: null, color: "purple", icon: "wallet", href: "/dashboard/finance", isCurrency: true },
      ];
      break;
    }

    // ─── NURSE (req - implied from same pattern) ──────────
    case "NURSE": {
      const [todayTasks, currentTasks, completedTasks, nurseEarnings] = await Promise.all([
        prisma.order.count({ where: { assignedNurseId: scopeId, createdAt: { gte: today } } }),
        prisma.order.count({ where: { assignedNurseId: scopeId, status: { in: ["ASSIGNED", "IN_TRANSIT", "IN_PROGRESS"] } } }),
        prisma.order.count({ where: { assignedNurseId: scopeId, status: "COMPLETED", createdAt: { gte: today } } }),
        partnerId
          ? prisma.transaction.aggregate({ where: { wallet: { partnerId }, type: "CREDIT", createdAt: { gte: today } }, _sum: { amount: true } })
          : Promise.resolve({ _sum: { amount: null } }),
      ]);

      kpis = [
        { key: "todayTasks", label: "مهام اليوم", value: todayTasks, change: null, color: "blue", icon: "clipboard", href: "/dashboard/visits" },
        { key: "currentTasks", label: "الحالية", value: currentTasks, change: null, color: "yellow", icon: "loader", href: "/dashboard/visits?status=current" },
        { key: "completedTasks", label: "المكتملة", value: completedTasks, change: null, color: "green", icon: "check-circle", href: "/dashboard/visits?status=completed" },
        { key: "nurseEarnings", label: "الأرباح", value: decimalToNumber(nurseEarnings._sum.amount), change: null, color: "purple", icon: "wallet", href: "/dashboard/finance", isCurrency: true },
      ];
      break;
    }

    // ─── DRIVER (req L42-46) ──────────────────────────────
    case "DRIVER": {
      const [todayTrips, currentTrips, completedTrips, driverEarnings] = await Promise.all([
        prisma.order.count({ where: { assignedDriverId: scopeId, createdAt: { gte: today } } }),
        prisma.order.count({ where: { assignedDriverId: scopeId, status: { in: ["IN_TRANSIT", "ARRIVED"] } } }),
        prisma.order.count({ where: { assignedDriverId: scopeId, status: "COMPLETED", createdAt: { gte: today } } }),
        partnerId
          ? prisma.transaction.aggregate({ where: { wallet: { partnerId }, type: "CREDIT", createdAt: { gte: today } }, _sum: { amount: true } })
          : Promise.resolve({ _sum: { amount: null } }),
      ]);

      kpis = [
        { key: "todayTrips", label: "الرحلات", value: todayTrips, change: null, color: "blue", icon: "truck", href: "/dashboard/trips" },
        { key: "currentTrips", label: "قيد التنفيذ", value: currentTrips, change: null, color: "yellow", icon: "loader", href: "/dashboard/trips?status=current" },
        { key: "completedTrips", label: "المكتملة", value: completedTrips, change: null, color: "green", icon: "check-circle", href: "/dashboard/trips?status=completed" },
        { key: "driverEarnings", label: "الأرباح", value: decimalToNumber(driverEarnings._sum.amount), change: null, color: "purple", icon: "wallet", href: "/dashboard/finance", isCurrency: true },
      ];
      break;
    }

    // ─── RADIOLOGY ────────────────────────────────────────
    // Scoped to the caller's own centre, for the same reason as LAB above.
    case "RADIOLOGY": {
      const [todayRequests, inImaging, readyReports, radEarnings] = await Promise.all([
        prisma.radiologyRequest.count({ where: { centerId: scopeId, createdAt: { gte: today } } }),
        prisma.radiologyRequest.count({ where: { centerId: scopeId, status: "imaged" } }),
        prisma.radiologyRequest.count({ where: { centerId: scopeId, status: { in: ["report_ready", "images_attached"] } } }),
        partnerId
          ? prisma.transaction.aggregate({ where: { wallet: { partnerId }, type: "CREDIT", createdAt: { gte: today } }, _sum: { amount: true } })
          : Promise.resolve({ _sum: { amount: null } }),
      ]);

      kpis = [
        { key: "todayRequests", label: "طلبات اليوم", value: todayRequests, change: null, color: "blue", icon: "scan", href: "/dashboard/requests" },
        { key: "inImaging", label: "قيد التصوير", value: inImaging, change: null, color: "yellow", icon: "loader", href: "/dashboard/requests?status=imaging" },
        { key: "readyReports", label: "التقارير الجاهزة", value: readyReports, change: null, color: "green", icon: "check-circle", href: "/dashboard/reports" },
        { key: "radEarnings", label: "الأرباح", value: decimalToNumber(radEarnings._sum.amount), change: null, color: "purple", icon: "wallet", href: "/dashboard/finance", isCurrency: true },
      ];
      break;
    }

    // ─── OPERATIONS (req L286-298) — مؤشرات اليوم، ١٠ مؤشرات ──
    //
    // There was no OPERATIONS case at all, so the switch fell to `default` and
    // returned `kpis: []`. The operations landing page reads ten named fields
    // off that response, none of which were ever sent, so every counter on the
    // employee's home screen showed ٠ permanently.
    //
    // Unlike the partner roles above, operations is not scoped to a partner —
    // it sees the whole platform, which is the job.
    case "SUPER_ADMIN":
    case "OPERATIONS": {
      // "قيد المعالجة" — accepted through to in-progress.
      const IN_FLIGHT = ["ACCEPTED", "ASSIGNED", "IN_TRANSIT", "ARRIVED", "IN_PROGRESS"] as const;
      const OPEN = [...IN_FLIGHT, "NEW", "DELAYED"] as const;

      const [
        newOrders,
        processing,
        completedToday,
        cancelledToday,
        critical,
        fieldTasks,
        onlineConsults,
        bloodDraws,
        labInProgress,
        radiologyPending,
        newYesterday,
      ] = await Promise.all([
        // Not date-scoped: an unaccepted order from yesterday is still sitting
        // in today's queue, and hiding it at midnight would lose it.
        prisma.order.count({ where: { status: "NEW" } }),
        prisma.order.count({ where: { status: { in: [...IN_FLIGHT] } } }),
        prisma.order.count({ where: { status: "COMPLETED", updatedAt: { gte: today } } }),
        prisma.order.count({ where: { status: "CANCELLED", updatedAt: { gte: today } } }),
        prisma.order.count({
          where: { priority: "CRITICAL", status: { in: [...OPEN] } },
        }),
        // Someone is physically out on these — a nurse or a driver is assigned.
        prisma.order.count({
          where: {
            status: { in: [...IN_FLIGHT] },
            OR: [{ assignedNurseId: { not: null } }, { assignedDriverId: { not: null } }],
          },
        }),
        prisma.sanadSession.count({
          where: { status: { in: ["waiting", "calling", "in_session"] } },
        }),
        prisma.order.count({
          where: { serviceType: "HOME_BLOOD_DRAW", status: { in: [...OPEN] } },
        }),
        prisma.labSample.count({
          where: { status: { in: ["received", "in_lab", "testing"] } },
        }),
        prisma.radiologyRequest.count({
          where: { status: { in: ["scheduled", "imaged"] } },
        }),
        prisma.order.count({
          where: { status: "NEW", createdAt: { gte: yesterday, lt: today } },
        }),
      ]);

      kpis = [
        { key: "newOrders", label: "الطلبات الجديدة", value: newOrders, change: calcChange(newOrders, newYesterday), color: "blue", icon: "clipboard", href: "/operations/orders?status=NEW" },
        { key: "processing", label: "قيد المعالجة", value: processing, change: null, color: "yellow", icon: "loader", href: "/operations/tracking" },
        { key: "completed", label: "المنجزة اليوم", value: completedToday, change: null, color: "green", icon: "check-circle", href: "/operations/orders?status=COMPLETED" },
        { key: "cancelled", label: "الملغاة اليوم", value: cancelledToday, change: null, color: "red", icon: "x-circle", href: "/operations/orders?status=CANCELLED" },
        { key: "critical", label: "الحرجة", value: critical, change: null, color: "red", icon: "alert-triangle", href: "/operations/orders?priority=CRITICAL" },
        { key: "fieldTasks", label: "المهام الميدانية", value: fieldTasks, change: null, color: "purple", icon: "map-pin", href: "/operations/dispatch" },
        { key: "onlineConsults", label: "الاستشارات الأونلاين", value: onlineConsults, change: null, color: "purple", icon: "video", href: "/operations/sanad" },
        { key: "bloodDraws", label: "سحب الدم المنزلي", value: bloodDraws, change: null, color: "red", icon: "droplets", href: "/operations/blood-bank" },
        { key: "labInProgress", label: "التحاليل قيد الإنجاز", value: labInProgress, change: null, color: "blue", icon: "flask", href: "/operations/lab" },
        { key: "radiologyPending", label: "الأشعة بانتظار التقرير", value: radiologyPending, change: null, color: "yellow", icon: "scan", href: "/operations/radiology" },
      ];
      break;
    }

    default:
      kpis = [];
  }

  return ok({ role, kpis }, { requestId });
});

/** Percentage change vs yesterday — `null` when it cannot be expressed. */
function calcChange(today: number, yesterday: number): number | null {
  if (yesterday === 0) return today > 0 ? 100 : null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}
