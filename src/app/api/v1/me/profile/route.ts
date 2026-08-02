import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

/**
 * PATCH /api/v1/me/profile — the details collected right after sign-up.
 *
 * Phone sign-in gives us a number but no name or city; Google gives a name and
 * email but no phone. Both land here, which is why every field is optional and
 * the completeness rule lives in one place below.
 *
 * Scoped to `identity.userId` and never to a client-supplied id.
 */
const bodySchema = z
  .object({
    name: z.string().trim().min(3, { message: "الاسم الكامل مطلوب" }).max(120).optional(),
    phone: z.string().trim().min(10, { message: "رقم هاتف غير صالح" }).max(32).optional(),
    governorateId: z.string().trim().min(1).optional(),
    area: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict();

export const PATCH = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, bodySchema);

  // The area must belong to the governorate being set. Without this a client
  // could pair "الكرخ" with البصرة, and every downstream dispatch decision
  // would inherit a location that does not exist.
  if (input.governorateId) {
    const gov = await prisma.governorate.findUnique({
      where: { id: input.governorateId },
      select: { name: true, areas: true, isActive: true },
    });
    if (!gov || !gov.isActive) {
      return fail(ErrorCode.INVALID_REFERENCE, 409, "المحافظة غير صالحة", { requestId });
    }

    const areas = Array.isArray(gov.areas) ? (gov.areas as string[]) : [];
    if (areas.length > 0) {
      if (!input.area) {
        return fail(ErrorCode.VALIDATION_FAILED, 400, `اختر المنطقة داخل ${gov.name}`, {
          requestId,
        });
      }
      if (!areas.includes(input.area)) {
        return fail(ErrorCode.VALIDATION_FAILED, 400, `المنطقة لا تتبع ${gov.name}`, {
          requestId,
        });
      }
    } else if (input.area) {
      // The governorate defines NO areas, so any area sent with it is wrong.
      // Without this branch the check was skipped entirely and "الكرخ" saved
      // happily against البصرة — the exact mismatch the validation exists to
      // stop, passing through the one door it did not cover.
      return fail(
        ErrorCode.VALIDATION_FAILED,
        400,
        `${gov.name} لا تحتوي على مناطق محددة`,
        { requestId }
      );
    }
  }

  // `User.phone` is @unique. Checking first turns "this number is already
  // registered" into a message the person can act on, rather than a bare 409
  // from the constraint.
  if (input.phone) {
    const clash = await prisma.user.findFirst({
      where: { phone: input.phone, id: { not: identity.userId } },
      select: { id: true },
    });
    if (clash) {
      return fail(ErrorCode.DUPLICATE_RESOURCE, 409, "رقم الهاتف مسجّل لحساب آخر", {
        requestId,
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: identity.userId },
    data: {
      name: input.name,
      phone: input.phone,
      governorateId: input.governorateId,
      // Explicitly clears the area when the new governorate defines none, so a
      // stale "الكرخ" cannot survive a move to البصرة.
      ...(input.governorateId ? { area: input.area ?? null } : {}),
    },
    select: { id: true, name: true, phone: true, governorateId: true, area: true },
  });

  return ok(user, { requestId });
});
