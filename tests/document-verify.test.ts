import { beforeAll, describe, expect, it } from "vitest";
import {
  documentVerifyCode,
  documentVerifyUrl,
  verifyDocumentCode,
} from "@/lib/document-verify";
import { parseReference } from "@/server/services/document-verification";

/**
 * The QR that proves a printed prescription is genuine.
 *
 * Pure crypto and pure parsing — no database, so these run anywhere. What they
 * defend is a forged sheet of paper being accepted at a pharmacy counter, which
 * makes the negative cases the important half of this file.
 */

const SECRET = "test-secret-that-is-definitely-long-enough-0123456789";

beforeAll(() => {
  process.env.DOCUMENT_VERIFY_SECRET = SECRET;
  process.env.APP_PUBLIC_URL = "https://warid.app";
});

const doc = {
  id: "ckreferral000000000000001",
  kind: "RADIOLOGY",
  seq: 5120,
  createdAt: new Date("2024-05-20T10:30:00Z"),
};

describe("the verification code", () => {
  it("is stable for the same document", () => {
    expect(documentVerifyCode(doc)).toBe(documentVerifyCode({ ...doc }));
  });

  it("verifies the document it was issued for", () => {
    expect(verifyDocumentCode(doc, documentVerifyCode(doc))).toBe(true);
  });

  it("is 128 bits, base64url — unguessable and still scannable on paper", () => {
    const code = documentVerifyCode(doc);
    expect(code).toHaveLength(22);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  /**
   * The forgery cases. Each is a different sheet of paper someone could print
   * and present, and every one of them must fail.
   */
  it("refuses a code issued for a DIFFERENT document", () => {
    const other = documentVerifyCode({ ...doc, id: "ckreferral000000000000002" });
    expect(verifyDocumentCode(doc, other)).toBe(false);
  });

  it("refuses a code from the same sequence but a different document type", () => {
    // RAD-2024-05120 and RX-2024-05120 can both exist; the code must not
    // transfer between them.
    const asPrescription = documentVerifyCode({ ...doc, kind: "PHARMACY" });
    expect(verifyDocumentCode(doc, asPrescription)).toBe(false);
  });

  it("refuses a code whose sequence was altered", () => {
    expect(verifyDocumentCode(doc, documentVerifyCode({ ...doc, seq: 5121 }))).toBe(false);
  });

  it("refuses a code whose issue date was altered", () => {
    const backdated = documentVerifyCode({ ...doc, createdAt: new Date("2024-05-21T10:30:00Z") });
    expect(verifyDocumentCode(doc, backdated)).toBe(false);
  });

  it("refuses a truncated, extended or empty code without throwing", () => {
    const code = documentVerifyCode(doc);
    // `timingSafeEqual` throws on a length mismatch — the length guard exists
    // so a short guess is a `false`, not a 500.
    expect(verifyDocumentCode(doc, code.slice(0, -1))).toBe(false);
    expect(verifyDocumentCode(doc, code + "A")).toBe(false);
    expect(verifyDocumentCode(doc, "")).toBe(false);
  });

  it("refuses every code once the secret changes", () => {
    const printed = documentVerifyCode(doc);
    process.env.DOCUMENT_VERIFY_SECRET = "a-different-secret-also-long-enough-0123456789";
    expect(verifyDocumentCode(doc, printed)).toBe(false);
    process.env.DOCUMENT_VERIFY_SECRET = SECRET;
  });
});

describe("the secret itself", () => {
  it("refuses to sign with a short secret rather than issuing a weak code", () => {
    const original = process.env.DOCUMENT_VERIFY_SECRET;
    const originalAuth = process.env.AUTH_SECRET;
    process.env.DOCUMENT_VERIFY_SECRET = "too-short";
    process.env.AUTH_SECRET = "";
    // A QR that looks like verification but proves nothing is worse than no QR.
    expect(() => documentVerifyCode(doc)).toThrow(/too short/i);
    process.env.DOCUMENT_VERIFY_SECRET = original;
    process.env.AUTH_SECRET = originalAuth;
  });

  it("falls back to AUTH_SECRET so single-secret deployments still work", () => {
    const original = process.env.DOCUMENT_VERIFY_SECRET;
    delete process.env.DOCUMENT_VERIFY_SECRET;
    process.env.AUTH_SECRET = SECRET;
    expect(verifyDocumentCode(doc, documentVerifyCode(doc))).toBe(true);
    process.env.DOCUMENT_VERIFY_SECRET = original;
  });
});

describe("the URL in the QR", () => {
  it("is absolute — a camera app has no page to be relative to", () => {
    const url = documentVerifyUrl("RAD-2024-05120", documentVerifyCode(doc));
    expect(url).toMatch(/^https:\/\/warid\.app\/verify\/RAD-2024-05120\?c=/);
  });

  it("escapes the code, so a base64url value cannot break the query string", () => {
    expect(documentVerifyUrl("RAD-2024-05120", "a+b/c=")).toContain("c=a%2Bb%2Fc%3D");
  });
});

describe("reading a reference off the paper", () => {
  it("maps each printed prefix back to its document type", () => {
    expect(parseReference("RAD-2024-05120")).toEqual({ kind: "RADIOLOGY", year: 2024, seq: 5120 });
    expect(parseReference("RX-2024-00001")).toEqual({ kind: "PHARMACY", year: 2024, seq: 1 });
    expect(parseReference("REF-2026-00042")).toEqual({ kind: "DOCTOR", year: 2026, seq: 42 });
    expect(parseReference("LAB-2026-00042")).toEqual({ kind: "LAB", year: 2026, seq: 42 });
  });

  it("tolerates the case and spacing a scanner or a human might produce", () => {
    expect(parseReference("  rad-2024-05120 ")).toEqual({ kind: "RADIOLOGY", year: 2024, seq: 5120 });
  });

  it("rejects anything that is not one of ours", () => {
    for (const bad of ["", "RAD-2024", "XXX-2024-00001", "RAD-24-00001", "RAD-2024-abc", "../etc"]) {
      expect(parseReference(bad)).toBeNull();
    }
  });
});
