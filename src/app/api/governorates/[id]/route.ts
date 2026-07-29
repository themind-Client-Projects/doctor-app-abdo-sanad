import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(64).optional(),
    isActive: z.boolean().optional(),
    areas: z.array(z.string().trim().min(1).max(64)).max(200).optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.STAFF }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.governorate.findUnique({
    where: { id },
    include: { _count: { select: { partners: true, orders: true, users: true } } },
  });

  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "المحافظة غير موجودة", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  const data = await prisma.governorate.update({
    where: { id },
    data: {
      name: input.name,
      isActive: input.isActive,
      ...(input.areas ? { areas: input.areas } : {}),
    },
    include: { _count: { select: { partners: true, orders: true, users: true } } },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const existing = await prisma.governorate.findUnique({
    where: { id },
    select: { _count: { select: { partners: true, orders: true, users: true } } },
  });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "المحافظة غير موجودة", { requestId });

  // Orders and partners point here with a nullable FK, so a delete would not
  // fail — it would quietly null out the governorate on historical orders and
  // lose where they happened. Deactivating removes it from every picker while
  // keeping history intact.
  const linked =
    existing._count.partners + existing._count.orders + existing._count.users;
  if (linked > 0) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `لا يمكن حذف محافظة مرتبطة بـ ${linked} سجل — عطّلها بدلاً من حذفها`,
      { requestId }
    );
  }

  await prisma.governorate.delete({ where: { id } });
  return ok({ message: "تم حذف المحافظة" }, { requestId });
});
