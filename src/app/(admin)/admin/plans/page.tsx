"use client";

import { useCallback, useState } from "react";
import { Layers } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import { formatCurrency, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الاشتراكات والباقات
//
// GLOBAL on purpose: a subscriber uses their plan inside سند and outside it, so
// `HealthPlan` carries no channel. Only the storefront *content* (banners,
// offers) and the provider pools are channel-scoped.
//
// The three plans were an inline array in src/app/(patient)/page.tsx, so
// changing a price meant a code deploy.
// ─────────────────────────────────────────────────────────────

const ACCENTS = ["blue", "emerald", "purple", "amber", "rose"] as const;
const ACCENT_LABELS: Record<string, string> = {
  blue: "أزرق",
  emerald: "أخضر",
  purple: "بنفسجي",
  amber: "برتقالي",
  rose: "وردي",
};

const ICONS = ["activity", "star", "home", "shield", "heart"] as const;
const ICON_LABELS: Record<string, string> = {
  activity: "نبض",
  star: "نجمة",
  home: "منزل",
  shield: "درع",
  heart: "قلب",
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  features: string[];
  accent: string;
  icon: string;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
};

type FormState = {
  name: string;
  description: string;
  monthlyPrice: string;
  features: string;
  accent: string;
  icon: string;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  monthlyPrice: "",
  features: "",
  accent: "blue",
  icon: "activity",
  isPopular: false,
  isActive: true,
  sortOrder: "0",
};

/** Features are a JSON array; the form edits them one per line. */
const parseFeatures = (raw: string) =>
  raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

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
        name: form.name,
        description: form.description.trim() || null,
        monthlyPrice: Number(form.monthlyPrice),
        features: parseFeatures(form.features),
        accent: form.accent,
        icon: form.icon,
        isPopular: form.isPopular,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || 0),
      };
      return editing
        ? apiFetch(`/api/plans/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch("/api/plans", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث الباقة" : "تمت إضافة الباقة", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/plans/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الباقة", onSuccess: done }
  );

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "الباقة",
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
            {r.name}
            {r.isPopular ? <Pill tone="positive">الأكثر طلباً</Pill> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{r.description || "—"}</p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "monthlyPrice",
      header: "السعر / شهر",
      align: "end",
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {formatCurrency(r.monthlyPrice)}
        </span>
      ),
      sortValue: (r) => Number(r.monthlyPrice),
    },
    {
      key: "features",
      header: "المزايا",
      secondary: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {formatNumber(r.features?.length ?? 0)} ميزة
        </span>
      ),
      sortValue: (r) => r.features?.length ?? 0,
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
      key: "sortOrder",
      header: "الترتيب",
      secondary: true,
      align: "end",
      render: (r) => formatNumber(r.sortOrder),
      sortValue: (r) => r.sortOrder,
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
        title="الاشتراكات والباقات"
        subtitle="تظهر في تطبيق سند وخارجه معاً — المشترك يستخدم باقته في الاثنين"
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
        searchable={(r) => `${r.name} ${r.description ?? ""}`}
        searchPlaceholder="بحث عن باقة..."
        filters={[
          {
            key: "isActive",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "ظاهرة" },
              { value: "no", label: "مخفية" },
            ],
            match: (r, v) => (v === "yes" ? r.isActive : !r.isActive),
          },
        ]}
        emptyMessage="لا توجد باقات بعد"
        actions={(r) => (
          <RowActions
            label={r.name}
            onEdit={() => {
              setEditing(r);
              setForm({
                name: r.name,
                description: r.description ?? "",
                monthlyPrice: String(r.monthlyPrice),
                features: (r.features ?? []).join("\n"),
                accent: r.accent,
                icon: r.icon,
                isPopular: r.isPopular,
                isActive: r.isActive,
                sortOrder: String(r.sortOrder),
              });
            }}
            onDelete={() => setDeleting(r)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الباقة" : "باقة جديدة"}
        description={editing?.name ?? "تظهر للمستخدمين داخل سند وخارجه"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم الباقة" htmlFor="plan-name">
            <input
              id="plan-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="الشاملة"
            />
          </Field>
          <Field label="السعر الشهري (د.ع)" htmlFor="plan-price">
            <input
              id="plan-price"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.monthlyPrice}
              onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="الوصف" htmlFor="plan-desc">
          <input
            id="plan-desc"
            className={fieldClass}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="تغطية متكاملة لجميع احتياجاتك"
          />
        </Field>

        <Field label="المزايا" htmlFor="plan-features" hint="ميزة واحدة في كل سطر">
          <textarea
            id="plan-features"
            rows={4}
            className={`${fieldClass} h-auto py-2.5 leading-relaxed`}
            value={form.features}
            onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
            placeholder={"3 كشفيات مجانية\nخصم 25% على التحاليل"}
          />
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
        </div>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الباقة"
        description={`سيتم حذف «${deleting?.name ?? ""}». لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
