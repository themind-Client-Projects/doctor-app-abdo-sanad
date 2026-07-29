"use client";

import { useMemo } from "react";
import { ArrowLeftRight, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader, Pill, StatTile } from "@/components/admin/crud-kit";
import {
  PARTNER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatCurrency, formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// سجل التحويلات (req L243)
//
// Read-only, and that is the design: a `Transaction` is written by the
// settlement engine when an order completes. Every wallet balance is the sum of
// its transactions, so a hand-authored row here would put the ledger and the
// balances permanently out of agreement.
// ─────────────────────────────────────────────────────────────

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
  wallet: {
    id: string;
    partnerId: string;
    partner: { id: string; name: string; type: string } | null;
  } | null;
  order: { id: string; orderNumber: string; serviceType: string } | null;
};

export default function TransfersPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Transaction[]>({
    url: "/api/transactions",
    params: { limit: "100" },
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    let credit = 0;
    let debit = 0;
    for (const t of rows) {
      if (t.type === "CREDIT") credit += Number(t.amount);
      else debit += Number(t.amount);
    }
    return { credit, debit, net: credit - debit, count: rows.length };
  }, [data]);

  const columns: Column<Transaction>[] = [
    {
      key: "createdAt",
      header: "التاريخ",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(r.createdAt)}
        </span>
      ),
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "partner",
      header: "الشريك",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {r.wallet?.partner?.name ?? "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {labelOf(PARTNER_TYPE_LABELS, r.wallet?.partner?.type)}
          </p>
        </div>
      ),
      sortValue: (r) => r.wallet?.partner?.name ?? "",
    },
    {
      key: "type",
      header: "النوع",
      render: (r) => (
        <Pill tone={r.type === "CREDIT" ? "positive" : "danger"}>
          {labelOf(TRANSACTION_TYPE_LABELS, r.type)}
        </Pill>
      ),
    },
    {
      key: "amount",
      header: "المبلغ",
      align: "end",
      render: (r) => (
        <span
          className={`whitespace-nowrap font-semibold tabular-nums ${
            r.type === "CREDIT"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {r.type === "CREDIT" ? "+" : "−"}
          {formatCurrency(r.amount)}
        </span>
      ),
      sortValue: (r) => Number(r.amount),
    },
    {
      key: "order",
      header: "الطلب",
      secondary: true,
      render: (r) =>
        r.order ? (
          <div className="min-w-0">
            <p className="truncate text-xs tabular-nums text-foreground" dir="ltr">
              {r.order.orderNumber.slice(0, 10)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {labelOf(SERVICE_TYPE_LABELS, r.order.serviceType)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "description",
      header: "البيان",
      secondary: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.description || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="سجل التحويلات"
        subtitle="كل حركة مالية على محافظ الشركاء، كما كتبتها تسوية الطلبات"
        icon={ArrowLeftRight}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="إجمالي الإيداعات"
          value={formatCurrency(totals.credit)}
          icon={TrendingUp}
        />
        <StatTile
          label="إجمالي السحوبات"
          value={formatCurrency(totals.debit)}
          icon={TrendingDown}
        />
        <StatTile label="الصافي" value={formatCurrency(totals.net)} icon={Wallet} />
        <StatTile
          label="عدد الحركات"
          value={String(totals.count)}
          hint="آخر ١٠٠ حركة"
          icon={ArrowLeftRight}
        />
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.wallet?.partner?.name ?? ""} ${r.description ?? ""} ${r.order?.orderNumber ?? ""}`
        }
        searchPlaceholder="بحث بالشريك أو رقم الطلب..."
        filters={[
          {
            key: "type",
            label: "كل الأنواع",
            options: optionsOf(TRANSACTION_TYPE_LABELS),
            match: (r, v) => r.type === v,
          },
        ]}
        emptyMessage="لا توجد حركات مالية بعد"
      />
    </div>
  );
}
