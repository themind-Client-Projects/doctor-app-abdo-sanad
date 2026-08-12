"use client";

import { useCallback, useState } from "react";
import { Users, Wallet } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatCurrency, formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المرضى ومحافظهم — "admin can add money to wallet".
//
// `POST /api/patients/[id]/wallet` existed with an audit trail and an overdraw
// guard, and nothing could reach it. A capability with no screen is a
// capability nobody has.
//
// Deliberately NOT part of /admin/users: that screen manages accounts and
// roles, this one moves money. Putting a top-up button next to a role selector
// invites the wrong click.
// ─────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  governorate: { name: string } | null;
  area: string | null;
};

type WalletView = {
  patient: { id: string; name: string | null };
  balance: number;
  transactions: {
    id: string;
    amount: number;
    type: string;
    reason: string;
    description: string | null;
    createdAt: string;
    order: { orderNumber: string; serviceType: string; source: string } | null;
  }[];
};

const REASON_LABELS: Record<string, string> = {
  TOPUP: "إيداع",
  PAYMENT: "دفع",
  REFUND: "استرداد",
  REWARD: "مكافأة",
};

export default function PatientsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Patient[]>({
    url: "/api/users",
    params: { role: "PATIENT", limit: "100" },
  });

  const [target, setTarget] = useState<Patient | null>(null);
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Only fetched once a patient is selected — loading every wallet to render a
  // list nobody has opened is work for nothing.
  const { data: wallet, refetch: refetchWallet } = useDashboardData<WalletView>({
    url: `/api/patients/${target?.id}/wallet`,
    enabled: Boolean(target),
  });

  const close = useCallback(() => {
    setTarget(null);
    setAmount("");
    setDescription("");
    setDirection("CREDIT");
  }, []);

  const { mutate: adjust, isPending } = useMutation(
    async () =>
      apiFetch(`/api/patients/${target!.id}/wallet`, {
        method: "POST",
        body: JSON.stringify({
          direction,
          amount: Number(amount),
          reason: direction === "CREDIT" ? "TOPUP" : "PAYMENT",
          description: description.trim() || undefined,
        }),
      }),
    {
      successMessage: direction === "CREDIT" ? "تم إيداع المبلغ" : "تم خصم المبلغ",
      onSuccess: () => {
        setAmount("");
        setDescription("");
        void refetchWallet();
      },
    }
  );

  const columns: Column<Patient>[] = [
    {
      key: "name",
      header: "المريض",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name ?? "بدون اسم"}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {r.phone ?? r.email ?? "—"}
          </p>
        </div>
      ),
      sortValue: (r) => r.name ?? "",
    },
    {
      key: "location",
      header: "الموقع",
      secondary: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {[r.governorate?.name, r.area].filter(Boolean).join(" - ") || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "مسجّل منذ",
      secondary: true,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(r.createdAt)}
        </span>
      ),
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "isActive",
      header: "الحساب",
      render: (r) => (
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "نشط" : "معطّل"}</Pill>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المرضى والمحافظ"
        subtitle="أرصدة المرضى وحركاتها — الإيداع والخصم يُسجَّلان في سجل النشاطات"
        icon={Users}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name ?? ""} ${r.phone ?? ""} ${r.email ?? ""}`}
        searchPlaceholder="بحث بالاسم أو الهاتف..."
        filters={[
          {
            key: "isActive",
            label: "كل الحسابات",
            options: [
              { value: "yes", label: "نشط" },
              { value: "no", label: "معطّل" },
            ],
            match: (r, v) => (v === "yes" ? r.isActive : !r.isActive),
          },
        ]}
        emptyMessage="لا يوجد مرضى"
        actions={(r) => (
          <button
            type="button"
            onClick={() => setTarget(r)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Wallet size={14} aria-hidden="true" />
            المحفظة
          </button>
        )}
      />

      <FormDialog
        open={target !== null}
        title="محفظة المريض"
        description={target?.name ?? undefined}
        submitLabel={direction === "CREDIT" ? "إيداع" : "خصم"}
        submitTone={direction === "CREDIT" ? "primary" : "danger"}
        onClose={close}
        onSubmit={() => void adjust()}
        isPending={isPending}
      >
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
            {formatCurrency(wallet?.balance ?? 0)}
          </p>
        </div>

        {/* A direction plus a positive amount, never a signed number — a stray
            minus on a top-up would drain the account instead of failing. */}
        <Field label="نوع الحركة" htmlFor="dir">
          <select
            id="dir"
            className={fieldClass}
            value={direction}
            onChange={(e) => setDirection(e.target.value as "CREDIT" | "DEBIT")}
          >
            <option value="CREDIT">إيداع رصيد</option>
            <option value="DEBIT">خصم من الرصيد</option>
          </select>
        </Field>

        <Field label="المبلغ (د.ع)" htmlFor="amt" hint="الخصم يفشل إذا تجاوز الرصيد المتاح">
          <input
            id="amt"
            type="number"
            min={1}
            dir="ltr"
            className={fieldClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label="البيان" htmlFor="desc" hint="اختياري — يظهر للمريض في سجل معاملاته">
          <input
            id="desc"
            className={fieldClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="تعويض عن طلب ملغي"
          />
        </Field>

        {wallet?.transactions.length ? (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground">آخر الحركات</p>
            <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {wallet.transactions.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {REASON_LABELS[t.reason] ?? t.reason}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.description ?? t.order?.orderNumber.slice(0, 8) ?? "—"}
                      {t.order?.source === "SANAD" ? " · سند" : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      t.type === "CREDIT"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {t.type === "CREDIT" ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
