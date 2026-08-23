import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, FileQuestion, ShieldAlert } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { REFERRAL_KIND_LABELS } from "@/server/services/referral-forms";
import { verifyReferralDocument } from "@/server/services/document-verification";

/**
 * /verify/RAD-2024-05120?c=… — what the QR on a printed referral opens.
 *
 * The audience is a pharmacist or a radiographer holding paper, on a phone,
 * standing at a counter. So the page answers in one glance and says nothing it
 * does not need to: no patient name, no phone, no clinical detail. Whoever
 * scanned it is already holding the document — this confirms what they can see
 * rather than disclosing what they cannot.
 *
 * Rendered outside every route group, so it inherits no dashboard shell and no
 * patient chrome, and `src/proxy.ts` does not match it — a verifier has no
 * account and must never be bounced to a sign-in form.
 */

export const metadata: Metadata = {
  title: "التحقق من وثيقة — وريد",
  // A verification URL carries a code. Keeping it out of search results costs
  // nothing and stops a scanned link becoming publicly discoverable.
  robots: { index: false, follow: false },
};

// The code is in the query string, so a cached render would answer for the
// wrong document. Always render per request.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ c?: string | string[] }>;
};

export default async function VerifyDocumentPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const code = Array.isArray(query.c) ? query.c[0] : query.c;

  // NOT `decodeURIComponent(reference)`. App Router has already decoded the
  // segment, so a second decode is both wrong and dangerous: `/verify/%25zz`
  // arrives here as the literal `%zz`, which `decodeURIComponent` throws a
  // `URIError` on — turning the one unauthenticated page in the app into a 500
  // instead of the "no matching document" card. `parseReference` trims,
  // case-folds and anchors its own regex, so raw input is what it wants.
  const result = await verifyReferralDocument(reference, code);

  if (!result.ok) {
    return (
      <Shell>
        <Badge tone="neutral" icon={FileQuestion} />
        <h1 className="text-xl font-bold text-foreground">لا توجد وثيقة مطابقة</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          الرمز غير صحيح أو الوثيقة غير صادرة عن وريد. تأكّد من مسح رمز QR كاملاً،
          وإن استمرّت المشكلة فلا تعتمد على هذه الوثيقة وراجع الجهة المُصدِرة.
        </p>
      </Shell>
    );
  }

  // Genuine, but no longer actionable. Loud, because the whole point of the
  // 30-day window is that a pharmacy refuses to act after it.
  const void_ = result.status === "cancelled" || result.isExpired;

  return (
    <Shell>
      {void_ ? (
        <>
          <Badge tone="danger" icon={ShieldAlert} />
          <h1 className="text-xl font-bold text-foreground">
            {result.status === "cancelled" ? "وثيقة مسحوبة" : "انتهت صلاحية الوثيقة"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {result.status === "cancelled"
              ? "صادرة عن وريد، لكن الجهة المُصدِرة سحبتها — لا تُنفَّذ."
              : "صادرة عن وريد، لكن مدّة صلاحيتها انقضت — لا تُنفَّذ، وتُطلب وثيقة جديدة."}
          </p>
        </>
      ) : (
        <>
          <Badge tone="positive" icon={BadgeCheck} />
          <h1 className="text-xl font-bold text-foreground">وثيقة صحيحة</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            صادرة عن منصّة وريد وسارية المفعول.
          </p>
        </>
      )}

      <dl className="mt-7 space-y-px overflow-hidden rounded-xl border border-border text-start">
        <Row label="رقم الوثيقة">
          <span className="font-mono text-sm" dir="ltr">
            {result.referenceNumber}
          </span>
        </Row>
        <Row label="نوع الوثيقة">{REFERRAL_KIND_LABELS[result.kind]}</Row>
        <Row label="الجهة المُصدِرة">{result.fromPartner}</Row>
        <Row label="الجهة المستلمة">{result.toPartner}</Row>
        <Row label="المجمّع الطبي">{result.complex}</Row>
        <Row label="تاريخ الإصدار">{formatDate(result.issuedAt)}</Row>
        <Row label="سارية حتى">
          {result.expiresAt ? (
            <span className={result.isExpired ? "text-destructive" : undefined}>
              {formatDate(result.expiresAt)}
            </span>
          ) : (
            "—"
          )}
        </Row>
        {result.respondedAt ? (
          <Row label="تاريخ الرد">{formatDateTime(result.respondedAt)}</Row>
        ) : null}
      </dl>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock size={14} aria-hidden="true" />
        بيانات المريض والتفاصيل السريرية لا تُعرض هنا
      </p>
    </Shell>
  );
}

/* --------------------------------- layout -------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {children}
        <p className="mt-7 border-t border-border pt-5 text-xs text-muted-foreground">
          وريد — منصّة الخدمات الطبية
        </p>
      </div>
    </main>
  );
}

const BADGE_TONES = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

function Badge({
  tone,
  icon: Icon,
}: {
  tone: keyof typeof BADGE_TONES;
  icon: typeof BadgeCheck;
}) {
  return (
    <div
      className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${BADGE_TONES[tone]}`}
    >
      <Icon className="h-8 w-8" aria-hidden="true" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
