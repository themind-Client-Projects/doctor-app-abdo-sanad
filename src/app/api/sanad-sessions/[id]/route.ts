import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

/** req L445-453 — waiting → calling → in_session → ended. */
const SESSION_STATUSES = ["waiting", "calling", "in_session", "ended"] as const;

// PATCH /api/sanad-sessions/[id] — Advance a session (req L445-453).
// The body used to be spread into prisma.sanadSession.update, so a caller could
// rewrite doctorId / patientId and hand somebody else's consultation over.
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    if (
      body.status !== undefined &&
      !SESSION_STATUSES.includes(body.status as (typeof SESSION_STATUSES)[number])
    ) {
      return NextResponse.json({ error: "حالة الجلسة غير صالحة" }, { status: 400 });
    }

    const timestamps: { startedAt?: Date | null; endedAt?: Date | null } = {};
    for (const key of ["startedAt", "endedAt"] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (value === null || value === "") {
        timestamps[key] = null;
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number") {
        return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
      }
      timestamps[key] = date;
    }

    const existing = await prisma.sanadSession.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const data = await prisma.sanadSession.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        ...timestamps,
      },
    });

    return NextResponse.json({ data });
  }
);
