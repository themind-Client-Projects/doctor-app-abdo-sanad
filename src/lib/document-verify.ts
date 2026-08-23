import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The verification code printed as a QR on a clinical document.
 *
 * "رمز QR للتحقق" on the client's four referral forms: a pharmacy handed a
 * prescription on paper needs to know it came out of this system, is about the
 * patient it names, and has not been altered or already expired.
 *
 * DERIVED, NOT STORED — and that is the whole design:
 *
 *   - A random column would sit in the row it protects. Anyone who dumps the
 *     table walks away with every live code and can print paper that this
 *     server will confirm as genuine. The key here lives in the environment
 *     and never touches the database, so a dump yields nothing that verifies.
 *   - It matches the rule `decorateReferral` already states: everything the
 *     printed document needs is computed, so no column can drift out of step
 *     with the row it describes. The reference number is derived; so is this.
 *   - Nothing needs per-code revocation. The verifier reads the LIVE row, so a
 *     withdrawn referral already reports `cancelled` and an old one already
 *     reports expired. Revocation here is the status machine, not the code.
 *
 * The cost, stated plainly: rotating the secret invalidates every already
 * printed QR at once. It is bounded — referrals are valid 30 days, so a
 * rotation orphans at most 30 days of paper — and `DOCUMENT_VERIFY_SECRET`
 * exists so that rotating `AUTH_SECRET` after a token compromise does not also
 * silently break the prescriptions in patients' hands.
 *
 * Server-only: this imports `node:crypto`. It deliberately does NOT live in
 * `referral-forms.ts` beside `referralNumber()`, because that module is
 * imported by a `"use client"` page and would fail to bundle.
 */

/** HMAC-SHA256's strength is the key's entropy — the same floor as `tokens.ts`. */
const MIN_SECRET_BYTES = 32;

/**
 * Truncation length. 128 bits is as unguessable as `randomBytes(16)`, and 22
 * base64url characters still fit a QR at a size that scans from paper.
 */
const CODE_BYTES = 16;

/**
 * Domain separation, versioned.
 *
 * Without a label, an HMAC over the same key could collide with any other use
 * of that key. The `v1` means a future change to what is signed can be rolled
 * out without every printed document silently failing to verify.
 */
const DOMAIN = "warid:document-verify:v1";

function secretKey(): string {
  // A dedicated secret is preferred so that rotating AUTH_SECRET — which is a
  // session-security action — does not invalidate paper documents as a side
  // effect. Falling back keeps single-secret deployments working.
  const secret = process.env.DOCUMENT_VERIFY_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    // Fail loudly. Silently degrading to a predictable code would print QR
    // codes that look like verification and prove nothing.
    throw new Error(
      "Neither DOCUMENT_VERIFY_SECRET nor AUTH_SECRET is set — cannot sign document codes"
    );
  }
  if (new TextEncoder().encode(secret).length < MIN_SECRET_BYTES) {
    throw new Error(
      `Document verification secret is too short. ` +
        `Use at least ${MIN_SECRET_BYTES} bytes: openssl rand -base64 48`
    );
  }
  return secret;
}

/**
 * The immutable identity of a document.
 *
 * Only fields that can never change for a given row. Signing anything mutable —
 * status, the clinical payload, the recipient — would invalidate the printed
 * QR the moment a pharmacy marked the referral received.
 */
export type DocumentIdentity = {
  id: string;
  kind: string;
  seq: number;
  createdAt: Date;
};

function payload(doc: DocumentIdentity): string {
  return [DOMAIN, doc.id, doc.kind, String(doc.seq), String(doc.createdAt.getTime())].join("|");
}

/** The code printed on the document, and carried in the QR's URL. */
export function documentVerifyCode(doc: DocumentIdentity): string {
  return createHmac("sha256", secretKey())
    .update(payload(doc))
    .digest()
    .subarray(0, CODE_BYTES)
    .toString("base64url");
}

/**
 * Does this code belong to this document?
 *
 * Compared in constant time. A `===` here leaks, through response timing, how
 * many leading characters of a guess were right — which turns an unguessable
 * code into one that can be recovered a character at a time.
 */
export function verifyDocumentCode(doc: DocumentIdentity, presented: string): boolean {
  const expected = Buffer.from(documentVerifyCode(doc), "utf8");
  const actual = Buffer.from(presented, "utf8");
  // `timingSafeEqual` throws on a length mismatch, and length is not a secret.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * The URL encoded into the QR — what a phone camera opens.
 *
 * Absolute, because the reader is a camera app with no page to be relative to.
 * `APP_PUBLIC_URL` is the origin already used for payment callbacks.
 *
 * Never emits a relative URL: `/verify/...` in a QR scans cleanly and then
 * opens nothing, which is the worst of both outcomes.
 *
 * `||` not `??`, because `APP_PUBLIC_URL=` in a dotenv file sets the empty
 * string — a nullish check would sail straight past it.
 *
 * In production an unset origin THROWS. `decorateReferral` catches it and the
 * sheet prints with a visible "تعذّر توليد رمز التحقق" where the QR belongs,
 * so a misconfiguration is legible on the paper rather than shipping a code
 * that points at a machine no patient can reach. Locally it falls back, so the
 * document is testable without extra setup.
 */
export function documentVerifyUrl(reference: string, code: string): string {
  const configured = (process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_PUBLIC_URL is not set — cannot build a scannable verification URL");
  }
  const origin = configured || "http://localhost:3000";
  return `${origin}/verify/${encodeURIComponent(reference)}?c=${encodeURIComponent(code)}`;
}
