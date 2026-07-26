import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/auth/otp/verify — Verify OTP code
export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: "رقم الهاتف ورمز التحقق مطلوبان" },
        { status: 400 }
      );
    }

    // Find valid OTP
    const otp = await prisma.oTPCode.findFirst({
      where: {
        phone,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "رمز التحقق غير صالح أو منتهي الصلاحية" },
        { status: 401 }
      );
    }

    // OTP is valid — the actual sign-in happens via Auth.js Credentials provider
    // This endpoint just validates; the client calls signIn("phone-otp", { phone, code })
    return NextResponse.json({
      success: true,
      message: "رمز التحقق صحيح",
      verified: true,
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json(
      { error: "فشل في التحقق من الرمز" },
      { status: 500 }
    );
  }
}
