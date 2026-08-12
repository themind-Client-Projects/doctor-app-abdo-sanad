"use client";

import { useCallback, useMemo, useState } from "react";
import { Pill as PillIcon } from "lucide-react";
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
import { formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الوصفات — the pharmacy's own queue.
//
// Called `/api/dashboard/prescriptions`, which does not exist.
// `/api/prescriptions` does, and is scoped to the caller's pharmacy.
//
// The page also read `doctorName` and a `medications` STRING. Prescription has
// `doctorId` and a `medications` Json ARRAY, so both rendered empty.
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
  order: { orderNumber: string; patientName: string; patientPhone: string } | null;
};

const statusOf = (p: Prescription) => p.status;

/** `medications` is a Json column — a malformed row must not break the table. */
const medCount = (meds: unknown) => (Array.isArray(meds) ? meds.length : 0);

export default function PharmacyPrescriptionsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Prescription[]>({
    url: "/api/prescriptions",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const [stage, setStage] = useState<string | null>(null);
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
          <span className="font-mono text-sm font-medium text-primary" dir="ltr">
            #{r.id.slice(-8)}
          </span>
        ),
        sortValue: (r) => r.id,
      },
      {
        key: "patient",
        header: "المريض",
        render: (r) =>
          r.order ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.order.patientName}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {r.order.patientPhone}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">بلا طلب مرتبط</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "medications",
        header: "الأدوية",
        align: "end",
        render: (r) => formatNumber(medCount(r.medications)),
        sortValue: (r) => medCount(r.medications),
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
        title="الوصفات"
        subtitle="وصفات صيدليتك — من الاستلام حتى التوصيل"
        icon={PillIcon}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.id} ${r.order?.patientName ?? ""} ${r.notes ?? ""}`}
        searchPlaceholder="بحث برقم الوصفة أو المريض..."
        emptyMessage={stage ? "لا وصفات في هذه المرحلة" : "لا وصفات بعد"}
        actions={(r) => (
          <StageAdvance
            stages={STAGES}
            current={r.status}
            onAdvance={(next) => void advance(r.id, next)}
            disabled={isPending}
            label={`وصفة ${r.id.slice(-8)}`}
          />
        )}
      />
    </div>
  );
}
