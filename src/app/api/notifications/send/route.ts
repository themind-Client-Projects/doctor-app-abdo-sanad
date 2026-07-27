import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { sendEmail } from "@/lib/resend";
import { sendWhatsAppNotification } from "@/lib/ultramessages";

/** The `NotificationChannel` enum from prisma/schema.prisma. */
const notificationChannel = z.enum(["IN_APP", "EMAIL", "WHATSAPP"], {
  message: "قناة غير صالحة",
});

const requiredField = z
  .string({ message: "بيانات غير صالحة" })
  .trim()
  .min(1, { message: "بيانات غير صالحة" });

// `.strict()` so an unexpected key is a 400 rather than being silently ignored.
const sendNotificationSchema = z
  .object({
    userId: requiredField,
    title: requiredField,
    body: requiredField,
    type: requiredField,
    // An explicit `null` still means "in-app", as it did before.
    channel: notificationChannel.nullable().optional(),
  })
  .strict();

/**
 * Escape text before it is interpolated into an HTML email body.
 *
 * `sendEmail` takes raw HTML, and this route used to drop the caller's `body`
 * into it verbatim — so whoever could reach this endpoint could send arbitrary
 * markup (links, forms, spoofed content) from the platform's own verified
 * sender. Escaping happens here, at the call site, because the helper cannot
 * know which of its arguments are untrusted.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// POST /api/notifications/send — Send notification via IN_APP, EMAIL, or WHATSAPP.
//
// Operations-only: this is a send-anything-to-anyone primitive, and it was open
// to unauthenticated callers.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { userId, title, body, type, channel } = await parseBody(
    req,
    sendNotificationSchema
  );

  const resolvedChannel = channel ?? "IN_APP";

  // Confirm the recipient exists *before* writing the row — an unknown userId
  // used to create an orphan notification and only then fail.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) {
    return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });
  }

  // Explicit allow-list — never spread the request body into Prisma.
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      channel: resolvedChannel,
    },
  });

  // Also send via external channel if requested
  if (resolvedChannel === "EMAIL" && user.email) {
    await sendEmail(
      user.email,
      escapeHtml(title),
      `<div dir="rtl"><p>${escapeHtml(body)}</p></div>`
    ).catch(console.error);
  }
  if (resolvedChannel === "WHATSAPP" && user.phone) {
    // Plain text, not HTML — escaping here would show entities to the reader.
    await sendWhatsAppNotification(user.phone, `${title}\n${body}`).catch(console.error);
  }

  return ok(notification, { status: 201, requestId });
});
