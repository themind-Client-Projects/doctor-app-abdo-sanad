import { NextRequest } from "next/server";
import { z } from "zod";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { rotateRefreshToken } from "@/lib/tokens";

/**
 * POST /api/auth/token/refresh — exchange a refresh token for a new pair.
 *
 * PUBLIC by necessity: the caller's access token has expired, which is the
 * whole reason they are here. The refresh token itself is the credential.
 *
 * Rotating: every refresh mints a new refresh token and consumes the old one.
 * Presenting an already-consumed token means the value leaked — the legitimate
 * client and an attacker cannot both hold it — so the whole device family is
 * revoked and a real sign-in is required.
 */

const bodySchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "بيانات غير صالحة");
    }

    const result = await rotateRefreshToken(parsed.data.refreshToken, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (!result.ok) {
      // One generic message: the client's only correct response to any of
      // these is to sign in again, and distinguishing them tells an attacker
      // whether a stolen token was live.
      return fail(ErrorCode.UNAUTHENTICATED, 401, "انتهت الجلسة، يرجى تسجيل الدخول مجدداً");
    }

    return ok(result.tokens);
  } catch (error) {
    console.error("[api] POST /api/auth/token/refresh", error);
    return fail(ErrorCode.INTERNAL_ERROR, 500, "فشل");
  }
}
