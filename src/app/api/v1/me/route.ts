import { prisma } from "@/lib/prisma";
import { withMaybeAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/v1/me — the signed-in patient and their wallet balance, or nulls.
 *
 * One request for the two things every patient screen's header shows: the
 * greeting name and the wallet chip. Both were hardcoded — "أحمد محمد" passed
 * in by each page, and "150,000 د.ع" written into the header component itself,
 * so every account saw the same name and the same balance.
 *
 * Answers 200 with `user: null` for a visitor rather than 401, because browsing
 * signed-out is a normal state here — the header simply hides the chip.
 */
export const GET = withMaybeAuth(async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  if (!identity) return ok({ user: null, wallet: null }, { requestId });

  const [user, wallet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: identity.userId },
      select: { id: true, name: true, phone: true, email: true, image: true, role: true },
    }),
    // Read-only: the wallet is created on first write, not by looking at it —
    // a GET that creates rows turns every page load into a mutation.
    prisma.patientWallet.findUnique({
      where: { userId: identity.userId },
      select: { balance: true },
    }),
  ]);

  return ok({ user, wallet: { balance: wallet?.balance ?? 0 } }, { requestId });
});
