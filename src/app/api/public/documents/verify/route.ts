import { z } from "zod";
import { withPublic } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { verifyReferralDocument } from "@/server/services/document-verification";

/**
 * GET /api/public/documents/verify?reference=RAD-2024-05120&code=… — is this
 * printed referral genuine?
 *
 * PUBLIC by necessity, and the only unauthenticated read of a clinical row in
 * the codebase. A pharmacy handed a prescription on paper has no account here;
 * requiring one would mean the QR verifies for nobody who actually needs it.
 *
 * Safe to expose because the code is an HMAC over the row's immutable identity
 * (see `src/lib/document-verify.ts`) and the answer carries no PHI — only what
 * is already printed on the document the caller is holding. See
 * `document-verification.ts` for exactly what is withheld and why.
 *
 * The web equivalent is `/verify/[reference]`, which is what the QR opens; this
 * exists so a native app can verify in-app rather than kicking out to a browser.
 */

const querySchema = z.object({
  reference: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(64),
});

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { reference, code } = parseQuery(req.nextUrl.searchParams, querySchema);

  const result = await verifyReferralDocument(reference, code);

  // One answer for every failure — unknown reference, wrong code, malformed
  // input. Distinguishing them would confirm which references exist, and the
  // sequence is an incrementing integer.
  if (!result.ok) {
    return fail(ErrorCode.NOT_FOUND, 404, "لا توجد وثيقة مطابقة لهذا الرمز", { requestId });
  }

  return ok(result, { requestId });
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { querySchema as verifyDocumentQuerySchema };
