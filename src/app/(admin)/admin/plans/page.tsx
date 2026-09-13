"use client";

import { useCallback, useState } from "react";
import { Layers, Plus, X } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import { SERVICE_TYPE_LABELS } from "@/lib/labels";
import { formatCurrency, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// عضويات وريد وسند
//
// GLOBAL on purpose: a subscriber uses their membership inside سند and outside
// it, so `HealthPlan` carries no channel. Only the storefront *content*
// (banners, offers) and the provider pools are channel-scoped.
//
// This screen used to edit a marketing card — a name, a monthly price and a
// list of strings. The client sells four packages with different durations and
// a per-service allowance each, so the form now edits terms that are actually
// enforced at booking: how long it runs, the discount rate, and the rows.
//
// EDITS DO NOT REACH MEMBERSHIPS ALREADY SOLD. Every membership copies its
// terms at purchase, so changing a price here sets what the NEXT buyer pays and
// silently rewrites nothing.
// ─────────────────────────────────────────────────────────────

const ACCENTS = ["blue", "emerald", "purple", "amber", "rose", "slate"] as const;
const ACCENT_LABELS: Record<string, string> = {
  blue: "أزرق",
  emerald: "أخضر",
  purple: "بنفسجي",
  amber: "برتقالي",
  rose: "وردي",
  slate: "رمادي",
};

const ICONS = ["activity", "star", "home", "shield", "heart", "calendar"] as const;
const ICON_LABELS: Record<string, string> = {
  activity: "نبض",
  star: "نجمة",
  home: "منزل",
  shield: "درع",
  heart: "قلب",
  calendar: "تقويم",
};

/** The three marks the patient's card draws per row. */
const STATES = ["AVAILABLE", "SUSPENDED", "LOCKED"] as const;
const STATE_LABELS: Record<string, string> = {
  AVAILABLE: "متاح",
  SUSPENDED: "معلق",
  LOCKED: "غير مشمول",
};

/** Common durations, so the usual four are one click rather than arithmetic. */
const DURATIONS = [
  { value: "1", label: "يوم واحد" },
  { value: "7", label: "أسبوع" },
  { value: "30", label: "شهر" },
  { value: "365", label: "سنة" },
];

type Benefit = {
  id?: string;
  serviceType: string | null;
  label: string;
  quota: number | null;
  state: string;
  sortOrder: number;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  discountPercent: number;
  accent: string;
  icon: string;
  isPopular: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  benefits: Benefit[];
};

type BenefitDraft = {
  serviceType: string;
  label: string;
  /** Text, not a number: "" is the unlimited case and 0 is a different answer. */
  quota: string;
  state: string;
};

type FormState = {
  code: string;
  name: string;
  description: string;
  price: string;
  durationDays: string;
  discountPercent: string;
  accent: string;
  icon: string;
  isPopular: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: string;
  benefits: BenefitDraft[];
};

const EMPTY: FormState = {
  code: "",
  name: "",
  description: "",
  price: "",
  durationDays: "30",
  discountPercent: "0",
  accent: "blue",
  icon: "activity",
  isPopular: false,
  isActive: true,
  isComingSoon: false,
  sortOrder: "0",
  benefits: [],
};

const SERVICE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as [string, string][];

export default function PlansPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Plan[]>({ url: "/api/plans" });

  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Plan | null>(null);
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
        code: form.code.trim().toUpperCase(),
        name: form.name,
        description: form.description.trim() || null,
        price: Number(form.price),
        durationDays: Number(form.durationDays || 30),
        discountPercent: Number(form.discountPercent || 0),
        accent: form.accent,
        icon: form.icon,
        isPopular: form.isPopular,
        isActive: form.isActive,
        isComingSoon: form.isComingSoon,
        sortOrder: Number(form.sortOrder || 0),
        benefits: form.benefits.map((benefit, index) => ({
          serviceType: benefit.serviceType || null,
          label: benefit.label.trim(),
          // "" means unlimited; "0" is a row that grants nothing. Number("")
          // is 0, which would silently turn the first into the second.
          quota: benefit.quota.trim() === "" ? null : Number(benefit.quota),
          state: benefit.state,
          sortOrder: index,
        })),
      };
      return editing
        ? apiFetch(`/api/plans/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch("/api/plans", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث الباقة" : "تمت إضافة الباقة", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/plans/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم تنفيذ الطلب", onSuccess: done }
  );

  const setBenefit = useCallback((index: number, patch: Partial<BenefitDraft>) => {
    setForm((f) => ({
      ...f,
      benefits: f.benefits.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }, []);

  const addBenefit = useCallback(() => {
    setForm((f) => ({
      ...f,
      benefits: [...f.benefits, { serviceType: "", label: "", quota: "", state: "AVAILABLE" }],
    }));
  }, []);

  const removeBenefit = useCallback((index: number) => {
    setForm((f) => ({ ...f, benefits: f.benefits.filter((_, i) => i !== index) }));
  }, []);

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "الباقة",
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
            {r.name}
            {r.isPopular ? <Pill tone="positive">الأكثر طلباً</Pill> : null}
            {r.isComingSoon ? <Pill tone="warning">قريباً</Pill> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono" dir="ltr">
              {r.code}
            </span>
            {r.description ? ` · ${r.description}` : ""}
          </p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "price",
      header: "السعر",
      align: "end",
      render: (r) => (
        <div className="whitespace-nowrap text-end">
          <p className="font-semibold tabular-nums text-foreground">{formatCurrency(r.price)}</p>
          <p className="text-xs text-muted-foreground">
            {/* The duration beside the price, because a number alone cannot be
                compared between a one-day and a twelve-month package. */}
            {r.durationDays === 1 ? "يوم" : `${formatNumber(r.durationDays)} يوم`}
          </p>
        </div>
      ),
      sortValue: (r) => Number(r.price),
    },
    {
      key: "discountPercent",
      header: "نسبة الخصم",
      align: "end",
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {r.discountPercent}%
        </span>
      ),
      sortValue: (r) => Number(r.discountPercent),
    },
    {
      key: "benefits",
      header: "المزايا",
      secondary: true,
      render: (r) => {
        const live = r.benefits.filter((b) => b.state === "AVAILABLE").length;
        return (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatNumber(live)} متاحة من {formatNumber(r.benefits.length)}
          </span>
        );
      },
      sortValue: (r) => r.benefits.length,
    },
    {
      key: "accent",
      header: "المظهر",
      secondary: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {ACCENT_LABELS[r.accent] ?? r.accent} · {ICON_LABELS[r.icon] ?? r.icon}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "الحالة",
      render: (r) => (
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "ظاهرة" : "مخفية"}</Pill>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="عضويات وريد وسند"
        subtitle="تظهر في تطبيق سند وخارجه معاً — المشترك يستخدم عضويته في الاثنين"
        icon={Layers}
        action={{
          label: "باقة جديدة",
          onClick: () => {
            setForm(EMPTY);
            setCreating(true);
          },
        }}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name} ${r.code} ${r.description ?? ""}`}
        searchPlaceholder="بحث عن باقة..."
        filters={[
          {
            key: "isActive",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "ظاهرة" },
              { value: "no", label: "مخفية" },
              { value: "soon", label: "متوفر قريباً" },
            ],
            match: (r, v) =>
              v === "soon" ? r.isComingSoon : v === "yes" ? r.isActive : !r.isActive,
          },
        ]}
        emptyMessage="لا توجد باقات بعد"
        actions={(r) => (
          <RowActions
            label={r.name}
            onEdit={() => {
              setEditing(r);
              setForm({
                code: r.code,
                name: r.name,
                description: r.description ?? "",
                price: String(r.price),
                durationDays: String(r.durationDays),
                discountPercent: String(r.discountPercent),
                accent: r.accent,
                icon: r.icon,
                isPopular: r.isPopular,
                isActive: r.isActive,
                isComingSoon: r.isComingSoon,
                sortOrder: String(r.sortOrder),
                benefits: (r.benefits ?? []).map((b) => ({
                  serviceType: b.serviceType ?? "",
                  label: b.label,
                  quota: b.quota === null ? "" : String(b.quota),
                  state: b.state,
                })),
              });
            }}
            onDelete={() => setDeleting(r)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الباقة" : "باقة جديدة"}
        description={
          editing
            ? "التعديل يسري على المشتركين الجدد فقط — العضويات المُباعة تحتفظ بشروطها"
            : "تظهر للمستخدمين داخل سند وخارجه"
        }
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
        submitDisabled={form.name.trim() === "" || form.code.trim() === "" || form.price === ""}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم الباقة" htmlFor="plan-name">
            <input
              id="plan-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="باقة شهري"
            />
          </Field>
          <Field
            label="الرمز"
            htmlFor="plan-code"
            hint="ثابت — لا يتغيّر بعد البيع"
          >
            <input
              id="plan-code"
              dir="ltr"
              className={fieldClass}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="MONTHLY"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="السعر (د.ع)" htmlFor="plan-price">
            <input
              id="plan-price"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
          <Field label="المدة (أيام)" htmlFor="plan-duration">
            <input
              id="plan-duration"
              type="number"
              min={1}
              dir="ltr"
              list="plan-durations"
              className={fieldClass}
              value={form.durationDays}
              onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
            />
            <datalist id="plan-durations">
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value} label={d.label} />
              ))}
            </datalist>
          </Field>
          <Field label="نسبة الخصم %" htmlFor="plan-discount">
            <input
              id="plan-discount"
              type="number"
              min={0}
              max={100}
              step="0.5"
              dir="ltr"
              className={fieldClass}
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="الوصف" htmlFor="plan-desc">
          <input
            id="plan-desc"
            className={fieldClass}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="صالح لمدة 30 يوم — خطة متكاملة لشهر كامل"
          />
        </Field>

        {/* ── المزايا ─────────────────────────────────────────── */}
        <Field
          label="مزايا الباقة"
          htmlFor="plan-benefits"
          hint="اترك العدد فارغاً لغير المحدود · «معلق» تظهر على البطاقة ولا تُحتسب"
        >
          <div id="plan-benefits" className="space-y-2">
            {form.benefits.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                لا مزايا بعد — أضف صفاً لكل سطر يظهر على البطاقة
              </p>
            ) : null}

            {form.benefits.map((benefit, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_4.5rem_6rem_2rem] items-center gap-2"
              >
                <input
                  aria-label={`اسم الميزة ${index + 1}`}
                  className={fieldClass}
                  value={benefit.label}
                  onChange={(e) => setBenefit(index, { label: e.target.value })}
                  placeholder="حجز الأطباء"
                />
                <select
                  aria-label={`الخدمة المرتبطة بالميزة ${index + 1}`}
                  className={fieldClass}
                  value={benefit.serviceType}
                  onChange={(e) => setBenefit(index, { serviceType: e.target.value })}
                >
                  {/* No service = a line that states access rather than a
                      counted allowance. */}
                  <option value="">بدون خدمة</option>
                  {SERVICE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`عدد الميزة ${index + 1}`}
                  type="number"
                  min={0}
                  dir="ltr"
                  className={fieldClass}
                  value={benefit.quota}
                  onChange={(e) => setBenefit(index, { quota: e.target.value })}
                  placeholder="∞"
                />
                <select
                  aria-label={`حالة الميزة ${index + 1}`}
                  className={fieldClass}
                  value={benefit.state}
                  onChange={(e) => setBenefit(index, { state: e.target.value })}
                >
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {STATE_LABELS[state]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`حذف الميزة ${index + 1}`}
                  onClick={() => removeBenefit(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addBenefit}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus size={14} />
              إضافة ميزة
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="اللون" htmlFor="plan-accent">
            <select
              id="plan-accent"
              className={fieldClass}
              value={form.accent}
              onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value }))}
            >
              {ACCENTS.map((a) => (
                <option key={a} value={a}>
                  {ACCENT_LABELS[a]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الأيقونة" htmlFor="plan-icon">
            <select
              id="plan-icon"
              className={fieldClass}
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            >
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {ICON_LABELS[i]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الترتيب" htmlFor="plan-order">
            <input
              id="plan-order"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              checked={form.isPopular}
              onChange={(e) => setForm((f) => ({ ...f, isPopular: e.target.checked }))}
            />
            الأكثر طلباً
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            ظاهرة للمستخدمين
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              checked={form.isComingSoon}
              onChange={(e) => setForm((f) => ({ ...f, isComingSoon: e.target.checked }))}
            />
            متوفر قريباً
          </label>
        </div>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الباقة"
        description={
          // The server keeps a sold package and deactivates it instead. Saying
          // "لا يمكن التراجع" over an action that may not delete anything would
          // be the dialog lying about what the button does.
          `سيتم حذف «${deleting?.name ?? ""}» — وإن كانت مباعة لمشترك فسيتم إيقافها بدل حذفها.`
        }
        submitLabel="تأكيد"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
