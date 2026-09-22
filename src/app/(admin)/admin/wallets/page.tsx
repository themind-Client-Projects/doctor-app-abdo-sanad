"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeftRight, Coins, TrendingUp, Wallet } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useServerFilters } from "@/hooks/use-server-filters";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, StatTile, type PillTone } from "@/components/data/crud-kit";
import { ServerFilterBar } from "@/components/data/server-filter-bar";
import { PARTNER_TYPE_LABELS } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المحافظ المالية (req L239-246) — الرصيد، المستحقات، التحويلات، الأرباح،
// الفواتير، الديون
//
// The subtitle promised those six and the page showed three, one of them
// (`pendingAmount`) a column nothing maintains — it read zero for everyone.
// "تحويل" and "فواتير" were buttons with no handler. And the transfer endpoint
// behind the first one only wrote a ledger row, never the balance, so wiring
// the button as it stood would have recorded payouts the balance never showed.
//
// The balance, the ledger and the debts now move together server-side
// (`partner-wallet.ts`), and every figure below comes from where the money is.
// ─────────────────────────────────────────────────────────────

type WalletRow = {
  id: string;
  partnerId: string;
  partner: { id: string; name: string; type: string };
  balance: number;
  totalEarnings: number;
  openDebts: number;
};

type Summary = {
  wallets: number;
  balance: number;
  earnings: number;
  openDebts: number;
  openDebtCount: number;
  dues: number;
  duesOrders: number;
};

const EMPTY_FILTERS = { q: "", type: "" };

const partnerLabel = (type: string) =>
  PARTNER_TYPE_LABELS[type as keyof typeof PARTNER_TYPE_LABELS] ?? type;

export default function WalletsPage() {
  const filters = useServerFilters(EMPTY_FILTERS);
  const { data, meta, isLoading, error, refetch } = useDashboardData<WalletRow[]>({
    url: "/api/wallets",
    params: { limit: "100", ...filters.params },
  });
  const summary = (meta?.summary ?? null) as Summary | null;

  const [transferTo, setTransferTo] = useState<WalletRow | null>(null);
  const [detailOf, setDetailOf] = useState<WalletRow | null>(null);

  const columns: Column<WalletRow>[] = [
    {
      key: "partner",
      header: "الشريك",
      render: (w) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{w.partner.name}</p>
          <p className="text-xs text-muted-foreground">{partnerLabel(w.partner.type)}</p>
        </div>
      ),
      sortValue: (w) => w.partner.name,
    },
    {
      key: "balance",
      header: "الرصيد",
      align: "end",
      render: (w) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {formatCurrency(w.balance)}
        </span>
      ),
      sortValue: (w) => Number(w.balance),
    },
    {
      key: "earnings",
      header: "إجمالي الأرباح",
      align: "end",
      secondary: true,
      render: (w) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatCurrency(w.totalEarnings)}
        </span>
      ),
      sortValue: (w) => Number(w.totalEarnings),
    },
    {
      key: "debts",
      header: "ديون مفتوحة",
      align: "end",
      render: (w) =>
        Number(w.openDebts) > 0 ? (
          <span className="whitespace-nowrap font-medium tabular-nums text-destructive">
            {formatCurrency(w.openDebts)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortValue: (w) => Number(w.openDebts),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المحافظ المالية"
        subtitle="الرصيد، المستحقات، التحويلات، الأرباح، الفواتير، الديون"
        icon={Wallet}
      />

      {/* Platform totals from the server — the old tiles summed whichever page
          had loaded and presented that as the whole. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="إجمالي الأرصدة"
          value={summary ? formatCurrency(summary.balance) : "—"}
          hint={summary ? `${formatNumber(summary.wallets)} محفظة` : undefined}
        />
        <StatTile
          icon={TrendingUp}
          label="إجمالي الأرباح"
          value={summary ? formatCurrency(summary.earnings) : "—"}
          hint="ما سُوّي للشركاء منذ البداية"
        />
        <StatTile
          icon={AlertTriangle}
          label="ديون مفتوحة"
          value={summary ? formatCurrency(summary.openDebts) : "—"}
          hint={summary ? `${formatNumber(summary.openDebtCount)} دين` : undefined}
        />
        <StatTile
          icon={Coins}
          label="المستحقات"
          value={summary ? formatCurrency(summary.dues) : "—"}
          hint={summary ? `${formatNumber(summary.duesOrders)} طلب منجز لم يُسوَّ` : undefined}
        />
      </div>

      <ServerFilterBar
        idPrefix="wl"
        search={{ placeholder: "بحث باسم الشريك..." }}
        selects={[
          {
            key: "type",
            label: "النوع",
            placeholder: "كل الأنواع",
            options: ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"].map((t) => ({
              value: t,
              label: partnerLabel(t),
            })),
          },
        ]}
        values={filters.values}
        onChange={(key, value) => filters.set(key as keyof typeof EMPTY_FILTERS, value)}
        isActive={filters.isActive}
        onReset={filters.reset}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage={filters.isActive ? "لا محافظ تطابق البحث" : "لا توجد محافظ بعد"}
        actions={(w) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setTransferTo(w)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              تحويل
            </button>
            <button
              type="button"
              onClick={() => setDetailOf(w)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              التفاصيل
            </button>
          </div>
        )}
      />

      <TransferDialog
        wallet={transferTo}
        onClose={() => setTransferTo(null)}
        onDone={() => {
          setTransferTo(null);
          void refetch();
        }}
      />

      <DetailDialog
        wallet={detailOf}
        onClose={() => setDetailOf(null)}
        onChanged={() => void refetch()}
      />
    </div>
  );
}

/* ------------------------------- transfer --------------------------------- */

function TransferDialog({
  wallet,
  onClose,
  onDone,
}: {
  wallet: WalletRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (!wallet && loadedFor !== null) setLoadedFor(null);
  if (wallet && loadedFor !== wallet.id) {
    setLoadedFor(wallet.id);
    setType("DEBIT");
    setAmount("");
    setDescription("");
  }

  const value = Number(amount);
  const balance = Number(wallet?.balance ?? 0);
  // Refused here AND by the server's own predicate — the button must not offer
  // a payout that can only come back as an error.
  const overdraw = type === "DEBIT" && value > balance;
  const invalid = !Number.isFinite(value) || value <= 0 || overdraw;

  const { mutate: submit, isPending } = useMutation(
    async () =>
      apiFetch(`/api/wallets/${wallet!.partnerId}/transfers`, {
        method: "POST",
        body: JSON.stringify({ type, amount: value, description: description.trim() || undefined }),
      }),
    { successMessage: type === "DEBIT" ? "تم تسجيل التحويل" : "تمت إضافة الرصيد", onSuccess: onDone }
  );

  return (
    <FormDialog
      open={wallet !== null}
      title={type === "DEBIT" ? "تحويل مستحقات إلى الشريك" : "إضافة رصيد للشريك"}
      description={wallet ? `${wallet.partner.name} — الرصيد الحالي ${formatCurrency(wallet.balance)}` : undefined}
      onClose={onClose}
      onSubmit={() => void submit()}
      isPending={isPending}
      submitLabel="تأكيد"
      submitDisabled={invalid}
    >
      <Field label="العملية" htmlFor="tr-type">
        <select
          id="tr-type"
          className={fieldClass}
          value={type}
          onChange={(e) => setType(e.target.value as "DEBIT" | "CREDIT")}
        >
          <option value="DEBIT">تحويل للشريك (يُخصم من رصيده)</option>
          <option value="CREDIT">إضافة رصيد / تسوية (يُضاف لرصيده)</option>
        </select>
      </Field>

      <Field
        label="المبلغ (د.ع)"
        htmlFor="tr-amount"
        hint={overdraw ? "المبلغ أكبر من رصيد الشريك" : type === "DEBIT" ? `حتى ${formatCurrency(balance)}` : undefined}
      >
        <input
          id="tr-amount"
          type="number"
          min={0}
          dir="ltr"
          className={`${fieldClass} ${overdraw ? "border-destructive" : ""}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>

      <Field label="الوصف" htmlFor="tr-desc" hint="رقم الحوالة البنكية أو سبب التسوية">
        <input
          id="tr-desc"
          className={fieldClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
      </Field>

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        يُسجَّل في سجل التحويلات ويتحدّث الرصيد في العملية نفسها. الأرباح لا تتأثر —
        تُحسب من التسويات فقط.
      </p>
    </FormDialog>
  );
}

/* --------------------------------- detail --------------------------------- */

type Detail = {
  partner: { id: string; name: string; type: string; phone: string | null };
  transactions: { id: string; amount: number; type: string; description: string | null; createdAt: string }[];
  figures: {
    balance: number;
    dues: number;
    earnings: number;
    paidOut: number;
    openInvoices: { amount: number; count: number };
    openDebts: { amount: number; count: number; overdue: number };
  };
};

type Invoice = { id: string; amount: number; status: string; dueDate: string; paidAt: string | null };
type Debt = {
  id: string;
  amount: number;
  reason: string | null;
  dueDate: string;
  state: "pending" | "overdue" | "paid" | "cancelled";
};

const DEBT_TONES: Record<Debt["state"], { label: string; tone: PillTone }> = {
  pending: { label: "مستحق", tone: "warning" },
  overdue: { label: "متأخر", tone: "danger" },
  paid: { label: "مُسدَّد", tone: "positive" },
  cancelled: { label: "ملغى", tone: "neutral" },
};

type Tab = "transfers" | "invoices" | "debts";

function DetailDialog({
  wallet,
  onClose,
  onChanged,
}: {
  wallet: WalletRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const partnerId = wallet?.partnerId;
  const open = wallet !== null;
  const [tab, setTab] = useState<Tab>("transfers");

  const detail = useDashboardData<Detail>({ url: `/api/wallets/${partnerId}`, enabled: open });
  const invoices = useDashboardData<Invoice[]>({
    url: `/api/wallets/${partnerId}/invoices`,
    params: { limit: "50" },
    enabled: open && tab === "invoices",
  });
  const debts = useDashboardData<Debt[]>({
    url: `/api/wallets/${partnerId}/debts`,
    params: { limit: "50" },
    enabled: open && tab === "debts",
  });

  const [addingDebt, setAddingDebt] = useState(false);

  const refresh = () => {
    void detail.refetch();
    void debts.refetch();
    onChanged();
  };

  const { mutate: settle, isPending: settling } = useMutation(
    async (debtId: string, fromWallet: boolean) =>
      apiFetch(`/api/wallets/${partnerId}/debts/${debtId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", fromWallet }),
      }),
    { successMessage: "تم تسديد الدين", onSuccess: refresh }
  );

  const f = detail.data?.figures;

  return (
    <>
    {/* Hidden, not unmounted, while a debt is being added: only ONE dialog is
        on screen at a time, so Escape closes the one in front and a submit
        cannot reach the panel behind it. */}
    <FormDialog
      open={open && !addingDebt}
      title={wallet?.partner.name ?? ""}
      description={wallet ? partnerLabel(wallet.partner.type) : undefined}
      onClose={() => {
        setTab("transfers");
        onClose();
      }}
      onSubmit={onClose}
      readOnly
    >
      {/* ── the six figures ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Figure label="الرصيد" value={f ? formatCurrency(f.balance) : "…"} strong />
        <Figure label="المستحقات" value={f ? formatCurrency(f.dues) : "…"} hint="منجز ولم يُسوَّ" />
        <Figure label="الأرباح" value={f ? formatCurrency(f.earnings) : "…"} />
        <Figure label="المحوَّل" value={f ? formatCurrency(f.paidOut) : "…"} />
        <Figure
          label="فواتير مفتوحة"
          value={f ? formatCurrency(f.openInvoices.amount) : "…"}
          hint={f ? `${f.openInvoices.count} فاتورة` : undefined}
        />
        <Figure
          label="ديون مفتوحة"
          value={f ? formatCurrency(f.openDebts.amount) : "…"}
          hint={f && f.openDebts.overdue > 0 ? `${f.openDebts.overdue} متأخر` : f ? `${f.openDebts.count} دين` : undefined}
          danger={Boolean(f && f.openDebts.overdue > 0)}
        />
      </div>

      {/* ── tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-border p-1" role="tablist">
        {(
          [
            ["transfers", "التحويلات"],
            ["invoices", "الفواتير"],
            ["debts", "الديون"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {tab === "transfers" ? (
          <List
            empty="لا تحويلات بعد"
            loading={detail.isLoading}
            rows={(detail.data?.transactions ?? []).map((t) => ({
              id: t.id,
              title: t.description ?? (t.type === "CREDIT" ? "إضافة" : "خصم"),
              sub: formatDateTime(t.createdAt),
              value: `${t.type === "CREDIT" ? "+" : "−"} ${formatCurrency(t.amount)}`,
              tone: t.type === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
            }))}
          />
        ) : tab === "invoices" ? (
          <List
            empty="لا فواتير"
            loading={invoices.isLoading}
            rows={(invoices.data ?? []).map((i) => ({
              id: i.id,
              title: `فاتورة — ${i.status === "paid" ? "مدفوعة" : i.status === "cancelled" ? "ملغاة" : "مستحقة"}`,
              sub: `الاستحقاق ${formatDate(i.dueDate)}`,
              value: formatCurrency(i.amount),
              tone: "text-foreground",
            }))}
          />
        ) : (
          <div className="space-y-2">
            {(debts.data ?? []).length === 0 && !debts.isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">لا ديون على هذا الشريك</p>
            ) : null}
            {(debts.data ?? []).map((d) => (
              <div key={d.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.reason ?? "دين"}</p>
                    <p className="text-xs text-muted-foreground">الاستحقاق {formatDate(d.dueDate)}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(d.amount)}</p>
                    <Pill tone={DEBT_TONES[d.state].tone}>{DEBT_TONES[d.state].label}</Pill>
                  </div>
                </div>
                {d.state === "pending" || d.state === "overdue" ? (
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() => void settle(d.id, false)}
                      className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      سُدِّد خارجياً
                    </button>
                    <button
                      type="button"
                      disabled={settling || Number(f?.balance ?? 0) < Number(d.amount)}
                      title={Number(f?.balance ?? 0) < Number(d.amount) ? "رصيد الشريك لا يكفي" : undefined}
                      onClick={() => void settle(d.id, true)}
                      className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      خصم من رصيده
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAddingDebt(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeftRight size={13} />
              تسجيل دين جديد
            </button>
          </div>
        )}
      </div>

    </FormDialog>

    {/* A sibling, never a child: FormDialog renders a <form>, and a form
        nested in another bubbles its submit to the outer one's handler. */}
    <AddDebtDialog
      partnerId={open && addingDebt ? (partnerId ?? null) : null}
      onClose={() => setAddingDebt(false)}
      onDone={() => {
        setAddingDebt(false);
        refresh();
      }}
    />
    </>
  );
}

function AddDebtDialog({
  partnerId,
  onClose,
  onDone,
}: {
  partnerId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));

  const value = Number(amount);

  const { mutate: submit, isPending } = useMutation(
    async () =>
      apiFetch(`/api/wallets/${partnerId}/debts`, {
        method: "POST",
        body: JSON.stringify({
          amount: value,
          reason: reason.trim(),
          dueDate: new Date(`${dueDate}T23:59:59+03:00`).toISOString(),
        }),
      }),
    {
      successMessage: "تم تسجيل الدين",
      onSuccess: () => {
        setAmount("");
        setReason("");
        onDone();
      },
    }
  );

  return (
    <FormDialog
      open={partnerId !== null}
      title="تسجيل دين على الشريك"
      description="يُبلَّغ الشريك بإشعار"
      onClose={onClose}
      onSubmit={() => void submit()}
      isPending={isPending}
      submitDisabled={!Number.isFinite(value) || value <= 0 || reason.trim().length < 3 || !dueDate}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (د.ع)" htmlFor="debt-amount">
          <input
            id="debt-amount"
            type="number"
            min={0}
            dir="ltr"
            className={fieldClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="تاريخ الاستحقاق" htmlFor="debt-due">
          <input
            id="debt-due"
            type="date"
            dir="ltr"
            className={fieldClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="السبب" htmlFor="debt-reason">
        <input
          id="debt-reason"
          className={fieldClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سلفة / غرامة تأخير / تصحيح تسوية"
          maxLength={200}
        />
      </Field>
    </FormDialog>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Figure({
  label,
  value,
  hint,
  strong,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm tabular-nums ${strong ? "font-bold" : "font-semibold"} ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className={`truncate text-[10px] ${danger ? "text-destructive" : "text-muted-foreground"}`}>{hint}</p> : null}
    </div>
  );
}

function List({
  rows,
  empty,
  loading,
}: {
  rows: { id: string; title: string; sub: string; value: string; tone: string }[];
  empty: string;
  loading: boolean;
}) {
  if (loading) return <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>;
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{r.title}</p>
            <p className="text-xs text-muted-foreground">{r.sub}</p>
          </div>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.tone}`}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
