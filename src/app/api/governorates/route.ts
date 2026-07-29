import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/validation";

/**
 * Governorates and their areas — the coverage map every other screen depends
 * on (`Order.governorateId`, `Partner.governorateId`, service coverage).
 *
 * This is real, editable system configuration, which is what "إعدادات النظام"
 * (req L265) administers. There is no `SystemSetting` model, and inventing a
 * settings screen full of switches wired to nothing would be worse than not
 * having one.
 *
 * Not keyset-paginated on purpose: Iraq has 18 governorates. A cursor here
 * would be ceremony, and every consumer wants the whole list to fill a
 * `<select>`.
 */

const listQuerySchema = z.object({
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const areasSchema = z.array(z.string().trim().min(1).max(64)).max(200);

const createSchema = z
  .object({
    name: z.string().trim().min(2, { message: "اسم المحافظة مطلوب" }).max(64),
    isActive: z.boolean().default(true),
    areas: areasSchema.default([]),
  })
  .strict();

// Readable by any signed-in staff member — a driver's app needs the list to
// render an address form.
export const GET = withAuth({ roles: ROLES.STAFF }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { activeOnly } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const data = await prisma.governorate.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
    include: {
      // Counts, not rows: a governorate with 4,000 orders must not drag them
      // into a dropdown payload.
      _count: { select: { partners: true, orders: true, users: true } },
    },
  });

  return ok(data, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  // `name` is @unique — a duplicate raises P2002, which withAuth maps to 409.
  const data = await prisma.governorate.create({
    data: { name: input.name, isActive: input.isActive, areas: input.areas },
  });

  return ok(data, { status: 201, requestId });
});
