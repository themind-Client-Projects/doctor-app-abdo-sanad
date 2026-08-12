"use client";

import { useMemo } from "react";
import { Coins, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill, StatTile } from "@/components/data/crud-kit";
import { formatCurrency, formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المالية — every partner role links here and the page did not exist.
//
// Its endpoint returned `{today: 0, month: 0, upcoming: 0}` hardcoded, so even
// once built it would have shown three confident zeros. Both are real now: the
// figures come from the wallet ledger, and the movements below are the rows
// that produced them.
// ─────────────────────────────────────────────────────────────

type Earnings = {
  today: number;
  month: number;
  upcoming: number;
  balance: number;
  currency: string;
  hasWallet: boolean;
};

type Movement = {
  id: string;
  amount: number | string;
  type: string;
  description: string | null;
  createdAt: string;
  order: { orderNumber: string } | null;
};

export default function FinancePage() {
  const { data: earnings, isLoading } = useDashboardData<Earnings>({
    url: "/api/dashboard/earnings",
    refreshInterval: 60_000,
  });

  // The ledger behind the totals. Same source, so the two can never disagree.
  const { data: movements, isLoading: movementsLoading, error, refetch } =
    useDashboardData<Movement[]>({ url: "/api/transactions", params: { limit: "100" } });

  const columns: Column<Movement>[] = useMemo(
    () => [
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
        key: "description",
        header: "البيان",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.description || "حركة مالية"}</p>
            {r.order ? (
              <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                #{r.order.orderNumber.slice(-8)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "type",
        header: "النوع",
        render: (r) => (
          <Pill tone={r.type === "CREDIT" ? "positive" : "danger"}>
            {r.type === "CREDIT" ? "إيداع" : "خصم"}
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
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="المالية"
        subtitle="أرباحك ورصيدك — محسوبة من دفتر محفظتك"
        icon={WalletIcon}
      />

      {!isLoading && earnings && !earnings.hasWallet ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          لا محفظة مرتبطة بحسابك بعد — تُنشأ عند أول تسوية.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="الرصيد الحالي"
            value={isLoading ? "…" : formatCurrency(earnings?.balance ?? 0)}
            icon={WalletIcon}
          />
          <StatTile
            label="أرباح اليوم"
            value={isLoading ? "…" : formatCurrency(earnings?.today ?? 0)}
            icon={TrendingUp}
          />
          <StatTile
            label="أرباح الشهر"
            value={isLoading ? "…" : formatCurrency(earnings?.month ?? 0)}
            icon={TrendingUp}
          />
          <StatTile
            label="قيد التسوية"
            // Gross value of delivered-but-unsettled work, not a payout: the
            // partner's share depends on the rule that will apply.
            value={isLoading ? "…" : formatCurrency(earnings?.upcoming ?? 0)}
            hint="قيمة أعمال منجزة لم تُسوَّ بعد"
            icon={Coins}
          />
        </div>
      )}

      <DataTable
        rows={movements}
        columns={columns}
        isLoading={movementsLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.description ?? ""} ${r.order?.orderNumber ?? ""}`}
        searchPlaceholder="بحث في الحركات..."
        filters={[
          {
            key: "type",
            label: "كل الأنواع",
            options: [
              { value: "CREDIT", label: "إيداع" },
              { value: "DEBIT", label: "خصم" },
            ],
            match: (r, v) => r.type === v,
          },
        ]}
        emptyMessage="لا حركات مالية بعد"
      />
    </div>
  );
}
