import { prisma } from "@/lib/prisma";
import { AuthError, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/notifications/[id]/read — mark one of the caller's own
// notifications as read.
//
// Any signed-in user may call this, but only for their own rows. The id used to
// be trusted outright, so anyone could flip `isRead` on any user's notification
// — silently hiding an alert from the person it was meant for.
export const PATCH = withAuth<Ctx>({}, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!notification) {
    return fail(ErrorCode.NOT_FOUND, 404, "الإشعار غير موجود", { requestId });
  }
  if (notification.userId !== identity.userId) {
    throw new AuthError(403, "ليس لديك صلاحية");
  }

  const data = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return ok(data, { requestId });
});
