"use client";

import { useCallback, useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/crud-kit";
import {
  PipelineStrip,
  StageAdvance,
  StagePill,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المختبر (req L455-463) — 6 مراحل للعينة
//
// The table showed `sampleId`, `patientName`, `testType` and `labName`. None of
// the four is a column on LabSample, so all four printed empty on every row —
// the model has `sampleType`, `labId`, `orderId` and `status`. The patient now
// comes from the joined order, and the lab name from the partner directory.
//
// The pipeline strip was also decorative: six counters an employee could not
// click, above a table with no way to move a sample forward.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "received", label: "استلمت", tone: "info" },
  { key: "in_lab", label: "وصلت المختبر", tone: "info" },
  { key: "testing", label: "قيد الفحص", tone: "warning" },
  { key: "ready", label: "النتيجة جاهزة", tone: "positive" },
  { key: "sent_to_doctor", label: "أرسلت للطبيب", tone: "positive" },
  { key: "sent_to_patient", label: "أرسلت للمريض", tone: "positive" },
];

type Sample = {
  id: string;
  labId: string;
  sampleType: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientPhone: string;
  } | null;
};

type Lab = { id: string; name: string };

const statusOf = (s: Sample) => s.status;

export default function LabPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Sample[]>({
    url: "/api/lab-samples",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  // `LabSample.labId` has no Prisma relation, so the name cannot be joined —
  // one directory read and a lookup instead of a name per row.
  const { data: labs } = useDashboardData<Lab[]>({
    url: "/api/partners",
    params: { type: "LAB", limit: "100" },
  });

  const labNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of labs ?? []) map.set(l.id, l.name);
    return map;
  }, [labs]);

  const [stage, setStage] = useState<string | null>(null);

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
            // A sample can be walked in without an order — say so rather than
            // printing an empty cell.
            <span className="text-xs text-muted-foreground">عينة بلا طلب</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "lab",
        header: "المختبر",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {labNames.get(r.labId) ?? r.labId.slice(-8)}
          </span>
        ),
        sortValue: (r) => labNames.get(r.labId) ?? "",
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
    [labNames]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="المختبر"
        subtitle="٦ مراحل للعينة — من الاستلام حتى إرسال النتيجة للمريض"
        icon={FlaskConical}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.sampleType} ${r.order?.patientName ?? ""} ${r.order?.orderNumber ?? ""} ${
            r.order?.patientPhone ?? ""
          }`
        }
        searchPlaceholder="بحث بنوع العينة أو المريض أو رقم الطلب..."
        emptyMessage={stage ? "لا توجد عينات في هذه المرحلة" : "لا توجد عينات"}
        actions={(r) => (
          <StageAdvance
            stages={STAGES}
            current={r.status}
            onAdvance={(next) => void advance(r.id, next)}
            disabled={isPending}
            label={`عينة ${r.sampleType}`}
          />
        )}
      />
    </div>
  );
}
