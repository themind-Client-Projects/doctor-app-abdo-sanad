import { z } from "zod";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { serviceTypeSchema, parseBody } from "@/lib/validation";
import { CommissionError, previewSplit } from "@/server/services/commission";

/**
 * POST /api/commissions/preview — simulate a split without writing anything.
 *
 * Backs the admin "محرك النسب" screen, which until now displayed hardcoded
 * percentages from React state while claiming they came from contracts.
 */
const previewSchema = z
  .object({
    partnerId: z.string().trim().min(1),
    serviceType: serviceTypeSchema,
    totalAmount: z.number().finite().positive(),
  })
  .strict();

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, previewSchema);

  try {
    return ok(await previewSplit(input.partnerId, input.serviceType, input.totalAmount), {
      requestId,
    });
  } catch (error) {
    if (error instanceof CommissionError) {
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, { requestId });
    }
    throw error;
  }
});
