"use client";

import { useCallback, useMemo, useState } from "react";
import { Tags } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import { SERVICE_TYPE_KEYS, SERVICE_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatCurrency, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة الأسعار (req L231-238)
//
// The page fetched /api/pricing and then rendered static cards, so the data was
// never shown and nothing could be edited. /api/pricing has had full CRUD all
// along — this wires the screen to it.
// ─────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = SERVICE_TYPE_LABELS;
const SERVICE_TYPES: readonly string[] = SERVICE_TYPE_KEYS;

type PriceConfig = {
  id: string;
  serviceType: string;
  basePrice: number | string;
  sanadPrice: number | string | null;
  complexPrice: number | string | null;
  discountPercent: number | string | null;
  isActive: boolean;
};

type FormState = {
  serviceType: string;
  basePrice: string;
  sanadPrice: string;
  complexPrice: string;
  discountPercent: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  serviceType: "",
  basePrice: "",
  sanadPrice: "",
  complexPrice: "",
  discountPercent: "",
  isActive: true,
};

/** Empty string means "not set" — send null, not 0, which would be a real price. */
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function PricingPage() {
  const { data, isLoading, error, refetch } = useDashboardData<PriceConfig[]>({
    url: "/api/pricing",
  });

  // `serviceType` is @unique, so a type that already has a row cannot get a
  // second one. Offering all 14 in the "سعر جديد" dropdown meant that once every
  // service was priced — which is the normal, fully-configured state — every
  // option led to a duplicate error and the form could only fail.
  const available = useMemo(() => {
    const taken = new Set((data ?? []).map((r) => r.serviceType));
    return SERVICE_TYPES.filter((t) => !taken.has(t));
  }, [data]);

  const [editing, setEditing] = useState<PriceConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PriceConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setDeleting(null);
    setForm(EMPTY);
  }, []);

  const done = useCallback(() => {
    close();
    refetch?.();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      const body = {
        serviceType: form.serviceType,
        basePrice: Number(form.basePrice),
        sanadPrice: numOrNull(form.sanadPrice),
        complexPrice: numOrNull(form.complexPrice),
        discountPercent: numOrNull(form.discountPercent),
        isActive: form.isActive,
      };
      return editing
        ? apiFetch(`/api/pricing/${editing.id}`, {
            method: "PUT",
            // serviceType is @unique and identifies the row — changing it is a
            // create, not an edit.
            body: JSON.stringify({ ...body, serviceType: undefined }),
          })
        : apiFetch("/api/pricing", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث السعر" : "تمت إضافة السعر", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/pricing/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف السعر", onSuccess: done }
  );

  const openEdit = (row: PriceConfig) => {
    setEditing(row);
    setForm({
      serviceType: row.serviceType,
      basePrice: String(row.basePrice ?? ""),
      sanadPrice: row.sanadPrice == null ? "" : String(row.sanadPrice),
      complexPrice: row.complexPrice == null ? "" : String(row.complexPrice),
      discountPercent: row.discountPercent == null ? "" : String(row.discountPercent),
      isActive: row.isActive,
    });
  };

  const columns: Column<PriceConfig>[] = [
    {
      key: "serviceType",
      header: "الخدمة",
      render: (r) => (
        <span className="font-medium text-foreground">
          {SERVICE_LABELS[r.serviceType] ?? r.serviceType}
        </span>
      ),
    },
    {
      key: "basePrice",
      header: "السعر الأساسي",
      render: (r) => formatCurrency(r.basePrice),
      sortValue: (r) => Number(r.basePrice),
    },
    {
      key: "sanadPrice",
      header: "سعر سند",
      secondary: true,
      render: (r) => (r.sanadPrice == null ? "—" : formatCurrency(r.sanadPrice)),
    },
    {
      key: "complexPrice",
      header: "سعر المجمع",
      secondary: true,
      render: (r) => (r.complexPrice == null ? "—" : formatCurrency(r.complexPrice)),
    },
    {
      key: "discountPercent",
      header: "الخصم",
      secondary: true,
      render: (r) => (r.discountPercent == null ? "—" : `${formatNumber(r.discountPercent)}%`),
    },
    {
      key: "isActive",
      header: "الحالة",
      render: (r) => (
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "مفعّل" : "معطّل"}</Pill>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الأسعار"
        subtitle={
          available.length > 0
            ? "السعر الأساسي، سعر سند، سعر المجمع والخصومات لكل خدمة"
            : // Say why the "سعر جديد" button is absent, rather than letting it
              // vanish and leave the admin wondering.
              "السعر الأساسي، سعر سند، سعر المجمع والخصومات لكل خدمة — كل الخدمات مُسعّرة، عدّل أي سطر لتغيير أسعاره"
        }
        icon={Tags}
        action={
          // Nothing left to add once every service is priced — the button would
          // open a form with an empty dropdown.
          available.length > 0
            ? {
                label: "سعر جديد",
                onClick: () => {
                  setForm(EMPTY);
                  setCreating(true);
                },
              }
            : undefined
        }
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${labelOf(SERVICE_LABELS, r.serviceType)} ${r.serviceType}`}
        searchPlaceholder="بحث عن خدمة..."
        filters={[
          {
            key: "isActive",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "مفعّل" },
              { value: "no", label: "معطّل" },
            ],
            match: (r, v) => (v === "yes" ? r.isActive : !r.isActive),
          },
        ]}
        emptyMessage="لا توجد أسعار معرّفة بعد"
        actions={(r) => (
          <RowActions
            label={labelOf(SERVICE_LABELS, r.serviceType)}
            onEdit={() => openEdit(r)}
            onDelete={() => setDeleting(r)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل السعر" : "سعر جديد"}
        description={
          editing
            ? SERVICE_LABELS[editing.serviceType] ?? editing.serviceType
            : "يُستخدم السعر الأساسي عند غياب سعر سند أو المجمع"
        }
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="نوع الخدمة" htmlFor="serviceType">
          <select
            id="serviceType"
            className={fieldClass}
            value={form.serviceType}
            disabled={editing !== null}
            onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
          >
            <option value="">— اختر —</option>
            {/* While editing, the row's own type must stay visible even though
                it is taken — the field is disabled, but an empty select would
                render as blank. */}
            {(editing ? [editing.serviceType] : available).map((t) => (
              <option key={t} value={t}>
                {SERVICE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="السعر الأساسي (د.ع)" htmlFor="basePrice">
            <input
              id="basePrice"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.basePrice}
              onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
            />
          </Field>
          <Field label="الخصم %" htmlFor="discountPercent" hint="اتركه فارغاً لعدم وجود خصم">
            <input
              id="discountPercent"
              type="number"
              min={0}
              max={100}
              dir="ltr"
              className={fieldClass}
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
            />
          </Field>
          <Field label="سعر سند" htmlFor="sanadPrice">
            <input
              id="sanadPrice"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.sanadPrice}
              onChange={(e) => setForm((f) => ({ ...f, sanadPrice: e.target.value }))}
            />
          </Field>
          <Field label="سعر المجمع" htmlFor="complexPrice">
            <input
              id="complexPrice"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.complexPrice}
              onChange={(e) => setForm((f) => ({ ...f, complexPrice: e.target.value }))}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          مفعّل
        </label>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف السعر"
        description={`سيتم حذف سعر «${
          deleting ? (SERVICE_LABELS[deleting.serviceType] ?? deleting.serviceType) : ""
        }». لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
