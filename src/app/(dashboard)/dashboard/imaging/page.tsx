"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, ImageIcon, ScanLine } from "lucide-react";
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
// طلبات الأشعة — the centre's own worklist.
//
// Called `/api/dashboard/imaging`, which does not exist.
// `/api/radiology-requests` does, and is already scoped to the caller's centre.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "scheduled", label: "الموعد", tone: "info" },
  { key: "imaged", label: "تم التصوير", tone: "info" },
  { key: "report_ready", label: "التقرير الطبي", tone: "warning" },
  { key: "images_attached", label: "الصور المرفقة", tone: "positive" },
  { key: "sent_to_doctor", label: "أُرسلت للطبيب", tone: "positive" },
];

type Request = {
  id: string;
  requestType: string;
  equipmentType: string | null;
  appointmentDate: string | null;
  status: string;
  report: string | null;
  images: string[];
  order: { orderNumber: string; patientName: string } | null;
};

const statusOf = (r: Request) => r.status;

export default function ImagingPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Request[]>({
    url: "/api/radiology-requests",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const [stage, setStage] = useState<string | null>(null);
  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/radiology-requests", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((r) => r.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<Request>[] = useMemo(
    () => [
      {
        key: "patient",
        header: "المريض",
        render: (r) =>
          r.order ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.order.patientName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                #{r.order.orderNumber.slice(-8)}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">بلا طلب مرتبط</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "requestType",
        header: "نوع الأشعة",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.requestType}</p>
            {r.equipmentType ? (
              <p className="truncate text-xs text-muted-foreground">{r.equipmentType}</p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.requestType,
      },
      {
        key: "appointmentDate",
        header: "الموعد",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {r.appointmentDate ? formatDateTime(r.appointmentDate) : "بلا موعد"}
          </span>
        ),
        sortValue: (r) => (r.appointmentDate ? new Date(r.appointmentDate).getTime() : 0),
      },
      {
        key: "status",
        header: "المرحلة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "attachments",
        header: "المرفقات",
        secondary: true,
        render: (r) => {
          const images = Array.isArray(r.images) ? r.images.length : 0;
          const hasReport = Boolean(r.report && r.report.trim());
          if (!hasReport && images === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasReport ? (
                <span className="inline-flex items-center gap-1">
                  <FileText size={12} aria-hidden />
                  تقرير
                </span>
              ) : null}
              {images > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon size={12} aria-hidden />
                  {images}
                </span>
              ) : null}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="طلبات الأشعة"
        subtitle="طلبات مركزك — من الموعد حتى إرسال التقرير"
        icon={ScanLine}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.requestType} ${r.equipmentType ?? ""} ${r.order?.patientName ?? ""}`
        }
        searchPlaceholder="بحث بنوع الأشعة أو المريض..."
        emptyMessage={stage ? "لا طلبات في هذه المرحلة" : "لا طلبات أشعة بعد"}
        actions={(r) => (
          <StageAdvance
            stages={STAGES}
            current={r.status}
            onAdvance={(next) => void advance(r.id, next)}
            disabled={isPending}
            label={`أشعة ${r.requestType}`}
          />
        )}
      />
    </div>
  );
}
