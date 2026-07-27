import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { jsonValue, parseBody, parseQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

/** `dateish`, carrying the message this route already returned. */
const requiredDate = z.coerce.date({ message: "تاريخ البداية وتاريخ الانتهاء مطلوبان" });

/** A Prisma `Json` column: any JSON value, with `null` meaning "leave alone". */
const jsonInput = jsonValue
  .optional()
  .transform((v) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue)));

const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, { message: "اسم الحملة مطلوب" }),
    description: z.string().optional(),
    discountType,
    discountValue,
    startDate: requiredDate,
    endDate: requiredDate,
    targetServices: jsonInput,
    isActive: z.boolean().default(true),
  })
  .strict();

// GET /api/campaigns — was unbounded: campaigns are kept after they end, so the
// list grows with every marketing push.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.campaign.findMany({
    where: keyset.where ?? {},
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/campaigns — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createCampaignSchema);

  const data = await prisma.campaign.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: input.name,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startDate: input.startDate,
      endDate: input.endDate,
      targetServices: input.targetServices,
      isActive: input.isActive,
    },
  });

  return ok(data, { status: 201, requestId });
});
