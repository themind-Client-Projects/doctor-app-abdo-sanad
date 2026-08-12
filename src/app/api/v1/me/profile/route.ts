import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone";

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

  // The phone is the PATIENT sign-in credential, so it gets two guards the
  // other fields do not need.
  let phone: string | undefined;
  if (input.phone !== undefined) {
    // 1. Canonical form. Every other phone path normalises — OTP send, OTP
    //    verify, the User lookup behind both — and this one stored the raw
    //    string. "0770 123 4567" saved here never matches the "9647701234567"
    //    that sign-in looks up, so the @unique constraint and the clash check
    //    below could both be walked straight past with a reformatted number.
    phone = normalizePhone(input.phone) ?? undefined;
    if (!phone) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "رقم هاتف غير صالح", { requestId });
    }

    const current = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: { phone: true },
    });

    // 2. Set, don't change. This endpoint exists to COLLECT a number that is
    //    missing — Google gives an email and no phone. Letting it REPLACE an
    //    established one means the login identifier is attacker-chosen: set
    //    your account's phone to someone else's number and, when they later
    //    sign in by OTP, the lookup resolves to YOUR account — they land in it,
    //    and you still hold a session on it. It also squats the number so the
    //    real owner can never register it.
    //
    //    Re-submitting the same number is a no-op: the onboarding form posts
    //    every field, including the phone it prefilled.
    if (current?.phone && current.phone !== phone) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        409,
        "لتغيير رقم الهاتف يجب التحقق منه برمز جديد",
        { requestId }
      );
    }

    // `User.phone` is @unique. Checking first turns "this number is already
    // registered" into a message the person can act on, rather than a bare 409
    // from the constraint.
    const clash = await prisma.user.findFirst({
      where: { phone, id: { not: identity.userId } },
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
      phone,
      governorateId: input.governorateId,
      // Explicitly clears the area when the new governorate defines none, so a
      // stale "الكرخ" cannot survive a move to البصرة.
      ...(input.governorateId ? { area: input.area ?? null } : {}),
    },
    select: { id: true, name: true, phone: true, governorateId: true, area: true },
  });

  return ok(user, { requestId });
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { bodySchema as updateProfileSchema };
