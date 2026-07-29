import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { specialtyFields } from "../route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * `slug` is deliberately absent: it is the stable machine key clients branch on
 * and `DoctorProfile.specialtyId` resolves through. Renaming it would silently
 * orphan every doctor keyed to the old value.
 */
const updateSchema = specialtyFields.omit({ slug: true }).partial().strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.specialty.findUnique({
    where: { id },
    include: { _count: { select: { doctors: true } } },
  });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "التخصص غير موجود", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  const data = await prisma.specialty.update({
    where: { id },
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    include: { _count: { select: { doctors: true } } },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const existing = await prisma.specialty.findUnique({
    where: { id },
    select: { _count: { select: { doctors: true } } },
  });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "التخصص غير موجود", { requestId });

  // `DoctorProfile.specialtyId` is a nullable FK, so a delete would not fail —
  // it would quietly strip the specialty off every doctor holding it, and they
  // would then match no filter on any browse page.
  if (existing._count.doctors > 0) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `لا يمكن حذف تخصص مرتبط بـ ${existing._count.doctors} طبيب — أخفِه بدلاً من ذلك`,
      { requestId }
    );
  }

  await prisma.specialty.delete({ where: { id } });
  return ok({ message: "تم حذف التخصص" }, { requestId });
});
