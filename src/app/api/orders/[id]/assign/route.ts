import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

/** Assignment slot → the order column it writes and the partner type it needs. */
const SLOTS = {
  nurse: { column: "assignedNurseId", partnerType: "NURSE" },
  driver: { column: "assignedDriverId", partnerType: "DRIVER" },
  lab: { column: "assignedLabId", partnerType: "LAB" },
  pharmacy: { column: "assignedPharmacyId", partnerType: "PHARMACY" },
  radiology: { column: "assignedRadiologyId", partnerType: "RADIOLOGY" },
} as const satisfies Record<string, { column: string; partnerType: UserRole }>;

type SlotName = keyof typeof SLOTS;

// POST /api/orders/[id]/assign — Assign service provider (req L324-382 Dispatch Center)
//
// This always created a timeline row at `step: 3`, and @@unique([orderId, step])
// made the 2nd and 3rd assignment fail — so a multi-party order (lab + nurse +
// driver) could never be fully dispatched. The row is now upserted, making
// assignment repeatable.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const { type, partnerId } = body;
    if (typeof type !== "string" || !(type in SLOTS)) {
      return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
    }
    if (typeof partnerId !== "string" || !partnerId) {
      return NextResponse.json({ error: "معرف الشريك مطلوب" }, { status: 400 });
    }

    const slot = SLOTS[type as SlotName];

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    // The partner id used to be written straight through, so a bad id failed on
    // the foreign key as a 500 and a pharmacy could be assigned as a driver.
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, type: true },
    });
    if (!partner) {
      return NextResponse.json({ error: "الشريك غير موجود" }, { status: 404 });
    }
    if (partner.type !== slot.partnerType) {
      return NextResponse.json({ error: "نوع الشريك لا يطابق المهمة" }, { status: 400 });
    }

    const data: Prisma.OrderUncheckedUpdateInput = { status: "ASSIGNED" };
    data[slot.column] = partnerId;

    const updated = await prisma.order.update({ where: { id }, data });

    await prisma.orderTimeline.upsert({
      where: { orderId_step: { orderId: id, step: 3 } },
      create: {
        orderId: id,
        step: 3,
        title: "تم تعيين منفذ الخدمة",
        completedAt: new Date(),
        completedBy: identity.userId,
      },
      update: {
        completedAt: new Date(),
        completedBy: identity.userId,
      },
    });

    return NextResponse.json({ data: updated });
  }
);
