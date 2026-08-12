import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

const partnerType = z.enum(
  ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"],
  { message: "نوع الشريك غير صالح" }
);

const partnerStatus = z.enum(["ACTIVE", "SUSPENDED", "PENDING", "PAUSED"], {
  message: "حالة غير صالحة",
});

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  type: partnerType.optional(),
  status: partnerStatus.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /** Restrict to partners selling through one storefront. */
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).optional(),
  /** Attach each partner's live workload — see `attachActiveLoad`. */
  withLoad: z.coerce.boolean().optional(),
});

/** Which order column records an assignment to a partner of this type. */
const ASSIGNMENT_COLUMN = {
  NURSE: "assignedNurseId",
  DRIVER: "assignedDriverId",
  LAB: "assignedLabId",
  PHARMACY: "assignedPharmacyId",
  RADIOLOGY: "assignedRadiologyId",
} as const;

/** Assigned but not yet finished — i.e. what the partner is holding right now. */
const OPEN_STATUSES = ["ASSIGNED", "IN_TRANSIT", "ARRIVED", "IN_PROGRESS"] as const;

/**
 * Adds `activeOrders` — how many open orders each partner is currently holding.
 *
 * Dispatch needs to answer "who is free?" and the dispatch screen used to answer
 * it with a `currentTasks` field that does not exist on Partner, so every row
 * read 0. The number is real and cheap: one grouped count over the assignment
 * column, scoped to the ids already on the page.
 *
 * `totalTasks` on the partner is the lifetime figure and stays what it was.
 */
async function attachActiveLoad<T extends { id: string }>(
  rows: T[],
  type: keyof typeof ASSIGNMENT_COLUMN
): Promise<(T & { activeOrders: number })[]> {
  if (rows.length === 0) return [];

  const column = ASSIGNMENT_COLUMN[type];
  const ids = rows.map((r) => r.id);

  const grouped = await prisma.order.groupBy({
    by: [column],
    where: { [column]: { in: ids }, status: { in: [...OPEN_STATUSES] } },
    _count: { _all: true },
  });

  const load = new Map<string, number>();
  for (const g of grouped) {
    const partnerId = (g as Record<string, unknown>)[column];
    if (typeof partnerId === "string") load.set(partnerId, g._count._all);
  }

  return rows.map((r) => ({ ...r, activeOrders: load.get(r.id) ?? 0 }));
}

// `rating` and `totalTasks` are derived server-side and are deliberately absent,
// so `.strict()` turns an attempt to set them into a 400.
const createPartnerSchema = z
  .object({
    userId: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    type: partnerType,
    name: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    phone: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    email: z.string().trim().min(1).optional(),
    governorateId: nonEmpty.optional(),
    address: z.string().trim().min(1).optional(),
    status: partnerStatus.default("PENDING"),
    complexId: nonEmpty.optional(),
  })
  .strict();

// GET /api/partners — List all partners (req L128-182).
// Dispatch (OPERATIONS) needs to read partners to assign orders.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  // Clamped by `paginationSchema`: pageSize was unbounded and a non-numeric
  // ?page produced skip: NaN.
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, type, status, cursor, limit, channel, withLoad } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  // Only meaningful for the five assignable types — a DOCTOR is not dispatched.
  const loadType =
    withLoad && type && type in ASSIGNMENT_COLUMN
      ? (type as keyof typeof ASSIGNMENT_COLUMN)
      : null;

  const where: Prisma.PartnerWhereInput = {
    // Partners are retired by soft-delete, so historical orders keep naming who
    // served them. Without this they would keep appearing in dispatch pickers.
    deletedAt: null,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    // Membership is a row, so "in this storefront" is an indexed join rather
    // than a boolean scan — and it can say "suspended in Sanad only".
    ...(channel ? { channels: { some: { channel, status: { not: "SUSPENDED" } } } } : {}),
  };

  const include = {
    user: { select: { id: true, email: true, phone: true } },
    governorate: { select: { id: true, name: true } },
    complex: { select: { id: true, name: true } },
    // Which partners own a medical complex — `MedicalComplex.partnerId` is
    // @unique, so a complex IS a partner plus this row. The admin screen had a
    // "المجمعات الطبية" tab filtering on `type: "COMPLEX"`, a value the
    // `UserRole` enum has never contained, so that tab always came back empty.
    ownedComplex: { select: { id: true, name: true } },
    channels: { select: { channel: true, status: true } },
    contract: { select: { id: true, isActive: true, endDate: true } },
  } as const;

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new partners are onboarded between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.partner.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      include,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    // After `toPage`, so the count is only run for rows actually returned.
    return okList(loadType ? await attachActiveLoad(items, loadType) : items, pageMeta, {
      requestId,
    });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.partner.count({ where }),
  ]);

  return okList(
    loadType ? await attachActiveLoad(partners, loadType) : partners,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/partners — Create partner.
// The body used to be spread into prisma.partner.create, so a caller could set
// `rating`, `totalTasks` or `status: "ACTIVE"` on a partner that had not been
// vetted. Only the fields below are writable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createPartnerSchema);

  const partner = await prisma.partner.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      userId: input.userId,
      type: input.type,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      governorateId: input.governorateId ?? null,
      address: input.address ?? null,
      status: input.status,
      complexId: input.complexId ?? null,
      wallet: { create: {} }, // Auto-create wallet
    },
    include: { wallet: true },
  });

  return ok(partner, { status: 201, requestId });
});
