import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ partnerId: string }> };

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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { amount, type, description, orderId } = body;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
  }
  if (type !== "CREDIT" && type !== "DEBIT") {
    return NextResponse.json({ error: "نوع العملية غير صالح" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { partnerId } });
  if (!wallet) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const data = await prisma.transaction.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      walletId: wallet.id,
      amount,
      type,
      description: typeof description === "string" ? description : null,
      orderId: typeof orderId === "string" ? orderId : null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
