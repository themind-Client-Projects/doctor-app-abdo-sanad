import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const schedules = body?.schedules;

  if (!Array.isArray(schedules)) {
    return NextResponse.json({ error: "قائمة الجداول غير صالحة" }, { status: 400 });
  }

  const rows: {
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean | undefined;
  }[] = [];

  for (const raw of schedules) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const s = raw as Record<string, unknown>;
    if (
      typeof s.dayOfWeek !== "number" ||
      !Number.isInteger(s.dayOfWeek) ||
      s.dayOfWeek < 0 ||
      s.dayOfWeek > 6
    ) {
      return NextResponse.json({ error: "يوم غير صالح" }, { status: 400 });
    }
    if (typeof s.startTime !== "string" || typeof s.endTime !== "string") {
      return NextResponse.json({ error: "وقت غير صالح" }, { status: 400 });
    }
    rows.push({
      doctorId: id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: typeof s.isActive === "boolean" ? s.isActive : undefined,
    });
  }

  const [, data] = await prisma.$transaction([
    prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
    prisma.doctorSchedule.createMany({ data: rows }),
  ]);

  return NextResponse.json({ data });
});
