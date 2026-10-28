"use client";

import { useCallback, useMemo, useState } from "react";
import { Pill as PillIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
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

  // ROUTING A PRESCRIPTION TO A PHARMACY — the control this screen never had.
  //
  // `Prescription.pharmacyId` is the tenant key for the pharmacy's own
  // prescription list, three of its four KPI cards and its home task table,
  // and NOTHING in the product ever wrote it: the doctor's dialog omits it on
  // purpose (`/api/partners` is operations-only, and a partner directory on a
  // doctor's screen would widen who can enumerate the platform), and
  // `POST /api/orders/[id]/assign` never touches Prescription. So every
  // pharmacy's inbound queue was empty by construction.
  //
  // The capability already existed and is already role-gated — PATCH
  // /api/prescriptions/[id] accepts `pharmacyId` only from the prescribing
  // doctor or a platform role (prescriptions/[id]/route.ts:119, :170), so a
  // pharmacy cannot reassign its own work. It was, exactly as the audit put
  // it, a missing dropdown.
  const { mutate: route, isPending: routing } = useMutation(
    async (id: string, pharmacyId: string) =>
      apiFetch(`/api/prescriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pharmacyId }),
      }),
    { successMessage: "تم إسناد الوصفة إلى الصيدلية", onSuccess: refresh }
  );

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
        render: (r) =>
          r.pharmacyId ? (
            <span className="text-xs text-muted-foreground">
              {pharmacyNames.get(r.pharmacyId) ?? r.pharmacyId.slice(-8)}
            </span>
          ) : (
            // «لم تُسند لصيدلية» was the whole of it — a statement with no way
            // to act on it, on the one screen whose job is dispatch.
            <select
              aria-label={`إسناد الوصفة ${r.id.slice(-8)} إلى صيدلية`}
              className="h-8 max-w-[11rem] rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary/40"
              value=""
              disabled={routing || (pharmacies ?? []).length === 0}
              onChange={(e) => {
                if (e.target.value) void route(r.id, e.target.value);
              }}
            >
              <option value="">
                {(pharmacies ?? []).length === 0 ? "لا صيدليات متاحة" : "لم تُسند — اختر صيدلية"}
              </option>
              {(pharmacies ?? []).map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name}
                </option>
              ))}
            </select>
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
    // The الصيدلية cell is now an interactive picker, so it depends on the
    // options, the mutation and its pending flag — without them the select
    // could stay disabled after a save finished, or render an empty list.
    [pharmacyNames, pharmacies, route, routing]
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
