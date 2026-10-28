"use client";

import { useCallback, useState } from "react";
import { HeartPulse, Stethoscope } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { FormDialog, Field, fieldClass } from "@/components/data/form-dialog";
import { LineListField } from "@/components/data/line-list-field";
import { SearchableSelect, type SelectOption } from "@/components/data/searchable-select";
import { invalidate } from "@/lib/request-cache";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الملف الطبي المختصر — the writer the file never had.
//
// `PUT /api/medical-records/[patientId]` has always existed, complete and
// carefully guarded: SUPER_ADMIN, DOCTOR and NURSE only, each checked for a
// real care relationship with this patient, upserting so the first save
// creates the file. Nothing called it. No screen, no service, no seed — so the
// GET 404'd for every patient and the operations screen sat on its empty state
// forever, with all eight fields of the requirement unreachable.
//
// The clinical cost is specific: allergies ARE captured today, but only inside
// a referral form, and never copied anywhere a later reader would look. A
// nurse pulling a patient up before a home blood draw had no allergy
// information and no way for anyone to enter it.
//
// Only the four AUTHORED fields are edited here. آخر التحاليل، آخر الأشعة and
// الوصفات السابقة are derived by the endpoint from the lab, radiology and
// prescription records that already exist — "latest" has to mean the actual
// latest, and a typed copy is stale the moment the next result lands.
// ─────────────────────────────────────────────────────────────

export type MedicalRecord = {
  medicalHistory: string | null;
  chronicDiseases: unknown;
  allergies: unknown;
  currentMedications: unknown;
  treatingDoctorId: string | null;
  treatingDoctorName: string | null;
  previousPrescriptions: { id: string; createdAt: string }[];
  latestLabResults: { id: string; createdAt: string }[];
  latestRadiology: { id: string; createdAt: string }[];
  updatedAt: string | null;
};

/** The Json columns hold arrays of strings; anything else is shown as text. */
function asLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

export function MedicalRecordDrawer({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string | null;
  patientName: string;
  onClose: () => void;
}) {
  const open = patientId !== null;

  // A 404 is a patient with no file YET — a normal state, and the reason this
  // drawer exists. It must not read as a failure.
  const { data, isLoading, error } = useDashboardData<MedicalRecord>({
    url: patientId ? `/api/medical-records/${patientId}` : "",
    enabled: open,
  });

  const { data: doctors } = useDashboardData<{ id: string; name: string }[]>({
    url: "/api/public/doctors",
    params: { limit: "100" },
    enabled: open,
  });

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [history, setHistory] = useState("");
  const [chronic, setChronic] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [doctorId, setDoctorId] = useState("");

  // Closing forgets the draft, so reopening always re-seeds from the row —
  // the same guard the referral dialogs carry.
  if (!open && loadedFor !== null) setLoadedFor(null);

  if (open && patientId && loadedFor !== patientId && (data || error)) {
    setLoadedFor(patientId);
    setHistory(data?.medicalHistory ?? "");
    setChronic(asLines(data?.chronicDiseases));
    setAllergies(asLines(data?.allergies));
    setMedications(asLines(data?.currentMedications));
    setDoctorId(data?.treatingDoctorId ?? "");
  }

  const { mutate: save, isPending } = useMutation(
    async (id: string) =>
      apiFetch(`/api/medical-records/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          medicalHistory: history,
          chronicDiseases: chronic,
          allergies,
          currentMedications: medications,
          ...(doctorId ? { treatingDoctorId: doctorId } : {}),
        }),
      }),
    {
      successMessage: "تم حفظ الملف الطبي",
      onSuccess: () => {
        if (patientId) invalidate(`/api/medical-records/${patientId}`);
        onClose();
      },
    }
  );

  const submit = useCallback(() => {
    if (patientId) void save(patientId);
  }, [patientId, save]);

  const derivedCount =
    (data?.previousPrescriptions?.length ?? 0) +
    (data?.latestLabResults?.length ?? 0) +
    (data?.latestRadiology?.length ?? 0);

  return (
    <FormDialog
      open={open}
      title="الملف الطبي المختصر"
      description={patientName}
      onClose={onClose}
      onSubmit={submit}
      isPending={isPending}
      submitLabel="حفظ"
    >
      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">جاري تحميل الملف...</p>
      ) : null}

      <Field label="التاريخ المرضي" htmlFor="mr-history" hint="اختياري">
        <textarea
          id="mr-history"
          className={`${fieldClass} h-24 py-2.5`}
          value={history}
          onChange={(e) => setHistory(e.target.value)}
          maxLength={2000}
        />
      </Field>

      <LineListField
        id="mr-chronic"
        label="الأمراض المزمنة"
        hint="مرض في كل سطر"
        items={chronic}
        onChange={setChronic}
        rows="h-20"
      />

      <LineListField
        id="mr-allergies"
        label="الحساسية"
        hint="حساسية في كل سطر — اكتب «لا توجد» إن لم تكن هناك"
        items={allergies}
        onChange={setAllergies}
        rows="h-20"
      />

      <LineListField
        id="mr-medications"
        label="الأدوية الحالية"
        hint="دواء في كل سطر"
        items={medications}
        onChange={setMedications}
        rows="h-20"
      />

      <Field label="الطبيب المعالج" htmlFor="mr-doctor" hint="اختياري">
        <SearchableSelect
          id="mr-doctor"
          value={doctorId}
          onChange={setDoctorId}
          options={(doctors ?? []).map<SelectOption>((d) => ({ value: d.id, label: d.name }))}
          placeholder="اختر الطبيب"
          emptyMessage="لا أطباء"
        />
      </Field>

      {/* Read-only, and said so: these come from the lab, radiology and
          prescription records themselves. */}
      <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-bold text-foreground">
          <HeartPulse className="h-3.5 w-3.5" aria-hidden />
          آخر التحاليل، آخر الأشعة والوصفات السابقة
        </p>
        {derivedCount > 0 ? (
          <p>
            {data?.latestLabResults?.length ?? 0} تحليل ·{" "}
            {data?.latestRadiology?.length ?? 0} أشعة ·{" "}
            {data?.previousPrescriptions?.length ?? 0} وصفة — تُقرأ من سجلات المريض
            نفسها ولا تُكتب هنا.
          </p>
        ) : (
          <p>لا توجد نتائج أو وصفات مسجّلة لهذا المريض بعد.</p>
        )}
        {data?.treatingDoctorName ? (
          <p className="mt-1 flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden />
            الطبيب المعالج الحالي: {data.treatingDoctorName}
          </p>
        ) : null}
        {data?.updatedAt ? (
          <p className="mt-1">آخر تحديث للملف: {formatDate(data.updatedAt)}</p>
        ) : null}
      </div>
    </FormDialog>
  );
}
