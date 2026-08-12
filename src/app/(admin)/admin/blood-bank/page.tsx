"use client";

import { useCallback, useMemo } from "react";
import { STALE_TIME } from "@/lib/request-cache";
import { Droplet, Send, Users } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useCrudDialogs } from "@/hooks/use-crud-dialogs";
import { useServerFilters } from "@/hooks/use-server-filters";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions, StatTile, type PillTone } from "@/components/data/crud-kit";
import { SearchableSelect, type SelectOption } from "@/components/data/searchable-select";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مصرف الدم — the employee side of the patient's form.
//
// The client's spec ends "يتم ارسال الاستمارة إلى موظف التطبيق ومن خلاله يتم
// ارسال الحالة داخل التطبيق أو مراسلة المتبرعين" — so a request is not finished
// when it is submitted; someone has to broadcast it and match a donor.
//
// It was read-plus-workflow only: staff could move a case along but could not
// create one, and could not fix one. Both happen constantly — most of these
// arrive by phone, and a mistyped number makes the record useless because the
// whole point is calling the person back.
// ─────────────────────────────────────────────────────────────

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "+A", A_NEG: "−A", B_POS: "+B", B_NEG: "−B",
  AB_POS: "+AB", AB_NEG: "−AB", O_POS: "+O", O_NEG: "−O",
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  broadcast: "أُرسل للمتبرعين",
  matched: "تم إيجاد متبرع",
  fulfilled: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_TONES: Record<string, PillTone> = {
  new: "warning",
  broadcast: "info",
  matched: "info",
  fulfilled: "positive",
  cancelled: "neutral",
};

const GENDERS = [
  { value: "", label: "—" },
  { value: "ذكر", label: "ذكر" },
  { value: "أنثى", label: "أنثى" },
];

type Request = {
  id: string;
  requestType: string;
  fullName: string;
  phone: string;
  age: number | null;
  gender: string | null;
  residence: string | null;
  landmark: string | null;
  bloodType: string;
  governorateId: string | null;
  lastDonation: string | null;
  operationType: string | null;
  bagsNeeded: number | null;
  operationPlace: string | null;
  status: string;
  broadcastAt: string | null;
  donorName: string | null;
  notes: string | null;
  createdAt: string;
  governorate: { id: string; name: string } | null;
};

/** The dialog's fields, all as strings — one shape for create and for edit. */
type FormState = {
  requestType: string;
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  residence: string;
  landmark: string;
  bloodType: string;
  governorateId: string;
  lastDonation: string;
  operationType: string;
  bagsNeeded: string;
  operationPlace: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  requestType: "REQUESTER",
  fullName: "",
  phone: "",
  age: "",
  gender: "",
  residence: "",
  landmark: "",
  bloodType: "O_POS",
  governorateId: "",
  lastDonation: "",
  operationType: "",
  bagsNeeded: "",
  operationPlace: "",
  notes: "",
};

const EMPTY_FILTERS = { requestType: "", status: "", bloodType: "", q: "" };

/** `<input type="date">` wants `YYYY-MM-DD`; the API returns an ISO timestamp. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function BloodBankPage() {
  // The dropdowns and the search box drive the QUERY, not a client-side filter
  // over whichever page happened to load. See `useServerFilters`.
  const filters = useServerFilters(EMPTY_FILTERS);

  const { data, isLoading, error, refetch } = useDashboardData<Request[]>({
    url: "/api/blood-bank",
    params: { limit: "100", ...filters.params },
  });

  const { data: governorates } = useDashboardData<{ id: string; name: string }[]>({
    url: "/api/governorates",
    staleTime: STALE_TIME.reference,
  });

  const refresh = useCallback(() => void refetch(), [refetch]);
  const crud = useCrudDialogs<Request, FormState>(EMPTY_FORM, refresh);

  const { mutate: setStatus } = useMutation(
    // PATCH, not PUT — and `broadcastAt` is stamped server-side from the status,
    // so the client never sends a time that could disagree with it.
    async (id: string, status: string) =>
      apiFetch(`/api/blood-bank/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    { successMessage: "تم تحديث الحالة", onSuccess: refresh }
  );

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      const f = crud.form;
      const isRequester = f.requestType === "REQUESTER";

      // Empty strings are sent as `null` so a cleared field CLEARS the column
      // rather than storing a blank that later reads as a real value.
      const body = {
        requestType: f.requestType,
        fullName: f.fullName.trim(),
        phone: f.phone.trim(),
        age: f.age === "" ? null : Number(f.age),
        gender: f.gender,
        residence: f.residence,
        landmark: f.landmark,
        bloodType: f.bloodType,
        governorateId: f.governorateId,
        lastDonation: f.lastDonation,
        notes: f.notes,
        // A donor registration has no operation. Sending the old values when the
        // type is switched would leave a donor row carrying a bag count.
        operationType: isRequester ? f.operationType : null,
        bagsNeeded: isRequester && f.bagsNeeded !== "" ? Number(f.bagsNeeded) : null,
        operationPlace: isRequester ? f.operationPlace : null,
      };

      return crud.editing
        ? apiFetch(`/api/blood-bank/${crud.editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : apiFetch("/api/blood-bank", { method: "POST", body: JSON.stringify(body) });
    },
    {
      successMessage: crud.editing ? "تم تحديث الطلب" : "تم إنشاء الطلب",
      onSuccess: crud.done,
    }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/blood-bank/${crud.deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الطلب", onSuccess: crud.done }
  );

  const { mutate: assignDonor, isPending: assigning } = useMutation(
    async (id: string, donorName: string) =>
      apiFetch(`/api/blood-bank/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "matched", donorName }),
      }),
    { successMessage: "تم ربط المتبرع بالطلب", onSuccess: refresh }
  );

  const requests = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const requesters = requests.filter((r) => r.requestType === "REQUESTER");
    return {
      open: requesters.filter((r) => r.status === "new").length,
      broadcast: requesters.filter((r) => r.status === "broadcast").length,
      donors: requests.filter((r) => r.requestType === "DONOR").length,
      bags: requesters
        .filter((r) => r.status !== "fulfilled" && r.status !== "cancelled")
        .reduce((a, r) => a + (r.bagsNeeded ?? 0), 0),
    };
  }, [requests]);

  const governorateOptions = useMemo<SelectOption[]>(
    () => (governorates ?? []).map((g) => ({ value: g.id, label: g.name })),
    [governorates]
  );

  const openEdit = useCallback(
    (r: Request) =>
      crud.openEdit(r, (row) => ({
        requestType: row.requestType,
        fullName: row.fullName,
        phone: row.phone,
        age: row.age?.toString() ?? "",
        gender: row.gender ?? "",
        residence: row.residence ?? "",
        landmark: row.landmark ?? "",
        bloodType: row.bloodType,
        governorateId: row.governorateId ?? "",
        lastDonation: toDateInput(row.lastDonation),
        operationType: row.operationType ?? "",
        bagsNeeded: row.bagsNeeded?.toString() ?? "",
        operationPlace: row.operationPlace ?? "",
        notes: row.notes ?? "",
      })),
    [crud]
  );

  const columns: Column<Request>[] = useMemo(
    () => [
      {
        key: "fullName",
        header: "مقدّم الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.fullName}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.phone}
            </p>
          </div>
        ),
        sortValue: (r) => r.fullName,
      },
      {
        key: "requestType",
        header: "النوع",
        // `requestType` is a plain String column, so a value outside the
        // vocabulary can exist — and did. This read
        // `=== "REQUESTER" ? "طالب دم" : "متبرع"`, so every unrecognised value
        // was labelled متبرع: twelve rows written by an older seed showed blood
        // REQUESTS as donors. An unknown value now shows itself, which is
        // ugly on screen and therefore gets noticed and fixed.
        render: (r) =>
          r.requestType === "REQUESTER" ? (
            <Pill tone="danger">طالب دم</Pill>
          ) : r.requestType === "DONOR" ? (
            <Pill tone="positive">متبرع</Pill>
          ) : (
            <Pill tone="warning">{r.requestType}</Pill>
          ),
      },
      {
        key: "bloodType",
        header: "الفصيلة",
        render: (r) => (
          <span className="font-bold tabular-nums text-foreground" dir="ltr">
            {BLOOD_LABELS[r.bloodType] ?? r.bloodType}
          </span>
        ),
        sortValue: (r) => r.bloodType,
      },
      {
        key: "need",
        header: "المطلوب",
        secondary: true,
        render: (r) =>
          r.requestType === "REQUESTER" ? (
            <div className="min-w-0">
              <p className="truncate text-xs text-foreground">{r.operationType ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {r.bagsNeeded ? `${formatNumber(r.bagsNeeded)} كيس` : "—"}
                {r.operationPlace ? ` · ${r.operationPlace}` : ""}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              آخر تبرع: {r.lastDonation ? formatDate(r.lastDonation) : "—"}
            </span>
          ),
      },
      {
        key: "governorate",
        header: "الموقع",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.governorate?.name, r.residence].filter(Boolean).join(" - ") || "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={STATUS_TONES[r.status] ?? "neutral"}>
            {STATUS_LABELS[r.status] ?? r.status}
          </Pill>
        ),
      },
      {
        key: "createdAt",
        header: "منذ",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatRelative(r.createdAt)}
          </span>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
    ],
    []
  );

  const isRequester = crud.form.requestType === "REQUESTER";

  return (
    <div className="space-y-5">
      <PageHeader
        title="مصرف الدم"
        subtitle="طلبات الدم وتسجيلات المتبرعين — أرسل الحالة للمتبرعين ثم اربط المتبرع بالطلب"
        icon={Droplet}
        action={{ label: "تسجيل طلب", onClick: crud.openCreate }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="طلبات جديدة" value={formatNumber(stats.open)} icon={Droplet} />
        <StatTile label="أُرسلت للمتبرعين" value={formatNumber(stats.broadcast)} icon={Send} />
        <StatTile label="أكياس مطلوبة" value={formatNumber(stats.bags)} hint="للطلبات غير المكتملة" />
        <StatTile label="متبرعون مسجّلون" value={formatNumber(stats.donors)} icon={Users} />
      </div>

      {/* Server-backed. `DataTable`'s own `searchable`/`filters` props are
          deliberately not used here — they would narrow the loaded page only,
          which for a paged history means answering "none" for records that
          exist. */}
      <FilterBar filters={filters} />

      <DataTable
        rows={requests}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage={filters.isActive ? "لا نتائج مطابقة" : "لا توجد طلبات بعد"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {/* The two steps the spec describes: broadcast the case, then match
                a donor to it. Only offered where they make sense. */}
            {r.requestType === "REQUESTER" && r.status === "new" ? (
              <button
                type="button"
                onClick={() => void setStatus(r.id, "broadcast")}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
              >
                إرسال للمتبرعين
              </button>
            ) : null}
            {r.requestType === "REQUESTER" && ["new", "broadcast"].includes(r.status) ? (
              <DonorButton row={r} onAssign={assignDonor} disabled={assigning} />
            ) : null}
            {r.status === "matched" ? (
              <button
                type="button"
                onClick={() => void setStatus(r.id, "fulfilled")}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                إكمال
              </button>
            ) : null}
            <RowActions
              onEdit={() => openEdit(r)}
              // A matched or fulfilled case names a real donor; the server
              // refuses to delete it. Not offering the button is kinder than a
              // 422 toast.
              onDelete={
                r.status === "matched" || r.status === "fulfilled"
                  ? undefined
                  : () => crud.openDelete(r)
              }
              label={r.fullName}
            />
          </div>
        )}
      />

      <FormDialog
        open={crud.isFormOpen}
        title={crud.editing ? "تعديل الطلب" : "تسجيل طلب جديد"}
        description={
          crud.editing
            ? "تصحيح بيانات الاستمارة — الحالة تُدار من أزرار الجدول"
            : "استمارة طالب دم أو تسجيل متبرع، كما تُستلم عبر الهاتف"
        }
        onClose={crud.close}
        onSubmit={() => void save()}
        isPending={saving}
        // The three fields the server insists on, plus the operation fields it
        // requires for a REQUESTER. Refusing here spares a round trip whose only
        // possible answer is an error.
        submitDisabled={
          crud.form.fullName.trim().length < 3 ||
          crud.form.phone.trim().length < 6 ||
          (isRequester &&
            (crud.form.operationType.trim() === "" ||
              crud.form.bagsNeeded === "" ||
              crud.form.operationPlace.trim() === ""))
        }
      >
        <Field label="نوع الاستمارة" htmlFor="bb-type">
          <select
            id="bb-type"
            className={fieldClass}
            value={crud.form.requestType}
            onChange={(e) => crud.setField("requestType", e.target.value)}
          >
            <option value="REQUESTER">طالب دم</option>
            <option value="DONOR">متبرع</option>
          </select>
        </Field>

        <Field label="الاسم الثلاثي" htmlFor="bb-name">
          <input
            id="bb-name"
            className={fieldClass}
            value={crud.form.fullName}
            onChange={(e) => crud.setField("fullName", e.target.value)}
            maxLength={120}
          />
        </Field>

        <Field label="رقم الهاتف" htmlFor="bb-phone" hint="الوسيلة الوحيدة للتواصل — تأكّد منه">
          <input
            id="bb-phone"
            className={fieldClass}
            value={crud.form.phone}
            onChange={(e) => crud.setField("phone", e.target.value)}
            dir="ltr"
            inputMode="tel"
            maxLength={32}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="فصيلة الدم" htmlFor="bb-blood">
            <select
              id="bb-blood"
              className={fieldClass}
              value={crud.form.bloodType}
              onChange={(e) => crud.setField("bloodType", e.target.value)}
            >
              {Object.entries(BLOOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="العمر" htmlFor="bb-age">
            <input
              id="bb-age"
              className={fieldClass}
              value={crud.form.age}
              onChange={(e) => crud.setField("age", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={3}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الجنس" htmlFor="bb-gender">
            <select
              id="bb-gender"
              className={fieldClass}
              value={crud.form.gender}
              onChange={(e) => crud.setField("gender", e.target.value)}
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="المحافظة" htmlFor="bb-gov">
            <SearchableSelect
              id="bb-gov"
              value={crud.form.governorateId}
              onChange={(v) => crud.setField("governorateId", v)}
              options={governorateOptions}
              placeholder="— اختر —"
            />
          </Field>
        </div>

        <Field label="السكن" htmlFor="bb-residence">
          <input
            id="bb-residence"
            className={fieldClass}
            value={crud.form.residence}
            onChange={(e) => crud.setField("residence", e.target.value)}
            maxLength={240}
          />
        </Field>

        <Field label="أقرب نقطة دالة" htmlFor="bb-landmark" hint="العناوين هنا تُعطى بنقطة دالة">
          <input
            id="bb-landmark"
            className={fieldClass}
            value={crud.form.landmark}
            onChange={(e) => crud.setField("landmark", e.target.value)}
            maxLength={160}
          />
        </Field>

        {isRequester ? (
          <>
            <Field label="نوع العملية" htmlFor="bb-op">
              <input
                id="bb-op"
                className={fieldClass}
                value={crud.form.operationType}
                onChange={(e) => crud.setField("operationType", e.target.value)}
                maxLength={160}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="عدد الأكياس" htmlFor="bb-bags">
                <input
                  id="bb-bags"
                  className={fieldClass}
                  value={crud.form.bagsNeeded}
                  onChange={(e) => crud.setField("bagsNeeded", e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  maxLength={2}
                />
              </Field>

              <Field label="مكان العملية" htmlFor="bb-place">
                <input
                  id="bb-place"
                  className={fieldClass}
                  value={crud.form.operationPlace}
                  onChange={(e) => crud.setField("operationPlace", e.target.value)}
                  maxLength={240}
                />
              </Field>
            </div>
          </>
        ) : (
          <Field label="آخر تبرع" htmlFor="bb-last" hint="يحدّد أهلية المتبرع">
            <input
              id="bb-last"
              type="date"
              className={fieldClass}
              value={crud.form.lastDonation}
              onChange={(e) => crud.setField("lastDonation", e.target.value)}
              dir="ltr"
            />
          </Field>
        )}

        <Field label="ملاحظات" htmlFor="bb-notes">
          <textarea
            id="bb-notes"
            className={`${fieldClass} h-24 py-2.5`}
            value={crud.form.notes}
            onChange={(e) => crud.setField("notes", e.target.value)}
            maxLength={1000}
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={crud.deleting !== null}
        title="حذف الطلب"
        description={
          crud.deleting
            ? `سيُحذف سجل «${crud.deleting.fullName}» نهائياً. لإغلاق حالة قائمة استخدم «ملغي» بدلاً من الحذف — فهو يحفظ السجل.`
            : undefined
        }
        onClose={crud.close}
        onSubmit={() => void remove()}
        isPending={removing}
        submitLabel="حذف"
        submitTone="danger"
      />
    </div>
  );
}

/* -------------------------------- filters -------------------------------- */

function FilterBar({
  filters,
}: {
  filters: ReturnType<typeof useServerFilters<typeof EMPTY_FILTERS>>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <label htmlFor="bb-q" className="sr-only">
          بحث بالاسم أو الهاتف أو نوع العملية
        </label>
        <input
          id="bb-q"
          type="search"
          value={filters.values.q}
          onChange={(e) => filters.set("q", e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو نوع العملية..."
          className={fieldClass}
        />
      </div>

      <FilterSelect
        id="bb-f-type"
        label="نوع الاستمارة"
        value={filters.values.requestType}
        onChange={(v) => filters.set("requestType", v)}
        placeholder="الكل"
        options={[
          { value: "REQUESTER", label: "طالبو الدم" },
          { value: "DONOR", label: "المتبرعون" },
        ]}
      />

      <FilterSelect
        id="bb-f-status"
        label="الحالة"
        value={filters.values.status}
        onChange={(v) => filters.set("status", v)}
        placeholder="كل الحالات"
        options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
      />

      <FilterSelect
        id="bb-f-blood"
        label="الفصيلة"
        value={filters.values.bloodType}
        onChange={(v) => filters.set("bloodType", v)}
        placeholder="كل الفصائل"
        options={Object.entries(BLOOD_LABELS).map(([value, label]) => ({ value, label }))}
      />

      {filters.isActive ? (
        <button
          type="button"
          onClick={filters.reset}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          مسح
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="shrink-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} w-auto min-w-[9rem]`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------ donor matching ---------------------------- */

/**
 * "ربط متبرع" — its own component so the donor name lives with the row it
 * belongs to. Holding it in the page meant one `donorName` state shared by
 * every row, which is only safe while exactly one dialog can be open.
 */
function DonorButton({
  row,
  onAssign,
  disabled,
}: {
  row: Request;
  onAssign: (id: string, donorName: string) => void;
  disabled: boolean;
}) {
  const crud = useCrudDialogs<Request, { donorName: string }>({ donorName: "" });

  return (
    <>
      <button
        type="button"
        onClick={() => crud.openEdit(row, (r) => ({ donorName: r.donorName ?? "" }))}
        disabled={disabled}
        className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        ربط متبرع
      </button>

      <FormDialog
        open={crud.isFormOpen}
        title="ربط متبرع بالطلب"
        description={`${row.fullName} · ${BLOOD_LABELS[row.bloodType] ?? row.bloodType} · ${
          row.bagsNeeded ?? "—"
        } كيس`}
        submitLabel="ربط المتبرع"
        submitDisabled={crud.form.donorName.trim() === ""}
        onClose={crud.close}
        onSubmit={() => {
          onAssign(row.id, crud.form.donorName.trim());
          crud.close();
        }}
        isPending={disabled}
      >
        <Field
          label="اسم المتبرع"
          htmlFor={`donor-${row.id}`}
          hint="يتولى الموظف التواصل بين الطالب والمتبرع"
        >
          <input
            id={`donor-${row.id}`}
            className={fieldClass}
            value={crud.form.donorName}
            onChange={(e) => crud.setField("donorName", e.target.value)}
            placeholder="اسم المتبرع الثلاثي"
          />
        </Field>
      </FormDialog>
    </>
  );
}
