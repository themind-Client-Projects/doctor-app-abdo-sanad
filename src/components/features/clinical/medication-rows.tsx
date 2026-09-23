"use client";

import { memo } from "react";
import { fieldClass } from "@/components/data/form-dialog";
import { MEDICATION_FORMS, MEDICATION_FORM_LABELS } from "@/server/services/referral-forms";

// ─────────────────────────────────────────────────────────────
// جدول الأدوية — the one drug table in the app.
//
// It lived inside the referral form's `PharmacyFields`, where only a referral
// could reach it. The doctor's own prescription screen needs exactly the same
// table — same six columns, same required-ness — and copying it would have
// given the platform two drug editors that drift: a column tightened on one
// and not the other means a prescription accepted by one screen and rejected
// by the other, for the same drug.
//
// The shape is `medicationSchema` in `server/services/referral-forms`, and
// `isComplete` below mirrors its required fields so the form can refuse to
// submit rather than trade a round trip for a validation toast.
// ─────────────────────────────────────────────────────────────

export type Medication = {
  name: string;
  form: string;
  dose: string;
  route: string;
  duration: string;
  notes?: string;
};

export const BLANK_MEDICATION: Medication = {
  name: "",
  form: "tablet",
  dose: "",
  route: "",
  duration: "",
};

/** Every column the printed form has, except the notes, must be filled. */
export function medicationsComplete(meds: readonly Medication[]): boolean {
  return (
    meds.length > 0 &&
    meds.every(
      (m) =>
        m.name.trim() !== "" &&
        m.dose.trim() !== "" &&
        m.route.trim() !== "" &&
        m.duration.trim() !== ""
    )
  );
}

/** Drops the empty optional note, which `.strict()` would otherwise see as "". */
export function normalizeMedications(meds: readonly Medication[]): Medication[] {
  return meds.map((m) => {
    const notes = m.notes?.trim();
    return {
      name: m.name.trim(),
      form: m.form,
      dose: m.dose.trim(),
      route: m.route.trim(),
      duration: m.duration.trim(),
      ...(notes ? { notes } : {}),
    };
  });
}

/** A Json column: a malformed row must render as "no drugs", never throw. */
export function readMedications(value: unknown): Medication[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is Medication =>
      typeof m === "object" && m !== null && typeof (m as Medication).name === "string"
  );
}

export const MedicationRows = memo(function MedicationRows({
  value,
  onChange,
  disabled,
}: {
  value: readonly Medication[];
  onChange: (next: Medication[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<Medication>) =>
    onChange(value.map((m, index) => (index === i ? { ...m, ...patch } : m)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">الأدوية الموصوفة</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, { ...BLANK_MEDICATION }])}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          إضافة دواء
        </button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          لا أدوية بعد — الوصفة لا تُرسل فارغة
        </p>
      ) : null}

      <div className="space-y-3">
        {value.map((med, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">دواء {i + 1}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, index) => index !== i))}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
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
                disabled={disabled}
                aria-label={`اسم الدواء ${i + 1}`}
              />
              <select
                className={fieldClass}
                value={med.form}
                onChange={(e) => update(i, { form: e.target.value })}
                disabled={disabled}
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
                disabled={disabled}
                aria-label={`الجرعة ${i + 1}`}
              />
              <input
                className={fieldClass}
                placeholder="طريقة الاستخدام — كل 12 ساعة"
                value={med.route}
                onChange={(e) => update(i, { route: e.target.value })}
                maxLength={120}
                disabled={disabled}
                aria-label={`طريقة الاستخدام ${i + 1}`}
              />
              <input
                className={fieldClass}
                placeholder="المدة — 7 أيام"
                value={med.duration}
                onChange={(e) => update(i, { duration: e.target.value })}
                maxLength={80}
                disabled={disabled}
                aria-label={`المدة ${i + 1}`}
              />
              <input
                className={fieldClass}
                placeholder="ملاحظات — بعد الأكل (اختياري)"
                value={med.notes ?? ""}
                onChange={(e) => update(i, { notes: e.target.value })}
                maxLength={240}
                disabled={disabled}
                aria-label={`ملاحظات الدواء ${i + 1}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * The same table, read-only — what the pharmacy dispenses against.
 *
 * The pharmacy's queue showed a COUNT of drugs and nothing else, so the one
 * screen whose entire job is handing over the right medicine could not see
 * which medicine it was.
 */
export function MedicationList({ value }: { value: readonly Medication[] }) {
  if (value.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        لا أدوية مسجّلة على هذه الوصفة
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {value.map((med, i) => (
        <li key={i} className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-foreground">{med.name}</p>
            <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground">
              {MEDICATION_FORM_LABELS[med.form] ?? med.form}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">الجرعة</dt>
              <dd className="text-foreground">{med.dose}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">الاستخدام</dt>
              <dd className="text-foreground">{med.route}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">المدة</dt>
              <dd className="text-foreground">{med.duration}</dd>
            </div>
          </dl>
          {med.notes ? (
            <p className="mt-2 text-xs text-muted-foreground">{med.notes}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
