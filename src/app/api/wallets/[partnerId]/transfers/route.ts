import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { amount, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ partnerId: string }> };

// `walletId` is deliberately absent — it is resolved from the route param only.
// `.strict()` turns a client-supplied `walletId` into a 400 instead of letting
// it reach Prisma.
const createTransferSchema = z
  .object({
    amount,
    type: z.enum(["CREDIT", "DEBIT"], { message: "نوع العملية غير صالح" }),
    description: z.string().optional(),
    orderId: z.string().optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { partnerId } = await params;
  const wallet = await prisma.wallet.findUnique({ where: { partnerId } });
  if (!wallet) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const data = await prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ data });
});

// POST — Record a transaction against this partner's wallet.
//
// This was `data: { walletId: wallet.id, ...body }` — the spread came LAST, so a
// client-supplied `walletId` silently overrode the wallet resolved from the
// route param and money could be written to any partner's wallet. `amount` and
// `type` were also unvalidated (a string amount or an arbitrary `type` went
// straight to the DB). walletId now comes only from the looked-up wallet.
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { partnerId } = await params;
  const input = await parseBody(req, createTransferSchema);

  const wallet = await prisma.wallet.findUnique({ where: { partnerId } });
  if (!wallet) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const data = await prisma.transaction.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      walletId: wallet.id,
      amount: input.amount,
      type: input.type,
      description: input.description ?? null,
      orderId: input.orderId ?? null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
