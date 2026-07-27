import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const data = await prisma.wallet.findUnique({
    where: { partnerId: id },
    include: { transactions: { take: 20, orderBy: { createdAt: "desc" } } },
  });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  return ok(data, { requestId });
});
