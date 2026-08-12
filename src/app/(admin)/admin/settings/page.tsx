"use client";

import { useCallback, useState } from "react";
import { STALE_TIME } from "@/lib/request-cache";
import { MapPin, Settings } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إعدادات النظام (req L265)
//
// The coverage map — governorates and their areas — is the system
// configuration the platform actually reads: `Order.governorateId`,
// `Partner.governorateId`, and the service-coverage lists on this admin area
// all resolve against it.
//
// There is no `SystemSetting` model, so there are no other settings to
// administer. A screen of switches wired to nothing would look complete and be
// worse than absent.
// ─────────────────────────────────────────────────────────────

type Governorate = {
  id: string;
  name: string;
  isActive: boolean;
  areas: string[];
  _count: { partners: number; orders: number; users: number };
};

type FormState = { name: string; isActive: boolean; areas: string };

const EMPTY: FormState = { name: "", isActive: true, areas: "" };

/** Areas are stored as a JSON array; the form edits them as one line. */
const parseAreas = (raw: string) =>
  raw
    .split(/[,،\n]/)
    .map((a) => a.trim())
    .filter(Boolean);

export default function SettingsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Governorate[]>({
    url: "/api/governorates",
    staleTime: STALE_TIME.reference,
  });

  const [editing, setEditing] = useState<Governorate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Governorate | null>(null);
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
        isActive: form.isActive,
        areas: parseAreas(form.areas),
      };
      return editing
        ? apiFetch(`/api/governorates/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : apiFetch("/api/governorates", { method: "POST", body: JSON.stringify(body) });
    },
    { successMessage: editing ? "تم تحديث المحافظة" : "تمت إضافة المحافظة", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/governorates/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف المحافظة", onSuccess: done }
  );

  const { mutate: toggleActive } = useMutation(
    async (id: string, isActive: boolean) =>
      apiFetch(`/api/governorates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    { successMessage: "تم تحديث حالة المحافظة", onSuccess: () => void refetch() }
  );

  const columns: Column<Governorate>[] = [
    {
      key: "name",
      header: "المحافظة",
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      key: "isActive",
      header: "الحالة",
      render: (r) => (
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "مفعّلة" : "معطّلة"}</Pill>
      ),
    },
    {
      key: "areas",
      header: "المناطق",
      render: (r) =>
        r.areas?.length ? (
          <div className="flex flex-wrap gap-1">
            {r.areas.slice(0, 3).map((a) => (
              <Pill key={a}>{a}</Pill>
            ))}
            {r.areas.length > 3 ? <Pill>+{r.areas.length - 3}</Pill> : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">لا مناطق</span>
        ),
      sortValue: (r) => r.areas?.length ?? 0,
    },
    {
      key: "partners",
      header: "الشركاء",
      secondary: true,
      align: "end",
      render: (r) => formatNumber(r._count?.partners ?? 0),
      sortValue: (r) => r._count?.partners ?? 0,
    },
    {
      key: "orders",
      header: "الطلبات",
      secondary: true,
      align: "end",
      render: (r) => formatNumber(r._count?.orders ?? 0),
      sortValue: (r) => r._count?.orders ?? 0,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إعدادات النظام"
        subtitle="خريطة التغطية — المحافظات ومناطقها التي تُبنى عليها الطلبات وتغطية الشركاء"
        icon={Settings}
        action={{
          label: "محافظة جديدة",
          onClick: () => {
            setForm(EMPTY);
            setCreating(true);
          },
        }}
      />

      <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/30 p-4">
        <MapPin size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          تعطيل محافظة يخفيها من كل قوائم الاختيار في المنصة دون المساس بالطلبات السابقة
          المسجّلة فيها. الحذف متاح فقط للمحافظات غير المرتبطة بأي سجل.
        </p>
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name} ${(r.areas ?? []).join(" ")}`}
        searchPlaceholder="بحث بالمحافظة أو المنطقة..."
        filters={[
          {
            key: "isActive",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "مفعّلة" },
              { value: "no", label: "معطّلة" },
            ],
            match: (r, v) => (v === "yes" ? r.isActive : !r.isActive),
          },
        ]}
        emptyMessage="لا توجد محافظات معرّفة بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => void toggleActive(r.id, !r.isActive)}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {r.isActive ? "تعطيل" : "تفعيل"}
            </button>
            <RowActions
              label={r.name}
              onEdit={() => {
                setEditing(r);
                setForm({
                  name: r.name,
                  isActive: r.isActive,
                  areas: (r.areas ?? []).join("، "),
                });
              }}
              onDelete={() => setDeleting(r)}
            />
          </div>
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل المحافظة" : "محافظة جديدة"}
        description={editing?.name ?? "أضف محافظة إلى خريطة التغطية"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="اسم المحافظة" htmlFor="gov-name">
          <input
            id="gov-name"
            className={fieldClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="بغداد"
          />
        </Field>

        <Field label="المناطق" htmlFor="gov-areas" hint="افصل بينها بفاصلة أو سطر جديد">
          <textarea
            id="gov-areas"
            rows={4}
            className={`${fieldClass} h-auto py-2.5 leading-relaxed`}
            value={form.areas}
            onChange={(e) => setForm((f) => ({ ...f, areas: e.target.value }))}
            placeholder="الكرادة، المنصور، الأعظمية"
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          مفعّلة
        </label>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف المحافظة"
        description={`سيتم حذف «${deleting?.name ?? ""}». المحافظات المرتبطة بسجلات لا يمكن حذفها — عطّلها بدلاً من ذلك.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}
