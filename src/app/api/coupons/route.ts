import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { dateish, parseBody, parseQuery } from "@/lib/validation";
import { couponCode, discountType, discountValue, percentageCap } from "@/server/services/coupon-rules";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(40).optional()),
  /** live = usable today; expired / exhausted / inactive = why it is not. */
  status: z.preprocess(emptyToUndefined, z.enum(["live", "expired", "exhausted", "inactive"]).optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// `usedCount` is server-owned and deliberately absent, so `.strict()` turns an
// attempt to reset it (and revive a spent coupon) into a 400.
const createCouponSchema = z
  .object({
    code: couponCode,
    discountType,
    discountValue,
    maxUses: z.number().int().nonnegative().default(0),
    expiresAt: dateish,
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(percentageCap, { message: "نسبة الخصم لا تتجاوز 100%", path: ["discountValue"] })
  .refine((v) => v.expiresAt > new Date(), {
    message: "تاريخ الانتهاء يجب أن يكون في المستقبل",
    path: ["expiresAt"],
  });

function statusWhere(status: "live" | "expired" | "exhausted" | "inactive"): Prisma.CouponWhereInput {
  const now = new Date();
  if (status === "inactive") return { isActive: false };
  if (status === "expired") return { isActive: true, expiresAt: { lte: now } };
  // `usedCount >= maxUses` compares two columns, which Prisma cannot express in
  // a `where`. `fields` is the supported way to reference one column from
  // another, so the filter stays in SQL instead of loading every coupon.
  if (status === "exhausted") {
    return {
      isActive: true,
      expiresAt: { gt: now },
      maxUses: { gt: 0 },
      usedCount: { gte: prisma.coupon.fields.maxUses },
    };
  }
  return {
    isActive: true,
    expiresAt: { gt: now },
    OR: [{ maxUses: 0 }, { usedCount: { lt: prisma.coupon.fields.maxUses } }],
  };
}

// GET /api/coupons — was unbounded: coupons are never deleted, only expired, so
// this list only ever grows.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { q, status, cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const filters: Prisma.CouponWhereInput[] = [];
  if (q) filters.push({ code: { contains: q.toUpperCase() } });
  if (status) filters.push(statusWhere(status));
  const where: Prisma.CouponWhereInput = filters.length ? { AND: filters } : {};

  const [rows, redeemed] = await Promise.all([
    prisma.coupon.findMany({
      where: keyset.where ? { AND: [where, keyset.where] } : where,
      orderBy: keyset.orderBy,
      take: keyset.take,
    }),
    // What the coupons have actually cost — the sum of discounts granted.
    prisma.couponRedemption.aggregate({ _sum: { amount: true }, _count: true }),
  ]);

  const { items, page } = toPage(rows, limit);
  return okList(items, page, {
    requestId,
    summary: {
      redemptions: redeemed._count,
      discountGiven: redeemed._sum.amount ?? new Prisma.Decimal(0),
    },
  });
});

// POST /api/coupons — the body used to be spread into create, so `usedCount`
// could be reset to 0 to make a spent coupon reusable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createCouponSchema);

  const [data] = await prisma.$transaction([
    prisma.coupon.create({
      // Explicit allow-list — `usedCount` is server-owned and not writable here.
      data: {
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        expiresAt: input.expiresAt,
        maxUses: input.maxUses,
        isActive: input.isActive,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `إنشاء كوبون ${input.code}`,
        entityType: "coupon",
        details: { discountType: input.discountType, discountValue: input.discountValue, maxUses: input.maxUses },
      },
    }),
  ]);

  return ok(data, { status: 201, requestId });
});
