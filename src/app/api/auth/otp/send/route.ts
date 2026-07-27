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

    await sendOTP(phone, code);

    // Response is deliberately identical whether or not the phone is known —
    // it must not become an account-enumeration oracle.
    return ok({ sent: true, message: "تم إرسال رمز التحقق" });
  } catch (error) {
    console.error("[api] POST /api/auth/otp/send", error);
    return fail(ErrorCode.INTERNAL_ERROR, 500, "فشل في إرسال رمز التحقق");
  }
}
