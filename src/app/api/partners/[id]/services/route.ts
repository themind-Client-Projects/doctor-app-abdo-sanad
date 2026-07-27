import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { jsonValue, parseBody, serviceTypeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** A Prisma `Json` column: any JSON value, with `null` meaning "leave alone". */
const jsonInput = jsonValue
  .optional()
  .transform((v) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue)));

const serviceStatus = z.enum(["ACTIVE", "SUSPENDED", "PAUSED", "REACTIVATED"], {
  message: "حالة غير صالحة",
});

// `partnerId` always comes from the route param and is deliberately absent, so a
// body can no longer write a config onto a different partner.
const serviceConfigSchema = z
  .object({
    serviceType: serviceTypeSchema,
    status: serviceStatus.optional(),
    workHours: jsonInput,
    governorates: jsonInput,
    dailyCapacity: z.number().int().optional(),
    isHomeService: z.boolean().optional(),
    isBloodDraw: z.boolean().optional(),
  })
  .strict();

const updateServicesSchema = z
  .object({
    configs: z.array(serviceConfigSchema).min(1, { message: "قائمة الخدمات غير صالحة" }),
  })
  .strict();

// GET — List partner service configs (req L183-198)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const data = await prisma.serviceConfig.findMany({ where: { partnerId: id } });
  return ok(data, { requestId });
});

// PUT — Update/create service configs.
// Each entry used to be spread into upsert, so `partnerId` could be supplied in
// the body and write a config onto a different partner. `configs` was also
// assumed to be an array — a malformed body threw inside .map and 500'd.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { configs } = await parseBody(req, updateServicesSchema);

  const results = await prisma.$transaction(
    configs.map(({ serviceType, ...fields }) =>
      prisma.serviceConfig.upsert({
        where: { partnerId_serviceType: { partnerId: id, serviceType } },
        update: fields,
        create: { partnerId: id, serviceType, ...fields },
      })
    )
  );

  return ok(results, { requestId });
});
