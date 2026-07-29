import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const invoiceStatus = z.enum(["pending", "paid", "overdue", "cancelled"]);

/**
 * `partnerId` is deliberately unwritable — reassigning an issued invoice to a
 * different partner is not an edit, and would silently move a debt.
 */
const updateSchema = z
  .object({
    amount: z.number().finite().positive().optional(),
    dueDate: z.coerce.date().optional(),
    status: invoiceStatus.optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.invoice.findUnique({
    where: { id },
    include: { partner: { select: { id: true, name: true, type: true } } },
  });

  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الفاتورة غير موجودة", { requestId });
  return ok(data, { requestId });
});

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateSchema);

  // `paidAt` is derived, never supplied: marking an invoice paid stamps the
  // time, and moving it back off "paid" clears the stamp. Letting the client
  // send `paidAt` would allow a paid-at that disagrees with the status.
  const paidAt =
    input.status === undefined ? undefined : input.status === "paid" ? new Date() : null;

  const data = await prisma.invoice.update({
    where: { id },
    data: {
      amount: input.amount,
      dueDate: input.dueDate,
      status: input.status,
      ...(paidAt === undefined ? {} : { paidAt }),
    },
    include: { partner: { select: { id: true, name: true, type: true } } },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const existing = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "الفاتورة غير موجودة", { requestId });

  // A settled invoice is an accounting record. Cancel it instead — deleting it
  // would leave the partner's paid total unexplainable.
  if (existing.status === "paid") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "لا يمكن حذف فاتورة مدفوعة — غيّر حالتها إلى ملغاة بدلاً من ذلك",
      { requestId }
    );
  }

  await prisma.invoice.delete({ where: { id } });
  return ok({ message: "تم حذف الفاتورة" }, { requestId });
});
