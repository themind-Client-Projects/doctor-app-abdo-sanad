import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const serviceStatus = z.enum(["ACTIVE", "SUSPENDED", "PAUSED", "REACTIVATED"]);

/**
 * `partnerId` and `serviceType` are deliberately absent: moving a config to a
 * different partner or service is a create-and-delete, not an edit. Allowing it
 * here would let one partner's configuration silently become another's.
 */
const updateSchema = z
  .object({
    status: serviceStatus.optional(),
    dailyCapacity: z.number().int().min(0).max(10_000).nullable().optional(),
    isHomeService: z.boolean().optional(),
    isBloodDraw: z.boolean().optional(),
    governorates: z.array(z.string()).optional(),
    workHours: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.serviceConfig.findUnique({
    where: { id },
    include: { partner: { select: { id: true, name: true, type: true, status: true } } },
  });

  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الخدمة غير موجودة", { requestId });
  return ok(data, { requestId });
});

// PATCH /api/services/[id] — activate / suspend / pause / set capacity.
// The admin screen's "update status" was a console.log; this is the endpoint
// it should have been calling.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  const data = await prisma.serviceConfig.update({
    where: { id },
    data: {
      status: input.status,
      dailyCapacity: input.dailyCapacity,
      isHomeService: input.isHomeService,
      isBloodDraw: input.isBloodDraw,
      ...(input.governorates ? { governorates: input.governorates } : {}),
      ...(input.workHours ? { workHours: input.workHours as Prisma.InputJsonValue } : {}),
    },
    include: { partner: { select: { id: true, name: true, type: true, status: true } } },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  await prisma.serviceConfig.delete({ where: { id } });
  return ok({ message: "تم حذف الخدمة" }, { requestId });
});
