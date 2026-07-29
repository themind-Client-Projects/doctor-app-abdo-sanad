import { NextResponse } from "next/server";
import { withWebhook } from "@/lib/api-auth";
import { settleTopup } from "@/server/services/topup";
import { verifyWebhookSignature } from "@/server/services/wayl";

/**
 * Wayl payment webhook.
 *
 * Public by necessity — Wayl has no session with us — which is exactly why the
 * body is treated as a hint rather than as truth. It tells us WHICH reference
 * changed; `settleTopup` then asks Wayl what actually happened and credits
 * behind an idempotent transition. A forged POST naming a real reference
 * therefore achieves nothing beyond a wasted lookup.
 *
 * Always answers 200 once the reference is understood, including for a repeat:
 * a gateway that receives a non-2xx retries, and retrying a settlement we have
 * already applied is noise, not progress.
 */
export const POST = withWebhook(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // Read raw — a signature is over the exact bytes, so parsing first and
  // re-serialising would compare a different string.
  const raw = await req.text();

  const signature =
    req.headers.get("x-wayl-signature") ??
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-wayl-webhook-secret");

  // When a secret is configured the signature must check out. When it is not,
  // the confirm-with-Wayl step is what keeps this safe on its own.
  if (process.env.WAYL_WEBHOOK_SECRET && !verifyWebhookSignature(raw, signature)) {
    console.warn(`[wayl] rejected webhook with a bad signature requestId=${requestId}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { referenceId?: string; reference?: string; data?: { referenceId?: string } } | null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "malformed json" }, { status: 400 });
  }

  const reference = body?.referenceId ?? body?.reference ?? body?.data?.referenceId;
  if (!reference) return NextResponse.json({ error: "missing referenceId" }, { status: 400 });

  const result = await settleTopup(reference);
  console.info(`[wayl] ${reference} → ${result.outcome} requestId=${requestId}`);

  return NextResponse.json({ received: true, outcome: result.outcome });
});
