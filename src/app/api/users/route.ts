import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { paginationSchema, parseBody, parseQuery } from "@/lib/validation";

const userRole = z.enum([
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "LAB",
  "PHARMACY",
  "NURSE",
  "DRIVER",
  "RADIOLOGY",
  "PATIENT",
]);

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  role: userRole.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently ignored.
const createUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(6).optional(),
    role: userRole.default("PATIENT"),
    governorateId: z.string().trim().min(1).optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((v) => Boolean(v.email || v.phone), {
    message: "البريد الإلكتروني أو رقم الهاتف مطلوب",
    path: ["email"],
  });

// GET /api/users — List users (req L265)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, role, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.UserWhereInput = role ? { role } : {};

  // `id` and `createdAt` are what the cursor is built from, so both must stay
  // in the projection.
  const select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    image: true,
    createdAt: true,
  } as const;

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new users are created between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.user.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items, pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
    prisma.user.count({ where }),
  ]);

  return okList(
    users,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/users — Create a user.
// Previously spread the raw body into prisma.user.create, so an anonymous
// caller could POST {"role":"SUPER_ADMIN"} and mint an admin.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createUserSchema);

  const data = await prisma.user.create({
    data: {
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role,
      governorateId: input.governorateId ?? null,
      isActive: input.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  return ok(data, { status: 201, requestId });
});
