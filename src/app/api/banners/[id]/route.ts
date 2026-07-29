import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { bannerFields } from "../route";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = bannerFields.partial().strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.banner.findUnique({ where: { id } });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الإعلان غير موجود", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  // The window has to be checked against the STORED values, not just the sent
  // ones: a PATCH that moves only `endsAt` can still invert an existing window,
  // and a partial schema has nothing to compare against on its own.
  const existing = await prisma.banner.findUnique({
    where: { id },
    select: { startsAt: true, endsAt: true },
  });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "الإعلان غير موجود", { requestId });

  const startsAt = input.startsAt === undefined ? existing.startsAt : input.startsAt;
  const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt;
  if (startsAt && endsAt && startsAt > endsAt) {
    return fail(
      ErrorCode.VALIDATION_FAILED,
      400,
      "تاريخ البداية يجب أن يسبق تاريخ الانتهاء",
      { requestId }
    );
  }

  const data = await prisma.banner.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle,
      imageUrl: input.imageUrl,
      href: input.href,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  await prisma.banner.delete({ where: { id } });
  return ok({ message: "تم حذف الإعلان" }, { requestId });
});
