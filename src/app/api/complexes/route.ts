import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createComplexSchema = z
  .object({
    partnerId: z.string().trim().min(1, { message: "الشريك والاسم مطلوبان" }),
    name: z.string().trim().min(1, { message: "الشريك والاسم مطلوبان" }),
  })
  .strict();

// GET /api/complexes — was unbounded, and each row drags its whole `departments`
// and `partners` array with it, so the payload grew faster than the row count.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.medicalComplex.findMany({
    where: keyset.where ?? {},
    include: {
      departments: true,
      partners: { select: { id: true, name: true, type: true } },
    },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/complexes — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createComplexSchema);

  const data = await prisma.medicalComplex.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: { partnerId: input.partnerId, name: input.name },
  });
  return ok(data, { status: 201, requestId });
});
