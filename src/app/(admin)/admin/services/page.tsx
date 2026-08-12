"use client";

import { useCallback, useState } from "react";
import { STALE_TIME } from "@/lib/request-cache";
import { FileText } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions, toneForStatus } from "@/components/data/crud-kit";
import {
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_KEYS,
  SERVICE_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة الخدمات (req L183-198) — "هذه من أهم الصفحات"
//
// The previous version fetched /api/pricing and typed the result as
// ServiceConfig (a different model), labelled rows with a serviceType map
// whose ten keys matched no enum member, and its status update was
// `console.log("Update service", id, "to", status)` under a hardcoded
// four-card "example". Nothing on the page was connected to anything.
//
// req L183-198 asks for seven controls: activate, suspend, pause, reactivate,
// working hours, governorates, daily capacity. All seven are here, against
// /api/services.
// ─────────────────────────────────────────────────────────────

type ServiceConfig = {
  id: string;
  partnerId: string;
  serviceType: string;
  status: string;
  dailyCapacity: number | null;
  isHomeService: boolean;
  isBloodDraw: boolean;
  governorates: string[];
  workHours: Record<string, unknown> | null;
  partner: { id: string; name: string; type: string; status: string } | null;
};

type Partner = { id: string; name: string; type: string };
type Governorate = { id: string; name: string };

type FormState = {
  partnerId: string;
  serviceType: string;
  status: string;
  dailyCapacity: string;
  isHomeService: boolean;
  isBloodDraw: boolean;
  governorates: string[];
  workFrom: string;
  workTo: string;
};

const EMPTY: FormState = {
  partnerId: "",
  serviceType: "",
  status: "ACTIVE",
  dailyCapacity: "",
  isHomeService: false,
  isBloodDraw: false,
  governorates: [],
  workFrom: "",
  workTo: "",
};

/** `workHours` is a free-form Json column; the screen writes/reads {from,to}. */
function readHours(value: Record<string, unknown> | null): { from: string; to: string } {
  const from = typeof value?.from === "string" ? value.from : "";
  const to = typeof value?.to === "string" ? value.to : "";
  return { from, to };
}

export default function ServicesPage() {
  const {
    data: services,
    isLoading,
    error,
    refetch,
  } = useDashboardData<ServiceConfig[]>({ url: "/api/services" });

  // Both are needed to *create* a config; a partner picker with no partners
  // would make the create button a dead end.
  const { data: partners } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { limit: "100" },
  });
  const { data: governorates } = useDashboardData<Governorate[]>({
    url: "/api/governorates",
    staleTime: STALE_TIME.reference,
    params: { activeOnly: "true" },
  });

  const [editing, setEditing] = useState<ServiceConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ServiceConfig | null>(null);
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
      const workHours =
        form.workFrom && form.workTo ? { from: form.workFrom, to: form.workTo } : undefined;
      const capacity = form.dailyCapacity.trim() === "" ? null : Number(form.dailyCapacity);

      if (editing) {
        // partnerId / serviceType are unwritable server-side — moving a config
        // between partners is a create-and-delete, not an edit.
        return apiFetch(`/api/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: form.status,
            dailyCapacity: capacity,
            isHomeService: form.isHomeService,
            isBloodDraw: form.isBloodDraw,
            governorates: form.governorates,
            ...(workHours ? { workHours } : {}),
          }),
        });
      }

      return apiFetch("/api/services", {
        method: "POST",
        body: JSON.stringify({
          partnerId: form.partnerId,
          serviceType: form.serviceType,
          status: form.status,
          dailyCapacity: capacity,
          isHomeService: form.isHomeService,
          isBloodDraw: form.isBloodDraw,
          governorates: form.governorates,
          ...(workHours ? { workHours } : {}),
        }),
      });
    },
    { successMessage: editing ? "تم تحديث الخدمة" : "تمت إضافة الخدمة", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/services/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الخدمة", onSuccess: done }
  );

  // The one-click status controls the requirement asks for (تفعيل / تعليق /
  // إيقاف مؤقت / إعادة تفعيل) without opening the edit dialog.
  const { mutate: setStatus } = useMutation(
    async (id: string, status: string) =>
      apiFetch(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    { successMessage: "تم تحديث حالة الخدمة", onSuccess: () => void refetch() }
  );

  const openEdit = useCallback((row: ServiceConfig) => {
    const hours = readHours(row.workHours);
    setEditing(row);
    setForm({
      partnerId: row.partnerId,
      serviceType: row.serviceType,
      status: row.status,
      dailyCapacity: row.dailyCapacity == null ? "" : String(row.dailyCapacity),
      isHomeService: row.isHomeService,
      isBloodDraw: row.isBloodDraw,
      governorates: row.governorates ?? [],
      workFrom: hours.from,
      workTo: hours.to,
    });
  }, []);

  const columns: Column<ServiceConfig>[] = [
    {
      key: "partner",
      header: "الشريك",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.partner?.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {labelOf(SERVICE_TYPE_LABELS, r.serviceType)}
          </p>
        </div>
      ),
      sortValue: (r) => r.partner?.name ?? "",
    },
    {
      key: "status",
      header: "الحالة",
      render: (r) => (
        <Pill tone={toneForStatus(r.status)}>{labelOf(SERVICE_STATUS_LABELS, r.status)}</Pill>
      ),
    },
    {
      key: "dailyCapacity",
      header: "الطاقة اليومية",
      secondary: true,
      render: (r) => (r.dailyCapacity == null ? "غير محدودة" : formatNumber(r.dailyCapacity)),
      sortValue: (r) => r.dailyCapacity ?? Number.MAX_SAFE_INTEGER,
    },
    {
      key: "governorates",
      header: "المحافظات",
      secondary: true,
      render: (r) =>
        r.governorates?.length ? (
          <span className="text-xs text-muted-foreground">
            {r.governorates.slice(0, 2).join("، ")}
            {r.governorates.length > 2 ? ` +${r.governorates.length - 2}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">كل المحافظات</span>
        ),
    },
    {
      key: "workHours",
      header: "أوقات العمل",
      secondary: true,
      render: (r) => {
        const { from, to } = readHours(r.workHours);
        return from && to ? (
          <span className="tabular-nums" dir="ltr">
            {from} – {to}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      key: "flags",
      header: "خصائص",
      secondary: true,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.isHomeService ? <Pill tone="info">منزلية</Pill> : null}
          {r.isBloodDraw ? <Pill tone="info">سحب دم</Pill> : null}
          {!r.isHomeService && !r.isBloodDraw ? "—" : null}
        </div>
      ),
    },
  ];

  const rowLabel = (r: ServiceConfig) =>
    `${r.partner?.name ?? ""} — ${labelOf(SERVICE_TYPE_LABELS, r.serviceType)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الخدمات"
        subtitle="تفعيل وتعليق خدمات كل شريك، وتحديد أوقات العمل والمحافظات والطاقة اليومية"
        icon={FileText}
        action={{
          label: "خدمة جديدة",
          onClick: () => {
            setForm(EMPTY);
            setCreating(true);
          },
        }}
      />

      <DataTable
        rows={services}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.partner?.name ?? ""} ${labelOf(SERVICE_TYPE_LABELS, r.serviceType)} ${r.serviceType}`
        }
        searchPlaceholder="بحث بالشريك أو الخدمة..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: optionsOf(SERVICE_STATUS_LABELS),
            match: (r, v) => r.status === v,
          },
          {
            key: "serviceType",
            label: "كل الخدمات",
            options: optionsOf(SERVICE_TYPE_LABELS),
            match: (r, v) => r.serviceType === v,
          },
        ]}
        emptyMessage="لا توجد خدمات معرّفة بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === "ACTIVE" ? (
              <>
                <QuickAction onClick={() => void setStatus(r.id, "PAUSED")}>
                  إيقاف مؤقت
                </QuickAction>
                <QuickAction tone="danger" onClick={() => void setStatus(r.id, "SUSPENDED")}>
                  تعليق
                </QuickAction>
              </>
            ) : (
              <QuickAction
                tone="positive"
                onClick={() => void setStatus(r.id, "REACTIVATED")}
              >
                إعادة التفعيل
              </QuickAction>
            )}
            <RowActions
              label={rowLabel(r)}
              onEdit={() => openEdit(r)}
              onDelete={() => setDeleting(r)}
            />
          </div>
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل الخدمة" : "خدمة جديدة"}
        description={editing ? rowLabel(editing) : "اربط خدمة بشريك وحدّد نطاق تشغيلها"}
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="الشريك" htmlFor="partnerId">
          <select
            id="partnerId"
            className={fieldClass}
            value={form.partnerId}
            disabled={editing !== null}
            onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
          >
            <option value="">— اختر —</option>
            {(partners ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع الخدمة" htmlFor="serviceType">
            <select
              id="serviceType"
              className={fieldClass}
              value={form.serviceType}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
            >
              <option value="">— اختر —</option>
              {SERVICE_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الحالة" htmlFor="status">
            <select
              id="status"
              className={fieldClass}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {optionsOf(SERVICE_STATUS_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="الطاقة اليومية"
            htmlFor="dailyCapacity"
            hint="اتركها فارغة لطاقة غير محدودة"
          >
            <input
              id="dailyCapacity"
              type="number"
              min={0}
              dir="ltr"
              className={fieldClass}
              value={form.dailyCapacity}
              onChange={(e) => setForm((f) => ({ ...f, dailyCapacity: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="من" htmlFor="workFrom">
              <input
                id="workFrom"
                type="time"
                dir="ltr"
                className={fieldClass}
                value={form.workFrom}
                onChange={(e) => setForm((f) => ({ ...f, workFrom: e.target.value }))}
              />
            </Field>
            <Field label="إلى" htmlFor="workTo">
              <input
                id="workTo"
                type="time"
                dir="ltr"
                className={fieldClass}
                value={form.workTo}
                onChange={(e) => setForm((f) => ({ ...f, workTo: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-foreground">
            المحافظات المغطاة
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">
            لا تختر شيئاً لتغطية كل المحافظات
          </p>
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-input p-2">
            {(governorates ?? []).map((g) => {
              const on = form.governorates.includes(g.name);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      governorates: on
                        ? f.governorates.filter((n) => n !== g.name)
                        : [...f.governorates, g.name],
                    }))
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-4">
          <Checkbox
            label="خدمة منزلية"
            checked={form.isHomeService}
            onChange={(v) => setForm((f) => ({ ...f, isHomeService: v }))}
          />
          <Checkbox
            label="سحب دم"
            checked={form.isBloodDraw}
            onChange={(v) => setForm((f) => ({ ...f, isBloodDraw: v }))}
          />
        </div>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف الخدمة"
        description={`سيتم حذف «${deleting ? rowLabel(deleting) : ""}». لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}

function QuickAction({
  onClick,
  tone = "neutral",
  children,
}: {
  onClick: () => void;
  tone?: "neutral" | "positive" | "danger";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "text-muted-foreground hover:bg-accent hover:text-foreground",
    positive: "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
    danger: "text-red-600 hover:bg-red-500/10 dark:text-red-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
