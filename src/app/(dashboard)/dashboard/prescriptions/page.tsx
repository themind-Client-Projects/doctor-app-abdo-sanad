"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pill as PillIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { useRole } from "@/hooks/use-role";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader } from "@/components/data/crud-kit";
import { SearchableSelect } from "@/components/data/searchable-select";
import {
  BLANK_MEDICATION,
  MedicationList,
  MedicationRows,
  medicationsComplete,
  normalizeMedications,
  readMedications,
  type Medication,
} from "@/components/features/clinical/medication-rows";
import {
  PipelineStrip,
  StageAdvance,
  StagePill,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الوصفات — one screen, two jobs, because two roles link to this URL.
//
//   • الصيدلية dispenses. It had a ladder and a COUNT of drugs — the one screen
//     whose whole purpose is handing over the right medicine could not see
//     which medicine it was, and had nowhere to record who dispensed it. The
//     server has taken `pharmacistName` all along and stamps `dispensedAt`
//     from the status itself.
//
//   • الطبيب prescribes — and could not. Writing a prescription is a DOCTOR's
//     act and the doctor's menu links here, but the page was the pharmacy
//     queue: a doctor opening it saw an empty list and no way to write one.
//
// The patient picker is "مرضاي" (`/api/dashboard/patients`), which is derived
// from exactly the sources `resolvePatientForCaller` accepts. That is
// deliberate: the create endpoint refuses a patient the doctor has no booking,
// appointment or referral with, so a picker fed from anywhere else would offer
// people the server then rejects.
//
// Routing to a pharmacy is NOT offered here. `/api/partners` is
// operations-only, and a doctor's prescription reaches a pharmacy either
// through the referral flow inside a complex or through العمليات — adding a
// partner directory to the doctor's screen would widen who can enumerate the
// platform's partners just to fill a dropdown.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "new", label: "الوصفة استلمت", tone: "info" },
  { key: "preparing", label: "قيد التجهيز", tone: "warning" },
  { key: "ready", label: "جاهزة للتوصيل", tone: "positive" },
  { key: "delivered", label: "تم التوصيل", tone: "positive" },
  { key: "returned", label: "المرتجعات", tone: "danger" },
];

type Prescription = {
  id: string;
  status: string;
  notes: string | null;
  medications: unknown;
  createdAt: string;
  expiresAt: string | null;
  pharmacistName: string | null;
  dispensedAt: string | null;
  patientId: string;
  patient: { id: string; name: string | null; phone: string | null } | null;
  order: { orderNumber: string; patientName: string; patientPhone: string } | null;
};

type MyPatient = { id: string; name: string | null; phone: string | null };

const statusOf = (p: Prescription) => p.status;

/** The order's details beat the account's — they are what was given at booking. */
function patientOf(p: Prescription): { name: string; phone: string | null } {
  if (p.order) return { name: p.order.patientName, phone: p.order.patientPhone };
  if (p.patient?.name) return { name: p.patient.name, phone: p.patient.phone };
  return { name: "مريض غير متاح", phone: null };
}

const isExpired = (p: Prescription) =>
  p.expiresAt !== null && new Date(p.expiresAt).getTime() < Date.now();

// `?new=1` opens the prescription form on arrival — the doctor's home page
// shortcut lands here. `useSearchParams` suspends, hence the boundary.
export default function PrescriptionsPage() {
  return (
    <Suspense fallback={null}>
      <PrescriptionsScreen />
    </Suspense>
  );
}

function PrescriptionsScreen() {
  const { role, isLoading: roleLoading } = useRole();
  const openNew = useSearchParams().get("new") === "1";
  const isDoctor = role === "DOCTOR";

  const { data, isLoading, error, refetch } = useDashboardData<Prescription[]>({
    url: "/api/prescriptions",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const [stage, setStage] = useState<string | null>(null);
  const [writing, setWriting] = useState(openNew);
  const [viewing, setViewing] = useState<Prescription | null>(null);
  const [dispensing, setDispensing] = useState<Prescription | null>(null);

  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/prescriptions", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((p) => p.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<Prescription>[] = useMemo(
    () => [
      {
        key: "prescription",
        header: "الوصفة",
        render: (r) => (
          <div className="min-w-0">
            <span className="font-mono text-sm font-medium text-primary" dir="ltr">
              #{r.id.slice(-8)}
            </span>
            {isExpired(r) ? (
              <p className="text-xs font-medium text-destructive">منتهية الصلاحية</p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.id,
      },
      {
        key: "patient",
        header: "المريض",
        render: (r) => {
          const p = patientOf(r);
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{p.name}</p>
              {p.phone ? (
                <a
                  href={`tel:${p.phone}`}
                  className="truncate text-xs text-primary hover:underline"
                  dir="ltr"
                >
                  {p.phone}
                </a>
              ) : null}
            </div>
          );
        },
        sortValue: (r) => patientOf(r).name,
      },
      {
        key: "medications",
        header: "الأدوية",
        align: "end",
        render: (r) => formatNumber(readMedications(r.medications).length),
        sortValue: (r) => readMedications(r.medications).length,
      },
      {
        key: "status",
        header: "المرحلة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "createdAt",
        header: "التاريخ",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(r.createdAt)}
          </span>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={isDoctor ? "وصفاتي" : "الوصفات"}
        subtitle={
          isDoctor
            ? "الوصفات التي كتبتها — ومتابعة صرفها"
            : "وصفات صيدليتك — من الاستلام حتى التوصيل"
        }
        icon={PillIcon}
        action={isDoctor ? { label: "وصفة جديدة", onClick: () => setWriting(true) } : undefined}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading || roleLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.id} ${patientOf(r).name} ${r.notes ?? ""}`}
        searchPlaceholder="بحث برقم الوصفة أو المريض..."
        emptyMessage={
          stage
            ? "لا وصفات في هذه المرحلة"
            : isDoctor
              ? "لم تكتب وصفات بعد"
              : "لا وصفات بعد"
        }
        actions={(r) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setViewing(r)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              الأدوية
            </button>
            {/* Moving a prescription along the dispensing ladder is the
                pharmacy's act. A doctor watching their own prescription gets
                no ladder at all rather than a row of buttons that answer 403. */}
            {isDoctor ? null : r.status === "ready" ? (
              // Handing the medicine over is not just the next rung: it records
              // WHO dispensed it. The generic advance would set the status and
              // leave the pharmacist unnamed.
              <button
                type="button"
                onClick={() => setDispensing(r)}
                className="whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                تم الصرف
              </button>
            ) : (
              <StageAdvance
                stages={STAGES}
                current={r.status}
                onAdvance={(next) => void advance(r.id, next)}
                disabled={isPending}
                label={`وصفة ${r.id.slice(-8)}`}
              />
            )}
          </div>
        )}
      />

      {writing ? (
        <WriteDialog
          onClose={() => setWriting(false)}
          onDone={() => {
            setWriting(false);
            refresh();
          }}
        />
      ) : null}

      <ViewDialog prescription={viewing} onClose={() => setViewing(null)} />

      {dispensing ? (
        <DispenseDialog
          prescription={dispensing}
          onClose={() => setDispensing(null)}
          onDone={() => {
            setDispensing(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ وصفة جديدة -------------------------------- */

function WriteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { doctorProfileId } = useRole();
  const [patientId, setPatientId] = useState("");
  const [meds, setMeds] = useState<Medication[]>([{ ...BLANK_MEDICATION }]);
  const [notes, setNotes] = useState("");

  const { data: patients, isLoading: patientsLoading } = useDashboardData<MyPatient[]>({
    url: "/api/dashboard/patients",
  });

  const options = useMemo(
    () =>
      (patients ?? []).map((p) => ({
        value: p.id,
        label: p.name ?? "مريض بلا اسم",
        hint: p.phone ?? undefined,
      })),
    [patients]
  );

  const { mutate: create, isPending } = useMutation(
    async () =>
      apiFetch("/api/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          // The server overrides this with the session's own doctor profile —
          // it is sent because the schema requires the field, never trusted.
          doctorId: doctorProfileId ?? "",
          patientId,
          medications: normalizeMedications(meds),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      }),
    { successMessage: "تم إصدار الوصفة", onSuccess: onDone }
  );

  const ready = patientId !== "" && medicationsComplete(meds);

  return (
    <FormDialog
      open
      title="وصفة جديدة"
      description="صالحة ٣٠ يوماً من تاريخ الإصدار"
      onClose={onClose}
      onSubmit={() => void create()}
      isPending={isPending}
      submitDisabled={!ready}
      submitLabel="إصدار الوصفة"
    >
      <Field
        label="المريض"
        htmlFor="rx-patient"
        hint="من مرضاك — حجز أو موعد أو إحالة معك"
      >
        <SearchableSelect
          id="rx-patient"
          value={patientId}
          options={options}
          onChange={setPatientId}
          placeholder={patientsLoading ? "جارِ التحميل..." : "— اختر مريضاً —"}
          searchPlaceholder="ابحث بالاسم أو الهاتف..."
          emptyMessage="لا مرضى مرتبطين بك بعد"
          disabled={patientsLoading}
        />
      </Field>

      <MedicationRows value={meds} onChange={setMeds} disabled={isPending} />

      <Field label="ملاحظات" htmlFor="rx-notes" hint="اختياري — تُطبع على الوصفة">
        <textarea
          id="rx-notes"
          className={`${fieldClass} h-20 py-2.5`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
        />
      </Field>
    </FormDialog>
  );
}

/* -------------------------------- الأدوية --------------------------------- */

function ViewDialog({
  prescription,
  onClose,
}: {
  prescription: Prescription | null;
  onClose: () => void;
}) {
  if (!prescription) return null;
  const patient = patientOf(prescription);

  return (
    <FormDialog
      open
      readOnly
      title={`وصفة #${prescription.id.slice(-8)}`}
      description={patient.name}
      onClose={onClose}
      onSubmit={onClose}
    >
      {isExpired(prescription) ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          انتهت صلاحية هذه الوصفة — لا يمكن صرفها، يلزم إصدار وصفة جديدة.
        </p>
      ) : null}

      <MedicationList value={readMedications(prescription.medications)} />

      {prescription.notes ? (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-foreground">ملاحظات الطبيب</p>
          <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
            {prescription.notes}
          </p>
        </div>
      ) : null}

      {prescription.dispensedAt ? (
        <p className="text-xs text-muted-foreground">
          صُرفت في {formatDateTime(prescription.dispensedAt)}
          {prescription.pharmacistName ? ` — ${prescription.pharmacistName}` : ""}
        </p>
      ) : null}
    </FormDialog>
  );
}

/* ------------------------------- تم الصرف --------------------------------- */

/**
 * "تم صرف الأدوية" on the printed form is a box somebody signs, so the record
 * has to carry a name. `dispensedAt` and `dispensedById` are stamped by the
 * server from this status change — never sent from here.
 */
function DispenseDialog({
  prescription,
  onClose,
  onDone,
}: {
  prescription: Prescription;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pharmacistName, setPharmacistName] = useState(prescription.pharmacistName ?? "");

  const { mutate: dispense, isPending } = useMutation(
    async () =>
      apiFetch(`/api/prescriptions/${prescription.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "delivered", pharmacistName: pharmacistName.trim() }),
      }),
    { successMessage: "تم تسجيل الصرف", onSuccess: onDone }
  );

  const expired = isExpired(prescription);

  return (
    <FormDialog
      open
      title="تسجيل الصرف"
      description={patientOf(prescription).name}
      onClose={onClose}
      onSubmit={() => void dispense()}
      isPending={isPending}
      submitDisabled={expired || pharmacistName.trim().length < 2}
      submitLabel="تأكيد الصرف"
    >
      {expired ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          انتهت صلاحية الوصفة — الصرف مرفوض، يلزم إصدار وصفة جديدة.
        </p>
      ) : null}

      <MedicationList value={readMedications(prescription.medications)} />

      <Field label="اسم الصيدلي" htmlFor="rx-pharmacist" hint="يُسجَّل على الوصفة">
        <input
          id="rx-pharmacist"
          className={fieldClass}
          value={pharmacistName}
          onChange={(e) => setPharmacistName(e.target.value)}
          maxLength={120}
          placeholder="الاسم الكامل"
        />
      </Field>
    </FormDialog>
  );
}
