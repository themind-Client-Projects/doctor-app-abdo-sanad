import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { revokeAllForUser, revokeRefreshTokenForUser } from "@/lib/tokens";

/**
 * POST /api/auth/token/logout — revoke this device, or every device.
 *
 * Authenticated, unlike the other token endpoints: a caller must prove who
 * they are before revoking sessions. Revocation is what a cookie-bound JWT
 * could never offer — previously the only way to end a session was to wait
 * out its expiry.
 *
 * Body: { refreshToken?: string, allDevices?: boolean }
 */

const bodySchema = z
  .object({
    refreshToken: z.string().trim().min(1).optional(),
    allDevices: z.boolean().optional(),
  })
  .strict();

export const POST = withAuth({}, async (req: NextRequest, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw ?? {});

  // A malformed body used to fall back to `{}`, which took the default branch
  // and revoked EVERY device. A client sending one unexpected key got signed
  // out everywhere with no error.
  if (!parsed.success) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, "بيانات غير صالحة", { requestId });
  }
  const input = parsed.data;

  if (input.allDevices) {
    const revoked = await revokeAllForUser(identity.userId);
    return ok({ revoked, scope: "all" }, { requestId });
  }

  if (input.refreshToken) {
    // Ownership: any authenticated caller could previously submit ANOTHER
    // user's refresh token and revoke that user's entire family.
    const revoked = await revokeRefreshTokenForUser(input.refreshToken, identity.userId);
    if (revoked === 0) {
      return fail(ErrorCode.NOT_FOUND, 404, "الجلسة غير موجودة", { requestId });
    }
    return ok({ revoked, scope: "device" }, { requestId });
  }

  // No token supplied and not an explicit all-devices request: revoke
  // everything rather than silently doing nothing. Logging out must never
  // appear to succeed while leaving a session alive.
  const revoked = await revokeAllForUser(identity.userId);
  return ok({ revoked, scope: "all" }, { requestId });
});
