import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bearer-token auth for the mobile client.
 *
 * NextAuth's session is a cookie-bound JWT: a native app cannot participate in
 * the browser sign-in handshake, and a cookie JWT cannot be revoked — its
 * lifetime is the blast radius of a stolen token. This module issues a short
 * access token plus an opaque, rotating refresh token that CAN be revoked.
 */

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 60;
const ISSUER = "warid";
const AUDIENCE = "warid-mobile";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Fail loudly. A missing secret must never silently degrade to an
    // unsigned or predictably-signed token.
    throw new Error("AUTH_SECRET is not set — cannot sign access tokens");
  }
  return new TextEncoder().encode(secret);
}

export type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  partnerId: string | null;
  doctorProfileId: string | null;
};

/**
 * Mint a 15-minute access token.
 *
 * Carries authorisation context only. A JWT is signed, not encrypted — anyone
 * holding it can read the payload — so no PHI, name, phone or email goes in.
 */
export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    partnerId: claims.partnerId,
    doctorProfileId: claims.doctorProfileId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Verify an access token. Returns null on any failure — never throws to callers. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"], // pinned: never let the token choose its own alg
    });

    if (!payload.sub || typeof payload.role !== "string") return null;

    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      partnerId: (payload.partnerId as string | null) ?? null,
      doctorProfileId: (payload.doctorProfileId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Refresh tokens are opaque and stored only as a hash. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
};

type DeviceContext = { userAgent?: string | null; ip?: string | null };

/**
 * Issue a fresh access + refresh pair.
 *
 * @param familyId continue an existing rotation lineage, or start a new one.
 */
export async function issueTokens(
  user: { id: string; role: UserRole; partnerId: string | null; doctorProfileId: string | null },
  device: DeviceContext = {},
  familyId: string = randomUUID()
): Promise<IssuedTokens> {
  const raw = randomBytes(32).toString("base64url");

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId: user.id,
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      userAgent: device.userAgent?.slice(0, 255) ?? null,
      ip: device.ip ?? null,
    },
  });

  return {
    accessToken: await signAccessToken({
      sub: user.id,
      role: user.role,
      partnerId: user.partnerId,
      doctorProfileId: user.doctorProfileId,
    }),
    refreshToken: raw,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    tokenType: "Bearer",
  };
}

export type RefreshResult =
  | { ok: true; tokens: IssuedTokens }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "reused" | "inactive" };

/**
 * Exchange a refresh token for a new pair, rotating it.
 *
 * Reuse detection: a token that has already been consumed means the value
 * leaked — the legitimate client and the attacker cannot both hold it. The
 * entire family is revoked, forcing a real sign-in.
 */
export async function rotateRefreshToken(
  raw: string,
  device: DeviceContext = {}
): Promise<RefreshResult> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });

  if (!existing) return { ok: false, reason: "invalid" };

  if (existing.consumedAt) {
    await revokeFamily(existing.familyId);
    return { ok: false, reason: "reused" };
  }
  if (existing.revokedAt) return { ok: false, reason: "revoked" };
  if (existing.expiresAt <= new Date()) return { ok: false, reason: "expired" };

  // Re-read the user on every refresh. Without this, a demoted or deactivated
  // account keeps its old claims for the life of the refresh token.
  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    include: {
      partner: { select: { id: true } },
      doctorProfile: { select: { id: true } },
    },
  });

  if (!user || !user.isActive) {
    await revokeFamily(existing.familyId);
    return { ok: false, reason: "inactive" };
  }

  // Consume atomically: `updateMany` on a still-unconsumed row means two
  // concurrent refreshes cannot both mint a new pair.
  const consumed = await prisma.refreshToken.updateMany({
    where: { id: existing.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: "reused" };

  const tokens = await issueTokens(
    {
      id: user.id,
      role: user.role,
      partnerId: user.partner?.id ?? null,
      doctorProfileId: user.doctorProfile?.id ?? null,
    },
    device,
    existing.familyId
  );

  return { ok: true, tokens };
}

/** Revoke one device's lineage (used on logout and on reuse detection). */
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke a single refresh token — the normal logout path. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { familyId: true },
  });
  if (token) await revokeFamily(token.familyId);
}

/** Revoke every session for a user — "sign out everywhere". */
export async function revokeAllForUser(userId: string): Promise<number> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}
