"use client";

import { useCallback, useState } from "react";
import { Ticket, TicketCheck, TicketPercent } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useServerFilters } from "@/hooks/use-server-filters";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions, StatTile, type PillTone } from "@/components/data/crud-kit";
import { ServerFilterBar } from "@/components/data/server-filter-bar";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الكوبونات
//
// The API had full CRUD, checkout already validated coupon codes, and there was
// no screen anywhere to create one — the only coupons in the system were seeded.
//
// Two defects came out of wiring it. The API stored a code exactly as typed
// while checkout looked it up upper-cased, so "save10" could never be redeemed;
// and deleting a coupon cascaded away the record of who had used it. Both are
// fixed server-side, so no client can reintroduce them.
//
// NOT the same thing as العروض والحملات: a campaign discounts a service for
// everyone who books it; a coupon is a code a patient has to type.
// ─────────────────────────────────────────────────────────────

type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
};

type Summary = { redemptions: number; discountGiven: number };

type Draft = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
};

/** `<input type="date">` works in YYYY-MM-DD; a month from today by default. */
const inAMonth = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

const EMPTY: Draft = {
  code: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  maxUses: "0",
  expiresAt: inAMonth(),
  isActive: true,
};

const EMPTY_FILTERS = { q: "", status: "" };

/** Why a coupon does or does not work today — in one word. */
function stateOf(c: Coupon): { label: string; tone: PillTone } {
  if (!c.isActive) return { label: "موقوف", tone: "neutral" };
  if (new Date(c.expiresAt) <= new Date()) return { label: "منتهي", tone: "neutral" };
  if (c.maxUses > 0 && c.usedCount >= c.maxUses) return { label: "مستنفد", tone: "warning" };
  return { label: "فعّال", tone: "positive" };
}

const valueLabel = (c: Pick<Coupon, "discountType" | "discountValue">) =>
  c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : formatCurrency(c.discountValue);

export default function CouponsPage() {
  const filters = useServerFilters(EMPTY_FILTERS);
  const { data, meta, isLoading, error, refetch } = useDashboardData<Coupon[]>({
    url: "/api/coupons",
    params: { limit: "100", ...filters.params },
  });
  const summary = (meta?.summary ?? null) as Summary | null;

  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setDeleting(null);
    setDraft({ ...EMPTY, expiresAt: inAMonth() });
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      const body = {
        code: draft.code.trim(),
        discountType: draft.discountType,
        discountValue: Number(draft.discountValue),
        maxUses: Number(draft.maxUses || 0),
        // End of the chosen day in Baghdad, not midnight UTC — a coupon marked
        // "valid until the 30th" must still work on the evening of the 30th.
        expiresAt: new Date(`${draft.expiresAt}T23:59:59+03:00`).toISOString(),
        isActive: draft.isActive,
      };
      return editing
        ? apiFetch(`/api/coupons/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/api/coupons", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث الكوبون" : "تم إنشاء الكوبون", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/coupons/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم تنفيذ الطلب", onSuccess: done }
  );

  const value = Number(draft.discountValue);
  const invalidValue =
    !Number.isFinite(value) || value <= 0 || (draft.discountType === "PERCENTAGE" && value > 100);

  const columns: Column<Coupon>[] = [
    {
      key: "code",
      header: "الرمز",
      render: (c) => (
        <span className="font-mono text-sm font-semibold text-foreground" dir="ltr">
          {c.code}
        </span>
      ),
      sortValue: (c) => c.code,
    },
    {
      key: "value",
      header: "الخصم",
      render: (c) => <span className="whitespace-nowrap font-semibold tabular-nums">{valueLabel(c)}</span>,
      sortValue: (c) => Number(c.discountValue),
    },
    {
      key: "usage",
      header: "الاستخدام",
      align: "end",
      render: (c) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {formatNumber(c.usedCount)} / {c.maxUses === 0 ? "∞" : formatNumber(c.maxUses)}
        </span>
      ),
      sortValue: (c) => c.usedCount,
    },
    {
      key: "expiresAt",
      header: "ينتهي",
      render: (c) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.expiresAt)}</span>
      ),
      sortValue: (c) => new Date(c.expiresAt).getTime(),
    },
    {
      key: "state",
      header: "الحالة",
      render: (c) => {
        const s = stateOf(c);
        return <Pill tone={s.tone}>{s.label}</Pill>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الكوبونات"
        subtitle="رموز خصم يكتبها المريض عند الحجز — تختلف عن العروض التي تُطبَّق تلقائياً"
        icon={TicketPercent}
        action={{
          label: "كوبون جديد",
          onClick: () => {
            setDraft({ ...EMPTY, expiresAt: inAMonth() });
            setCreating(true);
          },
        }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          icon={Ticket}
          label="مرات الاستخدام"
          value={summary ? formatNumber(summary.redemptions) : "—"}
          hint="منذ البداية، لكل الكوبونات"
        />
        <StatTile
          icon={TicketCheck}
          label="قيمة الخصومات الممنوحة"
          value={summary ? formatCurrency(summary.discountGiven) : "—"}
          hint="ما كلّفته الكوبونات فعلاً"
        />
      </div>

      <ServerFilterBar
        idPrefix="cp"
        search={{ placeholder: "بحث بالرمز..." }}
        selects={[
          {
            key: "status",
            label: "الحالة",
            placeholder: "كل الحالات",
            options: [
              { value: "live", label: "فعّال" },
              { value: "exhausted", label: "مستنفد" },
              { value: "expired", label: "منتهي" },
              { value: "inactive", label: "موقوف" },
            ],
          },
        ]}
        values={filters.values}
        onChange={(key, v) => filters.set(key as keyof typeof EMPTY_FILTERS, v)}
        isActive={filters.isActive}
        onReset={filters.reset}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage={filters.isActive ? "لا كوبونات تطابق البحث" : "لا توجد كوبونات بعد"}
        actions={(c) => (
          <RowActions
            label={c.code}
            onEdit={() => {
              setEditing(c);
              setDraft({
                code: c.code,
                discountType: c.discountType,
                discountValue: String(c.discountValue),
                maxUses: String(c.maxUses),
                expiresAt: c.expiresAt.slice(0, 10),
                isActive: c.isActive,
              });
            }}
            onDelete={() => setDeleting(c)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الكوبون" : "كوبون جديد"}
        description={editing ? `استُخدم ${editing.usedCount} مرة` : "يُحفظ الرمز بأحرف كبيرة — يعمل كيفما كتبه المريض"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
        submitDisabled={draft.code.trim().length < 3 || invalidValue || draft.expiresAt === ""}
      >
        <Field label="الرمز" htmlFor="cp-code" hint="أحرف إنجليزية وأرقام — مثل RAMADAN25">
          <input
            id="cp-code"
            dir="ltr"
            className={`${fieldClass} font-mono uppercase`}
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
            maxLength={32}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع الخصم" htmlFor="cp-type">
            <select
              id="cp-type"
              className={fieldClass}
              value={draft.discountType}
              onChange={(e) => setDraft((d) => ({ ...d, discountType: e.target.value as Draft["discountType"] }))}
            >
              <option value="PERCENTAGE">نسبة مئوية</option>
              <option value="FIXED">مبلغ ثابت</option>
            </select>
          </Field>
          <Field
            label={draft.discountType === "PERCENTAGE" ? "النسبة %" : "المبلغ (د.ع)"}
            htmlFor="cp-value"
            hint={draft.discountType === "PERCENTAGE" ? "من 1 إلى 100" : undefined}
          >
            <input
              id="cp-value"
              type="number"
              min={0}
              max={draft.discountType === "PERCENTAGE" ? 100 : undefined}
              dir="ltr"
              className={fieldClass}
              value={draft.discountValue}
              onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الحد الأقصى للاستخدام" htmlFor="cp-max" hint="0 = غير محدود · مرة واحدة لكل مريض دائماً">
            <input
              id="cp-max"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={draft.maxUses}
              onChange={(e) => setDraft((d) => ({ ...d, maxUses: e.target.value }))}
            />
          </Field>
          <Field label="ينتهي في" htmlFor="cp-exp" hint="يعمل حتى نهاية اليوم">
            <input
              id="cp-exp"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={draft.expiresAt}
              onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            checked={draft.isActive}
            onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          />
          فعّال
        </label>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الكوبون"
        description={
          deleting && deleting.usedCount > 0
            ? `«${deleting.code}» استُخدم ${deleting.usedCount} مرة — سيُوقف بدل حذفه، ليبقى سجل من حصل على الخصم.`
            : `سيُحذف «${deleting?.code ?? ""}» نهائياً.`
        }
        submitLabel={deleting && deleting.usedCount > 0 ? "إيقاف" : "حذف"}
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
