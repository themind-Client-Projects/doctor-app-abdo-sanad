"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Megaphone } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Field, FormDialog, fieldClass } from "@/components/admin/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/admin/crud-kit";
import { CHANNEL_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الإعلانات
//
// Channel-scoped, unlike the subscription plans: the main home runs
// "إعلانات وتخفيضات" while the Sanad home runs "خصم 20% على التحاليل". Both
// were hardcoded — the main one was literally the same image repeated by a
// `[1,2,3].map`.
// ─────────────────────────────────────────────────────────────

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string | null;
  channel: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

type FormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  channel: string;
  isActive: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY: FormState = {
  title: "",
  subtitle: "",
  imageUrl: "/ads/real_clinic_banner.png",
  href: "",
  channel: "",
  isActive: true,
  sortOrder: "0",
  startsAt: "",
  endsAt: "",
};

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (v: string) => (v.trim() === "" ? null : new Date(v).toISOString());

/** Live = active AND inside its flight window (a null bound means unbounded). */
function isLive(b: Banner, now: number): boolean {
  if (!b.isActive) return false;
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return false;
  return true;
}

export default function BannersPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Banner[]>({ url: "/api/banners" });

  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Banner | null>(null);
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
        title: form.title,
        subtitle: form.subtitle.trim() || null,
        imageUrl: form.imageUrl,
        href: form.href.trim() || null,
        channel: form.channel === "" ? null : form.channel,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || 0),
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
      };
      return editing
        ? apiFetch(`/api/banners/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiFetch("/api/banners", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث الإعلان" : "تمت إضافة الإعلان", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/banners/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الإعلان", onSuccess: done }
  );

  const columns: Column<Banner>[] = [
    {
      key: "title",
      header: "الإعلان",
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            {/* `unoptimized` because the URL may be an external campaign asset
                that is not in next.config's remotePatterns. */}
            <Image src={r.imageUrl} alt="" fill unoptimized className="object-cover" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.title}</p>
            <p className="truncate text-xs text-muted-foreground">{r.subtitle || "—"}</p>
          </div>
        </div>
      ),
      sortValue: (r) => r.title,
    },
    {
      key: "channel",
      header: "الظهور",
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
        const live = isLive(r, Date.now());
        return (
          <Pill tone={live ? "positive" : "neutral"}>
            {!r.isActive ? "معطّل" : live ? "يعرض الآن" : "خارج الفترة"}
          </Pill>
        );
      },
    },
    {
      key: "window",
      header: "فترة العرض",
      secondary: true,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {r.startsAt || r.endsAt
            ? `${r.startsAt ? formatDate(r.startsAt) : "—"} ← ${r.endsAt ? formatDate(r.endsAt) : "—"}`
            : "دائم"}
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
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإعلانات"
        subtitle="بانرات الصفحة الرئيسية — لكل واجهة إعلاناتها: سند أو خارج سند أو الاثنان"
        icon={Megaphone}
        action={{
          label: "إعلان جديد",
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
        searchable={(r) => `${r.title} ${r.subtitle ?? ""}`}
        searchPlaceholder="بحث عن إعلان..."
        filters={[
          {
            key: "channel",
            label: "كل الواجهات",
            options: [...optionsOf(CHANNEL_LABELS), { value: "__all", label: "كل الواجهات" }],
            match: (r, v) => (v === "__all" ? r.channel === null : r.channel === v),
          },
          {
            key: "live",
            label: "كل الحالات",
            options: [
              { value: "live", label: "يعرض الآن" },
              { value: "off", label: "غير معروض" },
            ],
            match: (r, v) => (v === "live" ? isLive(r, Date.now()) : !isLive(r, Date.now())),
          },
        ]}
        emptyMessage="لا توجد إعلانات بعد"
        actions={(r) => (
          <RowActions
            label={r.title}
            onEdit={() => {
              setEditing(r);
              setForm({
                title: r.title,
                subtitle: r.subtitle ?? "",
                imageUrl: r.imageUrl,
                href: r.href ?? "",
                channel: r.channel ?? "",
                isActive: r.isActive,
                sortOrder: String(r.sortOrder),
                startsAt: toDateInput(r.startsAt),
                endsAt: toDateInput(r.endsAt),
              });
            }}
            onDelete={() => setDeleting(r)}
          />
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الإعلان" : "إعلان جديد"}
        description={editing?.title ?? "يظهر أعلى الصفحة الرئيسية للواجهة المختارة"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="العنوان" htmlFor="b-title">
          <input
            id="b-title"
            className={fieldClass}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="إعلانات وتخفيضات"
          />
        </Field>

        <Field label="النص الفرعي" htmlFor="b-subtitle">
          <input
            id="b-subtitle"
            className={fieldClass}
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            placeholder="تعرف على أحدث العروض والخدمات في مجمعاتنا"
          />
        </Field>

        <Field label="رابط الصورة" htmlFor="b-image" hint="مسار داخل /public أو رابط كامل">
          <input
            id="b-image"
            dir="ltr"
            className={fieldClass}
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="وجهة الضغط" htmlFor="b-href" hint="اتركه فارغاً لإعلان غير قابل للضغط">
            <input
              id="b-href"
              dir="ltr"
              className={fieldClass}
              value={form.href}
              onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
              placeholder="/services/offers"
            />
          </Field>
          <Field label="الواجهة" htmlFor="b-channel">
            <select
              id="b-channel"
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
          <Field label="بداية العرض" htmlFor="b-start" hint="اختياري">
            <input
              id="b-start"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </Field>
          <Field label="نهاية العرض" htmlFor="b-end" hint="اختياري">
            <input
              id="b-end"
              type="date"
              dir="ltr"
              className={fieldClass}
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="الترتيب" htmlFor="b-order">
            <input
              id="b-order"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </Field>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            مفعّل
          </label>
        </div>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الإعلان"
        description={`سيتم حذف «${deleting?.title ?? ""}». لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
