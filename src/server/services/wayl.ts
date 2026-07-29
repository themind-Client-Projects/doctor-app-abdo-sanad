import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Wayl payment-link client — https://api.thewayl.com/reference
 *
 * Kept behind this module so the rest of the app never learns Wayl's
 * vocabulary. Their statuses (Created / Pending / Processing / Complete /
 * Delivered / Cancelled / Rejected / Returned) are theirs to change; ours are
 * PENDING / SETTLED / CANCELLED / FAILED and are what the database stores.
 *
 * Inert without credentials: `isConfigured()` is false when the key is unset,
 * so the top-up endpoint returns a clean "not configured" rather than throwing
 * a stack trace at a patient. That is what lets this ship before the merchant
 * account exists.
 */

const BASE_URL = process.env.WAYL_BASE_URL ?? "https://api.thewayl.com";
const API_KEY = process.env.WAYL_API_KEY ?? "";
const WEBHOOK_SECRET = process.env.WAYL_WEBHOOK_SECRET ?? "";
/** "live" or "test" — never inferred from NODE_ENV, which is about OUR build. */
const ENV = (process.env.WAYL_ENV ?? "test") as "live" | "test";

/** Wayl rejects anything under 1,000 IQD, in MAJOR units (not fils). */
export const MIN_AMOUNT_IQD = 1000;

export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

export class WaylError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "WaylError";
  }
}

export type WaylLink = {
  id: string;
  code: string;
  url: string;
  referenceId: string;
  total: number;
  currency: string;
  status: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isConfigured()) throw new WaylError(503, "بوابة الدفع غير مهيأة");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      // Their scheme — NOT `Authorization`.
      "X-WAYL-AUTHENTICATION": API_KEY,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // A hung gateway must not hold a patient's request open indefinitely.
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new WaylError(res.status, `Wayl ${init?.method ?? "GET"} ${path} → ${res.status}`, body);
  }
  return (body?.data ?? body) as T;
}

/**
 * Create a payment link.
 *
 * `total` MUST equal the sum of `lineItem` amounts — Wayl rejects the request
 * otherwise, so the single line item is derived from the total rather than
 * passed separately and allowed to disagree.
 */
export async function createPaymentLink(params: {
  reference: string;
  amount: number;
  label: string;
  webhookUrl?: string;
  redirectionUrl?: string;
}): Promise<WaylLink> {
  if (!Number.isInteger(params.amount) || params.amount < MIN_AMOUNT_IQD) {
    throw new WaylError(400, `أقل مبلغ للشحن ${MIN_AMOUNT_IQD} د.ع`);
  }

  return call<WaylLink>("/api/v1/links", {
    method: "POST",
    body: JSON.stringify({
      env: ENV,
      referenceId: params.reference,
      total: params.amount,
      currency: "IQD",
      lineItem: [{ label: params.label, amount: params.amount, type: "increase" }],
      ...(params.webhookUrl ? { webhookUrl: params.webhookUrl } : {}),
      ...(WEBHOOK_SECRET ? { webhookSecret: WEBHOOK_SECRET } : {}),
      ...(params.redirectionUrl ? { redirectionUrl: params.redirectionUrl } : {}),
    }),
  });
}

/**
 * Read a link back from Wayl.
 *
 * The webhook says what happened; THIS says what is true. Crediting a wallet on
 * the strength of an unauthenticated POST to a public URL is how a forged
 * webhook becomes free money, so the settlement path confirms here.
 */
export async function getPaymentLink(reference: string): Promise<WaylLink> {
  return call<WaylLink>(`/api/v1/links/${encodeURIComponent(reference)}`);
}

/** Their terminal "paid" states, mapped to ours. */
const PAID = new Set(["Complete", "Delivered"]);
const DEAD = new Set(["Cancelled", "Rejected", "Returned"]);

export function toInternalStatus(waylStatus: string): "PENDING" | "SETTLED" | "FAILED" {
  if (PAID.has(waylStatus)) return "SETTLED";
  if (DEAD.has(waylStatus)) return "FAILED";
  return "PENDING";
}

/**
 * Verify a webhook signature, when Wayl sends one.
 *
 * Compared in constant time: a plain `===` on a secret leaks it one byte at a
 * time to anyone who can measure the response.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) return false;
  if (!signature) return false;

  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.replace(/^sha256=/, ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
