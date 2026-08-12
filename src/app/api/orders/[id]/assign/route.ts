import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { PROVIDER_SLOT } from "@/lib/order-slots";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Assignment slot → the order column it writes and the partner type it needs.
 *
 * The column comes from `PROVIDER_SLOT`, the single definition shared with
 * booking, the workload count and the seed — four hand-written copies of this
 * mapping is what let the seed put doctors in the nurse column.
 */
const SLOTS = {
  /// The doctor PERFORMING the order — a consultation's provider.
  doctor: { column: PROVIDER_SLOT.DOCTOR, partnerType: "DOCTOR" },
  nurse: { column: PROVIDER_SLOT.NURSE, partnerType: "NURSE" },
  driver: { column: PROVIDER_SLOT.DRIVER, partnerType: "DRIVER" },
  lab: { column: PROVIDER_SLOT.LAB, partnerType: "LAB" },
  pharmacy: { column: PROVIDER_SLOT.PHARMACY, partnerType: "PHARMACY" },
  radiology: { column: PROVIDER_SLOT.RADIOLOGY, partnerType: "RADIOLOGY" },
} as const satisfies Record<string, { column: string; partnerType: UserRole }>;

// The five assignee slots — anything else is a 400, not a Prisma crash.
// `.strict()` so an unexpected key (e.g. a `status`) cannot ride along.
const assignOrderSchema = z
  .object({
    type: z.enum(["doctor", "nurse", "driver", "lab", "pharmacy", "radiology"], {
      message: "نوع غير صالح",
    }),
    partnerId: z
      .string({ message: "معرف الشريك مطلوب" })
      .trim()
      .min(1, { message: "معرف الشريك مطلوب" }),
  })
  .strict();

// POST /api/orders/[id]/assign — Assign service provider (req L324-382 Dispatch Center)
//
// This always created a timeline row at `step: 3`, and @@unique([orderId, step])
// made the 2nd and 3rd assignment fail — so a multi-party order (lab + nurse +
// driver) could never be fully dispatched. The row is now upserted, making
// assignment repeatable.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const { type, partnerId } = await parseBody(req, assignOrderSchema);

    const slot = SLOTS[type];

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    // The partner id used to be written straight through, so a bad id failed on
    // the foreign key as a 500 and a pharmacy could be assigned as a driver.
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, type: true },
    });
    if (!partner) {
      return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير موجود", { requestId });
    }
    if (partner.type !== slot.partnerType) {
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 400, "نوع الشريك لا يطابق المهمة", {
        requestId,
      });
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

    return ok(updated, { requestId });
  }
);
