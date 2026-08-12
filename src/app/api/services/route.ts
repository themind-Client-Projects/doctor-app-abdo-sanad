import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody, parseQuery, serviceTypeSchema } from "@/lib/validation";

/**
 * Platform-wide service configuration — "إدارة الخدمات" (req L183-198).
 *
 * `ServiceConfig` was only reachable through `/api/partners/[id]/services`, so
 * the admin screen had no way to list every partner's services, and no way to
 * create or delete one at all. It compensated by fetching `/api/pricing` and
 * typing the result as ServiceConfig, which is a different model entirely.
 */

const serviceStatus = z.enum(["ACTIVE", "SUSPENDED", "PAUSED", "REACTIVATED"]);

const listQuerySchema = z.object({
  partnerId: z.string().trim().min(1).optional(),
  serviceType: serviceTypeSchema.optional(),
  status: serviceStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const createSchema = z
  .object({
    partnerId: z.string().trim().min(1, { message: "الشريك مطلوب" }),
    serviceType: serviceTypeSchema,
    status: serviceStatus.default("ACTIVE"),
    dailyCapacity: z.number().int().min(0).max(10_000).nullable().optional(),
    isHomeService: z.boolean().default(false),
    isBloodDraw: z.boolean().default(false),
    governorates: z.array(z.string()).optional(),
    workHours: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId, serviceType, status, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.ServiceConfigWhereInput = {
    ...(partnerId ? { partnerId } : {}),
    ...(serviceType ? { serviceType } : {}),
    ...(status ? { status } : {}),
  };

  const data = await prisma.serviceConfig.findMany({
    where,
    take: limit,
    orderBy: [{ partnerId: "asc" }, { serviceType: "asc" }],
    include: {
      partner: { select: { id: true, name: true, type: true, status: true } },
    },
  });

  return ok(data, { requestId });
});

// POST /api/services — enable a service for a partner.
// @@unique([partnerId, serviceType]) means a duplicate is a P2002, which
// withAuth maps to 409 rather than a 500.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  const data = await prisma.serviceConfig.create({
    // Explicit allow-list — never spread the body into Prisma.
    data: {
      partnerId: input.partnerId,
      serviceType: input.serviceType,
      status: input.status,
      dailyCapacity: input.dailyCapacity ?? null,
      isHomeService: input.isHomeService,
      isBloodDraw: input.isBloodDraw,
      ...(input.governorates ? { governorates: input.governorates } : {}),
      ...(input.workHours ? { workHours: input.workHours as Prisma.InputJsonValue } : {}),
    },
    include: { partner: { select: { id: true, name: true, type: true, status: true } } },
  });

  return ok(data, { status: 201, requestId });
});
