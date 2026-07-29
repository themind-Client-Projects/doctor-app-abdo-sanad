"use client";

import { useCallback, useState } from "react";
import { Stethoscope } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Field, FormDialog, fieldClass } from "@/components/admin/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/admin/crud-kit";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// التخصصات الطبية
//
// GLOBAL, like the plans: a cardiologist is a cardiologist in سند and outside
// it. Only the doctor POOL is channel-scoped, not the specialty list.
//
// The frontend filter row reads a hardcoded `SPECIALIZATIONS` constant while
// `DoctorProfile.specialtyId` points at these rows — so the filter could offer
// a specialty no doctor was keyed to, and hide one that several were.
// ─────────────────────────────────────────────────────────────

type Specialty = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { doctors: number };
};

type FormState = {
  slug: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  slug: "",
  name: "",
  icon: "",
  color: "",
  sortOrder: "0",
  isActive: true,
};

export default function SpecialtiesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Specialty[]>({
    url: "/api/specialties",
  });

  const [editing, setEditing] = useState<Specialty | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
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
        icon: form.icon.trim() || null,
        color: form.color.trim() || null,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      };
      return editing
        ? // `slug` is the stable machine key doctors are keyed to — changing it
          // would orphan them, so it is create-only.
          apiFetch(`/api/specialties/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : apiFetch("/api/specialties", {
            method: "POST",
            body: JSON.stringify({ ...body, slug: form.slug }),
          });
    },
    { successMessage: editing ? "تم تحديث التخصص" : "تمت إضافة التخصص", onSuccess: done }
  );

  const { mutate: toggle } = useMutation(
    async (id: string, isActive: boolean) =>
      apiFetch(`/api/specialties/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    { successMessage: "تم تحديث حالة التخصص", onSuccess: () => void refetch() }
  );

  const columns: Column<Specialty>[] = [
    {
      key: "name",
      header: "التخصص",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {r.slug}
          </p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "doctors",
      header: "الأطباء",
      align: "end",
      render: (r) => formatNumber(r._count?.doctors ?? 0),
      sortValue: (r) => r._count?.doctors ?? 0,
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
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "ظاهر" : "مخفي"}</Pill>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="التخصصات الطبية"
        subtitle="قائمة التخصصات التي تُفلتر بها صفحات الأطباء — مشتركة بين سند وخارجه"
        icon={Stethoscope}
        action={{
          label: "تخصص جديد",
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
        searchable={(r) => `${r.name} ${r.slug}`}
        searchPlaceholder="بحث عن تخصص..."
        filters={[
          {
            key: "isActive",
            label: "كل الحالات",
            options: [
              { value: "yes", label: "ظاهر" },
              { value: "no", label: "مخفي" },
            ],
            match: (r, v) => (v === "yes" ? r.isActive : !r.isActive),
          },
        ]}
        emptyMessage="لا توجد تخصصات بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => void toggle(r.id, !r.isActive)}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {r.isActive ? "إخفاء" : "إظهار"}
            </button>
            <RowActions
              label={r.name}
              onEdit={() => {
                setEditing(r);
                setForm({
                  slug: r.slug,
                  name: r.name,
                  icon: r.icon ?? "",
                  color: r.color ?? "",
                  sortOrder: String(r.sortOrder),
                  isActive: r.isActive,
                });
              }}
            />
          </div>
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل التخصص" : "تخصص جديد"}
        description={
          editing
            ? `${editing.name} — مرتبط بـ ${formatNumber(editing._count?.doctors ?? 0)} طبيب`
            : "المعرّف اللاتيني لا يمكن تغييره بعد الإنشاء"
        }
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم" htmlFor="s-name">
            <input
              id="s-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="أمراض القلب"
            />
          </Field>
          <Field
            label="المعرّف"
            htmlFor="s-slug"
            hint={editing ? "غير قابل للتغيير" : "حروف لاتينية صغيرة وشرطات"}
          >
            <input
              id="s-slug"
              dir="ltr"
              className={fieldClass}
              value={form.slug}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="cardiology"
            />
          </Field>
          <Field label="الأيقونة" htmlFor="s-icon" hint="مفتاح يترجمه التطبيق">
            <input
              id="s-icon"
              dir="ltr"
              className={fieldClass}
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="heart"
            />
          </Field>
          <Field label="الترتيب" htmlFor="s-order">
            <input
              id="s-order"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
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
          ظاهر في فلاتر التطبيق
        </label>
      </FormDialog>
    </div>
  );
}
