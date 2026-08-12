"use client";

import { useCallback, useMemo, useState } from "react";
import { Droplets, Megaphone, Pencil } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import {
  PipelineStrip,
  StagePill,
  stageOptions,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة بنك الدم (req L433-443)
//
// Two things were wrong beyond the missing writes.
//
// The API includes `governorate` as an OBJECT, and the table rendered
// `{r.governorate}` directly — React throws "Objects are not valid as a React
// child" on that, so the page crashed outright as soon as one request had a
// governorate set.
//
// It also read `drawDate`; the column is `drawAppointment`, so the draw
// appointment — one of the eight fields the requirement names — was always "—".
//
// And the whole workflow (accept a donor, set the draw appointment, record the
// test and delivery status) is the employee's job, which the screen offered no
// way to do.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "new", label: "طلب جديد", tone: "info" },
  { key: "broadcast", label: "أُرسل للمتبرعين", tone: "warning" },
  { key: "matched", label: "تم إيجاد متبرع", tone: "warning" },
  { key: "fulfilled", label: "تم التسليم", tone: "positive" },
  { key: "cancelled", label: "ملغي", tone: "danger" },
];

const BLOOD_TYPE_LABELS: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  REQUESTER: "طالب دم",
  DONOR: "متبرع",
};

type BloodRequest = {
  id: string;
  requestType: string;
  fullName: string;
  phone: string;
  age: number | null;
  gender: string | null;
  residence: string | null;
  landmark: string | null;
  bloodType: string;
  operationType: string | null;
  bagsNeeded: number | null;
  operationPlace: string | null;
  status: string;
  broadcastAt: string | null;
  donorName: string | null;
  drawAppointment: string | null;
  testStatus: string | null;
  deliveryStatus: string | null;
  notes: string | null;
  createdAt: string;
  governorate: { id: string; name: string } | null;
};

type FormState = {
  status: string;
  donorName: string;
  drawAppointment: string;
  testStatus: string;
  deliveryStatus: string;
};

const EMPTY: FormState = {
  status: "new",
  donorName: "",
  drawAppointment: "",
  testStatus: "",
  deliveryStatus: "",
};

const statusOf = (r: BloodRequest) => r.status;

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" with no zone. */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

export default function BloodBankPage() {
  const { data, isLoading, error, refetch } = useDashboardData<BloodRequest[]>({
    url: "/api/blood-bank",
    params: { limit: "100" },
  });

  const [stage, setStage] = useState<string | null>(null);
  const [editing, setEditing] = useState<BloodRequest | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const counts = useStageCounts(data, STAGES, statusOf);

  const close = useCallback(() => {
    setEditing(null);
    setForm(EMPTY);
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async (id: string, body: Record<string, unknown>) =>
      apiFetch(`/api/blood-bank/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    { successMessage: "تم تحديث الطلب", onSuccess: done }
  );

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((r) => r.status === stage) : (data ?? [])),
    [data, stage]
  );

  const openEdit = useCallback((r: BloodRequest) => {
    setEditing(r);
    setForm({
      status: r.status,
      donorName: r.donorName ?? "",
      drawAppointment: toLocalInput(r.drawAppointment),
      testStatus: r.testStatus ?? "",
      deliveryStatus: r.deliveryStatus ?? "",
    });
  }, []);

  const columns: Column<BloodRequest>[] = useMemo(
    () => [
      {
        key: "requester",
        header: "مقدّم الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.fullName}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.phone}
            </p>
          </div>
        ),
        sortValue: (r) => r.fullName,
      },
      {
        key: "bloodType",
        header: "الزمرة",
        render: (r) => (
          <span className="inline-flex h-8 w-9 items-center justify-center rounded-full bg-red-500/10 text-sm font-bold text-red-600 dark:text-red-400">
            {BLOOD_TYPE_LABELS[r.bloodType] ?? r.bloodType}
          </span>
        ),
        sortValue: (r) => r.bloodType,
      },
      {
        key: "requestType",
        header: "النوع",
        render: (r) => (
          <div className="flex flex-wrap gap-1">
            <Pill tone={r.requestType === "REQUESTER" ? "danger" : "positive"}>
              {REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}
            </Pill>
            {r.bagsNeeded ? <Pill>{formatNumber(r.bagsNeeded)} كيس</Pill> : null}
          </div>
        ),
      },
      {
        key: "governorate",
        header: "المحافظة",
        secondary: true,
        // `.name`, not the object — this is the crash.
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.governorate?.name, r.residence].filter(Boolean).join(" - ") || "—"}
          </span>
        ),
        sortValue: (r) => r.governorate?.name ?? "",
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "donor",
        header: "المتبرع",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">{r.donorName || "لم يُقبل بعد"}</span>
        ),
      },
      {
        key: "drawAppointment",
        header: "موعد السحب",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {r.drawAppointment ? formatDateTime(r.drawAppointment) : "—"}
          </span>
        ),
        sortValue: (r) => (r.drawAppointment ? new Date(r.drawAppointment).getTime() : 0),
      },
      {
        key: "progress",
        header: "التحاليل / التسليم",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.testStatus || "—"} / {r.deliveryStatus || "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة بنك الدم"
        subtitle="طلبات الدم والمتبرعون — القبول، موعد السحب، التحاليل والتسليم"
        icon={Droplets}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.fullName} ${r.phone} ${r.donorName ?? ""} ${r.governorate?.name ?? ""} ${
            r.operationType ?? ""
          }`
        }
        searchPlaceholder="بحث بالاسم أو الهاتف أو المتبرع..."
        filters={[
          {
            key: "requestType",
            label: "الكل",
            options: [
              { value: "REQUESTER", label: "طالبو الدم" },
              { value: "DONOR", label: "المتبرعون" },
            ],
            match: (r, v) => r.requestType === v,
          },
          {
            key: "bloodType",
            label: "كل الزمر",
            options: Object.entries(BLOOD_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            match: (r, v) => r.bloodType === v,
          },
          {
            key: "status",
            label: "كل الحالات",
            options: stageOptions(STAGES),
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage={stage ? "لا توجد طلبات في هذه الحالة" : "لا توجد طلبات"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-0.5">
            {r.status === "new" ? (
              <button
                type="button"
                onClick={() => void save(r.id, { status: "broadcast" })}
                disabled={saving}
                aria-label={`إرسال طلب ${r.fullName} للمتبرعين`}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Megaphone size={12} aria-hidden />
                إرسال للمتبرعين
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openEdit(r)}
              aria-label={`تحديث طلب ${r.fullName}`}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil size={15} aria-hidden />
            </button>
          </div>
        )}
      />

      <FormDialog
        open={editing !== null}
        title="تحديث طلب الدم"
        description={
          editing
            ? `${editing.fullName} · ${BLOOD_TYPE_LABELS[editing.bloodType] ?? editing.bloodType}${
                editing.operationType ? ` · ${editing.operationType}` : ""
              }`
            : undefined
        }
        onClose={close}
        onSubmit={() => {
          if (!editing) return;
          void save(editing.id, {
            status: form.status,
            donorName: form.donorName.trim(),
            // "" clears the appointment — the endpoint accepts that explicitly.
            drawAppointment: form.drawAppointment
              ? new Date(form.drawAppointment).toISOString()
              : "",
            testStatus: form.testStatus.trim(),
            deliveryStatus: form.deliveryStatus.trim(),
          });
        }}
        isPending={saving}
      >
        <Field label="الحالة" htmlFor="bb-status">
          <select
            id="bb-status"
            className={fieldClass}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المتبرع المقبول" htmlFor="bb-donor" hint="اتركه فارغاً إن لم يُقبل متبرع بعد">
          <input
            id="bb-donor"
            className={fieldClass}
            value={form.donorName}
            onChange={(e) => setForm((f) => ({ ...f, donorName: e.target.value }))}
          />
        </Field>

        <Field label="موعد السحب" htmlFor="bb-draw">
          <input
            id="bb-draw"
            type="datetime-local"
            dir="ltr"
            className={fieldClass}
            value={form.drawAppointment}
            onChange={(e) => setForm((f) => ({ ...f, drawAppointment: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="حالة التحاليل" htmlFor="bb-test">
            <input
              id="bb-test"
              className={fieldClass}
              value={form.testStatus}
              onChange={(e) => setForm((f) => ({ ...f, testStatus: e.target.value }))}
              placeholder="مطابقة"
            />
          </Field>
          <Field label="حالة التسليم" htmlFor="bb-delivery">
            <input
              id="bb-delivery"
              className={fieldClass}
              value={form.deliveryStatus}
              onChange={(e) => setForm((f) => ({ ...f, deliveryStatus: e.target.value }))}
              placeholder="سُلّمت"
            />
          </Field>
        </div>
      </FormDialog>
    </div>
  );
}
