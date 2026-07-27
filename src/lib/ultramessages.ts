import { randomInt } from "node:crypto";
// ─────────────────────────────────────────────────────────────
// UltraMessages — OTP + WhatsApp notification service
// ─────────────────────────────────────────────────────────────

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;
const BASE_URL = `https://api.ultramsg.com/${INSTANCE_ID}`;

interface UltraMessageResponse {
  sent: string;
  message: string;
  id: string;
}

/**
 * Send a WhatsApp message via UltraMessages API
 */
async function sendWhatsApp(
  phone: string,
  body: string
): Promise<UltraMessageResponse> {
  const response = await fetch(`${BASE_URL}/messages/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: TOKEN,
      to: phone,
      body,
    }),
  });

  if (!response.ok) {
    throw new Error(`UltraMessages API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Send OTP code for login
 */
export async function sendOTP(phone: string, code: string) {
  const message = `رمز التحقق الخاص بك في وريد: ${code}\n\nلا تشارك هذا الرمز مع أي شخص.\nينتهي خلال 5 دقائق.`;
  return sendWhatsApp(phone, message);
}

/**
 * Send general WhatsApp notification
 */
export async function sendWhatsAppNotification(
  phone: string,
  message: string
) {
  return sendWhatsApp(phone, message);
}

/**
 * Send order update notification
 */
export async function sendOrderUpdate(
  phone: string,
  orderNumber: string,
  status: string
) {
  const message = `وريد — تحديث الطلب #${orderNumber}\n\nحالة الطلب: ${status}\n\nشكراً لاستخدامك وريد.`;
  return sendWhatsApp(phone, message);
}

/**
 * Send result ready notification via WhatsApp
 */
export async function sendResultReadyWhatsApp(
  phone: string,
  orderNumber: string,
  resultType: string
) {
  const message = `وريد — نتيجة ${resultType} جاهزة\n\nالطلب #${orderNumber}\n\nيمكنك الاطلاع على النتائج من خلال التطبيق.`;
  return sendWhatsApp(phone, message);
}

/**
 * Send appointment reminder via WhatsApp
 */
export async function sendAppointmentReminderWhatsApp(
  phone: string,
  doctorName: string,
  date: string,
  time: string
) {
  const message = `وريد — تذكير بموعدك\n\nالطبيب: ${doctorName}\nالتاريخ: ${date}\nالوقت: ${time}\n\nنتمنى لك الصحة والعافية.`;
  return sendWhatsApp(phone, message);
}

/**
 * Generate a random 6-digit OTP code.
 *
 * Uses a CSPRNG. `Math.random()` is xorshift128+ in V8: its internal state is
 * recoverable from a handful of observed outputs, so an attacker who can
 * request codes for a phone they control could PREDICT the code issued to
 * someone else's phone — turning a 10^6 brute force into a single request.
 */
export function generateOTPCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
