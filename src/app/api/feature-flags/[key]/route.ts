import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ key: string }> };

/**
 * `key`, `label`, `group` and `description` are all absent: they describe a
 * switch the code branches on, so renaming one from the UI would detach the
 * toggle from the behaviour it controls. Only the state is editable.
 */
const updateSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    numericValue: z.number().finite().nonnegative().nullable().optional(),
  })
  .strict();

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { key } = await params;
  const input = await parseBody(req, updateSchema);

  const existing = await prisma.featureFlag.findUnique({ where: { key } });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "الخيار غير موجود", { requestId });

  const [data] = await prisma.$transaction([
    prisma.featureFlag.update({
      where: { key },
      data: { isEnabled: input.isEnabled, numericValue: input.numericValue },
    }),
    // Switching a payment or booking behaviour on for every user is exactly the
    // change you need to be able to attribute later.
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `تغيير خيار النظام: ${existing.label}`,
        entityType: "feature_flag",
        entityId: key,
        details: {
          from: { isEnabled: existing.isEnabled, numericValue: existing.numericValue?.toString() ?? null },
          to: { isEnabled: input.isEnabled ?? existing.isEnabled, numericValue: input.numericValue ?? null },
        },
      },
    }),
  ]);

  return ok(data, { requestId });
});
