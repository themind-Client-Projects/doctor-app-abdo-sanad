import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────
// Resend — Email notification service
// ─────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@warid.app";

/**
 * Send a generic email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
) {
  const { data, error } = await resend.emails.send({
    from: `وريد <${fromEmail}>`,
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Email failed: ${error.message}`);
  return data;
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmation(
  to: string,
  orderNumber: string,
  serviceType: string
) {
  return sendEmail(
    to,
    `تأكيد الطلب #${orderNumber}`,
    `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0066CC;">وريد — تأكيد الطلب</h2>
      <p>تم إنشاء طلبك بنجاح.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>رقم الطلب</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${orderNumber}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>نوع الخدمة</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${serviceType}</td></tr>
      </table>
      <p style="color: #666; margin-top: 20px;">فريق وريد</p>
    </div>
    `
  );
}

/**
 * Send result ready notification
 */
export async function sendResultReady(
  to: string,
  orderNumber: string,
  resultType: string
) {
  return sendEmail(
    to,
    `نتيجة جاهزة — الطلب #${orderNumber}`,
    `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0066CC;">وريد — نتيجة جاهزة</h2>
      <p>نتيجة <strong>${resultType}</strong> الخاصة بطلبك #${orderNumber} جاهزة الآن.</p>
      <p>يمكنك الاطلاع عليها من خلال التطبيق.</p>
      <p style="color: #666; margin-top: 20px;">فريق وريد</p>
    </div>
    `
  );
}

/**
 * Send appointment reminder
 */
export async function sendAppointmentReminder(
  to: string,
  doctorName: string,
  date: string,
  time: string
) {
  return sendEmail(
    to,
    `تذكير بموعدك مع ${doctorName}`,
    `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0066CC;">وريد — تذكير بالموعد</h2>
      <p>لديك موعد قادم:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>الطبيب</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${doctorName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>التاريخ</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>الوقت</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
      </table>
      <p style="color: #666; margin-top: 20px;">فريق وريد</p>
    </div>
    `
  );
}
