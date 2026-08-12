import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";
import { orderScopeFor } from "@/lib/order-slots";

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
//
// `ROLES.STAFF`, matching the list. `GET /api/orders` was widened so a partner
// could see their own queue, but this stayed on `ROLES.OPERATIONS` — so a lab
// listed its samples and got 403 on every row it tapped. A list you cannot open
// is not a feature.
//
// Scoped the same way the list is: `orderScopeFor` limits a partner to the
// column their own type occupies, so widening the role does not widen the data.
export const GET = withAuth<Ctx>(
  { roles: ROLES.STAFF },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const order = await prisma.order.findFirst({
      // An order outside the caller's scope answers 404, not 403 — the same
      // convention the referral routes use, so an id cannot be probed.
      where: { id, ...orderScopeFor(identity) },
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
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    return ok(order, { requestId });
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
    const requestId = req.headers.get("x-request-id") ?? undefined;
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
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    const order = await prisma.order.update({ where: { id }, data });

    return ok(order, { requestId });
  }
);

// DELETE /api/orders/[id] — Delete order. Destructive, so admin only.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }

  await prisma.order.delete({ where: { id } });
  return ok({ message: "تم حذف الطلب" }, { requestId });
});
