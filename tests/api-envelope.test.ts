import { describe, expect, it } from "vitest";
import { unwrapEnvelope } from "@/lib/api-envelope";

/**
 * `ok(null)` must reach the client as `null`, not as the envelope.
 *
 * The client unwrapped with `body?.data ?? body`, and `??` falls through on
 * null — so a response whose data is legitimately null handed the caller
 * `{ data: null, meta: {…} }` instead. That object is TRUTHY, so a
 * `membership ? <Card/> : null` guard passed and the card crashed on
 * `membership.entitlements.some(...)`, taking the memberships page down to its
 * error boundary. `GET /api/v1/me/membership` returns `ok(null)` on purpose:
 * holding no membership is a normal state, not a 404.
 *
 * Decided by whether the `data` key is PRESENT, which is the real question —
 * the `?? body` fallback for non-enveloped responses is kept.
 */
describe("unwrapEnvelope", () => {
  it("returns null for an enveloped null — the bug that crashed the page", () => {
    expect(unwrapEnvelope({ data: null, meta: { requestId: "r1" } })).toBeNull();
  });

  it("unwraps ordinary payloads", () => {
    expect(unwrapEnvelope({ data: { id: "m1" }, meta: {} })).toEqual({ id: "m1" });
    expect(unwrapEnvelope({ data: [1, 2], meta: {} })).toEqual([1, 2]);
  });

  it("preserves falsy data that is not null", () => {
    expect(unwrapEnvelope({ data: 0, meta: {} })).toBe(0);
    expect(unwrapEnvelope({ data: false, meta: {} })).toBe(false);
    expect(unwrapEnvelope({ data: "", meta: {} })).toBe("");
  });

  it("passes a non-enveloped body straight through", () => {
    // The fallback the old `?? body` existed for.
    expect(unwrapEnvelope({ id: "raw" })).toEqual({ id: "raw" });
    expect(unwrapEnvelope([1, 2, 3])).toEqual([1, 2, 3]);
    expect(unwrapEnvelope(null)).toBeNull();
    expect(unwrapEnvelope(undefined)).toBeUndefined();
  });
});
