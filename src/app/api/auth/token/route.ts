import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { issueTokens } from "@/lib/tokens";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/auth/token — exchange credentials for a bearer token pair.
 *
 * PUBLIC by necessity: this IS the mobile sign-in surface.
 *
 * NextAuth's `/api/auth/callback/*` is cookie- and CSRF-bound and cannot serve
 * a native client, and its previous OTP endpoint deliberately did not sign the
 * user in at all. This is the only path that returns usable credentials.
 *
 * Two grants:
 *   { grantType: "password", email, password }   — staff
 *   { grantType: "otp", phone, code }            — patients
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
      return fail(ErrorCode.VALIDATION_FAILED, 400, "بيانات غير صالحة");
    }
    const input = parsed.data;

    const user =
      input.grantType === "password"
        ? await authenticatePassword(input.email, input.password)
        : await authenticateOtp(input.phone, input.code);

    // One generic message for every failure mode. Distinguishing "no such
    // account" from "wrong password" would make this an enumeration oracle.
    if (!user) {
      return fail(ErrorCode.UNAUTHENTICATED, 401, "بيانات الدخول غير صحيحة");
    }

    const tokens = await issueTokens(user, deviceContext(req));

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
