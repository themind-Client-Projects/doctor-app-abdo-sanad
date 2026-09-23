"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { useRole } from "@/hooks/use-role";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مواعيدي — the doctor's appointment book.
//
// Two defects made this page unusable for every doctor on the platform:
//
//  1. It asked `/api/v1/me` for its own identity. That is the PATIENT endpoint;
//     it returns `id, name, phone, email, image, role, governorateId, area` and
//     no doctor profile — so `doctorId` was permanently null and the page
//     rendered "لا ملف طبيب مرتبط بحسابك" to doctors who had one. The identity
//     is in the session (`useRole().doctorProfileId`), and the LIST endpoint
//     scopes itself with `appointmentScope(identity)` anyway, so the `?doctorId=`
//     round trip bought nothing but the bug.
//
//  2. It was read-only. `PATCH /api/appointments/[id]` has always accepted
//     status, date, time and notes, and nothing on screen could send one — a
//     doctor could not mark a patient seen, record a no-show, cancel, or move
//     an appointment.
//
// The statuses here are the API's own vocabulary — `scheduled | completed |
// cancelled | no_show`.
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  scheduled: "مجدول",
  completed: "مكتمل",
  cancelled: "ملغي",
  no_show: "لم يحضر",
};

const TONE: Record<string, "positive" | "warning" | "danger" | "neutral"> = {
  scheduled: "warning",
  completed: "positive",
  cancelled: "danger",
  no_show: "danger",
};

const TYPE_LABELS: Record<string, string> = {
  IN_PERSON: "حضوري",
  ONLINE: "أونلاين",
  HOME_VISIT: "زيارة منزلية",
  SURGERY: "عملية",
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  notes: string | null;
  patientId: string;
  patient: { id: string; name: string | null; phone: string | null } | null;
};

/** `2026-09-23T00:00:00.000Z` → `2026-09-23`, for `<input type="date">`. */
const dateInputValue = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export default function AppointmentsPage() {
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const { role, doctorProfileId, isLoading: roleLoading } = useRole();

  // No `?doctorId=` — `appointmentScope` pins a doctor to their own book
  // server-side, and a client-supplied filter can only ever narrow within it.
  const { data, isLoading, error, refetch } = useDashboardData<Appointment[]>({
    url: "/api/appointments",
    params: { limit: "100" },
    refreshInterval: 60_000,
  });

  const refresh = useCallback(() => void refetch(), [refetch]);

  const { mutate: save, isPending } = useMutation(
    async (id: string, patch: Record<string, unknown>) =>
      apiFetch(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    { successMessage: "تم تحديث الموعد", onSuccess: refresh }
  );

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!upcomingOnly) return all;
    const now = Date.now();
    return all.filter((a) => new Date(a.date).getTime() >= now && a.status === "scheduled");
  }, [data, upcomingOnly]);

  const columns: Column<Appointment>[] = useMemo(
    () => [
      {
        key: "patient",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {r.patient?.name ?? "حساب غير متاح"}
            </p>
            {r.patient?.phone ? (
              <a
                href={`tel:${r.patient.phone}`}
                className="truncate text-xs text-primary hover:underline"
                dir="ltr"
              >
                {r.patient.phone}
              </a>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.patient?.name ?? "",
      },
      {
        key: "date",
        header: "التاريخ",
        render: (r) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium text-foreground">{formatDate(r.date)}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {r.time}
            </p>
          </div>
        ),
        sortValue: (r) => new Date(r.date).getTime(),
      },
      {
        key: "type",
        header: "النوع",
        secondary: true,
        render: (r) => <span className="text-foreground">{TYPE_LABELS[r.type] ?? r.type}</span>,
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={TONE[r.status] ?? "neutral"}>{STATUS_LABELS[r.status] ?? r.status}</Pill>
        ),
      },
    ],
    []
  );

  // A doctor account with no DoctorProfile really cannot have a book — but say
  // so only once the session has actually loaded, not while it is still null.
  if (!roleLoading && role === "DOCTOR" && !doctorProfileId) {
    return (
      <div className="space-y-5">
        <PageHeader title="مواعيدي" subtitle="دفتر مواعيدك" icon={CalendarDays} />
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          لا ملف طبيب مرتبط بحسابك — راجع الإدارة لربط حسابك بملفك الطبي.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مواعيدي"
        subtitle={upcomingOnly ? "المواعيد القادمة فقط" : "كل المواعيد"}
        icon={CalendarDays}
        action={{
          label: upcomingOnly ? "إظهار الكل" : "القادمة فقط",
          onClick: () => setUpcomingOnly((v) => !v),
        }}
      />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading || roleLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.patient?.name ?? ""} ${r.patient?.phone ?? ""} ${r.time} ${
            STATUS_LABELS[r.status] ?? r.status
          }`
        }
        searchPlaceholder="بحث بالمريض أو الوقت أو الحالة..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage={upcomingOnly ? "لا مواعيد قادمة" : "لا مواعيد بعد"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1.5">
            {/* The two outcomes a clinic records dozens of times a day get a
                button each; everything else is behind إدارة. */}
            {r.status === "scheduled" ? (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void save(r.id, { status: "completed" })}
                  className="whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                >
                  تم الكشف
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void save(r.id, { status: "no_show" })}
                  className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
                >
                  لم يحضر
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(r)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              إدارة
            </button>
          </div>
        )}
      />

      <ManageDialog
        appointment={editing}
        isPending={isPending}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          void save(editing.id, patch).then((result) => {
            if (result) setEditing(null);
          });
        }}
      />
    </div>
  );
}

/* ------------------------------- إدارة الموعد ------------------------------ */

/**
 * Reschedule, change the outcome, or write a clinical note.
 *
 * One dialog rather than four, because the server takes them in one PATCH and
 * a doctor moving an appointment usually annotates it in the same breath.
 * Keyed on the appointment id so reopening it on a different row cannot show
 * the previous row's edits.
 */
function ManageDialog({
  appointment,
  isPending,
  onClose,
  onSave,
}: {
  appointment: Appointment | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  if (!appointment) return null;
  return (
    <ManageForm
      key={appointment.id}
      appointment={appointment}
      isPending={isPending}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function ManageForm({
  appointment,
  isPending,
  onClose,
  onSave,
}: {
  appointment: Appointment;
  isPending: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState(appointment.status);
  const [date, setDate] = useState(dateInputValue(appointment.date));
  const [time, setTime] = useState(appointment.time);
  const [notes, setNotes] = useState(appointment.notes ?? "");

  const submit = () => {
    // Only what actually changed. `.strict()` accepts the extra keys, but
    // sending an unchanged `date` would still bump `updatedAt` and make the
    // audit trail claim a reschedule that never happened.
    const patch: Record<string, unknown> = {};
    if (status !== appointment.status) patch.status = status;
    if (date && date !== dateInputValue(appointment.date)) patch.date = date;
    if (time.trim() && time.trim() !== appointment.time) patch.time = time.trim();
    if (notes !== (appointment.notes ?? "")) patch.notes = notes;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    onSave(patch);
  };

  return (
    <FormDialog
      open
      title="إدارة الموعد"
      description={appointment.patient?.name ?? "المريض غير متاح"}
      onClose={onClose}
      onSubmit={submit}
      isPending={isPending}
      submitLabel="حفظ التغييرات"
    >
      <Field label="الحالة" htmlFor="ap-status">
        <select
          id="ap-status"
          className={fieldClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="التاريخ" htmlFor="ap-date">
          <input
            id="ap-date"
            type="date"
            className={fieldClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="الوقت" htmlFor="ap-time" hint="مثال: 09:30">
          <input
            id="ap-time"
            type="time"
            className={fieldClass}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            dir="ltr"
          />
        </Field>
      </div>

      <Field label="ملاحظات" htmlFor="ap-notes" hint="اختياري — تُحفظ على الموعد">
        <textarea
          id="ap-notes"
          className={`${fieldClass} h-24 py-2.5`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />
      </Field>
    </FormDialog>
  );
}
