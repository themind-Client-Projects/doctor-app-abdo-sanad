import { randomInt } from "node:crypto";
// ─────────────────────────────────────────────────────────────
// UltraMessages — OTP + WhatsApp notification service
// ─────────────────────────────────────────────────────────────

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

/**
 * Is WhatsApp delivery actually set up?
 *
 * Without this the base URL was built from `undefined` — every send went to
 * `https://api.ultramsg.com/undefined/messages/chat`, failed, and threw. The
 * OTP route caught it and answered 500, so in ANY environment without UltraMsg
 * credentials — every dev machine, every staging box — sign-in was impossible
 * even though the code had been created and stored.
 */
export function isConfigured(): boolean {
  return isRealCredential(INSTANCE_ID) && isRealCredential(TOKEN);
}

/**
 * A value that is present but obviously a placeholder is NOT configuration.
 *
 * `Boolean(INSTANCE_ID && TOKEN)` was enough to defeat the guard above: this
 * environment carries `ULTRAMSG_INSTANCE_ID="your-instance-id"` copied straight
 * from the example file, which is truthy. So `isConfigured()` said yes, the
 * graceful "log the code locally" path was skipped, every send went to
 * `https://api.ultramsg.com/your-instance-id/...`, threw, and sign-in answered
 * 502 — the exact failure the guard exists to prevent.
 *
 * Deliberately a small, specific denylist rather than a format check: an
 * over-eager rule that rejected a real credential would take down sign-in in
 * production, which is far worse than letting an unusual placeholder through.
 */
function isRealCredential(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) return false;
  return !(
    v.startsWith("your-") ||
    v.startsWith("your_") ||
    v.startsWith("<") ||
    v.includes("placeholder") ||
    v.includes("changeme") ||
    v.includes("xxxx") ||
    v === "instance-id" ||
    v === "token"
  );
}

interface UltraMessageResponse {
  sent: string;
  message: string;
  id: string;
}

/** Raised when no WhatsApp credentials are set — distinct from a send failure. */
export class NotConfigured extends Error {
  constructor() {
    super("UltraMsg is not configured");
    this.name = "NotConfigured";
  }
}

/**
 * Send a WhatsApp message via UltraMessages API
 */
async function sendWhatsApp(
  phone: string,
  body: string
): Promise<UltraMessageResponse> {
  if (!isConfigured()) {
    throw new NotConfigured();
  }

  const response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
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
export type OtpDelivery = "sent" | "not_configured";

/**
 * Deliver a verification code.
 *
 * Returns HOW it went instead of throwing on a missing provider, because the
 * caller has to treat the two cases differently: no provider is a working local
 * setup, while a provider that failed is a real outage the user must be told
 * about.
 *
 * With no provider the code is logged server-side so the flow stays testable.
 * It is never returned in the response body — that would turn sign-in into an
 * open door the moment the same build reached production.
 */
export async function sendOTP(phone: string, code: string): Promise<OtpDelivery> {
  const message = `رمز التحقق الخاص بك في وريد: ${code}\n\nلا تشارك هذا الرمز مع أي شخص.\nينتهي خلال 5 دقائق.`;

  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[otp] WhatsApp not configured — code for ${phone} is ${code}`);
    } else {
      console.error("[otp] WhatsApp is not configured in production");
    }
    return "not_configured";
  }

  await sendWhatsApp(phone, message);
  return "sent";
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
