import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/validation";

/**
 * Platform-wide invoices — "الفواتير والمدفوعات" (req L245).
 *
 * `Invoice` was reachable only per-partner. Finance needs one list across all
 * partners to see what is overdue.
 */

const invoiceStatus = z.enum(["pending", "paid", "overdue", "cancelled"]);

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  partnerId: z.string().trim().min(1).optional(),
  status: invoiceStatus.optional(),
});

const createSchema = z
  .object({
    partnerId: z.string().trim().min(1, { message: "الشريك مطلوب" }),
    orderId: z.string().trim().min(1).nullable().optional(),
    amount: z.number().finite().positive({ message: "المبلغ يجب أن يكون أكبر من صفر" }),
    dueDate: z.coerce.date(),
    status: invoiceStatus.default("pending"),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit, partnerId, status } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const keyset = keysetArgs(cursor, limit);
  const filters: Prisma.InvoiceWhereInput[] = [];
  if (partnerId) filters.push({ partnerId });
  if (status) filters.push({ status });
  if (keyset.where) filters.push(keyset.where);

  const rows = await prisma.invoice.findMany({
    where: filters.length ? { AND: filters } : {},
    include: { partner: { select: { id: true, name: true, type: true } } },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  const data = await prisma.invoice.create({
    // Explicit allow-list — never spread the request body into Prisma.
    // `paidAt` is absent on purpose: it is set by the status transition, not
    // by the creator, so a new invoice can never claim to be already paid.
    data: {
      partnerId: input.partnerId,
      orderId: input.orderId ?? null,
      amount: input.amount,
      dueDate: input.dueDate,
      status: input.status,
    },
    include: { partner: { select: { id: true, name: true, type: true } } },
  });

  return ok(data, { status: 201, requestId });
});
