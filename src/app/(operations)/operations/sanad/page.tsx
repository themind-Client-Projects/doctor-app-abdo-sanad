"use client";

import { useCallback, useMemo, useState } from "react";
import { Phone, Stethoscope } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/crud-kit";
import {
  PipelineStrip,
  StageAdvance,
  StagePill,
  stageOptions,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة سند (req L445-453) — الاستشارات الأونلاين
//
// The table read `doctorName`, `patientName` and `doctorStatus`; the API sent
// only `doctor.userId`, so all three columns were blank on every row and the
// "اتصال" link was `href="tel:"` — a call button that dialled nothing.
//
// `appointmentTime` was printed raw, which for a DateTime means the ISO string.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "waiting", label: "انتظار", tone: "warning" },
  { key: "calling", label: "جاري الاتصال", tone: "info" },
  { key: "in_session", label: "في الجلسة", tone: "info" },
  { key: "ended", label: "انتهت الجلسة", tone: "neutral" },
];

type Session = {
  id: string;
  doctorId: string;
  patientId: string;
  appointmentTime: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  doctor: {
    id: string;
    userId: string;
    user: { name: string | null; phone: string | null } | null;
    specialty: { name: string } | null;
  } | null;
  patient: { id: string; name: string | null; phone: string | null } | null;
};

const statusOf = (s: Session) => s.status;

export default function SanadPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Session[]>({
    url: "/api/sanad-sessions",
    params: { limit: "100" },
    // A waiting room — a patient sitting in "انتظار" is waiting in real time.
    refreshInterval: 15_000,
  });

  const [stage, setStage] = useState<string | null>(null);

  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/sanad-sessions", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((s) => s.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<Session>[] = useMemo(
    () => [
      {
        key: "doctor",
        header: "الطبيب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {r.doctor?.user?.name ?? "طبيب غير معروف"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {r.doctor?.specialty?.name ?? "—"}
            </p>
          </div>
        ),
        sortValue: (r) => r.doctor?.user?.name ?? "",
      },
      {
        key: "patient",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.patient?.name ?? "مريض غير معروف"}</p>
            {r.patient?.phone ? (
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {r.patient.phone}
              </p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.patient?.name ?? "",
      },
      {
        key: "appointmentTime",
        header: "وقت الموعد",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(r.appointmentTime)}
          </span>
        ),
        sortValue: (r) => new Date(r.appointmentTime).getTime(),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "call",
        header: "اتصال",
        secondary: true,
        render: (r) => {
          // Only a real number gets a link — an <a href="tel:"> with nothing
          // after the colon is a button that does nothing when tapped.
          const phone = r.patient?.phone;
          return phone ? (
            <a
              href={`tel:${phone}`}
              aria-label={`اتصال بالمريض ${r.patient?.name ?? ""}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Phone size={12} aria-hidden />
              اتصال
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">لا يوجد رقم</span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة سند"
        subtitle="الاستشارات الأونلاين — انتظار، جاري الاتصال، في الجلسة، انتهت"
        icon={Stethoscope}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.doctor?.user?.name ?? ""} ${r.patient?.name ?? ""} ${r.patient?.phone ?? ""} ${
            r.doctor?.specialty?.name ?? ""
          }`
        }
        searchPlaceholder="بحث بالطبيب أو المريض..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: stageOptions(STAGES),
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage={stage ? "لا توجد جلسات في هذه الحالة" : "لا توجد جلسات"}
        actions={(r) => (
          <StageAdvance
            stages={STAGES}
            current={r.status}
            onAdvance={(next) => void advance(r.id, next)}
            disabled={isPending}
            label={`جلسة ${r.patient?.name ?? r.id.slice(-8)}`}
          />
        )}
      />
    </div>
  );
}
