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
// الصيدليات (req L474-477) — 5 مراحل
//
// The first stage was keyed "received" while the stored value is "new", so the
// counter above the busiest column of the queue permanently read 0. The table
// read `prescriptionId`, `patientName`, `pharmacyName` and `items`, none of
// which exist on Prescription — the item count is the length of the
// `medications` JSON array.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "new", label: "الوصفة استلمت", tone: "info" },
  { key: "preparing", label: "قيد التجهيز", tone: "warning" },
  { key: "ready", label: "جاهزة للتوصيل", tone: "positive" },
  { key: "delivered", label: "تم التوصيل", tone: "positive" },
  { key: "returned", label: "المرتجعات", tone: "danger" },
];

type Medication = { name?: string; dose?: string; quantity?: number };

type Prescription = {
  id: string;
  doctorId: string;
  patientId: string;
  pharmacyId: string | null;
  medications: Medication[];
  status: string;
  notes: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientPhone: string;
  } | null;
};

type Pharmacy = { id: string; name: string };

const statusOf = (p: Prescription) => p.status;

/** `medications` is a Json column — a malformed row must not crash the table. */
const medicationCount = (meds: unknown) => (Array.isArray(meds) ? meds.length : 0);

export default function PharmacyPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Prescription[]>({
    url: "/api/prescriptions",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const { data: pharmacies } = useDashboardData<Pharmacy[]>({
    url: "/api/partners",
    params: { type: "PHARMACY", limit: "100" },
  });

  const pharmacyNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pharmacies ?? []) map.set(p.id, p.name);
    return map;
  }, [pharmacies]);

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
            // Prescription.patientId is a plain column with no User relation, so
            // an unlinked prescription genuinely has no name to show.
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
              {r.patientId.slice(-8)}
            </span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "pharmacy",
        header: "الصيدلية",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.pharmacyId
              ? (pharmacyNames.get(r.pharmacyId) ?? r.pharmacyId.slice(-8))
              : "لم تُسند لصيدلية"}
          </span>
        ),
        sortValue: (r) => (r.pharmacyId ? (pharmacyNames.get(r.pharmacyId) ?? "") : ""),
      },
      {
        key: "medications",
        header: "الأدوية",
        align: "end",
        render: (r) => formatNumber(medicationCount(r.medications)),
        sortValue: (r) => medicationCount(r.medications),
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
    [pharmacyNames]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصيدليات"
        subtitle="٥ مراحل — استلام ثم تجهيز ثم جاهزة ثم توصيل، والمرتجعات"
        icon={PillIcon}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.id} ${r.order?.patientName ?? ""} ${r.order?.orderNumber ?? ""} ${r.notes ?? ""}`
        }
        searchPlaceholder="بحث برقم الوصفة أو المريض..."
        emptyMessage={stage ? "لا توجد وصفات في هذه المرحلة" : "لا توجد وصفات"}
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
