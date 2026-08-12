"use client";

import { useCallback } from "react";
import { Field, fieldClass } from "@/components/data/form-dialog";
import {
  MEDICATION_FORMS,
  MEDICATION_FORM_LABELS,
  RADIOLOGY_EXAMS,
  RADIOLOGY_EXAM_LABELS,
  type ReferralKind,
} from "@/server/services/referral-forms";

/**
 * The half of the form that changes with the document.
 *
 * Four papers, four field sets: a radiology request asks three safety
 * questions, a prescription collects a table of drugs, a doctor-to-doctor
 * referral takes vitals and a summary. Keeping them here rather than in the
 * page means the page stays a page, and the shape a screen collects cannot
 * drift from the shape the server validates — both read the same vocabulary
 * from `referral-forms`.
 */

export type ClinicalDraft = Record<string, unknown>;

/** A blank payload per document, so switching kind never carries stale fields. */
export function emptyClinical(kind: ReferralKind): ClinicalDraft {
  switch (kind) {
    case "RADIOLOGY":
      // The three safety answers start UNSET, not false. "Nobody asked" and
      // "the patient said no" are different facts, and the server refuses the
      // first — so the form must be able to represent it.
      return { examTypes: [], contrastAllergy: null, possiblePregnancy: null, metalImplant: null };
    case "PHARMACY":
      return { medications: [] };
    case "LAB":
      return { tests: [] };
    default:
      return {};
  }
}

/** Is this draft complete enough for the server to accept it? */
export function isClinicalComplete(kind: ReferralKind, draft: ClinicalDraft): boolean {
  if (kind === "RADIOLOGY") {
    const exams = (draft.examTypes as string[]) ?? [];
    return (
      exams.length > 0 &&
      typeof draft.contrastAllergy === "boolean" &&
      typeof draft.possiblePregnancy === "boolean" &&
      typeof draft.metalImplant === "boolean"
    );
  }
  if (kind === "PHARMACY") return ((draft.medications as unknown[]) ?? []).length > 0;
  if (kind === "LAB") return ((draft.tests as string[]) ?? []).length > 0;
  return true;
}

export function ClinicalFields({
  kind,
  value,
  onChange,
}: {
  kind: ReferralKind;
  value: ClinicalDraft;
  onChange: (next: ClinicalDraft) => void;
}) {
  const set = useCallback(
    (key: string, v: unknown) => onChange({ ...value, [key]: v }),
    [value, onChange]
  );

  if (kind === "RADIOLOGY") return <RadiologyFields value={value} set={set} />;
  if (kind === "PHARMACY") return <PharmacyFields value={value} set={set} />;
  if (kind === "LAB") return <LabFields value={value} set={set} />;
  return <DoctorFields value={value} set={set} />;
}

type SetFn = (key: string, value: unknown) => void;

/* ------------------------------- RAD — أشعة ------------------------------- */

const EXAM_GROUPS: { key: keyof typeof RADIOLOGY_EXAMS; label: string }[] = [
  { key: "XRAY", label: "أشعة عادية (X-Ray)" },
  { key: "ULTRASOUND", label: "سونار (Ultrasound)" },
  { key: "CT", label: "مقطعية (CT Scan)" },
  { key: "PET_CT", label: "بت سكان (PET-CT)" },
];

function RadiologyFields({ value, set }: { value: ClinicalDraft; set: SetFn }) {
  const selected = (value.examTypes as string[]) ?? [];
  const toggle = (code: string) =>
    set("examTypes", selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);

  return (
    <>
      <div>
        <p className="mb-2 block text-[13px] font-semibold text-foreground">نوع الفحص المطلوب</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXAM_GROUPS.map((group) => (
            <fieldset key={group.key} className="rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">
                {group.label}
              </legend>
              {RADIOLOGY_EXAMS[group.key].map((item) => {
                const code = `${group.key}:${item}`;
                return (
                  <label key={code} className="flex items-center gap-2 py-1 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selected.includes(code)}
                      onChange={() => toggle(code)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {RADIOLOGY_EXAM_LABELS[code]}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </div>

      {/* The reason this screen exists. An imaging centre needs a stated answer,
          and an unset field is refused by the server rather than read as "no". */}
      <fieldset className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
        <legend className="px-1 text-[13px] font-bold text-amber-800 dark:text-amber-300">
          معلومات سريرية مهمة — إجابة إلزامية
        </legend>
        <YesNo
          label="حساسية من الصبغة"
          value={value.contrastAllergy as boolean | null}
          onChange={(v) => set("contrastAllergy", v)}
        />
        <YesNo
          label="حمل محتمل"
          value={value.possiblePregnancy as boolean | null}
          onChange={(v) => set("possiblePregnancy", v)}
        />
        <YesNo
          label="وجود جهاز معدني"
          value={value.metalImplant as boolean | null}
          onChange={(v) => set("metalImplant", v)}
        />
        <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/70">
          لا يمكن إرسال الطلب دون الإجابة على الثلاثة — قسم الأشعة يحتاج «لا» مُصرَّحاً بها، لا حقلاً فارغاً.
        </p>
      </fieldset>

      <Field label="ملاحظات لطبيب الأشعة" htmlFor="rad-notes" hint="اختياري">
        <textarea
          id="rad-notes"
          className={`${fieldClass} h-20 py-2.5`}
          value={(value.radiologistNotes as string) ?? ""}
          onChange={(e) => set("radiologistNotes", e.target.value)}
          maxLength={1000}
        />
      </Field>

      <Field label="تعليمات للمريض" htmlFor="rad-instructions" hint="الصيام، إحضار تقارير سابقة…">
        <textarea
          id="rad-instructions"
          className={`${fieldClass} h-20 py-2.5`}
          value={(value.patientInstructions as string) ?? ""}
          onChange={(e) => set("patientInstructions", e.target.value)}
          maxLength={1000}
        />
      </Field>
    </>
  );
}

/**
 * A tri-state answer: نعم / لا / (لم يُجب).
 *
 * A checkbox cannot express the third, which is exactly the state that must not
 * be submitted — so this is radio buttons with no default selection.
 */
function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const name = `yn-${label}`;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200/60 py-2 last:border-0 dark:border-amber-800/30">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex shrink-0 gap-3">
        {[
          { v: true, t: "نعم" },
          { v: false, t: "لا" },
        ].map((opt) => (
          <label key={opt.t} className="flex items-center gap-1.5 text-sm text-foreground">
            <input
              type="radio"
              name={name}
              checked={value === opt.v}
              onChange={() => onChange(opt.v)}
              className="h-4 w-4 accent-primary"
            />
            {opt.t}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- RX — وصفة -------------------------------- */

type Medication = {
  name: string;
  form: string;
  dose: string;
  route: string;
  duration: string;
  notes?: string;
};

const BLANK_MED: Medication = {
  name: "",
  form: "tablet",
  dose: "",
  route: "",
  duration: "",
};

function PharmacyFields({ value, set }: { value: ClinicalDraft; set: SetFn }) {
  const meds = ((value.medications as Medication[]) ?? []) as Medication[];
  const update = (i: number, patch: Partial<Medication>) =>
    set("medications", meds.map((m, index) => (index === i ? { ...m, ...patch } : m)));

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-foreground">الأدوية الموصوفة</p>
          <button
            type="button"
            onClick={() => set("medications", [...meds, { ...BLANK_MED }])}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            إضافة دواء
          </button>
        </div>

        {meds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            لا أدوية بعد — الوصفة لا تُرسل فارغة
          </p>
        ) : null}

        <div className="space-y-3">
          {meds.map((med, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">دواء {i + 1}</span>
                <button
                  type="button"
                  onClick={() => set("medications", meds.filter((_, index) => index !== i))}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  aria-label={`إزالة الدواء ${i + 1}`}
                >
                  إزالة
                </button>
              </div>

              {/* Every one of these is a column on the client's printed table,
                  and every one is required by the server. A prescription that
                  reaches a pharmacy without a dose has to be phoned in. */}
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  placeholder="اسم الدواء والتركيز"
                  value={med.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  maxLength={160}
                  aria-label={`اسم الدواء ${i + 1}`}
                />
                <select
                  className={fieldClass}
                  value={med.form}
                  onChange={(e) => update(i, { form: e.target.value })}
                  aria-label={`الشكل الدوائي ${i + 1}`}
                >
                  {MEDICATION_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {MEDICATION_FORM_LABELS[f]}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass}
                  placeholder="الجرعة — 1 قرص"
                  value={med.dose}
                  onChange={(e) => update(i, { dose: e.target.value })}
                  maxLength={80}
                  aria-label={`الجرعة ${i + 1}`}
                />
                <input
                  className={fieldClass}
                  placeholder="طريقة الاستخدام — كل 12 ساعة"
                  value={med.route}
                  onChange={(e) => update(i, { route: e.target.value })}
                  maxLength={120}
                  aria-label={`طريقة الاستخدام ${i + 1}`}
                />
                <input
                  className={fieldClass}
                  placeholder="المدة — 7 أيام"
                  value={med.duration}
                  onChange={(e) => update(i, { duration: e.target.value })}
                  maxLength={80}
                  aria-label={`المدة ${i + 1}`}
                />
                <input
                  className={fieldClass}
                  placeholder="ملاحظات — بعد الأكل (اختياري)"
                  value={med.notes ?? ""}
                  onChange={(e) => update(i, { notes: e.target.value })}
                  maxLength={240}
                  aria-label={`ملاحظات الدواء ${i + 1}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Field label="ملاحظات الطبيب" htmlFor="rx-notes" hint="اختياري">
        <textarea
          id="rx-notes"
          className={`${fieldClass} h-20 py-2.5`}
          value={(value.doctorNotes as string) ?? ""}
          onChange={(e) => set("doctorNotes", e.target.value)}
          maxLength={1000}
        />
      </Field>
    </>
  );
}

/* ------------------------------- LAB — تحاليل ----------------------------- */

function LabFields({ value, set }: { value: ClinicalDraft; set: SetFn }) {
  const tests = (value.tests as string[]) ?? [];
  return (
    <>
      <Field
        label="الفحوصات المطلوبة"
        htmlFor="lab-tests"
        hint="فحص في كل سطر — مثال: تحليل دم شامل CBC"
      >
        <textarea
          id="lab-tests"
          className={`${fieldClass} h-24 py-2.5`}
          value={tests.join("\n")}
          onChange={(e) =>
            set(
              "tests",
              e.target.value.split("\n").map((t) => t.trim()).filter(Boolean)
            )
          }
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value.fastingRequired)}
          onChange={(e) => set("fastingRequired", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        يتطلّب صياماً
      </label>

      <Field label="ملاحظات سريرية" htmlFor="lab-notes" hint="اختياري">
        <textarea
          id="lab-notes"
          className={`${fieldClass} h-20 py-2.5`}
          value={(value.clinicalNotes as string) ?? ""}
          onChange={(e) => set("clinicalNotes", e.target.value)}
          maxLength={1000}
        />
      </Field>
    </>
  );
}

/* ------------------------------ REF — إحالة ------------------------------- */

function DoctorFields({ value, set }: { value: ClinicalDraft; set: SetFn }) {
  const vitals = (value.vitals as Record<string, unknown>) ?? {};
  const summary = (value.summary as string[]) ?? [];

  return (
    <>
      <Field label="نوع الإحالة" htmlFor="ref-type" hint="مثال: إحالة تخصص">
        <input
          id="ref-type"
          className={fieldClass}
          value={(value.referralType as string) ?? ""}
          onChange={(e) => set("referralType", e.target.value)}
          maxLength={80}
        />
      </Field>

      {/* Their own fields rather than a paragraph, so "130/85" and "96" stay
          readable and comparable on the receiving doctor's screen. */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="ضغط الدم" htmlFor="v-bp">
          <input
            id="v-bp"
            className={fieldClass}
            placeholder="130/85"
            dir="ltr"
            value={(vitals.bloodPressure as string) ?? ""}
            onChange={(e) => set("vitals", { ...vitals, bloodPressure: e.target.value || undefined })}
            maxLength={20}
          />
        </Field>
        <Field label="النبض" htmlFor="v-pulse">
          <input
            id="v-pulse"
            className={fieldClass}
            inputMode="numeric"
            value={(vitals.pulse as number | undefined)?.toString() ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              set("vitals", { ...vitals, pulse: digits === "" ? undefined : Number(digits) });
            }}
            maxLength={3}
          />
        </Field>
        <Field label="الحرارة" htmlFor="v-temp">
          <input
            id="v-temp"
            className={fieldClass}
            inputMode="decimal"
            value={(vitals.temperature as number | undefined)?.toString() ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, "");
              set("vitals", { ...vitals, temperature: raw === "" ? undefined : Number(raw) });
            }}
            maxLength={4}
          />
        </Field>
      </div>

      <Field label="الملخص السريري" htmlFor="ref-summary" hint="سطر لكل نقطة">
        <textarea
          id="ref-summary"
          className={`${fieldClass} h-24 py-2.5`}
          value={summary.join("\n")}
          onChange={(e) =>
            set("summary", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))
          }
        />
      </Field>

      <Field label="الحساسية" htmlFor="ref-allergies" hint="اكتب «لا توجد» إن لم تكن هناك">
        <input
          id="ref-allergies"
          className={fieldClass}
          value={(value.allergies as string) ?? ""}
          onChange={(e) => set("allergies", e.target.value)}
          maxLength={300}
        />
      </Field>
    </>
  );
}
