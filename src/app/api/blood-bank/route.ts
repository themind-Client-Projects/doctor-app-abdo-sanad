import { NextResponse } from "next/server";
import type { BloodType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const BLOOD_TYPES: readonly BloodType[] = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
];

// GET /api/blood-bank — Blood bank requests (req L433-443)
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async () => {
  const data = await prisma.bloodBankRequest.findMany({
    include: { governorate: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data });
});

// POST /api/blood-bank — Create a request.
// The body used to be spread straight into Prisma, so any column was writable
// and an unknown blood group crashed as a 500 instead of a 400.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { requestType, bloodType } = body;
  if (typeof requestType !== "string" || !requestType) {
    return NextResponse.json({ error: "نوع الطلب مطلوب" }, { status: 400 });
  }
  if (typeof bloodType !== "string" || !BLOOD_TYPES.includes(bloodType as BloodType)) {
    return NextResponse.json({ error: "زمرة الدم غير صالحة" }, { status: 400 });
  }

  const drawAppointment = parseDate(body.drawAppointment);
  if (drawAppointment === "invalid") {
    return NextResponse.json({ error: "موعد السحب غير صالح" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  const data = await prisma.bloodBankRequest.create({
    data: {
      requestType,
      bloodType: bloodType as BloodType,
      governorateId: str(body.governorateId),
      status: typeof body.status === "string" && body.status ? body.status : "new",
      donorId: str(body.donorId),
      donorName: str(body.donorName),
      drawAppointment,
      testStatus: str(body.testStatus),
      deliveryStatus: str(body.deliveryStatus),
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});

/** null when absent, "invalid" when unparseable — so callers get a 400. */
function parseDate(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return "invalid";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}
