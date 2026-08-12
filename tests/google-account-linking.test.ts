import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveGoogleUser, type GoogleIdentity } from "@/server/services/google-identity";

/**
 * Who a verified Google identity is allowed to become.
 *
 * The verification tests prove a token really came from Google. These prove the
 * step after: that holding a genuine Google token for an address does NOT hand
 * you whatever account already uses it.
 *
 * That is the account-takeover case, and it is the reason NextAuth calls the
 * opt-in `allowDangerousEmailAccountLinking`. Staff sign in with a password and
 * their addresses are predictable, so a Google sign-in that silently adopted an
 * existing user by email would be a role escalation with no exploit required.
 *
 * Runs against the real database, like the rest of this suite. Everything it
 * creates is namespaced and removed in `afterAll`.
 */

const TAG = "gtest-";
const identity = (over: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  googleId: `${TAG}sub-default`,
  email: `${TAG}default@example.test`,
  name: "مستخدم Google",
  picture: "https://lh3.googleusercontent.com/a/x",
  ...over,
});

const createdUserIds: string[] = [];
const track = (id: string | undefined) => {
  if (id) createdUserIds.push(id);
};

afterAll(async () => {
  // Accounts cascade from User; the tagged rows are the only ones touched here.
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
});

describe("a brand-new Google user", () => {
  it("is created as a PATIENT, with the account linked and the email marked verified", async () => {
    const who = identity({ googleId: `${TAG}sub-new`, email: `${TAG}new@example.test` });
    const user = await resolveGoogleUser(who);
    track(user?.id);

    expect(user).not.toBeNull();
    expect(user!.role).toBe("PATIENT");

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user!.id },
      include: { accounts: true },
    });
    expect(row.email).toBe(who.email);
    // Google asserted the address; that is exactly what this column records.
    expect(row.emailVerified).not.toBeNull();
    expect(row.name).toBe("مستخدم Google");
    expect(row.accounts).toHaveLength(1);
    expect(row.accounts[0].provider).toBe("google");
    expect(row.accounts[0].providerAccountId).toBe(who.googleId);
  });

  it("signing in again returns the SAME user rather than creating another", async () => {
    const who = identity({ googleId: `${TAG}sub-twice`, email: `${TAG}twice@example.test` });

    const first = await resolveGoogleUser(who);
    track(first?.id);
    const second = await resolveGoogleUser(who);

    expect(second?.id).toBe(first?.id);
    expect(await prisma.user.count({ where: { email: who.email } })).toBe(1);
  });

  it("is matched by Google's `sub`, not by email — a changed address still signs in", async () => {
    const who = identity({ googleId: `${TAG}sub-stable`, email: `${TAG}before@example.test` });
    const first = await resolveGoogleUser(who);
    track(first?.id);

    // Same person at Google, new address on their Google account.
    const renamed = await resolveGoogleUser({ ...who, email: `${TAG}after@example.test` });
    expect(renamed?.id).toBe(first?.id);
  });
});

describe("an address that somebody already owns", () => {
  it("REFUSES rather than adopting an existing account", async () => {
    const email = `${TAG}existing@example.test`;
    const existing = await prisma.user.create({
      data: { email, name: "صاحب الحساب", role: "PATIENT" },
    });
    track(existing.id);

    // A genuine, fully-verified Google token for that address.
    const result = await resolveGoogleUser(identity({ googleId: `${TAG}sub-attacker`, email }));

    expect(result).toBeNull();
    // And nothing was linked on the way to refusing.
    expect(await prisma.account.count({ where: { userId: existing.id } })).toBe(0);
  });

  it("refuses a STAFF address — the escalation this rule exists to stop", async () => {
    const email = `${TAG}admin@example.test`;
    const staff = await prisma.user.create({
      data: { email, name: "مدير", role: "SUPER_ADMIN", passwordHash: "x" },
    });
    track(staff.id);

    expect(await resolveGoogleUser(identity({ googleId: `${TAG}sub-esc`, email }))).toBeNull();
  });
});

describe("only patients come through this door", () => {
  it("refuses a linked account whose user is staff", async () => {
    // A staff member could hold a google Account row from an earlier web
    // sign-in. The native grant still must not mint a staff token.
    const staff = await prisma.user.create({
      data: {
        email: `${TAG}linked-staff@example.test`,
        name: "موظف",
        role: "OPERATIONS",
        accounts: {
          create: { type: "oidc", provider: "google", providerAccountId: `${TAG}sub-staff` },
        },
      },
    });
    track(staff.id);

    expect(
      await resolveGoogleUser(
        identity({ googleId: `${TAG}sub-staff`, email: `${TAG}linked-staff@example.test` })
      )
    ).toBeNull();
  });

  it("refuses a deactivated user", async () => {
    const disabled = await prisma.user.create({
      data: {
        email: `${TAG}disabled@example.test`,
        role: "PATIENT",
        isActive: false,
        accounts: {
          create: { type: "oidc", provider: "google", providerAccountId: `${TAG}sub-disabled` },
        },
      },
    });
    track(disabled.id);

    expect(
      await resolveGoogleUser(
        identity({ googleId: `${TAG}sub-disabled`, email: `${TAG}disabled@example.test` })
      )
    ).toBeNull();
  });
});
