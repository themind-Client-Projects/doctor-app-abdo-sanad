import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

/** The execution timeline is a fixed 11-step ladder (req L384-407). */
const MIN_STEP = 1;
const MAX_STEP = 11;

// GET /api/orders/[id]/timeline — Get order timeline (req L384-407, 11 steps)
export const GET = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (_req, { params }) => {
    const { id } = await params;
    const timeline = await prisma.orderTimeline.findMany({
      where: { orderId: id },
      orderBy: { step: "asc" },
    });
    return NextResponse.json({ data: timeline });
  }
);

// POST /api/orders/[id]/timeline — Add timeline step.
//
// `step` and `title` used to be taken verbatim from the client, so any integer
// (or a non-integer, which then failed inside Prisma as a 500) could be written
// outside the 11-step ladder. `completedBy` came from the body too, letting a
// caller attribute a step to somebody else — it is now the verified caller.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const { step, title } = body;
    if (
      typeof step !== "number" ||
      !Number.isInteger(step) ||
      step < MIN_STEP ||
      step > MAX_STEP
    ) {
      return NextResponse.json({ error: "رقم الخطوة غير صالح" }, { status: 400 });
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "عنوان الخطوة مطلوب" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    // @@unique([orderId, step]) — report the clash instead of throwing a 500.
    const duplicate = await prisma.orderTimeline.findUnique({
      where: { orderId_step: { orderId: id, step } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "الخطوة مسجلة مسبقاً" }, { status: 409 });
    }

    const entry = await prisma.orderTimeline.create({
      data: {
        orderId: id,
        step,
        title: title.trim(),
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        completedAt: new Date(),
        completedBy: identity.userId,
      },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  }
);
