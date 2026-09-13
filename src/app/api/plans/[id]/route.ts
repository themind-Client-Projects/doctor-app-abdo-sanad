import { Prisma } from "@prisma/client";
import { TX_OPTIONS, prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { PLAN_INCLUDE } from "@/server/services/membership";
import { duplicateServiceType, planFields } from "../route";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = planFields.partial().strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.healthPlan.findUnique({ where: { id }, include: PLAN_INCLUDE });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الباقة غير موجودة", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  if (input.benefits) {
    const duplicate = duplicateServiceType(input.benefits);
    if (duplicate) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, `الخدمة «${duplicate}» مكرّرة في الباقة`, {
        requestId,
      });
    }
  }

  const data = await prisma.$transaction(async (tx) => {
    // Benefits are replaced wholesale, not merged.
    //
    // The rows have no stable identity the admin form can preserve — reordering
    // and renaming are the normal edits — so a merge would have to guess which
    // submitted row is which stored row. Deleting and recreating is safe here
    // precisely BECAUSE a membership never reads them back: every live
    // membership already holds its own copy in `MembershipEntitlement`, so
    // rewriting a plan cannot alter a deal already sold.
    if (input.benefits) {
      await tx.healthPlanBenefit.deleteMany({ where: { planId: id } });
    }

    return tx.healthPlan.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        price: input.price === undefined ? undefined : new Prisma.Decimal(input.price),
        durationDays: input.durationDays,
        discountPercent:
          input.discountPercent === undefined
            ? undefined
            : new Prisma.Decimal(input.discountPercent),
        accent: input.accent,
        icon: input.icon,
        isPopular: input.isPopular,
        isActive: input.isActive,
        isComingSoon: input.isComingSoon,
        sortOrder: input.sortOrder,
        ...(input.benefits ? { benefits: { create: input.benefits } } : {}),
      },
      include: PLAN_INCLUDE,
    });
  }, TX_OPTIONS);

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  // A plan somebody has bought is deactivated, never deleted.
  //
  // `Membership.planId` is a real foreign key, so the delete would fail at the
  // database with a constraint error — but the reason to refuse is not the
  // constraint: those rows are the record of what was sold, and a sold package
  // has to stay readable for as long as any membership points at it.
  const sold = await prisma.membership.count({ where: { planId: id } });
  if (sold > 0) {
    const data = await prisma.healthPlan.update({
      where: { id },
      data: { isActive: false },
      include: PLAN_INCLUDE,
    });
    return ok(
      { ...data, message: `تم إيقاف الباقة — لا يمكن حذفها لوجود ${sold} عضوية مرتبطة بها` },
      { requestId }
    );
  }

  await prisma.healthPlan.delete({ where: { id } });
  return ok({ message: "تم حذف الباقة" }, { requestId });
});
