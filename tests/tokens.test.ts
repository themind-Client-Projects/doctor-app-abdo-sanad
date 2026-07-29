import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  issueTokens,
  revokeAllForUser,
  revokeRefreshTokenForUser,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/tokens";

async function subject() {
  const user = await prisma.user.findFirstOrThrow({
    where: { role: "PATIENT" },
    include: { partner: { select: { id: true } }, doctorProfile: { select: { id: true } } },
  });
  return {
    id: user.id,
    role: user.role,
    partnerId: user.partner?.id ?? null,
    doctorProfileId: user.doctorProfile?.id ?? null,
  };
}

describe("access tokens", () => {
  it("round-trips the authorisation claims", async () => {
    const s = await subject();
    const claims = await verifyAccessToken(await signAccessToken({ sub: s.id, ...s } as never));
    expect(claims?.sub).toBe(s.id);
    expect(claims?.role).toBe(s.role);
  });

  it("rejects a tampered signature", async () => {
    const s = await subject();
    const token = (await issueTokens(s)).accessToken;
    expect(await verifyAccessToken(token.slice(0, -3) + "aaa")).toBeNull();
  });

  it("rejects a token carrying a role outside the enum", async () => {
    // Regression guard: `payload.role as UserRole` accepted ANY string, and
    // deny-list checks like `if (role !== "PATIENT") return;` then passed it.
    const s = await subject();
    const forged = await signAccessToken({
      sub: s.id,
      role: "SUPERUSER" as never,
      partnerId: null,
      doctorProfileId: null,
    });
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("carries no PHI in the payload", async () => {
    const s = await subject();
    const { accessToken } = await issueTokens(s);
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")
    );
    // A JWT is signed, not encrypted — anyone holding it can read this.
    for (const leak of ["name", "email", "phone", "patientName"]) {
      expect(payload[leak]).toBeUndefined();
    }
  });
});

describe("refresh rotation", () => {
  it("rotates and invalidates the presented token", async () => {
    const s = await subject();
    const first = await issueTokens(s);

    const rotated = await rotateRefreshToken(first.refreshToken);
    expect(rotated.ok).toBe(true);

    const replay = await rotateRefreshToken(first.refreshToken);
    expect(replay.ok).toBe(false);
  });

  it("revokes the whole family when a consumed token is replayed", async () => {
    const s = await subject();
    const first = await issueTokens(s);
    const rotated = await rotateRefreshToken(first.refreshToken);
    const successor = rotated.ok ? rotated.tokens.refreshToken : null;

    await rotateRefreshToken(first.refreshToken); // triggers reuse detection

    // The victim's live token must die too — that is the point of family revocation.
    expect((await rotateRefreshToken(successor!)).ok).toBe(false);
  });

  it("does not let a refresh outrun a concurrent logout-all", async () => {
    // Regression guard: `revokedAt` was checked only against a row read
    // earlier, so a refresh racing "sign out everywhere" consumed its token and
    // INSERTed a fresh un-revoked row — the user was told they were signed out
    // while a stolen token stayed live.
    const s = await subject();
    const tokens = await issueTokens(s);

    const [, rotated] = await Promise.all([
      revokeAllForUser(s.id),
      rotateRefreshToken(tokens.refreshToken),
    ]);

    if (rotated.ok) {
      // If the refresh won the race, its successor must NOT survive revocation.
      const live = await prisma.refreshToken.findMany({
        where: { userId: s.id, revokedAt: null, consumedAt: null },
      });
      expect(live).toHaveLength(0);
    } else {
      expect(rotated.ok).toBe(false);
    }
  });

  it("stores only a hash, never the raw token", async () => {
    const s = await subject();
    const { refreshToken } = await issueTokens(s);
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: s.id },
      orderBy: { createdAt: "desc" },
    });
    expect(stored!.tokenHash).not.toBe(refreshToken);
  });
});

describe("logout ownership", () => {
  it("will not let one user revoke another user's session", async () => {
    // Regression guard: revokeRefreshToken took only the raw token, so any
    // authenticated caller could kill someone else's family.
    const owner = await subject();
    const other = await prisma.user.findFirstOrThrow({
      where: { role: "PATIENT", id: { not: owner.id } },
    });

    const { refreshToken } = await issueTokens(owner);
    const revoked = await revokeRefreshTokenForUser(refreshToken, other.id);

    expect(revoked).toBe(0);
    // And the owner's token still works.
    expect((await rotateRefreshToken(refreshToken)).ok).toBe(true);
  });
});
