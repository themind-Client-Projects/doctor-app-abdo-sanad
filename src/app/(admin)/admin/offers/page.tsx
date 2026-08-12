"use client";

import { useCallback, useState } from "react";
import { PercentSquare } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import {
  CHANNEL_LABELS,
  SERVICE_TYPE_KEYS,
  SERVICE_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// العروض والحملات (req L237)
//
// `Campaign` already carried the discount, the window and the targeted
// services — it just had no channel, and no screen. /services/offers rendered
// its own inline array of six offers with category chips, none of which any
// admin could touch.
//
// Channel-scoped: "وفر حتى 80%" is a Sanad promise, not a platform-wide one.
// ─────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  startDate: string;
  endDate: string;
  targetServices: string[];
  channel: string | null;
  isActive: boolean;
};

type FormState = {
  name: string;
  description: string;
  discountType: string;
  discountValue: string;
  startDate: string;
  endDate: string;
  targetServices: string[];
  channel: string;
  isActive: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: FormState = {
  name: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  startDate: "",
  endDate: "",
  targetServices: [],
  channel: "",
  isActive: true,
};

const toDateInput = (iso: string) => iso.slice(0, 10);

/** Running = active AND today falls inside the window. */
function isRunning(c: Campaign, now: number): boolean {
  return (
    c.isActive &&
    new Date(c.startDate).getTime() <= now &&
    new Date(c.endDate).getTime() >= now
  );
}

export default function OffersPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Campaign[]>({
    url: "/api/campaigns",
    params: { limit: "100" },
  });

  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
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
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        targetServices: form.targetServices,
        channel: form.channel === "" ? null : form.channel,
        isActive: form.isActive,
      };
      return editing
        ? apiFetch(`/api/campaigns/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/api/campaigns", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث العرض" : "تمت إضافة العرض", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/campaigns/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف العرض", onSuccess: done }
  );

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "العرض",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.description || "—"}</p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "discount",
      header: "الخصم",
      align: "end",
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
          {r.discountType === "PERCENTAGE"
            ? `${formatNumber(r.discountValue)}%`
            : formatCurrency(r.discountValue)}
        </span>
      ),
      sortValue: (r) => Number(r.discountValue),
    },
    {
      key: "channel",
      header: "الواجهة",
      render: (r) =>
        r.channel ? (
          <Pill tone="info">{labelOf(CHANNEL_LABELS, r.channel)}</Pill>
        ) : (
          <Pill>كل الواجهات</Pill>
        ),
    },
    {
      key: "status",
      header: "الحالة",
      render: (r) => {
        const running = isRunning(r, Date.now());
        return (
          <Pill tone={running ? "positive" : "neutral"}>
            {!r.isActive ? "معطّل" : running ? "ساري" : "خارج الفترة"}
          </Pill>
        );
      },
    },
    {
      key: "window",
      header: "الفترة",
      secondary: true,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(r.startDate)} ← {formatDate(r.endDate)}
        </span>
      ),
      sortValue: (r) => new Date(r.endDate).getTime(),
    },
    {
      key: "targetServices",
      header: "الخدمات",
      secondary: true,
      render: (r) =>
        r.targetServices?.length ? (
          <span className="text-xs text-muted-foreground">
            {r.targetServices
              .slice(0, 2)
              .map((s) => labelOf(SERVICE_TYPE_LABELS, s))
              .join("، ")}
            {r.targetServices.length > 2 ? ` +${r.targetServices.length - 2}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">كل الخدمات</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="العروض والحملات"
        subtitle="خصومات على الخدمات — لكل واجهة عروضها، أو عرض مشترك بين الاثنين"
        icon={PercentSquare}
        action={{
          label: "عرض جديد",
          onClick: () => {
            setForm({ ...EMPTY, startDate: today(), endDate: today() });
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
        searchPlaceholder="بحث عن عرض..."
        filters={[
          {
            key: "channel",
            label: "كل الواجهات",
            options: [...optionsOf(CHANNEL_LABELS), { value: "__all", label: "كل الواجهات" }],
            match: (r, v) => (v === "__all" ? r.channel === null : r.channel === v),
          },
          {
            key: "running",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "ساري الآن" },
              { value: "no", label: "غير ساري" },
            ],
            match: (r, v) =>
              v === "yes" ? isRunning(r, Date.now()) : !isRunning(r, Date.now()),
          },
        ]}
        emptyMessage="لا توجد عروض بعد"
        actions={(r) => (
          <RowActions
            label={r.name}
            onEdit={() => {
              setEditing(r);
              setForm({
                name: r.name,
                description: r.description ?? "",
                discountType: r.discountType,
                discountValue: String(r.discountValue),
                startDate: toDateInput(r.startDate),
                endDate: toDateInput(r.endDate),
                targetServices: r.targetServices ?? [],
                channel: r.channel ?? "",
                isActive: r.isActive,
              });
            }}
            onDelete={() => setDeleting(r)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل العرض" : "عرض جديد"}
        description={editing?.name ?? "يظهر في صفحة العروض وفي الواجهة المختارة"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="اسم العرض" htmlFor="o-name">
          <input
            id="o-name"
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="خصم 20% على التحاليل"
          />
        </Field>

        <Field label="الوصف" htmlFor="o-desc">
          <input
            id="o-desc"
            className={fieldClass}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="احجز الآن من خلال التطبيق في مختبرات الشفاء"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع الخصم" htmlFor="o-type">
            <select
              id="o-type"
              className={fieldClass}
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
            >
              <option value="PERCENTAGE">نسبة مئوية %</option>
              <option value="FIXED">مبلغ ثابت د.ع</option>
            </select>
          </Field>
          <Field label="قيمة الخصم" htmlFor="o-value">
            <input
              id="o-value"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
            />
          </Field>
          <Field label="بداية العرض" htmlFor="o-start">
            <input
              id="o-start"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>
          <Field label="نهاية العرض" htmlFor="o-end">
            <input
              id="o-end"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="الواجهة" htmlFor="o-channel" hint="«كل الواجهات» يعرضه داخل سند وخارجه">
          <select
            id="o-channel"
            className={fieldClass}
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="">كل الواجهات</option>
            {optionsOf(CHANNEL_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-foreground">
            الخدمات المشمولة
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">لا تختر شيئاً لشمول كل الخدمات</p>
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-input p-2">
            {SERVICE_TYPE_KEYS.map((t) => {
              const on = form.targetServices.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      targetServices: on
                        ? f.targetServices.filter((s) => s !== t)
                        : [...f.targetServices, t],
                    }))
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {SERVICE_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

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
        title="حذف العرض"
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
