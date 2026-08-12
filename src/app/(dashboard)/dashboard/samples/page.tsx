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
// عينات المختبر — the lab's own worklist.
//
// This called `/api/dashboard/samples`, a route that was never built, so the
// page showed a permanent skeleton. `/api/lab-samples` has existed all along
// and is already scoped to the caller's lab by `partnerScope`, which is exactly
// what this screen needs — a lab must see its own samples and no one else's.
//
// It also read `patientName` straight off the sample. `LabSample` has no such
// column; the patient is on the joined order.
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
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientPhone: string;
  } | null;
};

const statusOf = (s: Sample) => s.status;

export default function LabSamplesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Sample[]>({
    url: "/api/lab-samples",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

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
            <span className="text-xs text-muted-foreground">عينة بلا طلب</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
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
