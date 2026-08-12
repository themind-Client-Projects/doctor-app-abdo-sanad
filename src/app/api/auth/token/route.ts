import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { issueTokens } from "@/lib/tokens";
import { normalizePhone } from "@/lib/phone";
import { issuesOf } from "@/lib/validation";
import {
  isGoogleGrantConfigured,
  resolveGoogleUser,
  verifyGoogleIdToken,
} from "@/server/services/google-identity";
import {
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/server/services/login-throttle";

/**
 * POST /api/auth/token — exchange credentials for a bearer token pair.
 *
 * PUBLIC by necessity: this IS the mobile sign-in surface.
 *
 * NextAuth's `/api/auth/callback/*` is cookie- and CSRF-bound and cannot serve
 * a native client, and its previous OTP endpoint deliberately did not sign the
 * user in at all. This is the only path that returns usable credentials.
 *
 * Three grants:
 *   { grantType: "password", email, password }   — staff
 *   { grantType: "otp", phone, code }            — patients
 *   { grantType: "google", idToken }             — patients, native Google SDK
 */

const MAX_OTP_ATTEMPTS = 5;

/** Cost-12 hash of an unguessable value — equalises timing when no user exists. */
const DUMMY_PASSWORD_HASH = "$2b$12$7K5CQ4UKD8jWYBos1PrWguddIBh4TtBYC3.Bq6gFX7lzr.k87OkSa";

const bodySchema = z.discriminatedUnion("grantType", [
  z.object({
    grantType: z.literal("password"),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  }),
  z.object({
    grantType: z.literal("otp"),
    phone: z.string().trim().min(6),
    code: z.string().trim().length(6),
  }),
  z.object({
    grantType: z.literal("google"),
    /**
     * The ID token from the native Google SDK — NOT an access token.
     *
     * An access token is opaque and only tells us the app that holds it; the
     * ID token is a signed statement about WHO signed in, which is what has to
     * be verified here.
     */
    idToken: z.string().trim().min(1),
  }),
]);

function deviceContext(req: NextRequest) {
  return {
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      // `details` names the offending field, so a sign-in form can highlight it
      // rather than showing one message under the whole screen. Safe to expose:
      // it describes the SHAPE the caller sent, never whether an account exists.
      return fail(ErrorCode.VALIDATION_FAILED, 400, "بيانات غير صالحة", {
        details: issuesOf(parsed.error),
        requestId: req.headers.get("x-request-id") ?? undefined,
      });
    }
    const input = parsed.data;

    const device = deviceContext(req);

    // The OTP grant carries its own limits (5 guesses per code, 3 codes an
    // hour). The password grant had none, so it is throttled here — before
    // bcrypt runs, so a locked-out caller cannot spend our CPU either.
    if (input.grantType === "password") {
      const verdict = await checkLoginAllowed(input.email, device.ip);
      if (!verdict.allowed) {
        return fail(
          ErrorCode.RATE_LIMITED,
          429,
          "محاولات دخول كثيرة. حاول مرة أخرى بعد قليل",
          { requestId: req.headers.get("x-request-id") ?? undefined }
        );
      }
    }

    // A deployment with no Google client id configured must say so, rather than
    // returning "بيانات الدخول غير صحيحة" for a token that is perfectly valid.
    if (input.grantType === "google" && !isGoogleGrantConfigured()) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        "الدخول عبر Google غير مفعّل على هذا الخادم",
        { requestId: req.headers.get("x-request-id") ?? undefined }
      );
    }

    const user =
      input.grantType === "password"
        ? await authenticatePassword(input.email, input.password)
        : input.grantType === "otp"
          ? await authenticateOtp(input.phone, input.code)
          : await authenticateGoogleIdToken(input.idToken);

    // One generic message for every failure mode. Distinguishing "no such
    // account" from "wrong password" would make this an enumeration oracle.
    if (!user) {
      if (input.grantType === "password") {
        await recordLoginFailure(input.email, device.ip);
      }
      return fail(ErrorCode.UNAUTHENTICATED, 401, "بيانات الدخول غير صحيحة");
    }

    if (input.grantType === "password") {
      await clearLoginFailures(input.email);
    }

    const tokens = await issueTokens(user, device);

    return ok({
      ...tokens,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[api] POST /api/auth/token", error);
    return fail(ErrorCode.INTERNAL_ERROR, 500, "فشل");
  }
}

type AuthedUser = {
  id: string;
  role: import("@prisma/client").UserRole;
  name: string | null;
  partnerId: string | null;
  doctorProfileId: string | null;
};

/**
 * Verify the token, then resolve it to one of our users.
 *
 * Both halves live in `@/server/services/google-identity` — the verification
 * because it is pure crypto, and the account lookup because its account-takeover
 * refusal is the single most important rule on this route and needs to be
 * testable against the database rather than only through HTTP.
 */
async function authenticateGoogleIdToken(idToken: string): Promise<AuthedUser | null> {
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) return null;
  return resolveGoogleUser(identity);
}

async function authenticatePassword(email: string, password: string): Promise<AuthedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      partner: { select: { id: true } },
      doctorProfile: { select: { id: true } },
    },
  });

  // Always run a compare, so a missing account costs the same as a wrong password.
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.passwordHash || !matches || !user.isActive) return null;

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    partnerId: user.partner?.id ?? null,
    doctorProfileId: user.doctorProfile?.id ?? null,
  };
}

async function authenticateOtp(rawPhone: string, code: string): Promise<AuthedUser | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  // Consume atomically — a code must never be usable twice.
  const consumed = await prisma.oTPCode.updateMany({
    where: {
      phone,
      code,
      verified: false,
      consumedAt: null,
      attempts: { lt: MAX_OTP_ATTEMPTS },
      expiresAt: { gt: new Date() },
    },
    data: { verified: true, consumedAt: new Date() },
  });

  if (consumed.count === 0) {
    await prisma.oTPCode.updateMany({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  let user = await prisma.user.findUnique({
    where: { phone },
    include: {
      partner: { select: { id: true } },
      doctorProfile: { select: { id: true } },
    },
  });

  if (!user) {
    const created = await prisma.user.create({ data: { phone, role: "PATIENT" } });
    user = { ...created, partner: null, doctorProfile: null };
  }

  // Phone OTP is the PATIENT path only. Staff accounts have phone numbers, so
  // without this a known admin's phone plus one code would mint an admin token.
  if (user.role !== "PATIENT" || !user.isActive) return null;

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    partnerId: user.partner?.id ?? null,
    doctorProfileId: user.doctorProfile?.id ?? null,
  };
}

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { bodySchema as tokenGrantSchema };
