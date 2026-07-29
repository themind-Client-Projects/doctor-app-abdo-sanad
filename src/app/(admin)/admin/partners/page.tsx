"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Handshake,
  HeartPulse,
  Pill as PillIcon,
  ScanLine,
  Stethoscope,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Field, FormDialog, fieldClass } from "@/components/admin/form-dialog";
import { PageHeader, Pill, RowActions, toneForStatus } from "@/components/admin/crud-kit";
import { PARTNER_STATUS_LABELS, PARTNER_TYPE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة الشركاء (req L128-182) — الأطباء، المختبرات، الصيدليات،
// مراكز الأشعة، الممرضون، السائقون، والمجمعات الطبية.
//
// The old screen's "إضافة شريك" button linked to /admin/partners/new, a page
// that was never built — so no doctor, lab or complex could be added from the
// admin area at all. The cause is relational: `Partner.userId` is required and
// @unique, and `POST /api/partners` only accepted an existing `userId`, so
// there was nothing for a create form to call. It now posts to
// /api/partners/onboard, which creates User + Partner + Wallet (+ DoctorProfile,
// + MedicalComplex) in one transaction.
//
// Its "المجمعات الطبية" tab also filtered on `type: "COMPLEX"` — a value the
// `UserRole` enum has never contained — so that tab was always empty. A complex
// is a partner that OWNS a `MedicalComplex` row, which is what the filter below
// actually matches.
// ─────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, LucideIcon> = {
  DOCTOR: Stethoscope,
  LAB: FlaskConical,
  PHARMACY: PillIcon,
  RADIOLOGY: ScanLine,
  NURSE: HeartPulse,
  DRIVER: Truck,
};

type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  phone: string;
  email: string | null;
  address: string | null;
  rating: number;
  totalTasks: number;
  isSanadLinked: boolean;
  governorateId: string | null;
  complexId: string | null;
  user: { id: string; email: string | null; phone: string | null } | null;
  governorate: { id: string; name: string } | null;
  complex: { id: string; name: string } | null;
  ownedComplex: { id: string; name: string } | null;
  contract: { id: string; isActive: boolean; endDate: string } | null;
};

type Governorate = { id: string; name: string };
type Complex = { id: string; name: string };
type Specialty = { id: string; name: string };

type FormState = {
  name: string;
  phone: string;
  email: string;
  type: string;
  status: string;
  governorateId: string;
  address: string;
  complexId: string;
  isSanadLinked: boolean;
  specialtyId: string;
  experience: string;
  gender: string;
  ownsComplex: boolean;
  complexName: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  type: "DOCTOR",
  status: "PENDING",
  governorateId: "",
  address: "",
  complexId: "",
  isSanadLinked: false,
  specialtyId: "",
  experience: "",
  gender: "",
  ownsComplex: false,
  complexName: "",
};

/** Omit empty optional strings — the API's `.strict()` schemas reject "" where
 *  a non-empty string is expected, and `undefined` means "not provided". */
const opt = (v: string) => (v.trim() === "" ? undefined : v.trim());

export default function PartnersPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { limit: "100" },
  });
  const { data: governorates } = useDashboardData<Governorate[]>({
    url: "/api/governorates",
    params: { activeOnly: "true" },
  });
  const { data: complexes } = useDashboardData<Complex[]>({
    url: "/api/complexes",
    params: { limit: "100" },
  });
  const { data: specialties } = useDashboardData<Specialty[]>({ url: "/api/v1/specialties" });

  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<Partner | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setRetiring(null);
    setForm(EMPTY);
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      if (editing) {
        // `type` and `userId` are immutable server-side: a LAB partner whose
        // user is a NURSE would authorise as one and dispatch as the other.
        return apiFetch(`/api/partners/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: opt(form.email),
            governorateId: opt(form.governorateId),
            address: opt(form.address),
            status: form.status,
            isSanadLinked: form.isSanadLinked,
            complexId: opt(form.complexId),
          }),
        });
      }

      return apiFetch("/api/partners/onboard", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: opt(form.email),
          type: form.type,
          status: form.status,
          governorateId: opt(form.governorateId),
          address: opt(form.address),
          complexId: opt(form.complexId),
          isSanadLinked: form.isSanadLinked,
          ...(form.type === "DOCTOR"
            ? {
                specialtyId: opt(form.specialtyId),
                experience: form.experience.trim() === "" ? undefined : Number(form.experience),
                gender: opt(form.gender),
              }
            : {}),
          ...(form.ownsComplex && form.complexName.trim()
            ? { complexName: form.complexName.trim() }
            : {}),
        }),
      });
    },
    {
      successMessage: editing ? "تم تحديث بيانات الشريك" : "تمت إضافة الشريك",
      onSuccess: done,
    }
  );

  const { mutate: retire, isPending: retirePending } = useMutation(
    async () => apiFetch(`/api/partners/${retiring!.id}`, { method: "DELETE" }),
    { successMessage: "تم إيقاف الشريك", onSuccess: done }
  );

  const { mutate: setStatus } = useMutation(
    async (id: string, status: string) =>
      apiFetch(`/api/partners/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    { successMessage: "تم تحديث حالة الشريك", onSuccess: () => void refetch() }
  );

  const openEdit = useCallback((p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      phone: p.phone,
      email: p.email ?? "",
      type: p.type,
      status: p.status,
      governorateId: p.governorateId ?? "",
      address: p.address ?? "",
      complexId: p.complexId ?? "",
      isSanadLinked: p.isSanadLinked,
      specialtyId: "",
      experience: "",
      gender: "",
      ownsComplex: false,
      complexName: "",
    });
  }, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of data ?? []) out[p.type] = (out[p.type] ?? 0) + 1;
    return out;
  }, [data]);

  const columns: Column<Partner>[] = [
    {
      key: "name",
      header: "الشريك",
      render: (r) => {
        const Icon = TYPE_ICONS[r.type] ?? Handshake;
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {r.phone}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (r) => r.name,
    },
    {
      key: "type",
      header: "النوع",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <Pill>{labelOf(PARTNER_TYPE_LABELS, r.type)}</Pill>
          {r.ownedComplex ? <Pill tone="info">مجمع</Pill> : null}
          {r.isSanadLinked ? <Pill tone="info">سند</Pill> : null}
        </div>
      ),
      sortValue: (r) => labelOf(PARTNER_TYPE_LABELS, r.type),
    },
    {
      key: "status",
      header: "الحالة",
      render: (r) => (
        <Pill tone={toneForStatus(r.status)}>{labelOf(PARTNER_STATUS_LABELS, r.status)}</Pill>
      ),
    },
    {
      key: "governorate",
      header: "المحافظة",
      secondary: true,
      render: (r) => r.governorate?.name ?? "—",
      sortValue: (r) => r.governorate?.name ?? "",
    },
    {
      key: "complex",
      header: "المجمع",
      secondary: true,
      render: (r) =>
        r.complex ? (
          <span className="text-xs text-foreground">{r.complex.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "contract",
      header: "العقد",
      secondary: true,
      render: (r) =>
        r.contract ? (
          <Pill tone={r.contract.isActive ? "positive" : "warning"}>
            {r.contract.isActive ? "فعّال" : "منتهٍ"}
          </Pill>
        ) : (
          <Pill tone="warning">بلا عقد</Pill>
        ),
    },
    {
      key: "rating",
      header: "التقييم",
      secondary: true,
      align: "end",
      render: (r) => (r.rating ? `${r.rating.toFixed(1)} ★` : "—"),
      sortValue: (r) => r.rating ?? 0,
    },
    {
      key: "totalTasks",
      header: "المهام",
      secondary: true,
      align: "end",
      render: (r) => formatNumber(r.totalTasks ?? 0),
      sortValue: (r) => r.totalTasks ?? 0,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الشركاء"
        subtitle="الأطباء والمختبرات والصيدليات ومراكز الأشعة والممرضون والسائقون"
        icon={Handshake}
        action={{
          label: "إضافة شريك",
          onClick: () => {
            setForm(EMPTY);
            setCreating(true);
          },
        }}
      />

      {/* Census across the six partner types the requirement names. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(PARTNER_TYPE_LABELS).map(([type, label]) => {
          const Icon = TYPE_ICONS[type] ?? Handshake;
          return (
            <div key={type} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon size={13} aria-hidden="true" />
                <span className="truncate">{label}</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {formatNumber(counts[type] ?? 0)}
              </p>
            </div>
          );
        })}
      </div>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.name} ${r.phone} ${r.email ?? ""} ${r.governorate?.name ?? ""} ${
            r.complex?.name ?? ""
          }`
        }
        searchPlaceholder="بحث بالاسم أو الهاتف أو المحافظة..."
        filters={[
          {
            key: "type",
            label: "كل الأنواع",
            options: [
              ...optionsOf(PARTNER_TYPE_LABELS),
              { value: "__complex", label: "المجمعات الطبية" },
            ],
            match: (r, v) => (v === "__complex" ? r.ownedComplex !== null : r.type === v),
          },
          {
            key: "status",
            label: "كل الحالات",
            options: optionsOf(PARTNER_STATUS_LABELS),
            match: (r, v) => r.status === v,
          },
          {
            key: "link",
            label: "كل الارتباطات",
            options: [
              { value: "sanad", label: "مرتبط بسند" },
              { value: "complex", label: "مرتبط بمجمع" },
              { value: "none", label: "بلا ارتباط" },
            ],
            match: (r, v) =>
              v === "sanad"
                ? r.isSanadLinked
                : v === "complex"
                  ? r.complexId !== null
                  : !r.isSanadLinked && r.complexId === null,
          },
          {
            key: "contract",
            label: "كل العقود",
            options: [
              { value: "active", label: "عقد فعّال" },
              { value: "none", label: "بلا عقد" },
            ],
            match: (r, v) =>
              v === "active" ? Boolean(r.contract?.isActive) : r.contract === null,
          },
        ]}
        emptyMessage="لا يوجد شركاء بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === "ACTIVE" ? (
              <button
                type="button"
                onClick={() => void setStatus(r.id, "SUSPENDED")}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                تعليق
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void setStatus(r.id, "ACTIVE")}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                تفعيل
              </button>
            )}
            <Link
              href={`/admin/partners/${r.id}`}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              التفاصيل
            </Link>
            <RowActions label={r.name} onEdit={() => openEdit(r)} onDelete={() => setRetiring(r)} />
          </div>
        )}
      />

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل بيانات الشريك" : "إضافة شريك"}
        description={
          editing
            ? `${labelOf(PARTNER_TYPE_LABELS, editing.type)} — النوع غير قابل للتغيير`
            : "يُنشأ حساب المستخدم والمحفظة تلقائياً. كلمة المرور تُضبط لاحقاً من صفحة المستخدمين."
        }
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم" htmlFor="p-name">
            <input
              id="p-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="د. أحمد محمد"
            />
          </Field>

          <Field label="رقم الهاتف" htmlFor="p-phone">
            <input
              id="p-phone"
              dir="ltr"
              className={fieldClass}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="07XXXXXXXXX"
            />
          </Field>

          <Field label="البريد الإلكتروني" htmlFor="p-email" hint="اختياري">
            <input
              id="p-email"
              type="email"
              dir="ltr"
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>

          <Field label="نوع الشريك" htmlFor="p-type">
            <select
              id="p-type"
              className={fieldClass}
              value={form.type}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {optionsOf(PARTNER_TYPE_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="المحافظة" htmlFor="p-gov">
            <select
              id="p-gov"
              className={fieldClass}
              value={form.governorateId}
              onChange={(e) => setForm((f) => ({ ...f, governorateId: e.target.value }))}
            >
              <option value="">— غير محددة —</option>
              {(governorates ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الحالة" htmlFor="p-status">
            <select
              id="p-status"
              className={fieldClass}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {optionsOf(PARTNER_STATUS_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="العنوان" htmlFor="p-address" hint="اختياري">
          <input
            id="p-address"
            className={fieldClass}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </Field>

        {/* req L142: "ربطه بمجمع أو سند" */}
        <Field label="الربط بمجمع طبي" htmlFor="p-complex" hint="اختياري">
          <select
            id="p-complex"
            className={fieldClass}
            value={form.complexId}
            onChange={(e) => setForm((f) => ({ ...f, complexId: e.target.value }))}
          >
            <option value="">— غير مرتبط —</option>
            {(complexes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {form.type === "DOCTOR" && !editing ? (
          <div className="grid grid-cols-3 gap-3">
            <Field label="التخصص" htmlFor="p-specialty">
              <select
                id="p-specialty"
                className={fieldClass}
                value={form.specialtyId}
                onChange={(e) => setForm((f) => ({ ...f, specialtyId: e.target.value }))}
              >
                <option value="">— اختر —</option>
                {(specialties ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="سنوات الخبرة" htmlFor="p-exp">
              <input
                id="p-exp"
                type="number"
                min={0}
                max={70}
                dir="ltr"
                className={fieldClass}
                value={form.experience}
                onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
              />
            </Field>
            <Field label="الجنس" htmlFor="p-gender">
              <select
                id="p-gender"
                className={fieldClass}
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">— غير محدد —</option>
                <option value="MALE">ذكر</option>
                <option value="FEMALE">أنثى</option>
              </select>
            </Field>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            checked={form.isSanadLinked}
            onChange={(e) => setForm((f) => ({ ...f, isSanadLinked: e.target.checked }))}
          />
          مرتبط بسند — يستقبل طلبات سند
        </label>

        {editing ? null : (
          <>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                checked={form.ownsComplex}
                onChange={(e) => setForm((f) => ({ ...f, ownsComplex: e.target.checked }))}
              />
              هذا الشريك يملك مجمعاً طبياً
            </label>

            {form.ownsComplex ? (
              <Field
                label="اسم المجمع"
                htmlFor="p-complex-name"
                hint="تُدار أقسامه من صفحة المجمعات الطبية"
              >
                <input
                  id="p-complex-name"
                  className={fieldClass}
                  value={form.complexName}
                  onChange={(e) => setForm((f) => ({ ...f, complexName: e.target.value }))}
                  placeholder="مجمع بغداد الطبي"
                />
              </Field>
            ) : null}
          </>
        )}
      </FormDialog>

      <FormDialog
        open={retiring !== null}
        title="إيقاف الشريك"
        description={`سيتم إيقاف «${retiring?.name ?? ""}» وتعطيل حسابه، مع الاحتفاظ بكل طلباته وسجلّه المالي. لا يمكن إيقاف شريك له رصيد أو مستحقات.`}
        submitLabel="إيقاف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void retire()}
        isPending={retirePending}
      />
    </div>
  );
}
