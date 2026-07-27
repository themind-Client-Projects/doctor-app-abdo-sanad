import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `doctorId` always comes from the route param and is deliberately absent, so a
// body can no longer write onto another doctor.
const scheduleEntrySchema = z
  .object({
    dayOfWeek: z
      .number({ message: "يوم غير صالح" })
      .int({ message: "يوم غير صالح" })
      .min(0, { message: "يوم غير صالح" })
      .max(6, { message: "يوم غير صالح" }),
    startTime: z.string({ message: "وقت غير صالح" }).min(1, { message: "وقت غير صالح" }),
    endTime: z.string({ message: "وقت غير صالح" }).min(1, { message: "وقت غير صالح" }),
    isActive: z.boolean().optional(),
  })
  .strict();

const updateScheduleSchema = z
  .object({
    schedules: z.array(scheduleEntrySchema).min(1, { message: "قائمة الجداول غير صالحة" }),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.doctorSchedule.findMany({ where: { doctorId: id } });
  return NextResponse.json({ data });
});

// PUT — Replace the whole schedule.
//
// This used to deleteMany and then .map over `schedules` with no validation and
// no transaction: a malformed body wiped the existing schedule and then 500'd,
// leaving the doctor with no schedule at all. The body is now validated before
// anything is deleted, and the delete + insert run as one transaction so a
// failure rolls the delete back. Entries are also allow-listed, so `doctorId`
// in the body can no longer write onto another doctor.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const { schedules } = await parseBody(req, updateScheduleSchema);

  const rows = schedules.map((s) => ({ ...s, doctorId: id }));

  const [, data] = await prisma.$transaction([
    prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
    prisma.doctorSchedule.createMany({ data: rows }),
  ]);

  return NextResponse.json({ data });
});
