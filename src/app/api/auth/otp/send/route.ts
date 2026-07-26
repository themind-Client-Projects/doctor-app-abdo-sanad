import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOTP, generateOTPCode } from "@/lib/ultramessages";

// POST /api/auth/otp/send — Send OTP via UltraMessages
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        { error: "رقم الهاتف مطلوب" },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const code = generateOTPCode();

    // Store OTP in database (expires in 5 minutes)
    await prisma.oTPCode.create({
      data: {
        phone,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Send OTP via UltraMessages WhatsApp
    await sendOTP(phone, code);

    return NextResponse.json({ success: true, message: "تم إرسال رمز التحقق" });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: "فشل في إرسال رمز التحقق" },
      { status: 500 }
    );
  }
}
