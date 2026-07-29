import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { InsufficientBalance, creditWallet, debitWallet, ensureWallet } from "@/server/services/patient-wallet";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin view of, and adjustments to, a patient's wallet — "admin can add money
 * to wallet".
 *
 * A single `amount` that must be positive, plus a direction, rather than a
 * signed number: a stray minus sign on a top-up would silently drain an account
 * instead of failing.
 */
const adjustSchema = z
  .object({
    direction: z.enum(["CREDIT", "DEBIT"]),
    amount: z.number().finite().positive({ message: "المبلغ يجب أن يكون أكبر من صفر" }),
    reason: z.enum(["TOPUP", "REFUND", "REWARD", "PAYMENT"]).default("TOPUP"),
    description: z.string().trim().max(160).optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const patient = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!patient) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });

  const wallet = await ensureWallet(id);
  const transactions = await prisma.patientTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, amount: true, type: true, reason: true, description: true, createdAt: true,
      order: { select: { orderNumber: true, serviceType: true, source: true } },
    },
  });

  return ok({ patient, balance: wallet.balance, transactions }, { requestId });
});

export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, adjustSchema);

  const patient = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!patient) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });

  try {
    const wallet =
      input.direction === "CREDIT"
        ? await creditWallet({
            userId: id,
            amount: input.amount,
            reason: input.reason === "PAYMENT" ? "TOPUP" : input.reason,
            description: input.description ?? "إيداع من الإدارة",
          })
        : await debitWallet({
            userId: id,
            amount: input.amount,
            description: input.description ?? "خصم من الإدارة",
          });

    // Money moved by hand is the first thing anyone asks about later.
    await prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `${input.direction === "CREDIT" ? "إيداع" : "خصم"} ${input.amount} د.ع ${
          input.direction === "CREDIT" ? "إلى" : "من"
        } محفظة ${patient.name ?? id}`,
        entityType: "patient_wallet",
        entityId: id,
        details: { direction: input.direction, amount: input.amount, reason: input.reason },
      },
    });

    return ok({ balance: wallet.balance }, { requestId });
  } catch (error) {
    if (error instanceof InsufficientBalance) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        `الرصيد غير كافٍ — الرصيد الحالي ${error.balance} والمطلوب ${error.required}`,
        { requestId }
      );
    }
    throw error;
  }
});
