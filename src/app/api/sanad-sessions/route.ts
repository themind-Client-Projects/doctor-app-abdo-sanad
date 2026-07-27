import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

/** req L445-453 — waiting → calling → in_session → ended. */
const sessionStatus = z.enum(["waiting", "calling", "in_session", "ended"], {
  message: "حالة الجلسة غير صالحة",
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread straight into Prisma, so every column was writable
// and a missing appointmentTime surfaced as a 500 rather than a 400.
const createSanadSessionSchema = z
  .object({
    doctorId: z.string({ message: "الطبيب مطلوب" }).trim().min(1, { message: "الطبيب مطلوب" }),
    patientId: z.string({ message: "المريض مطلوب" }).trim().min(1, { message: "المريض مطلوب" }),
    appointmentTime: z
      .union([z.string(), z.number()], { message: "موعد الجلسة مطلوب" })
      .pipe(z.coerce.date({ message: "موعد الجلسة غير صالح" })),
    status: sessionStatus.default("waiting"),
  })
  .strict();

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
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const input = await parseBody(req, createSanadSessionSchema);

  const data = await prisma.sanadSession.create({
    data: {
      doctorId: input.doctorId,
      patientId: input.patientId,
      appointmentTime: input.appointmentTime,
      status: input.status,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
