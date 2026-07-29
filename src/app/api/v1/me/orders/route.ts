import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/v1/me/orders — the patient's own service orders.
 *
 * `/api/orders` has no patientId filter, so a patient would have had to pull
 * every order on the platform to find their own. Scoped to the session here.
 */
const listQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const TERMINAL = ["COMPLETED", "CANCELLED"] as const;

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { active, cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const where: Prisma.OrderWhereInput = {
    patientId: identity.userId,
    deletedAt: null,
    ...(active === "true"
      ? { status: { notIn: [...TERMINAL] } }
      : active === "false"
        ? { status: { in: [...TERMINAL] } }
        : {}),
  };

  const keyset = keysetArgs(cursor, limit);
  const cursorWhere = "where" in keyset ? keyset.where : undefined;

  const rows = await prisma.order.findMany({
    ...keyset,
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    select: {
      id: true,
      createdAt: true,
      orderNumber: true,
      serviceType: true,
      status: true,
      priority: true,
      totalAmount: true,
      currency: true,
      paymentStatus: true,
      governorate: { select: { name: true } },
      // Only how far along it is — the full ladder is a separate call.
      _count: { select: { timeline: true } },
    },
  });

  const { items, page } = toPage(rows, limit);

  return okList(
    items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      serviceType: o.serviceType,
      status: o.status,
      priority: o.priority,
      totalAmount: o.totalAmount,
      currency: o.currency,
      paymentStatus: o.paymentStatus,
      governorate: o.governorate?.name ?? null,
      stepsCompleted: o._count.timeline,
      totalSteps: 11,
      createdAt: o.createdAt,
    })),
    page,
    { requestId }
  );
});
