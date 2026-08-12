import { describe, expect, it } from "vitest";
import { resolveHomePath } from "@/lib/roles";

/**
 * `resolveHomePath` decides where a user lands after signing in, from a
 * `callbackUrl` that arrives in the query string — i.e. from whoever wrote the
 * link they clicked.
 *
 * That makes it a phishing surface: a link to our own real sign-in page that
 * bounces to an attacker's site the moment the user authenticates carries our
 * domain in the address bar for the whole trip.
 *
 * The original guard was `startsWith("/") && !startsWith("//")`, which a
 * backslash walks straight past — browsers normalise `\` to `/` while parsing,
 * so `/\evil.example` is fetched as `//evil.example`.
 */

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);

const HOSTILE: [string, string][] = [
  ["protocol-relative", "//evil.example/steal"],
  ["backslash after slash", "/\\evil.example"],
  ["backslash then slash", "/\\/evil.example"],
  ["UNC path", "\\\\evil.example"],
  ["absolute https", "https://evil.example"],
  ["absolute http", "http://evil.example"],
  ["javascript scheme", "javascript:alert(1)"],
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["NUL byte", `/${NUL}/evil.example`],
  ["tab", `/${TAB}/evil.example`],
  ["newline", `/${NEWLINE}/evil.example`],
];

describe("resolveHomePath refuses to send a user off-site", () => {
  it.each(HOSTILE)("rejects %s for an authenticated user", (_label, url) => {
    expect(resolveHomePath("PATIENT", url)).not.toBe(url);
  });

  it.each(HOSTILE)("rejects %s with no role", (_label, url) => {
    // The role check is skipped when there is no role, so the URL guard has to
    // stand on its own here — this is the weaker of the two paths.
    expect(resolveHomePath(null, url)).not.toBe(url);
  });

  it("falls back to the role's own home rather than somewhere arbitrary", () => {
    expect(resolveHomePath("PATIENT", "//evil.example")).toBe("/");
  });
});

describe("resolveHomePath preserves legitimate destinations", () => {
  it.each([
    ["a plain path", "/wallet"],
    ["a path with a preserved filter", "/doctors?category=cardiology"],
    ["a path with a fragment", "/bookings#upcoming"],
  ])("keeps %s", (_label, url) => {
    expect(resolveHomePath("PATIENT", url)).toBe(url);
  });

  it("returns the role home when no callback is given", () => {
    expect(resolveHomePath("PATIENT", null)).toBe("/");
    expect(resolveHomePath("PATIENT", undefined)).toBe("/");
  });
});
