import { NextResponse } from "next/server";
import type { BloodType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

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

// PATCH /api/blood-bank/[id] — Update a request (req L433-443).
// The body used to be spread into prisma.bloodBankRequest.update, so every
// column — including the id — was rewritable in one call.
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    if (
      body.bloodType !== undefined &&
      !BLOOD_TYPES.includes(body.bloodType as BloodType)
    ) {
      return NextResponse.json({ error: "زمرة الدم غير صالحة" }, { status: 400 });
    }

    let drawAppointment: Date | null | undefined;
    if (body.drawAppointment !== undefined) {
      if (body.drawAppointment === null || body.drawAppointment === "") {
        drawAppointment = null;
      } else if (
        typeof body.drawAppointment === "string" ||
        typeof body.drawAppointment === "number"
      ) {
        const date = new Date(body.drawAppointment);
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ error: "موعد السحب غير صالح" }, { status: 400 });
        }
        drawAppointment = date;
      } else {
        return NextResponse.json({ error: "موعد السحب غير صالح" }, { status: 400 });
      }
    }

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);

    const existing = await prisma.bloodBankRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const data = await prisma.bloodBankRequest.update({
      where: { id },
      data: {
        requestType: str(body.requestType),
        bloodType: body.bloodType as BloodType | undefined,
        governorateId: str(body.governorateId),
        status: str(body.status),
        donorId: str(body.donorId),
        donorName: str(body.donorName),
        drawAppointment,
        testStatus: str(body.testStatus),
        deliveryStatus: str(body.deliveryStatus),
      },
    });

    return NextResponse.json({ data });
  }
);
