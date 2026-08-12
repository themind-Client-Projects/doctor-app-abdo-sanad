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
// الأشعة (req L465-472) — 5 مراحل
//
// The last stage was keyed "sent", but the stored value is "sent_to_doctor", so
// that counter read 0 no matter how many reports had been sent. The table also
// read `patientName`, `centerName`, `scheduledDate`, `hasReport` and `hasImages`
// — the real columns are the joined order, `centerId`, `appointmentDate`,
// `report` and the `images` array.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "scheduled", label: "الموعد", tone: "info" },
  { key: "imaged", label: "تم التصوير", tone: "info" },
  { key: "report_ready", label: "التقرير الطبي", tone: "warning" },
  { key: "images_attached", label: "الصور المرفقة", tone: "positive" },
  { key: "sent_to_doctor", label: "أُرسلت للطبيب", tone: "positive" },
];

type RadiologyRequest = {
  id: string;
  centerId: string;
  requestType: string;
  equipmentType: string | null;
  appointmentDate: string | null;
  status: string;
  report: string | null;
  images: string[];
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientPhone: string;
  } | null;
};

type Center = { id: string; name: string };

const statusOf = (r: RadiologyRequest) => r.status;

export default function RadiologyPage() {
  const { data, isLoading, error, refetch } = useDashboardData<RadiologyRequest[]>({
    url: "/api/radiology-requests",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const { data: centers } = useDashboardData<Center[]>({
    url: "/api/partners",
    params: { type: "RADIOLOGY", limit: "100" },
  });

  const centerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of centers ?? []) map.set(c.id, c.name);
    return map;
  }, [centers]);

  const [stage, setStage] = useState<string | null>(null);

  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/radiology-requests", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((r) => r.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<RadiologyRequest>[] = useMemo(
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
            <span className="text-xs text-muted-foreground">طلب بلا مريض مرتبط</span>
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
        key: "center",
        header: "المركز",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {centerNames.get(r.centerId) ?? r.centerId.slice(-8)}
          </span>
        ),
        sortValue: (r) => centerNames.get(r.centerId) ?? "",
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
          const imageCount = Array.isArray(r.images) ? r.images.length : 0;
          const hasReport = Boolean(r.report && r.report.trim());
          if (!hasReport && imageCount === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasReport ? (
                <span className="inline-flex items-center gap-1" title="التقرير الطبي جاهز">
                  <FileText size={12} aria-hidden />
                  تقرير
                </span>
              ) : null}
              {imageCount > 0 ? (
                <span className="inline-flex items-center gap-1" title={`${imageCount} صورة`}>
                  <ImageIcon size={12} aria-hidden />
                  {imageCount}
                </span>
              ) : null}
            </span>
          );
        },
      },
    ],
    [centerNames]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="الأشعة"
        subtitle="٥ مراحل — الموعد ثم التصوير ثم التقرير ثم الصور ثم الإرسال للطبيب"
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
          `${r.requestType} ${r.equipmentType ?? ""} ${r.order?.patientName ?? ""} ${
            r.order?.orderNumber ?? ""
          }`
        }
        searchPlaceholder="بحث بنوع الأشعة أو المريض أو رقم الطلب..."
        emptyMessage={stage ? "لا توجد طلبات في هذه المرحلة" : "لا توجد طلبات أشعة"}
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
