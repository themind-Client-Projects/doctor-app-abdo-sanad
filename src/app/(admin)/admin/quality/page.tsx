"use client";

import { useMemo } from "react";
import { Activity, MessageSquare, Star } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill, StatTile } from "@/components/data/crud-kit";
import { SERVICE_TYPE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مؤشرات الجودة (req L262)
//
// Patient feedback is the only quality signal the system actually records.
// Response time, uptime and SLA compliance appear in the requirement but are
// measured nowhere — so they are absent here rather than shown as invented
// numbers. Add the measurement first, then the tile.
// ─────────────────────────────────────────────────────────────

type Feedback = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  patient: { id: string; name: string | null; phone: string | null } | null;
  order: { id: string; orderNumber: string; serviceType: string; status: string } | null;
};

export default function QualityPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Feedback[]>({
    url: "/api/feedback",
    params: { limit: "100" },
  });

  // The endpoint returns a `meta.summary` over the whole filtered set, but
  // `useDashboardData` unwraps `data`. Re-deriving over the loaded page would
  // be a different number than the server's, so the tiles below are labelled
  // as covering the loaded rows — not the entire history.
  const stats = useMemo(() => {
    const rows = data ?? [];
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const f of rows) {
      const idx = Math.min(5, Math.max(1, f.rating)) - 1;
      counts[idx] += 1;
      sum += f.rating;
    }
    const total = rows.length;
    return {
      total,
      average: total ? sum / total : 0,
      counts,
      // Standard CSAT: 4- and 5-star as a share of all responses.
      satisfied: total ? (counts[3] + counts[4]) / total : 0,
      detractors: total ? (counts[0] + counts[1]) / total : 0,
    };
  }, [data]);

  const columns: Column<Feedback>[] = [
    {
      key: "rating",
      header: "التقييم",
      render: (r) => <Stars value={r.rating} />,
      sortValue: (r) => r.rating,
    },
    {
      key: "patient",
      header: "المريض",
      render: (r) => (
        <span className="font-medium text-foreground">{r.patient?.name ?? "—"}</span>
      ),
      sortValue: (r) => r.patient?.name ?? "",
    },
    {
      key: "service",
      header: "الخدمة",
      render: (r) =>
        r.order ? (
          <Pill>{labelOf(SERVICE_TYPE_LABELS, r.order.serviceType)}</Pill>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "comment",
      header: "الملاحظة",
      secondary: true,
      render: (r) =>
        r.comment ? (
          <span className="line-clamp-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            {r.comment}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">بدون تعليق</span>
        ),
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
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="مؤشرات الجودة"
        subtitle="تقييمات المرضى وملاحظاتهم — المؤشر الوحيد المقيس فعلياً في النظام"
        icon={Activity}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="متوسط التقييم"
          value={`${formatNumber(Math.round(stats.average * 100) / 100)} / 5`}
          hint={`${formatNumber(stats.total)} تقييم محمّل`}
          icon={Star}
        />
        <StatTile
          label="نسبة الرضا"
          value={formatPercent(stats.satisfied * 100)}
          hint="تقييم ٤ أو ٥ نجوم"
          icon={Activity}
        />
        <StatTile
          label="نسبة عدم الرضا"
          value={formatPercent(stats.detractors * 100)}
          hint="تقييم نجمة أو نجمتين"
          icon={MessageSquare}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">توزيع التقييمات</h2>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stats.counts[star - 1];
            const share = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {star} نجوم
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${star} نجوم: ${Math.round(share)}%`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                  {formatNumber(count)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.patient?.name ?? ""} ${r.comment ?? ""}`}
        searchPlaceholder="بحث بالمريض أو نص الملاحظة..."
        filters={[
          {
            key: "rating",
            label: "كل التقييمات",
            options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} نجوم` })),
            match: (r, v) => r.rating === Number(v),
          },
          {
            key: "serviceType",
            label: "كل الخدمات",
            options: optionsOf(SERVICE_TYPE_LABELS),
            match: (r, v) => r.order?.serviceType === v,
          },
        ]}
        emptyMessage="لا توجد تقييمات بعد"
      />
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} من ٥ نجوم`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          aria-hidden="true"
          className={
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          }
        />
      ))}
    </span>
  );
}
