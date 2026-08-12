import { z } from "zod";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
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
    /**
     * Sections to open the complex with.
     *
     * A complex created without any showed "لا أقسام" and needed a second trip
     * through a separate dialog before it described anything. Optional, because
     * they can still be managed afterwards.
     */
    // Deliberately lenient per item: the form is a textarea, so a trailing
    // blank line is a normal thing to send, not a validation error. Blanks and
    // duplicates are dropped by the handler below rather than rejected here.
    departments: z.array(z.string().max(80)).max(30).optional(),
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

  // One transaction: a complex whose sections half-landed would show a
  // partial structure with nothing saying so.
  const data = await prisma.$transaction(async (tx) => {
    const complex = await tx.medicalComplex.create({
      data: { partnerId: input.partnerId, name: input.name },
    });

    // Deduped and trimmed — the form takes free text, and "الباطنية" twice is
    // a typo, not two departments.
    const names = [...new Set((input.departments ?? []).map((n) => n.trim()).filter(Boolean))];
    if (names.length > 0) {
      await tx.department.createMany({
        data: names.map((name) => ({ complexId: complex.id, name })),
      });
    }

    return tx.medicalComplex.findUniqueOrThrow({
      where: { id: complex.id },
      include: {
        departments: true,
        partners: { select: { id: true, name: true, type: true } },
      },
    });
  }, TX_OPTIONS);

  return ok(data, { status: 201, requestId })
});
