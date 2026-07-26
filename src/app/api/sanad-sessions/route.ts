import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

/** req L445-453 — waiting → calling → in_session → ended. */
const SESSION_STATUSES = ["waiting", "calling", "in_session", "ended"] as const;

// GET /api/sanad-sessions — Online consultation sessions (req L445-453)
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50") || 50)
  );

  const data = await prisma.sanadSession.findMany({
    include: { doctor: { select: { userId: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ data });
});

// POST /api/sanad-sessions — Book a session.
// The body used to be spread straight into Prisma, so every column was writable
// and a missing appointmentTime surfaced as a 500 rather than a 400.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { doctorId, patientId, appointmentTime, status } = body;
  if (typeof doctorId !== "string" || !doctorId) {
    return NextResponse.json({ error: "الطبيب مطلوب" }, { status: 400 });
  }
  if (typeof patientId !== "string" || !patientId) {
    return NextResponse.json({ error: "المريض مطلوب" }, { status: 400 });
  }
  if (typeof appointmentTime !== "string" && typeof appointmentTime !== "number") {
    return NextResponse.json({ error: "موعد الجلسة مطلوب" }, { status: 400 });
  }
  const scheduledAt = new Date(appointmentTime);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "موعد الجلسة غير صالح" }, { status: 400 });
  }
  if (
    status !== undefined &&
    !SESSION_STATUSES.includes(status as (typeof SESSION_STATUSES)[number])
  ) {
    return NextResponse.json({ error: "حالة الجلسة غير صالحة" }, { status: 400 });
  }

  const data = await prisma.sanadSession.create({
    data: {
      doctorId,
      patientId,
      appointmentTime: scheduledAt,
      status: (status as string) ?? "waiting",
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
