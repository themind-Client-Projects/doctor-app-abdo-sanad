"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { useRole } from "@/hooks/use-role";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader } from "@/components/data/crud-kit";
import { SearchableSelect } from "@/components/data/searchable-select";
import {
  ResultRows,
  readResults,
  resultsComplete,
  toResultsObject,
  type ResultRow,
} from "@/components/features/clinical/result-rows";
import {
  PipelineStrip,
  StageAdvance,
  StagePill,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// عينات المختبر — the lab's own worklist.
//
// The queue and its ladder worked. The two things a lab actually does did not:
//
//  1. **استلام عينة.** `POST /api/lab-samples` has always existed and pins the
//     sample to the caller's own lab from the session — nothing on screen could
//     call it, so a lab's worklist could only ever contain rows somebody else
//     had created. Walk-ins were unrecordable.
//
//  2. **تسجيل النتيجة.** `results` is a Json column on the sample and the PATCH
//     endpoint takes it. The screen could move a sample to "النتيجة جاهزة"
//     while the result itself existed nowhere — a stage that asserted a finding
//     the record did not hold.
//
// The order picker offers only the lab's OWN assigned orders (`/api/orders` is
// scoped by `orderScopeFor`), and `orderId` stays optional so a walk-in with no
// order is still recordable.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "received", label: "استلمت", tone: "info" },
  { key: "in_lab", label: "وصلت المختبر", tone: "info" },
  { key: "testing", label: "قيد الفحص", tone: "warning" },
  { key: "ready", label: "النتيجة جاهزة", tone: "positive" },
  { key: "sent_to_doctor", label: "أُرسلت للطبيب", tone: "positive" },
  { key: "sent_to_patient", label: "أُرسلت للمريض", tone: "positive" },
];

type Sample = {
  id: string;
  sampleType: string;
  status: string;
  results: unknown;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientPhone: string;
  } | null;
};

type OpenOrder = {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
};

/** Assigned but not finished — what the lab is actually holding right now. */
const OPEN_ORDER_STATUSES = "ASSIGNED,IN_TRANSIT,ARRIVED,IN_PROGRESS";

const statusOf = (s: Sample) => s.status;

// `?new=1` opens the intake form on arrival — the home page's "استلام عينة"
// shortcut lands here. `useSearchParams` suspends, hence the boundary.
export default function LabSamplesPage() {
  return (
    <Suspense fallback={null}>
      <SamplesScreen />
    </Suspense>
  );
}

function SamplesScreen() {
  const { partnerId } = useRole();
  const openNew = useSearchParams().get("new") === "1";

  const { data, isLoading, error, refetch } = useDashboardData<Sample[]>({
    url: "/api/lab-samples",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const [stage, setStage] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(openNew);
  const [recording, setRecording] = useState<Sample | null>(null);

  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/lab-samples", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((s) => s.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<Sample>[] = useMemo(
    () => [
      {
        key: "sample",
        header: "العينة",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.sampleType}</p>
            <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
              {r.id.slice(-8)}
            </p>
          </div>
        ),
        sortValue: (r) => r.sampleType,
      },
      {
        key: "patient",
        header: "المريض",
        render: (r) =>
          r.order ? (
            <div className="min-w-0">
              <p className="truncate text-foreground">{r.order.patientName}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                #{r.order.orderNumber.slice(-8)}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">عينة بلا طلب</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "results",
        header: "النتيجة",
        align: "end",
        render: (r) => {
          const count = readResults(r.results).length;
          return count > 0 ? (
            <span className="whitespace-nowrap text-xs text-foreground">{count} قياس</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
        sortValue: (r) => readResults(r.results).length,
      },
      {
        key: "status",
        header: "المرحلة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "createdAt",
        header: "الاستلام",
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
        title="عينات المختبر"
        subtitle="عيناتك أنت — من الاستلام حتى إرسال النتيجة"
        icon={FlaskConical}
        action={{ label: "استلام عينة", onClick: () => setReceiving(true) }}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.sampleType} ${r.order?.patientName ?? ""} ${r.order?.orderNumber ?? ""}`
        }
        searchPlaceholder="بحث بنوع العينة أو المريض..."
        emptyMessage={stage ? "لا عينات في هذه المرحلة" : "لا عينات بعد"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setRecording(r)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              النتيجة
            </button>
            <StageAdvance
              stages={STAGES}
              current={r.status}
              onAdvance={(next) => void advance(r.id, next)}
              disabled={isPending}
              label={`عينة ${r.sampleType}`}
            />
          </div>
        )}
      />

      {receiving ? (
        <ReceiveDialog
          labId={partnerId}
          onClose={() => setReceiving(false)}
          onDone={() => {
            setReceiving(false);
            refresh();
          }}
        />
      ) : null}

      {recording ? (
        <ResultDialog
          key={recording.id}
          sample={recording}
          onClose={() => setRecording(null)}
          onDone={() => {
            setRecording(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ استلام عينة ------------------------------- */

function ReceiveDialog({
  labId,
  onClose,
  onDone,
}: {
  labId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sampleType, setSampleType] = useState("");
  const [orderId, setOrderId] = useState("");

  const { data: orders, isLoading } = useDashboardData<OpenOrder[]>({
    url: "/api/orders",
    params: { limit: "100", status: OPEN_ORDER_STATUSES },
  });

  const options = useMemo(
    () =>
      (orders ?? []).map((o) => ({
        value: o.id,
        label: o.patientName,
        hint: `#${o.orderNumber.slice(-8)} — ${o.patientPhone}`,
      })),
    [orders]
  );

  const { mutate: create, isPending } = useMutation(
    async () =>
      apiFetch("/api/lab-samples", {
        method: "POST",
        body: JSON.stringify({
          // Overridden server-side by the session's own partner — sent because
          // the schema requires the field, never trusted.
          labId: labId ?? "",
          sampleType: sampleType.trim(),
          ...(orderId ? { orderId } : {}),
        }),
      }),
    { successMessage: "تم تسجيل استلام العينة", onSuccess: onDone }
  );

  return (
    <FormDialog
      open
      title="استلام عينة"
      description="تُسجَّل باسم مختبرك، وتدخل الطابور في مرحلة «استلمت»"
      onClose={onClose}
      onSubmit={() => void create()}
      isPending={isPending}
      submitDisabled={sampleType.trim() === ""}
      submitLabel="تسجيل الاستلام"
    >
      <Field label="نوع العينة" htmlFor="ls-type" hint="مثال: دم وريدي — CBC">
        <input
          id="ls-type"
          className={fieldClass}
          value={sampleType}
          onChange={(e) => setSampleType(e.target.value)}
          maxLength={160}
          placeholder="نوع العينة أو الفحص"
        />
      </Field>

      <Field
        label="الطلب المرتبط"
        htmlFor="ls-order"
        hint="اختياري — اتركه فارغاً لعيّنة حضورية بلا طلب"
      >
        <SearchableSelect
          id="ls-order"
          value={orderId}
          options={options}
          onChange={setOrderId}
          placeholder={isLoading ? "جارِ التحميل..." : "— بلا طلب —"}
          searchPlaceholder="ابحث بالمريض أو رقم الطلب..."
          emptyMessage="لا طلبات مسندة إليك حالياً"
          disabled={isLoading}
        />
      </Field>
    </FormDialog>
  );
}

/* ----------------------------- تسجيل النتيجة ------------------------------ */

function ResultDialog({
  sample,
  onClose,
  onDone,
}: {
  sample: Sample;
  onClose: () => void;
  onDone: () => void;
}) {
  const existing = useMemo(() => readResults(sample.results), [sample.results]);
  const [rows, setRows] = useState<ResultRow[]>(
    existing.length > 0 ? existing : [{ name: "", value: "" }]
  );
  /** Publishing is the point of recording — offered, not forced. */
  const [markReady, setMarkReady] = useState(sample.status !== "ready");

  const { mutate: save, isPending } = useMutation<
    { order?: { advanced: boolean; reason: string | null } | null },
    []
  >(
    async () =>
      apiFetch(`/api/lab-samples/${sample.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          results: toResultsObject(rows),
          ...(markReady ? { status: "ready" } : {}),
        }),
      }),
    {
      successMessage: "تم حفظ النتيجة",
      onSuccess: onDone,
    }
  );

  return (
    <FormDialog
      open
      title="نتيجة الفحص"
      description={sample.order ? sample.order.patientName : sample.sampleType}
      onClose={onClose}
      onSubmit={() => void save()}
      isPending={isPending}
      submitDisabled={!resultsComplete(rows)}
      submitLabel="حفظ النتيجة"
    >
      <ResultRows value={rows} onChange={setRows} disabled={isPending} />

      {sample.status !== "ready" ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={markReady}
            onChange={(e) => setMarkReady(e.target.checked)}
          />
          نقل العينة إلى «النتيجة جاهزة» وإعلام الطلب المرتبط
        </label>
      ) : null}
    </FormDialog>
  );
}
