import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const orderPriority = z.enum(["NORMAL", "URGENT", "CRITICAL"], {
  message: "أولوية غير صالحة",
});

// Only genuinely editable descriptive fields are allow-listed. `status` and
// `paymentStatus` belong to the accept / reject / hold endpoints and are
// deliberately absent, as are the assignment columns and `patientId`.
// `.strict()` so an unexpected key is a 400 rather than being silently ignored.
const updateOrderSchema = z
  .object({
    patientName: nonEmpty.optional(),
    patientPhone: nonEmpty.optional(),
    governorateId: nonEmpty.optional(),
    area: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    priority: orderPriority.optional(),
  })
  .strict();

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
// `patientId` — bypassing the entire order lifecycle.
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const { id } = await params;
    const input = await parseBody(req, updateOrderSchema);

    // `undefined` leaves a column untouched in Prisma.
    const data = {
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      governorateId: input.governorateId,
      area: input.area,
      address: input.address,
      notes: input.notes,
      priority: input.priority,
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
