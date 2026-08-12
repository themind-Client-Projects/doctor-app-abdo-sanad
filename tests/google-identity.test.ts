import { SignJWT, generateKeyPair, type JWTPayload } from "jose";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  googleAudiences,
  isGoogleGrantConfigured,
  verifyGoogleIdToken,
} from "@/server/services/google-identity";

/**
 * The Google ID-token checks, against locally-signed tokens.
 *
 * These rules decide whether a stranger can sign in as somebody else, so they
 * are tested with real signatures rather than by inspection. The tokens below
 * are minted with a key pair generated here; the "attacker" cases are signed
 * just as correctly as the good one and differ only in a claim.
 *
 * The audience case is the one worth being loud about. Every Google ID token on
 * the internet is signed by the same keys, so a token minted for a COMPLETELY
 * DIFFERENT app carries a perfect signature. Skipping `aud` would mean anyone
 * who can get a user to sign into their own unrelated app holds a token that
 * logs in as that user here.
 */

const OUR_WEB_ID = "111111.apps.googleusercontent.com";
const OUR_IOS_ID = "222222.apps.googleusercontent.com";
const SOMEONE_ELSES_APP = "999999.apps.googleusercontent.com";

let privateKey: CryptoKey;
let publicKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

/** Stands in for Google's JWKS: the same shape, our key. */
const localKeys = () => Promise.resolve(publicKey);

const originalEnv = { ...process.env };
afterEach(() => {
  process.env.AUTH_GOOGLE_ID = originalEnv.AUTH_GOOGLE_ID;
  process.env.GOOGLE_MOBILE_CLIENT_IDS = originalEnv.GOOGLE_MOBILE_CLIENT_IDS;
});

function configure(web?: string, mobile?: string) {
  if (web === undefined) delete process.env.AUTH_GOOGLE_ID;
  else process.env.AUTH_GOOGLE_ID = web;
  if (mobile === undefined) delete process.env.GOOGLE_MOBILE_CLIENT_IDS;
  else process.env.GOOGLE_MOBILE_CLIENT_IDS = mobile;
}

/** A token that is correctly signed; the caller decides what it CLAIMS. */
async function mint(claims: JWTPayload & { aud?: string }, opts?: { expiresIn?: string }) {
  return new SignJWT({
    email: "patient@example.com",
    email_verified: true,
    name: "مريض تجريبي",
    picture: "https://lh3.googleusercontent.com/a/abc",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject((claims.sub as string) ?? "google-user-1")
    .setIssuer((claims.iss as string) ?? "https://accounts.google.com")
    .setAudience((claims.aud as string) ?? OUR_WEB_ID)
    .setIssuedAt()
    .setExpirationTime(opts?.expiresIn ?? "5m")
    .sign(privateKey);
}

const verify = (token: string) => verifyGoogleIdToken(token, localKeys);

describe("which client ids this deployment accepts", () => {
  it("takes the web id and the comma-separated mobile ids", () => {
    configure(OUR_WEB_ID, `${OUR_IOS_ID}, 333333.apps.googleusercontent.com`);
    expect(googleAudiences()).toEqual([
      OUR_WEB_ID,
      OUR_IOS_ID,
      "333333.apps.googleusercontent.com",
    ]);
  });

  it("deduplicates and drops blanks from a sloppy env value", () => {
    configure(OUR_WEB_ID, `${OUR_WEB_ID},, ${OUR_IOS_ID} ,`);
    expect(googleAudiences()).toEqual([OUR_WEB_ID, OUR_IOS_ID]);
  });

  it("reports the grant as unconfigured when nothing is set", () => {
    configure(undefined, undefined);
    expect(googleAudiences()).toEqual([]);
    expect(isGoogleGrantConfigured()).toBe(false);
  });

  it("counts mobile-only configuration as configured", () => {
    configure(undefined, OUR_IOS_ID);
    expect(isGoogleGrantConfigured()).toBe(true);
  });
});

describe("a token minted for another app is refused", () => {
  it("refuses a perfectly-signed token whose aud is someone else's client id", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    const token = await mint({ aud: SOMEONE_ELSES_APP });
    expect(await verify(token)).toBeNull();
  });

  it("accepts the web client id", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    const identity = await verify(await mint({ aud: OUR_WEB_ID }));
    expect(identity?.email).toBe("patient@example.com");
    expect(identity?.googleId).toBe("google-user-1");
  });

  it("accepts a mobile client id — the phone's token carries its own", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    const identity = await verify(await mint({ aud: OUR_IOS_ID }));
    expect(identity?.googleId).toBe("google-user-1");
  });

  it("refuses everything when no client id is configured, rather than accepting any", async () => {
    configure(undefined, undefined);
    // Signed correctly, claims our old audience — still refused, because with
    // an empty audience list `jwtVerify` would skip the check entirely.
    const token = await mint({ aud: OUR_WEB_ID });
    expect(await verify(token)).toBeNull();
  });
});

describe("the rest of the claims", () => {
  beforeAll(() => configure(OUR_WEB_ID, OUR_IOS_ID));

  it("refuses a token from an issuer that is not Google", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({ iss: "https://evil.example" }))).toBeNull();
  });

  it("accepts both spellings Google actually uses for iss", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({ iss: "accounts.google.com" }))).not.toBeNull();
    expect(await verify(await mint({ iss: "https://accounts.google.com" }))).not.toBeNull();
  });

  it("refuses an expired token", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({}, { expiresIn: "-10m" }))).toBeNull();
  });

  it("tolerates a minute of clock skew, because phones drift", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({}, { expiresIn: "-30s" }))).not.toBeNull();
  });

  it("refuses an unverified email — a claim is not a fact", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({ email_verified: false }))).toBeNull();
  });

  it("accepts the string \"true\", which Google has also sent", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({ email_verified: "true" }))).not.toBeNull();
  });

  it("refuses a token with no email at all", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify(await mint({ email: undefined }))).toBeNull();
  });

  it("lowercases and trims the email, since accounts are found by it", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    const identity = await verify(await mint({ email: "  Patient@Example.COM  " }));
    expect(identity?.email).toBe("patient@example.com");
  });

  it("refuses an unsigned or malformed token", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    expect(await verify("not-a-jwt")).toBeNull();
    expect(await verify("")).toBeNull();
    // A well-formed JWT with alg: none, which some verifiers have accepted.
    const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url"
    )}.${Buffer.from(
      JSON.stringify({ sub: "x", email: "a@b.c", email_verified: true, aud: OUR_WEB_ID })
    ).toString("base64url")}.`;
    expect(await verify(none)).toBeNull();
  });

  it("carries name and picture through, and tolerates their absence", async () => {
    configure(OUR_WEB_ID, OUR_IOS_ID);
    const full = await verify(await mint({}));
    expect(full?.name).toBe("مريض تجريبي");
    expect(full?.picture).toContain("googleusercontent.com");

    const bare = await verify(await mint({ name: undefined, picture: undefined }));
    expect(bare?.name).toBeNull();
    expect(bare?.picture).toBeNull();
  });
});
