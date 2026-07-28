import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { revokeAllForUser, revokeRefreshToken } from "@/lib/tokens";

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
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const input = parsed.success ? parsed.data : {};

  if (input.allDevices) {
    const revoked = await revokeAllForUser(identity.userId);
    return ok({ revoked, scope: "all" }, { requestId });
  }

  if (input.refreshToken) {
    await revokeRefreshToken(input.refreshToken);
    return ok({ revoked: 1, scope: "device" }, { requestId });
  }

  // No token supplied and not an explicit all-devices request: revoke
  // everything rather than silently doing nothing. Logging out must never
  // appear to succeed while leaving a session alive.
  const revoked = await revokeAllForUser(identity.userId);
  return ok({ revoked, scope: "all" }, { requestId });
});
