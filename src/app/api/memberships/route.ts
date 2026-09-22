import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, parseBody, parseQuery } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone";
import {
  MEMBERSHIP_INCLUDE,
  MembershipError,
  purchaseMembership,
} from "@/server/services/membership";

/**
 * العضويات المُباعة — the owner's view of what was sold.
 *
 * Until this existed, the only admin-side read of `Membership` was a count
 * guarding plan deletion. The owner could price four packages and could not
 * see who bought one, what it brought in, or step in when something went wrong.
 *
 * "Active" is decided by DATE, not by the status column, exactly as the booking
 * path decides it — a membership lapses by the passage of time and nothing
 * rewrites its row at that moment. A list filtered on `status` alone would show
 * last month's daily packages as live.
 */

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(["active", "expired", "cancelled"]).optional()),
  planId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  /** Patient name or phone. */
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const grantSchema = z
  .object({
    userId: nonEmpty,
    planId: nonEmpty,
  })
  .strict();

function statusWhere(status: "active" | "expired" | "cancelled", now: Date): Prisma.MembershipWhereInput {
  if (status === "cancelled") return { status: "CANCELLED" };
  if (status === "active") return { status: "ACTIVE", expiresAt: { gt: now } };
  return { status: { not: "CANCELLED" }, expiresAt: { lte: now } };
}

/** The status a reader should see — derived, never trusted from the column. */
function effectiveStatus(row: { status: string; expiresAt: Date }, now: Date) {
  if (row.status === "CANCELLED") return "cancelled" as const;
  return row.expiresAt > now ? ("active" as const) : ("expired" as const);
}

// GET /api/memberships
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { status, planId, q, cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const now = new Date();

  const filters: Prisma.MembershipWhereInput[] = [];
  if (status) filters.push(statusWhere(status, now));
  if (planId) filters.push({ planId });
  if (q) {
    const canonical = normalizePhone(q);
    filters.push({
      user: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q.replace(/\D/g, "") || q } },
          ...(canonical ? [{ phone: canonical }] : []),
        ],
      },
    });
  }
  const where: Prisma.MembershipWhereInput = filters.length ? { AND: filters } : {};

  const keyset = keysetArgs(cursor, limit);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [rows, activeCount, revenue, monthRevenue, byPlan] = await Promise.all([
    prisma.membership.findMany({
      ...keyset,
      where: keyset.where ? { AND: [where, keyset.where] } : where,
      include: {
        ...MEMBERSHIP_INCLUDE,
        user: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.membership.count({ where: statusWhere("active", now) }),
    // Money RECEIVED — `pricePaid`, which is zero for a grant — so a comp
    // membership does not inflate revenue by its list price.
    prisma.membership.aggregate({ _sum: { pricePaid: true }, _count: true }),
    prisma.membership.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { pricePaid: true },
      _count: true,
    }),
    prisma.membership.groupBy({
      by: ["planId", "planName"],
      where: statusWhere("active", now),
      _count: true,
      orderBy: { _count: { planId: "desc" } },
    }),
  ]);

  const { items, page } = toPage(rows, limit);

  return okList(
    items.map((row) => ({
      ...row,
      effectiveStatus: effectiveStatus(row, now),
      entitlements: row.entitlements.map((e) => ({
        ...e,
        remaining: e.quota === null ? null : Math.max(e.quota - e.used, 0),
      })),
    })),
    page,
    {
      requestId,
      summary: {
        active: activeCount,
        sold: revenue._count,
        revenue: revenue._sum.pricePaid ?? new Prisma.Decimal(0),
        monthSold: monthRevenue._count,
        monthRevenue: monthRevenue._sum.pricePaid ?? new Prisma.Decimal(0),
        activeByPlan: byPlan.map((p) => ({ planId: p.planId, planName: p.planName, count: p._count })),
      },
    }
  );
});

// POST /api/memberships — the owner grants one, free.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, grantSchema);

  // Memberships discount a patient's bookings. On a staff account there is
  // nothing for one to apply to, so granting it is a mistake worth stopping.
  const patient = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  });
  if (!patient) return fail(ErrorCode.NOT_FOUND, 404, "المريض غير موجود", { requestId });
  if (patient.role !== "PATIENT") {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "العضوية تُمنح للمرضى فقط", { requestId });
  }
  if (!patient.isActive) {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "حساب المريض موقوف", { requestId });
  }

  try {
    const result = await purchaseMembership({
      userId: input.userId,
      planId: input.planId,
      grantedBy: identity.userId,
    });
    return ok(
      { membership: result.membership, renewed: result.renewed },
      { status: result.renewed ? 200 : 201, requestId }
    );
  } catch (error) {
    if (error instanceof MembershipError) {
      return fail(
        error.code === "PLAN_NOT_FOUND" ? ErrorCode.NOT_FOUND : ErrorCode.BUSINESS_RULE_VIOLATION,
        error.code === "PLAN_NOT_FOUND" ? 404 : 422,
        error.message,
        { requestId }
      );
    }
    throw error;
  }
});
