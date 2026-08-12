import { describe, expect, it } from "vitest";
import { safeUrl } from "@/lib/validation";

/**
 * `Banner.href` is admin-editable and renders straight into a `<Link href>` on
 * the patient home page; `imageUrl` and `photoUrl` render as assets. All three
 * were `z.string().max(500)`, so a `javascript:` value would have been stored
 * XSS against every visitor — executing in the same session that holds the
 * wallet.
 *
 * Admin access must not imply the ability to run code in someone else's
 * browser, which is what these cases pin down.
 */

const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

describe("safeUrl rejects script and off-site schemes", () => {
  it.each([
    ["plain javascript:", "javascript:alert(1)"],
    ["mixed case", "JavaScript:alert(1)"],
    ["leading whitespace", "   javascript:alert(1)"],
    ["embedded tab", `java${TAB}script:alert(1)`],
    ["embedded newline", `java${NEWLINE}script:alert(1)`],
    ["embedded NUL", `java${NUL}script:alert(1)`],
    ["data URL", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["vbscript", "vbscript:msgbox(1)"],
    ["file", "file:///etc/passwd"],
    ["protocol-relative", "//evil.example/steal"],
    ["UNC path", "\\\\evil.example\\share"],
    ["backslash after slash", "/\\evil.example"],
    ["plaintext http", "http://insecure.example"],
    ["other scheme", "ftp://files.example"],
  ])("rejects %s", (_label, value) => {
    expect(safeUrl.safeParse(value).success).toBe(false);
  });

  it("rejects a value over the length cap", () => {
    expect(safeUrl.safeParse("/" + "a".repeat(500)).success).toBe(false);
  });
});

describe("safeUrl accepts the links the product actually uses", () => {
  it.each([
    ["internal path", "/services/offers"],
    ["internal path with query", "/doctors?category=cardiology"],
    ["asset under /public", "/ads/real_clinic_banner.png"],
    ["https CDN asset", "https://cdn.example.com/banner.png"],
    ["https link with query", "https://warid.app/promo?id=3"],
  ])("accepts %s", (_label, value) => {
    expect(safeUrl.safeParse(value).success).toBe(true);
  });

  it("trims before validating", () => {
    const parsed = safeUrl.safeParse("  /services/offers  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("/services/offers");
  });
});
