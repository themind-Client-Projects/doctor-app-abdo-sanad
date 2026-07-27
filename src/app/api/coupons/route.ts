import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { dateish, parseBody, parseQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

// `usedCount` is server-owned and deliberately absent, so `.strict()` turns an
// attempt to reset it (and revive a spent coupon) into a 400.
const createCouponSchema = z
  .object({
    code: z.string().trim().min(1, { message: "رمز الكوبون مطلوب" }),
    discountType,
    discountValue,
    maxUses: z.number().int().nonnegative().default(0),
    expiresAt: dateish,
    isActive: z.boolean().default(true),
  })
  .strict();

// GET /api/coupons — was unbounded: coupons are never deleted, only expired, so
// this list only ever grows.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.coupon.findMany({
    where: keyset.where ?? {},
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/coupons — the body used to be spread into create, so `usedCount`
// could be reset to 0 to make a spent coupon reusable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createCouponSchema);

  const data = await prisma.coupon.create({
    // Explicit allow-list — `usedCount` is server-owned and not writable here.
    data: {
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      isActive: input.isActive,
    },
  });

  return ok(data, { status: 201, requestId });
});
