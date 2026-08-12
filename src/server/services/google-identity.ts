import { createRemoteJWKSet, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Verify a Google ID token, for the native sign-in path.
 *
 * A mobile app cannot use `/api/auth/callback/google`: that flow is cookie- and
 * CSRF-bound and ends in a browser redirect. The native Google SDK instead
 * hands the app a signed **ID token**, which it posts here. Everything this
 * module does exists to make sure that token really is Google's, and really is
 * for US.
 *
 * The whole point is that the token is not trusted until proven:
 *
 *   - **Signature** against Google's published JWKS. Without this the token is
 *     a JSON blob any caller could write, naming any email.
 *   - **`iss`** is Google. A validly-signed token from another issuer is
 *     someone else's user.
 *   - **`aud`** is one of OUR client ids. This is the one most often skipped
 *     and the most dangerous to skip: every Google ID token in the world is
 *     signed by the same keys, so a token minted for a DIFFERENT app verifies
 *     perfectly. Without an audience check, anyone who can get a user to sign
 *     into their own unrelated app holds a token that logs in as that user
 *     here. `jwtVerify` enforces it, and this module refuses to run at all if
 *     no client id is configured rather than defaulting to "any".
 *   - **`exp` / `iat`** — handled by `jwtVerify`, with a small clock tolerance
 *     because phones drift.
 *   - **`email_verified`** — an unverified address is a claim, not a fact, and
 *     accounts here are found by email.
 */

export type GoogleIdentity = {
  /** `sub` — Google's stable user id. The value to store, never the email. */
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
};

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * Cached across requests — `createRemoteJWKSet` fetches Google's keys once and
 * refreshes them on rotation. Building it per request would mean an outbound
 * HTTPS round trip on every sign-in.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function keySet() {
  jwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  return jwks;
}

/**
 * Every client id this deployment accepts.
 *
 * The web client id is not enough. A native app has its OWN client ids — one
 * for iOS, one for Android — and the ID token it receives carries whichever of
 * those minted it. Accepting only `AUTH_GOOGLE_ID` would reject every real
 * phone, so the mobile ids are configured alongside it.
 */
export function googleAudiences(): string[] {
  const extra = (process.env.GOOGLE_MOBILE_CLIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const web = process.env.AUTH_GOOGLE_ID?.trim();

  return [...new Set([...(web ? [web] : []), ...extra])];
}

/** Is the Google grant usable at all on this deployment? */
export function isGoogleGrantConfigured(): boolean {
  return googleAudiences().length > 0;
}

/**
 * Returns the verified identity, or null for ANY failure.
 *
 * Never throws and never reports which check failed: the caller turns this into
 * one generic 401, so a probe cannot learn whether it got the audience wrong,
 * the signature wrong, or simply picked an email that does not exist.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  /**
   * The key source. Defaults to Google's live JWKS.
   *
   * Overridable so the checks below can be tested against locally-signed
   * tokens. These are the rules that decide whether a stranger can sign in as
   * someone else, so "it compiles" is not evidence that they hold — the tests
   * mint a token with the wrong audience and assert it is refused.
   */
  keys: Parameters<typeof jwtVerify>[1] = keySet()
): Promise<GoogleIdentity | null> {
  const audience = googleAudiences();
  // Fail closed. `jwtVerify` treats an empty audience array as "no audience
  // check", which would accept a token minted for any app on the internet.
  if (audience.length === 0) return null;

  try {
    const { payload } = await jwtVerify(idToken, keys, {
      issuer: GOOGLE_ISSUERS,
      audience,
      // Phones drift, and a token rejected for a few seconds of skew looks to
      // the user like sign-in is broken.
      clockTolerance: 60,
    });

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    // Google sends this as a boolean, but has historically sent the string
    // "true" as well; both mean verified and nothing else does.
    const verified = payload.email_verified === true || payload.email_verified === "true";

    if (!payload.sub || !email || !verified) return null;

    return {
      googleId: payload.sub,
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    // Expired, wrong audience, bad signature, unreachable JWKS — all the same
    // answer to the caller.
    return null;
  }
}

/* ------------------------------ account lookup ---------------------------- */

export type GoogleUser = {
  id: string;
  role: UserRole;
  name: string | null;
  partnerId: string | null;
  doctorProfileId: string | null;
};

/**
 * Turn a verified Google identity into a user of ours, or refuse.
 *
 * Deliberately mirrors what the WEB Google provider does through NextAuth's
 * PrismaAdapter, because two doors into the same accounts must not have two
 * different security postures:
 *
 *   1. Known `Account(provider, providerAccountId)` → that user.
 *   2. No Account row, but a User already holds this email → REFUSE.
 *   3. Neither → create a PATIENT and link the Account.
 *
 * Step 2 is the one that matters. Signing the existing user in instead would be
 * account takeover by email: staff sign in with a password, their address is
 * predictable, and anyone holding a Google token for that address would inherit
 * their role. NextAuth names the opt-in for this
 * `allowDangerousEmailAccountLinking`; it is not enabled here, and this is the
 * same refusal expressed for the native path.
 *
 * PATIENT-only, for the same reason phone OTP is: these are the two
 * self-service doors, and neither may ever mint a staff token.
 *
 * Returns null for every refusal — the caller answers with one generic 401, so
 * a probe cannot learn which addresses already exist.
 */
export async function resolveGoogleUser(identity: GoogleIdentity): Promise<GoogleUser | null> {
  const include = {
    partner: { select: { id: true } },
    doctorProfile: { select: { id: true } },
  } as const;

  const linked = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identity.googleId,
      },
    },
    select: { user: { include } },
  });

  let user = linked?.user ?? null;

  if (!user) {
    const taken = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    });
    // Someone already owns this address by another means. Linking is a
    // deliberate act by the account holder, not a side effect of signing in.
    if (taken) return null;

    user = await prisma.user.create({
      data: {
        email: identity.email,
        // Google verified the address, which is exactly what this column records.
        emailVerified: new Date(),
        name: identity.name,
        image: identity.picture,
        role: "PATIENT",
        accounts: {
          create: {
            type: "oidc",
            provider: "google",
            providerAccountId: identity.googleId,
          },
        },
      },
      include,
    });
  }

  if (user.role !== "PATIENT" || !user.isActive) return null;

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    partnerId: user.partner?.id ?? null,
    doctorProfileId: user.doctorProfile?.id ?? null,
  };
}
