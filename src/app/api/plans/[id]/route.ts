import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { planFields } from "../route";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = planFields.partial().strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.healthPlan.findUnique({ where: { id } });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الباقة غير موجودة", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  const data = await prisma.healthPlan.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      // `features` is a Json column: `undefined` skips it, `[]` clears it.
      ...(input.features ? { features: input.features } : {}),
      accent: input.accent,
      icon: input.icon,
      isPopular: input.isPopular,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  await prisma.healthPlan.delete({ where: { id } });
  return ok({ message: "تم حذف الباقة" }, { requestId });
});
