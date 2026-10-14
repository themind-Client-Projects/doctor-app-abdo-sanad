/**
 * Unwrap the API envelope — by KEY, never by nullishness.
 *
 * `ok(data)` sends `{ data, meta }`, and the client used to unwrap it with
 * `body?.data ?? body`. For a response whose data is legitimately `null` —
 * `GET /api/v1/me/membership` answers `ok(null)` for a patient who holds no
 * membership, deliberately, because that is a normal state and not a 404 —
 * `null ?? body` evaluates to the WHOLE ENVELOPE. The caller then received
 * `{ data: null, meta: {…} }`, which is truthy, so a `membership ? … : null`
 * guard passed and the card crashed reading `membership.entitlements.some`.
 *
 * The `?? body` fallback existed for responses that are not enveloped, so it
 * is kept — but decided by whether the key is PRESENT, which is the real
 * question. `0`, `false` and `""` were never affected, since `??` only falls
 * through on null and undefined; `null` was, and that is the one a lookup
 * endpoint actually returns.
 */
export function unwrapEnvelope(body: unknown): unknown {
  if (body !== null && typeof body === "object" && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

