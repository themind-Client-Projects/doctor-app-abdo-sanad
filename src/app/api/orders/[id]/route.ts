import { NextResponse } from "next/server";
import type { Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const PRIORITIES: readonly Priority[] = ["NORMAL", "URGENT", "CRITICAL"];

// GET /api/orders/[id] — Get order details
export const GET = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (_req, { params }) => {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        governorate: true,
        timeline: { orderBy: { step: "asc" } },
        assignedNurse: { select: { id: true, name: true, phone: true, rating: true } },
        assignedDriver: { select: { id: true, name: true, phone: true, rating: true } },
        assignedLab: { select: { id: true, name: true, phone: true, rating: true } },
        assignedPharmacy: { select: { id: true, name: true, phone: true, rating: true } },
        assignedRadiology: { select: { id: true, name: true, phone: true, rating: true } },
        labSamples: true,
        radiologyRequests: true,
        callLogs: true,
        feedbacks: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  }
);

// PATCH /api/orders/[id] — Update order.
//
// This used to spread the raw body into prisma.order.update, so one call could
// set `status` / `paymentStatus`, reassign every partner, or rewrite
// `patientId` — bypassing the entire order lifecycle. Only genuinely editable
// descriptive fields are allow-listed here; `status` and `paymentStatus` belong
// to the accept / reject / hold endpoints and are deliberately NOT settable.
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    if (body.priority !== undefined && !PRIORITIES.includes(body.priority as Priority)) {
      return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
    }

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);

    const data = {
      patientName: str(body.patientName),
      patientPhone: str(body.patientPhone),
      governorateId: str(body.governorateId),
      area: str(body.area),
      address: str(body.address),
      notes: str(body.notes),
      priority: body.priority as Priority | undefined,
    };

    const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const order = await prisma.order.update({ where: { id }, data });

    return NextResponse.json({ data: order });
  }
);

// DELETE /api/orders/[id] — Delete order. Destructive, so admin only.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ message: "تم حذف الطلب" });
});
