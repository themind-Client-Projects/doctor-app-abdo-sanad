import { NextResponse } from "next/server";
import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { sendEmail } from "@/lib/resend";
import { sendWhatsAppNotification } from "@/lib/ultramessages";

const CHANNELS: readonly NotificationChannel[] = ["IN_APP", "EMAIL", "WHATSAPP"];

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
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { userId, title, body, type, channel } = payload;

  if (
    typeof userId !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    typeof type !== "string" ||
    !userId.trim() ||
    !title.trim() ||
    !body.trim() ||
    !type.trim()
  ) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if (channel !== undefined && channel !== null && typeof channel !== "string") {
    return NextResponse.json({ error: "قناة غير صالحة" }, { status: 400 });
  }
  const resolvedChannel = (channel as string | undefined | null) || "IN_APP";
  if (!CHANNELS.includes(resolvedChannel as NotificationChannel)) {
    return NextResponse.json({ error: "قناة غير صالحة" }, { status: 400 });
  }

  // Confirm the recipient exists *before* writing the row — an unknown userId
  // used to create an orphan notification and only then fail.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }

  // Explicit allow-list — never spread the request body into Prisma.
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      channel: resolvedChannel as NotificationChannel,
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

  return NextResponse.json({ data: notification }, { status: 201 });
});
