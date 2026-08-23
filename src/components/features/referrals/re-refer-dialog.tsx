"use client";

import { useCallback, useMemo, useState } from "react";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { SearchableSelect, type SelectOption } from "@/components/data/searchable-select";
import { PARTNER_TYPE_LABELS, REFERRAL_PRIORITY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import {
  KIND_RECIPIENTS,
  REFERRAL_KINDS,
  REFERRAL_KIND_LABELS,
  type ReferralKind,
} from "@/server/services/referral-forms";
import { readAttachments, type Referral, type SendReferralInput } from "@/hooks/use-referrals";
import {
  ClinicalFields,
  emptyClinical,
  isClinicalComplete,
  type ClinicalDraft,
} from "./clinical-fields";

/**
 * إعادة الإحالة — send the same patient onward, carrying the chain.
 *
 * A lab finishes a test and the doctor re-refers to the pharmacy; the new
 * document links back so the whole path is traceable from either end.
 *
 * WHAT IS CARRIED AND WHAT IS NOT — this is the entire design of this dialog:
 *
 *   carried    the patient, and `parentId`. Identity, not judgement.
 *   shown      the parent's result and files, read-only, as context to read.
 *   re-entered the document type, the recipient, the title, the priority and
 *              EVERY clinical field.
 *
 * The clinical fieldset starts EMPTY, deliberately. Copying "لا حساسية من
 * الصبغة" forward is strictly worse than leaving it blank: blank reads as
 * "nobody asked", while a copy reads as "someone asked, and this is the
 * answer" — when in fact nobody asked today. `possiblePregnancy` is the
 * textbook case, and `contrastAllergy` most plausibly changes during the very
 * procedure the parent referral requested. The parent's data sits beside the
 * form as reference precisely so it can be read without being re-asserted.
 */

export function ReReferDialog({
  source,
  recipients,
  isPending,
  onClose,
  onSubmit,
}: {
  /** The referral being continued. Null closes the dialog. */
  source: Referral | null;
  recipients: { id: string; name: string; type: string }[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: SendReferralInput) => void;
}) {
  const [kind, setKind] = useState<ReferralKind>("PHARMACY");
  const [toPartnerId, setToPartnerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [clinical, setClinical] = useState<ClinicalDraft>(() => emptyClinical("PHARMACY"));

  // Re-seed when a different referral is opened, without a useEffect — the same
  // adjust-state-during-render idiom the reply dialog already uses.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Forget the draft on close. Without this, `loadedFor` still held the id
  // after the dialog shut, so reopening the SAME referral skipped the reset
  // below and the previous clinical answers were still sitting in the form —
  // the exact stale-assertion this dialog exists to prevent, arrived at from
  // the other direction.
  if (!source && loadedFor !== null) setLoadedFor(null);

  if (source && loadedFor !== source.id) {
    setLoadedFor(source.id);
    // A lab result most often becomes a prescription, so PHARMACY is the useful
    // default — but nothing about the parent's own kind is inherited.
    setKind("PHARMACY");
    setToPartnerId("");
    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setClinical(emptyClinical("PHARMACY"));
  }

  const changeKind = useCallback((next: ReferralKind) => {
    setKind(next);
    setClinical(emptyClinical(next));
    setToPartnerId("");
  }, []);

  const eligible = useMemo<SelectOption[]>(
    () =>
      recipients
        .filter((p) => KIND_RECIPIENTS[kind].includes(p.type))
        .map((p) => ({
          value: p.id,
          label: p.name,
          hint: PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type,
        })),
    [recipients, kind]
  );

  if (!source) return null;

  const files = readAttachments(source.attachments);
  const clinicalReady = isClinicalComplete(kind, clinical);

  return (
    <FormDialog
      open
      title="إعادة الإحالة"
      description={`متابعة للوثيقة ${source.referenceNumber} — نفس المريض، وثيقة جديدة`}
      onClose={onClose}
      isPending={isPending}
      submitLabel="إرسال"
      submitDisabled={!toPartnerId || title.trim() === "" || !clinicalReady}
      onSubmit={() =>
        onSubmit({
          kind,
          toPartnerId,
          patientId: source.patientId,
          parentId: source.id,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          clinical,
        })
      }
    >
      {/* ── الأصل: للقراءة فقط ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-muted/40 p-3">
        <h3 className="text-xs font-semibold text-foreground">الوثيقة الأصلية</h3>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <Detail label="الرقم">
            <span className="font-mono" dir="ltr">
              {source.referenceNumber}
            </span>
          </Detail>
          <Detail label="النوع">
            {REFERRAL_KIND_LABELS[source.kind as ReferralKind] ?? source.kind}
          </Detail>
          <Detail label="الجهة">{source.toPartner.name}</Detail>
          <Detail label="التاريخ">{formatDate(source.createdAt)}</Detail>
        </dl>

        {source.resultSummary ? (
          <div className="mt-2.5 border-t border-border pt-2.5">
            <p className="text-[11px] text-muted-foreground">النتيجة</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground">
              {source.resultSummary}
            </p>
          </div>
        ) : null}

        {files.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {files.map((f) => (
              <li key={f.url}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          للاطّلاع فقط. البيانات السريرية أدناه تُملأ من جديد — إجابة سلامة قديمة
          لا تصلح لوثيقة جديدة.
        </p>
      </section>

      {/* ── المريض: محمول، غير قابل للتغيير ────────────────────── */}
      <Field label="المريض" htmlFor="rr-patient" hint="محمول من الوثيقة الأصلية">
        <input
          id="rr-patient"
          className={`${fieldClass} cursor-not-allowed opacity-70`}
          value={`${source.patientName} — ${source.patientPhone}`}
          readOnly
          disabled
        />
      </Field>

      <Field label="نوع النموذج" htmlFor="rr-kind">
        <select
          id="rr-kind"
          className={fieldClass}
          value={kind}
          onChange={(e) => changeKind(e.target.value as ReferralKind)}
        >
          {REFERRAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {REFERRAL_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="الجهة المستلمة"
        htmlFor="rr-to"
        hint={`${REFERRAL_KIND_LABELS[kind]} تُرسل إلى ${KIND_RECIPIENTS[kind]
          .map((t) => PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t)
          .join(" أو ")} فقط`}
      >
        <SearchableSelect
          id="rr-to"
          value={toPartnerId}
          onChange={setToPartnerId}
          options={eligible}
          placeholder="— اختر الجهة —"
          emptyMessage="لا جهة مناسبة في مجمّعك"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="عنوان الطلب" htmlFor="rr-title">
          <input
            id="rr-title"
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="صرف علاج بناءً على نتيجة التحليل"
            maxLength={160}
          />
        </Field>

        <Field label="مستوى الأولوية" htmlFor="rr-priority">
          <select
            id="rr-priority"
            className={fieldClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {Object.entries(REFERRAL_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ClinicalFields kind={kind} value={clinical} onChange={setClinical} />

      <Field label="سبب الطلب / التشخيص المبدئي" htmlFor="rr-desc">
        <textarea
          id="rr-desc"
          className={`${fieldClass} h-24 py-2.5`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </Field>
    </FormDialog>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{children}</dd>
    </div>
  );
}
