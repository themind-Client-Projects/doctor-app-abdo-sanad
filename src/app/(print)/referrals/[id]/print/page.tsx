import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { UserRole } from "@prisma/client";
import { renderSVG } from "uqr";
import { auth } from "@/lib/auth";
import { ROLES } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/format";
import { PARTNER_TYPE_LABELS, REFERRAL_PRIORITY_LABELS } from "@/lib/labels";
import { PrintButton } from "@/components/features/referrals/print-button";
import {
  MEDICATION_FORM_LABELS,
  RADIOLOGY_EXAM_LABELS,
  REFERRAL_EVENT_LABELS,
  REFERRAL_INCLUDE,
  REFERRAL_KIND_LABELS,
  REFERRAL_VALIDITY_DAYS,
  type ReferralEventStatus,
  ageFrom,
  decorateReferral,
  patientNumber,
  referralScopeFor,
  complexContextFor,
  type ReferralKind,
} from "@/server/services/referral";

/**
 * The printed referral — the paper the client's four mockups describe.
 *
 * The send dialog has promised "تُرسل إلكترونياً ويمكن طباعتها" since the
 * feature shipped, with nothing behind it. This is that document, and it is
 * where the verification QR finally has somewhere to be: a code nobody can
 * scan verifies nothing.
 *
 * Server-rendered end to end. The QR is an SVG built on the server, so no QR
 * library reaches the browser bundle and the sheet prints identically whether
 * or not JavaScript ran.
 *
 * AUTHORISATION IS THIS PAGE'S OWN JOB. It sits outside the `/dashboard` tree,
 * which is what keeps the sidebar off the paper, and therefore outside
 * `src/proxy.ts`'s matcher. That matcher was never the boundary anyway — its
 * own comment says so — so the check here is the same `referralScopeFor` every
 * API read uses: sender, recipient, or platform role. Nobody else.
 */

export const metadata: Metadata = {
  title: "وثيقة إحالة — وريد",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PrintReferralPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) notFound();

  // The ROLES.STAFF half, which `referralScopeFor` does not make. Partner scope
  // and role are independent dimensions here, and the API this page mirrors
  // checks both — `withAuth({ roles: ROLES.STAFF })` on every referral read.
  // Defence in depth: `complexContextFor` now also refuses a PATIENT.
  if (!(ROLES.STAFF as readonly UserRole[]).includes(user.role)) notFound();

  const identity = {
    userId: user.id,
    role: user.role,
    partnerId: user.partnerId ?? null,
    doctorProfileId: user.doctorProfileId ?? null,
  };

  const ctx = await complexContextFor(identity);

  // Not `findUnique` then check: scoping in the query means a caller who is not
  // a party gets the same "no such document" as a wrong id, with no timing or
  // error-shape difference to tell the two apart.
  const row = await prisma.complexReferral.findFirst({
    where: { AND: [{ id }, referralScopeFor(identity, ctx)] },
    include: REFERRAL_INCLUDE,
  });
  if (!row) notFound();

  const referral = decorateReferral(row, ctx?.partnerId ?? null);

  // The patient's own identifiers are not on the referral row — they are the
  // patient's, and printed forms carry them under المريض.
  const patient = await prisma.user.findUnique({
    where: { id: row.patientId },
    select: { patientSeq: true, dateOfBirth: true, gender: true },
  });

  const age = ageFrom(patient?.dateOfBirth);

  // `border: 1` keeps the quiet zone the spec requires — a QR printed flush to
  // its neighbour is one many scanners refuse to read.
  //
  // Null when the signing secret is unusable. The document still prints — the
  // clinical content is the point and a pharmacist needs it — but it prints
  // WITHOUT a QR rather than with one that verifies nothing.
  const qr = referral.verifyUrl
    ? renderSVG(referral.verifyUrl, { ecc: "M", border: 1, pixelSize: 4 })
    : null;

  const sender = row.fromPartner;
  const senderDoctor = sender.user?.doctorProfile;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {REFERRAL_KIND_LABELS[referral.kind as ReferralKind]}
          </h1>
          <p className="text-sm text-muted-foreground">
            راجع الوثيقة قبل الطباعة — تُطبع بحجم A4
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-border bg-card p-8 text-foreground shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* ── الترويسة ─────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-foreground/80 pb-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight">{sender.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {PARTNER_TYPE_LABELS[sender.type as keyof typeof PARTNER_TYPE_LABELS] ?? sender.type}
              {senderDoctor?.specialty ? ` — ${senderDoctor.specialty.name}` : ""}
            </p>
            {sender.address ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{sender.address}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
              {sender.phone ?? ""}
            </p>
            {senderDoctor?.licenseNumber ? (
              <p className="mt-1 text-xs text-muted-foreground">
                رقم الترخيص: <span dir="ltr">{senderDoctor.licenseNumber}</span>
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-end">
            <p className="text-lg font-bold">{REFERRAL_KIND_LABELS[referral.kind as ReferralKind]}</p>
            <p className="mt-1 font-mono text-sm" dir="ltr">
              {referral.referenceNumber}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              التاريخ: {formatDate(referral.createdAt)}
            </p>
            <PriorityMark priority={row.priority} />
          </div>
        </header>

        {/* ── المريض ───────────────────────────────────────────── */}
        <Section title="بيانات المريض">
          <Grid>
            <Cell label="الاسم">{row.patientName}</Cell>
            <Cell label="رقم المريض">
              <span className="font-mono" dir="ltr">
                {patient ? patientNumber(patient.patientSeq, referral.createdAt) : "—"}
              </span>
            </Cell>
            <Cell label="الهاتف">
              <span dir="ltr">{row.patientPhone}</span>
            </Cell>
            <Cell label="العمر">{age === null ? "—" : `${age} سنة`}</Cell>
            <Cell label="الجنس">{patient?.gender ?? "—"}</Cell>
            <Cell label="المجمّع">{row.complex.name}</Cell>
          </Grid>
        </Section>

        {/* ── الجهة المستلمة ───────────────────────────────────── */}
        <Section title="الجهة المستلمة">
          <Grid>
            <Cell label="الاسم">{row.toPartner.name}</Cell>
            <Cell label="النوع">
              {PARTNER_TYPE_LABELS[row.toPartner.type as keyof typeof PARTNER_TYPE_LABELS] ??
                row.toPartner.type}
            </Cell>
          </Grid>
        </Section>

        {/* ── الطلب ────────────────────────────────────────────── */}
        <Section title="الطلب">
          <p className="font-medium">{row.title}</p>
          {row.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {row.description}
            </p>
          ) : null}
        </Section>

        <ClinicalSection kind={referral.kind as ReferralKind} clinical={referral.clinical} />

        {/* ── مسار الوثيقة ─────────────────────────────────────── */}
        {/* The track the client's form draws — أُرسل ← استُلم ← رُوجع ← أُعيدت ←
            عُولجت — with a real timestamp under each step. Read from the event
            log rather than inferred from the current status, which cannot say
            WHEN anything happened, nor that a re-referral happened at all. */}
        <Section title="مسار الوثيقة">
          <ol className="flex flex-wrap gap-x-6 gap-y-2">
            {row.events.map((event) => (
              <li key={event.id} className="min-w-0">
                <p className="text-sm font-medium">
                  {REFERRAL_EVENT_LABELS[event.status as ReferralEventStatus] ?? event.status}
                </p>
                {/* Time, not just the date: several stages routinely happen on
                    the same day, and a track that cannot order them is not a
                    track. */}
                <p className="text-[11px] text-muted-foreground">{formatDateTime(event.at)}</p>
                {event.note ? (
                  <p className="text-[11px] text-muted-foreground">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        {/* ── النتيجة ──────────────────────────────────────────── */}
        {row.resultSummary ? (
          <Section title="النتيجة">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.resultSummary}</p>
          </Section>
        ) : null}

        {/* ── التذييل: التوقيع والتحقق ─────────────────────────── */}
        {/* `break-inside-avoid`: the signature line and the verification QR are
            one unit. Split across a page break, a second sheet arrives carrying
            a QR and no document, which is exactly the thing a verifier must not
            be handed. */}
        <footer className="mt-8 flex break-inside-avoid items-end justify-between gap-8 border-t border-border pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              صالحة لمدة {REFERRAL_VALIDITY_DAYS} يوماً من تاريخ الإصدار
              {referral.expiresAt ? ` — حتى ${formatDate(referral.expiresAt)}` : ""}
            </p>
            <div className="mt-8 w-56 border-t border-foreground/60 pt-1.5 text-xs text-muted-foreground">
              توقيع وختم الجهة المُصدِرة
            </div>
          </div>

          <div className="shrink-0 text-center">
            {qr ? (
              <>
                {/* White plate under the QR: the modules must stay black-on-white
                    to scan, so it cannot inherit a dark surface. */}
                <div
                  className="mx-auto h-[104px] w-[104px] overflow-hidden rounded-md bg-white p-1 ring-1 ring-border [&>svg]:h-full [&>svg]:w-full"
                  // Built here from our own URL — no user input reaches it.
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <p className="mt-1.5 max-w-[132px] text-[10px] leading-tight text-muted-foreground">
                  امسح للتحقق من صحة الوثيقة
                </p>
              </>
            ) : (
              <p className="max-w-[132px] text-[10px] leading-tight text-muted-foreground">
                تعذّر توليد رمز التحقق — راجع إعدادات الخادم
              </p>
            )}
          </div>
        </footer>
      </article>
    </div>
  );
}

/* ------------------------------ per-document ------------------------------ */

/**
 * The half that differs per form.
 *
 * `clinical` is already parsed and narrowed by `decorateReferral`, so each
 * branch reads the fields its own schema guarantees rather than probing an
 * unknown object.
 */
function ClinicalSection({ kind, clinical }: { kind: ReferralKind; clinical: unknown }) {
  if (!clinical || typeof clinical !== "object") return null;
  const c = clinical as Record<string, unknown>;

  if (kind === "RADIOLOGY") {
    const exams = Array.isArray(c.examTypes) ? (c.examTypes as string[]) : [];
    return (
      <>
        <Section title="الفحص المطلوب">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {exams.map((code) => (
              <li key={code}>• {RADIOLOGY_EXAM_LABELS[code] ?? code}</li>
            ))}
            {typeof c.examOther === "string" && c.examOther ? <li>• {c.examOther}</li> : null}
          </ul>
        </Section>

        {/* Boxed, because a technician scans for these before positioning the
            patient — burying them in prose is how they get missed. */}
        <Section title="أسئلة السلامة">
          <div className="rounded-lg border border-foreground/30 p-3">
            <Grid>
              <Cell label="حساسية من الصبغة">{yesNo(c.contrastAllergy)}</Cell>
              <Cell label="احتمال حمل">{yesNo(c.possiblePregnancy)}</Cell>
              <Cell label="جهاز معدني مزروع">{yesNo(c.metalImplant)}</Cell>
            </Grid>
            {typeof c.otherSafetyNotes === "string" && c.otherSafetyNotes ? (
              <p className="mt-2 text-sm text-muted-foreground">{c.otherSafetyNotes}</p>
            ) : null}
          </div>
        </Section>

        <Notes label="ملاحظات لطبيب الأشعة" value={c.radiologistNotes} />
        <Notes label="تعليمات للمريض" value={c.patientInstructions} />
      </>
    );
  }

  if (kind === "PHARMACY") {
    const meds = Array.isArray(c.medications)
      ? (c.medications as Record<string, string>[])
      : [];
    return (
      <>
        <Section title="الأدوية">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-foreground/40 text-start">
                {["الدواء", "الشكل", "الجرعة", "طريقة الاستعمال", "المدة"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-start text-xs font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meds.map((m, i) => (
                // A drug's dose must never be orphaned onto the next page from
                // its name.
                <tr key={`${m.name}-${i}`} className="break-inside-avoid border-b border-border">
                  <td className="px-2 py-2 font-medium">
                    {m.name}
                    {m.notes ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {m.notes}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{MEDICATION_FORM_LABELS[m.form] ?? m.form}</td>
                  <td className="px-2 py-2">{m.dose}</td>
                  <td className="px-2 py-2">{m.route}</td>
                  <td className="px-2 py-2">{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Notes label="ملاحظات الطبيب" value={c.doctorNotes} />
      </>
    );
  }

  if (kind === "LAB") {
    const tests = Array.isArray(c.tests) ? (c.tests as string[]) : [];
    return (
      <>
        <Section title="الفحوصات المطلوبة">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {tests.map((t, i) => (
              <li key={`${t}-${i}`}>• {t}</li>
            ))}
          </ul>
          {c.fastingRequired === true ? (
            <p className="mt-3 inline-block rounded-md border border-foreground/30 px-2.5 py-1 text-sm font-medium">
              الصيام مطلوب
            </p>
          ) : null}
        </Section>
        <Notes label="ملاحظات سريرية" value={c.clinicalNotes} />
      </>
    );
  }

  // DOCTOR
  const vitals = (c.vitals ?? {}) as Record<string, unknown>;
  const summary = Array.isArray(c.summary) ? (c.summary as string[]) : [];
  const hasVitals =
    vitals.bloodPressure !== undefined ||
    vitals.pulse !== undefined ||
    vitals.temperature !== undefined;

  return (
    <>
      {c.referralType ? (
        <Section title="نوع الإحالة">
          <p className="text-sm">{String(c.referralType)}</p>
        </Section>
      ) : null}

      {hasVitals ? (
        <Section title="العلامات الحيوية">
          <Grid>
            <Cell label="ضغط الدم">
              <span dir="ltr">{(vitals.bloodPressure as string) ?? "—"}</span>
            </Cell>
            <Cell label="النبض">
              {vitals.pulse === undefined ? "—" : `${vitals.pulse} / دقيقة`}
            </Cell>
            <Cell label="الحرارة">
              {vitals.temperature === undefined ? "—" : `${vitals.temperature}°`}
            </Cell>
          </Grid>
        </Section>
      ) : null}

      {summary.length > 0 ? (
        <Section title="الملخص السريري">
          <ul className="space-y-1 text-sm">
            {summary.map((line, i) => (
              <li key={`${line}-${i}`}>• {line}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Notes label="الحساسية" value={c.allergies} />
    </>
  );
}

/* --------------------------------- pieces --------------------------------- */

/**
 * مستوى الأولوية, printed only when it is not the default.
 *
 * Stamping "عادي" on every sheet trains the reader to skip the line, which is
 * exactly the line that must catch the eye on the one form in fifty that says
 * عاجل.
 */
function PriorityMark({ priority }: { priority: keyof typeof REFERRAL_PRIORITY_LABELS }) {
  if (priority === "NORMAL") return null;
  return (
    <p
      className={`mt-1.5 inline-block rounded border px-2 py-0.5 text-xs font-bold ${
        priority === "CRITICAL"
          ? "border-destructive text-destructive"
          : "border-foreground/50 text-foreground"
      }`}
    >
      {REFERRAL_PRIORITY_LABELS[priority]}
    </p>
  );
}

/** A stated NO is a clinical answer; a blank is not. Never render one as the other. */
function yesNo(value: unknown): string {
  if (value === true) return "نعم";
  if (value === false) return "لا";
  return "—";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-border pb-1 text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-6 gap-y-2">{children}</div>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {/* Wraps rather than truncates. On a screen an ellipsis invites a hover;
          on paper it deletes the end of a patient's name with no way to recover
          it. */}
      <p className="break-words text-sm font-medium">{children}</p>
    </div>
  );
}

function Notes({ label, value }: { label: string; value: unknown }) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return (
    <Section title={label}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </Section>
  );
}
