import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendOTP, generateOTPCode } from "@/lib/ultramessages";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/auth/otp/send — deliberately public: it IS the sign-in surface.
 *
 * Previously this had no rate limit and never invalidated earlier codes, so
 * N requests produced N simultaneously-valid codes in the same 5-minute
 * window — and every call billed a real WhatsApp message, making it both a
 * brute-force amplifier and a cost/harassment vector.
 */

const OTP_TTL_MS = 5 * 60 * 1000;
/** Max sends per phone within the window. */
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 60 * 60 * 1000;

const sendSchema = z.object({
  phone: z.string().trim().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "رقم الهاتف مطلوب");
    }

    // Normalise first: 07xx, +9647xx and 009647xx are the same subscriber, but
    // stored raw they created distinct users and distinct rate-limit buckets.
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "رقم الهاتف غير صالح");
    }

    const recentSends = await prisma.oTPCode.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - SEND_WINDOW_MS) } },
    });
    if (recentSends >= MAX_SENDS_PER_WINDOW) {
      return fail(
        ErrorCode.RATE_LIMITED,
        429,
        "تم إرسال عدد كبير من الرموز. حاول مرة أخرى بعد قليل"
      );
    }

    const code = generateOTPCode();

    // Burn any still-live code for this phone, so only one is ever valid.
    await prisma.$transaction([
      prisma.oTPCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      prisma.oTPCode.create({
        data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      }),
    ]);

    // Delivery is its own failure mode, separate from "the code was stored".
    //
    // This used to be a bare `await sendOTP(...)` inside the try: a provider
    // error fell to the catch and answered 500 — AFTER the code had been
    // created and the caller's rate-limit budget spent. The user was told it
    // failed, could not retry, and a valid code was left live for five minutes.
    let delivery: Awaited<ReturnType<typeof sendOTP>>;
    try {
      delivery = await sendOTP(phone, code);
    } catch {
      // Burn the code: nobody received it, so nothing should be able to redeem
      // it. A distinct status lets the client offer "retry" rather than
      // treating this as a bad request.
      await prisma.oTPCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return fail(
        ErrorCode.UPSTREAM_UNAVAILABLE,
        502,
        "تعذّر إرسال رمز التحقق حالياً، حاول مرة أخرى"
      );
    }

    // No provider at all is a different failure from a provider that broke, and
    // the two need opposite treatment.
    //
    // In production it means nobody can ever receive a code: answering
    // `{sent: true}` strands every user staring at an input box with no signal
    // that the platform, not their phone, is the problem.
    //
    // Locally it is the normal state. The flow stays usable — `sendOTP` logs
    // the code to the server console — but the response now SAYS so, because a
    // client told "sent" while nothing was sent has no way to know it should go
    // and read a log. The code itself is never in the body: that would turn
    // sign-in into an open door the moment the same build reached production.
    if (delivery === "not_configured") {
      if (process.env.NODE_ENV === "production") {
        return fail(
          ErrorCode.UPSTREAM_UNAVAILABLE,
          502,
          "خدمة إرسال الرموز غير مهيّأة — راجع الإدارة"
        );
      }
      return ok({
        sent: false,
        delivery: "not_configured",
        message: "لا مزوّد رسائل مهيّأ — الرمز مطبوع في سجل الخادم",
      });
    }

    // Response is deliberately identical whether or not the phone is known —
    // it must not become an account-enumeration oracle.
    return ok({ sent: true, delivery, message: "تم إرسال رمز التحقق" });
  } catch (error) {
    console.error("[api] POST /api/auth/otp/send", error);
    return fail(ErrorCode.INTERNAL_ERROR, 500, "فشل في إرسال رمز التحقق");
  }
}

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { sendSchema as otpSendSchema };
