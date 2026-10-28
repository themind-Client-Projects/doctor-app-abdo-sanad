"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Coins,
  Loader2,
  RotateCcw,
  Scale,
  Undo2,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { FormDialog } from "@/components/data/form-dialog";
import { PageHeader, Pill, StatTile } from "@/components/data/crud-kit";
import {
  PARTNER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  SETTLEMENT_PARTY_LABELS,
  labelOf,
} from "@/lib/labels";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// التسويات — the operations surface for the commission engine.
//
// Settlement ran as a best-effort step at the end of POST /complete, and the
// only notice that it had failed was a toast on whoever happened to be looking.
// Retry (POST /api/orders/[id]/settle) and reversal (DELETE) both existed and
// nothing in the app called either, so a failed settlement stayed failed: work
// delivered, money collected, no partner credited, and no screen anywhere that
// could show it — only «المستحقات», one aggregate number on the wallets page.
//
// Since settlement refuses to pay out of an order whose money never arrived,
// «لم يُحصَّل» is the expected reason a row is sitting here. That is not a
// settlement failure to retry: it is cash to collect first, so the retry is
// disabled on those rows rather than offered and refused.
// ─────────────────────────────────────────────────────────────

type Provider = { id: string; name: string; type: string } | null;

type PendingRow = {
  id: string;
  orderNumber: string;
  patientName: string;
  serviceType: string;
  totalAmount: string | number | null;
  currency: string;
  paymentStatus: string;
  createdAt: string;
  provider: Provider;
  /** Set when this order is unsettled because a settlement was REVERSED. */
  reversedAt: string | null;
};

type Share = {
  party: string;
  partnerId: string | null;
  percentage: string | number;
  amount: string | number;
};

type HistoryRow = {
  id: string;
  orderId: string;
  totalAmount: string | number;
  currency: string;
  status: "SETTLED" | "REVERSED";
  settledAt: string;
  reversedAt: string | null;
  createdAt: string;
  shares: Share[];
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    serviceType: string;
  } | null;
};

type PendingSummary = { orders: number; amount: string | number };
type HistorySummary = {
  settledCount: number;
  settledAmount: string | number;
  reversedCount: number;
  reversedAmount: string | number;
};

const TABS = [
  { key: "pending", label: "بانتظار التسوية" },
  { key: "history", label: "سجل التسويات" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function SettlementsPage() {
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div className="space-y-5">
      <PageHeader
        title="التسويات"
        subtitle="ما وزّعه محرك النسب فعلاً — وما لم يُوزّع بعد"
        icon={Scale}
      />

      <div
        role="tablist"
        aria-label="عرض التسويات"
        className="flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-[hsl(var(--primary))] text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted only while selected: each owns a request, and
          a hidden tab must not keep polling a money endpoint. */}
      {tab === "pending" ? <PendingPanel /> : <HistoryPanel />}
    </div>
  );
}

/* ------------------------------- بانتظار التسوية ------------------------------ */

function PendingPanel() {
  const { data, meta, isLoading, error, refetch } = useDashboardData<PendingRow[]>({
    url: "/api/settlements",
    params: { view: "pending", limit: "100" },
  });
  const summary = (meta?.summary ?? null) as PendingSummary | null;

  const [retrying, setRetrying] = useState<string | null>(null);

  const { mutate: retry } = useMutation(
    async (orderId: string) => apiFetch(`/api/orders/${orderId}/settle`, { method: "POST" }),
    {
      successMessage: "تمت التسوية ووُزّعت الحصص",
      // Cleared on BOTH paths: a failed retry that left the row spinning for
      // ever would read as "still working" when the engine had already refused.
      onSuccess: () => {
        setRetrying(null);
        void refetch();
      },
      onError: () => setRetrying(null),
    }
  );

  const uncollected = useMemo(
    () => (data ?? []).filter((r) => r.paymentStatus !== "PAID").length,
    [data]
  );
  const reversedWaiting = useMemo(
    () => (data ?? []).filter((r) => r.reversedAt !== null).length,
    [data]
  );

  const columns: Column<PendingRow>[] = useMemo(
    () => [
      {
        key: "order",
        header: "الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.patientName}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.orderNumber.slice(0, 10)} · {labelOf(SERVICE_TYPE_LABELS, r.serviceType)}
            </p>
          </div>
        ),
        sortValue: (r) => r.patientName,
      },
      {
        key: "provider",
        header: "الشريك المستحق",
        render: (r) =>
          r.provider ? (
            <div className="min-w-0">
              <p className="truncate text-foreground">{r.provider.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {labelOf(PARTNER_TYPE_LABELS, r.provider.type)}
              </p>
            </div>
          ) : (
            // No assignment means no party to pay: the engine refuses this with
            // PARTY_UNASSIGNED, so the retry would always fail.
            <Pill tone="danger">لا شريك مُعيَّن</Pill>
          ),
        sortValue: (r) => r.provider?.name ?? "",
      },
      {
        key: "amount",
        header: "المبلغ",
        align: "end",
        render: (r) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(Number(r.totalAmount ?? 0))}
          </span>
        ),
        sortValue: (r) => Number(r.totalAmount ?? 0),
      },
      {
        key: "paymentStatus",
        header: "التحصيل",
        render: (r) => (
          <Pill tone={r.paymentStatus === "PAID" ? "positive" : "warning"}>
            {labelOf(PAYMENT_STATUS_LABELS, r.paymentStatus)}
          </Pill>
        ),
        sortValue: (r) => r.paymentStatus,
      },
      {
        key: "why",
        header: "السبب",
        secondary: true,
        render: (r) =>
          r.reversedAt ? (
            <Pill tone="info">عُكست التسوية · {formatDateTime(r.reversedAt)}</Pill>
          ) : r.paymentStatus !== "PAID" ? (
            <span className="text-xs text-muted-foreground">بانتظار تحصيل المبلغ</span>
          ) : (
            <span className="text-xs text-muted-foreground">لم تُسوَّ بعد</span>
          ),
      },
      {
        key: "createdAt",
        header: "أُنشئ",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
        ),
        sortValue: (r) => r.createdAt,
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={Coins}
          label="قيمة العمل غير المُسوّى"
          value={summary ? formatCurrency(Number(summary.amount)) : "—"}
          hint={summary ? `${formatNumber(summary.orders)} طلب منجز` : undefined}
        />
        <StatTile
          icon={AlertTriangle}
          label="بانتظار التحصيل"
          value={data ? formatNumber(uncollected) : "—"}
          hint="لا تُسوّى حتى يُحصَّل المبلغ"
        />
        <StatTile
          icon={Undo2}
          label="تسويات مُعكوسة"
          value={data ? formatNumber(reversedWaiting) : "—"}
          hint="سُحبت من المحافظ وتنتظر قراراً"
        />
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.patientName} ${r.orderNumber} ${r.provider?.name ?? ""}`}
        searchPlaceholder="بحث بالمريض أو رقم الطلب أو الشريك..."
        filters={[
          {
            key: "collection",
            label: "كل الحالات",
            options: [
              { value: "collected", label: "محصَّل — جاهز للتسوية" },
              { value: "uncollected", label: "لم يُحصَّل" },
              { value: "reversed", label: "عُكست تسويته" },
            ],
            match: (r, v) =>
              v === "collected"
                ? r.paymentStatus === "PAID"
                : v === "uncollected"
                  ? r.paymentStatus !== "PAID"
                  : r.reversedAt !== null,
          },
        ]}
        emptyMessage="لا يوجد طلب منجز بانتظار التسوية — كل ما سُلّم ووُصّل قد وُزّع"
        actions={(r) => {
          const ready = r.paymentStatus === "PAID" && r.provider !== null;
          const busy = retrying === r.id;
          return (
            <button
              type="button"
              // The engine refuses an uncollected order and an unassigned one.
              // Offering a button that is guaranteed to fail is how the old
              // toast-only flow wasted everyone's time.
              disabled={!ready || busy}
              title={
                r.paymentStatus !== "PAID"
                  ? "لا تُسوّى حتى يُحصَّل مبلغ الطلب"
                  : r.provider === null
                    ? "لا شريك مُعيَّن على الطلب"
                    : "تسوية الطلب الآن"
              }
              onClick={() => {
                setRetrying(r.id);
                void retry(r.id);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <RotateCcw size={13} aria-hidden />
              )}
              تسوية
            </button>
          );
        }}
      />
    </div>
  );
}

/* -------------------------------- سجل التسويات ------------------------------- */

function HistoryPanel() {
  const { data, meta, isLoading, error, refetch } = useDashboardData<HistoryRow[]>({
    url: "/api/settlements",
    params: { view: "history", limit: "100" },
  });
  const summary = (meta?.summary ?? null) as HistorySummary | null;

  const [reversing, setReversing] = useState<HistoryRow | null>(null);

  const { mutate: reverse, isPending: reversingNow } = useMutation(
    async () => apiFetch(`/api/orders/${reversing!.orderId}/settle`, { method: "DELETE" }),
    {
      successMessage: "عُكست التسوية وسُحبت الحصص من المحافظ",
      onSuccess: () => {
        setReversing(null);
        void refetch();
      },
    }
  );

  const columns: Column<HistoryRow>[] = useMemo(
    () => [
      {
        key: "order",
        header: "الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {r.order?.patientName ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {(r.order?.orderNumber ?? r.orderId).slice(0, 10)} ·{" "}
              {labelOf(SERVICE_TYPE_LABELS, r.order?.serviceType)}
            </p>
          </div>
        ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "amount",
        header: "المبلغ",
        align: "end",
        render: (r) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(Number(r.totalAmount))}
          </span>
        ),
        sortValue: (r) => Number(r.totalAmount),
      },
      {
        key: "shares",
        header: "التوزيع",
        render: (r) => (
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {r.shares.map((s) => (
              <span key={`${s.party}-${s.partnerId ?? "warid"}`} className="whitespace-nowrap">
                {labelOf(SETTLEMENT_PARTY_LABELS, s.party)} {formatNumber(Number(s.amount))}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) =>
          r.status === "SETTLED" ? (
            <Pill tone="positive">مُسوّاة</Pill>
          ) : (
            <Pill tone="danger">مُعكوسة</Pill>
          ),
        sortValue: (r) => r.status,
      },
      {
        key: "settledAt",
        header: "التاريخ",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.status === "REVERSED" && r.reversedAt
              ? `عُكست ${formatDateTime(r.reversedAt)}`
              : formatDateTime(r.settledAt)}
          </span>
        ),
        sortValue: (r) => r.settledAt,
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile
          icon={Scale}
          label="إجمالي ما سُوّي"
          value={summary ? formatCurrency(Number(summary.settledAmount)) : "—"}
          hint={summary ? `${formatNumber(summary.settledCount)} تسوية` : undefined}
        />
        <StatTile
          icon={Undo2}
          label="إجمالي ما عُكس"
          value={summary ? formatCurrency(Number(summary.reversedAmount)) : "—"}
          hint={summary ? `${formatNumber(summary.reversedCount)} تسوية مُعكوسة` : undefined}
        />
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.order?.patientName ?? ""} ${r.order?.orderNumber ?? ""}`}
        searchPlaceholder="بحث بالمريض أو رقم الطلب..."
        filters={[
          {
            key: "status",
            label: "كل التسويات",
            options: [
              { value: "SETTLED", label: "مُسوّاة" },
              { value: "REVERSED", label: "مُعكوسة" },
            ],
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage="لم تُسجَّل أي تسوية بعد"
        actions={(r) =>
          r.status === "SETTLED" ? (
            <button
              type="button"
              onClick={() => setReversing(r)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <Undo2 size={13} aria-hidden />
              عكس
            </button>
          ) : null
        }
      />

      <FormDialog
        open={reversing !== null}
        title="عكس التسوية"
        description={
          reversing
            ? `سيُسحب ${formatCurrency(Number(reversing.totalAmount))} من محافظ الشركاء الذين قُيّدت لهم حصص هذا الطلب، ويُسجَّل قيد مدين لكل واحد منهم. سجل التسوية يبقى كما هو — العكس قيد جديد لا تعديل. بعد العكس يعود الطلب إلى «بانتظار التسوية» ويمكن تسويته من جديد.`
            : undefined
        }
        submitLabel="عكس التسوية"
        submitTone="danger"
        onClose={() => setReversing(null)}
        onSubmit={() => void reverse()}
        isPending={reversingNow}
      />
    </div>
  );
}
