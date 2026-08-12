"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import {
  PageHeader,
  Pill,
  RowActions,
  StatTile,
  toneForStatus,
} from "@/components/data/crud-kit";
import { INVOICE_STATUS_LABELS, PARTNER_TYPE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الفواتير والمدفوعات (req L245)
// ─────────────────────────────────────────────────────────────

type Invoice = {
  id: string;
  partnerId: string;
  orderId: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  partner: { id: string; name: string; type: string } | null;
};

type Partner = { id: string; name: string; type: string };

type FormState = { partnerId: string; amount: string; dueDate: string; status: string };

const EMPTY: FormState = { partnerId: "", amount: "", dueDate: "", status: "pending" };

/** `<input type="date">` needs yyyy-mm-dd, and only the date part of an ISO. */
const toDateInput = (iso: string) => iso.slice(0, 10);

/** An invoice is overdue when it is unpaid and its due date has passed —
 *  the stored `status` can lag, because nothing sweeps it nightly yet. */
function isOverdue(inv: Invoice, now: number): boolean {
  return inv.status === "pending" && new Date(inv.dueDate).getTime() < now;
}

export default function InvoicesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Invoice[]>({
    url: "/api/invoices",
    params: { limit: "100" },
  });
  const { data: partners } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { limit: "100" },
  });

  const [editing, setEditing] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setDeleting(null);
    setForm(EMPTY);
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      const body = {
        amount: Number(form.amount),
        dueDate: new Date(form.dueDate).toISOString(),
        status: form.status,
      };
      return editing
        ? apiFetch(`/api/invoices/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : apiFetch("/api/invoices", {
            method: "POST",
            body: JSON.stringify({ ...body, partnerId: form.partnerId }),
          });
    },
    { successMessage: editing ? "تم تحديث الفاتورة" : "تمت إضافة الفاتورة", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/invoices/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الفاتورة", onSuccess: done }
  );

  // `paidAt` is stamped server-side from the status, never sent from here.
  const { mutate: markPaid } = useMutation(
    async (id: string) =>
      apiFetch(`/api/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
    { successMessage: "تم تسجيل الدفع", onSuccess: () => void refetch() }
  );

  const totals = useMemo(() => {
    const rows = data ?? [];
    const now = Date.now();
    let outstanding = 0;
    let paid = 0;
    let overdue = 0;
    for (const inv of rows) {
      const amount = Number(inv.amount);
      if (inv.status === "paid") paid += amount;
      else if (inv.status !== "cancelled") {
        outstanding += amount;
        if (isOverdue(inv, now)) overdue += amount;
      }
    }
    return { outstanding, paid, overdue };
  }, [data]);

  const columns: Column<Invoice>[] = [
    {
      key: "partner",
      header: "الشريك",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.partner?.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {labelOf(PARTNER_TYPE_LABELS, r.partner?.type)}
          </p>
        </div>
      ),
      sortValue: (r) => r.partner?.name ?? "",
    },
    {
      key: "amount",
      header: "المبلغ",
      align: "end",
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {formatCurrency(r.amount)}
        </span>
      ),
      sortValue: (r) => Number(r.amount),
    },
    {
      key: "status",
      header: "الحالة",
      render: (r) => {
        const overdue = isOverdue(r, Date.now());
        return (
          <Pill tone={overdue ? "danger" : toneForStatus(r.status)}>
            {overdue ? "متأخرة" : labelOf(INVOICE_STATUS_LABELS, r.status)}
          </Pill>
        );
      },
    },
    {
      key: "dueDate",
      header: "تاريخ الاستحقاق",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(r.dueDate)}
        </span>
      ),
      sortValue: (r) => new Date(r.dueDate).getTime(),
    },
    {
      key: "paidAt",
      header: "تاريخ الدفع",
      secondary: true,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {r.paidAt ? formatDate(r.paidAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الفواتير والمدفوعات"
        subtitle="فواتير الشركاء، المستحق منها والمتأخر"
        icon={Receipt}
        action={{
          label: "فاتورة جديدة",
          onClick: () => {
            setForm({ ...EMPTY, dueDate: new Date().toISOString().slice(0, 10) });
            setCreating(true);
          },
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="مستحق" value={formatCurrency(totals.outstanding)} icon={Receipt} />
        <StatTile
          label="متأخر"
          value={formatCurrency(totals.overdue)}
          hint="تجاوز تاريخ الاستحقاق ولم يُدفع"
          icon={AlertTriangle}
        />
        <StatTile label="مدفوع" value={formatCurrency(totals.paid)} icon={CheckCircle2} />
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => r.partner?.name ?? ""}
        searchPlaceholder="بحث بالشريك..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: [
              ...optionsOf(INVOICE_STATUS_LABELS),
              { value: "__overdue", label: "متأخرة فعلياً" },
            ],
            match: (r, v) =>
              v === "__overdue" ? isOverdue(r, Date.now()) : r.status === v,
          },
        ]}
        emptyMessage="لا توجد فواتير بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === "pending" ? (
              <button
                type="button"
                onClick={() => void markPaid(r.id)}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                تسجيل الدفع
              </button>
            ) : null}
            <RowActions
              label={`فاتورة ${r.partner?.name ?? ""}`}
              onEdit={() => {
                setEditing(r);
                setForm({
                  partnerId: r.partnerId,
                  amount: String(r.amount),
                  dueDate: toDateInput(r.dueDate),
                  status: r.status,
                });
              }}
              onDelete={() => setDeleting(r)}
            />
          </div>
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الفاتورة" : "فاتورة جديدة"}
        description={editing ? editing.partner?.name ?? undefined : "أصدر فاتورة على شريك"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        {editing ? null : (
          <Field label="الشريك" htmlFor="inv-partner">
            <select
              id="inv-partner"
              className={fieldClass}
              value={form.partnerId}
              onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
            >
              <option value="">— اختر —</option>
              {(partners ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {labelOf(PARTNER_TYPE_LABELS, p.type)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ (د.ع)" htmlFor="inv-amount">
            <input
              id="inv-amount"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label="تاريخ الاستحقاق" htmlFor="inv-due">
            <input
              id="inv-due"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </Field>
        </div>

        <Field
          label="الحالة"
          htmlFor="inv-status"
          hint="تاريخ الدفع يُسجَّل تلقائياً عند اختيار «مدفوعة»"
        >
          <select
            id="inv-status"
            className={fieldClass}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {optionsOf(INVOICE_STATUS_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الفاتورة"
        description={`سيتم حذف فاتورة ${deleting?.partner?.name ?? ""} بمبلغ ${formatCurrency(
          deleting?.amount ?? 0
        )}. لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
