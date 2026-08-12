"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, X } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { SearchableSelect, type SelectOption } from "@/components/data/searchable-select";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import { PARTNER_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المجمعات الطبية (req L130-139)
//
// A complex is owned by exactly one partner (`MedicalComplex.partnerId` is
// @unique), which is why the owner is chosen at creation and is not editable
// afterwards — reassigning an owner would transfer every linked doctor, lab and
// department with it.
// ─────────────────────────────────────────────────────────────

type Complex = {
  id: string;
  partnerId: string;
  name: string;
  departments: { id: string; name: string }[];
  partners: { id: string; name: string; type: string }[];
};

type Partner = { id: string; name: string; type: string };

export default function ComplexesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Complex[]>({
    url: "/api/complexes",
    params: { limit: "100" },
  });

  const { data: partners } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { limit: "100" },
  });

  const [editing, setEditing] = useState<Complex | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Complex | null>(null);
  const [managing, setManaging] = useState<Complex | null>(null);
  const [name, setName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  /** Free text on create: one section per line. */
  const [departments, setDepartments] = useState("");
  const [members, setMembers] = useState<Complex | null>(null);

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setDeleting(null);
    setManaging(null);
    setName("");
    setPartnerId("");
    setDepartments("");
    setMembers(null);
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: save, isPending: saving } = useMutation(
    async () =>
      editing
        ? // Only `name` is writable server-side; sending partnerId would be a 400.
          apiFetch(`/api/complexes/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name }),
          })
        : apiFetch("/api/complexes", {
            method: "POST",
            body: JSON.stringify({
              name,
              partnerId,
              // One per line. A complex created with none reads "لا أقسام" and
              // needs a second trip through the sections dialog before it
              // describes anything.
              departments: departments
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean),
            }),
          }),
    { successMessage: editing ? "تم تحديث المجمع" : "تمت إضافة المجمع", onSuccess: done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/complexes/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم حذف المجمع", onSuccess: done }
  );

  const columns: Column<Complex>[] = [
    {
      key: "name",
      header: "المجمع",
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      key: "departments",
      header: "الأقسام",
      render: (r) =>
        r.departments?.length ? (
          <div className="flex flex-wrap gap-1">
            {r.departments.slice(0, 3).map((d) => (
              <Pill key={d.id}>{d.name}</Pill>
            ))}
            {r.departments.length > 3 ? <Pill>+{r.departments.length - 3}</Pill> : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">لا أقسام</span>
        ),
      sortValue: (r) => r.departments?.length ?? 0,
    },
    {
      key: "partners",
      header: "المنتسبون",
      secondary: true,
      render: (r) => formatNumber(r.partners?.length ?? 0),
      sortValue: (r) => r.partners?.length ?? 0,
    },
    {
      key: "types",
      header: "التخصصات",
      secondary: true,
      render: (r) => {
        const types = [...new Set((r.partners ?? []).map((p) => p.type))];
        return types.length ? (
          <span className="text-xs text-muted-foreground">
            {types.map((t) => labelOf(PARTNER_TYPE_LABELS, t)).join("، ")}
          </span>
        ) : (
          "—"
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المجمعات الطبية"
        subtitle="المجمعات وأقسامها والشركاء المنتسبين إليها"
        icon={Building2}
        action={{
          label: "مجمع جديد",
          onClick: () => {
            setName("");
            setPartnerId("");
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
        searchable={(r) => r.name}
        searchPlaceholder="بحث باسم المجمع..."
        emptyMessage="لا توجد مجمعات طبية بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setManaging(r)}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              الأقسام
            </button>
            <button
              type="button"
              onClick={() => setMembers(r)}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              المنتسبون
            </button>
            <RowActions
              label={r.name}
              onEdit={() => {
                setEditing(r);
                setName(r.name);
                setPartnerId(r.partnerId);
              }}
              onDelete={() => setDeleting(r)}
            />
          </div>
        )}
      />

      {managing ? (
        <DepartmentsDialog
          complex={managing}
          onClose={close}
          onChanged={() => void refetch()}
        />
      ) : null}

      {members ? (
        <MembersDialog
          complex={members}
          onClose={close}
          onChanged={() => void refetch()}
        />
      ) : null}

      <FormDialog
        open={creating || editing !== null}
        title={editing ? "تعديل المجمع" : "مجمع جديد"}
        description={
          editing ? "اسم المجمع فقط قابل للتعديل" : "اختر الشريك المالك للمجمع ثم سمّه"
        }
        onClose={close}
        onSubmit={() => void save()}
        isPending={saving}
      >
        <Field label="اسم المجمع" htmlFor="complex-name">
          <input
            id="complex-name"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مجمع بغداد الطبي"
          />
        </Field>

        {editing ? null : (
          <Field
            label="الأقسام الأولية"
            htmlFor="complex-departments"
            hint="قسم في كل سطر — اختياري، ويمكن إدارتها لاحقاً من زر «الأقسام»"
          >
            <textarea
              id="complex-departments"
              rows={4}
              className={`${fieldClass} h-auto py-2.5`}
              value={departments}
              onChange={(e) => setDepartments(e.target.value)}
              placeholder={"قسم الباطنية\nقسم الأطفال\nقسم النسائية"}
            />
          </Field>
        )}

        {editing ? null : (
          <Field
            label="الشريك المالك"
            htmlFor="complex-partner"
            hint="لا يمكن تغييره بعد الإنشاء"
          >
            <select
              id="complex-partner"
              className={fieldClass}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {(partners ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {labelOf(PARTNER_TYPE_LABELS, p.type)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="حذف المجمع"
        description={`سيتم حذف «${deleting?.name ?? ""}» وفكّ ارتباط ${formatNumber(
          deleting?.partners?.length ?? 0
        )} شريك به. لا يمكن التراجع.`}
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}

/* ----------------------------- departments ------------------------------ */

/**
 * "إدارة أقسامه" (req L135).
 *
 * Its own dialog rather than another page: a department is nothing but a name
 * belonging to one complex, so a route with its own URL, header and back
 * navigation would be more chrome than content.
 */
function DepartmentsDialog({
  complex,
  onClose,
  onChanged,
}: {
  complex: Complex;
  onClose: () => void;
  onChanged: () => void;
}) {
  const url = `/api/complexes/${complex.id}/departments`;
  const { data, isLoading, refetch } = useDashboardData<{ id: string; name: string }[]>({ url });
  const [draft, setDraft] = useState("");

  const after = useCallback(() => {
    setDraft("");
    void refetch();
    // The complexes list embeds its departments, so it is stale too.
    onChanged();
  }, [refetch, onChanged]);

  const { mutate: add, isPending: adding } = useMutation(
    async () => apiFetch(url, { method: "POST", body: JSON.stringify({ name: draft.trim() }) }),
    { successMessage: "تمت إضافة القسم", onSuccess: after }
  );

  const { mutate: removeDept } = useMutation(
    // The route accepts the id in the body or as ?departmentId= — the query
    // form is used here because some proxies drop a body on DELETE.
    async (departmentId: string) =>
      apiFetch(`${url}?departmentId=${encodeURIComponent(departmentId)}`, { method: "DELETE" }),
    { successMessage: "تم حذف القسم", onSuccess: after }
  );

  return (
    <FormDialog
      open
      title="أقسام المجمع"
      description={complex.name}
      submitLabel="إضافة القسم"
      onClose={onClose}
      onSubmit={() => {
        if (draft.trim()) void add();
      }}
      isPending={adding}
    >
      <Field label="قسم جديد" htmlFor="dept-name">
        <div className="flex gap-2">
          <input
            id="dept-name"
            className={fieldClass}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="قسم الباطنية"
          />
        </div>
      </Field>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-foreground">الأقسام الحالية</p>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            لا توجد أقسام بعد
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(data ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm text-foreground">{d.name}</span>
                <button
                  type="button"
                  onClick={() => void removeDept(d.id)}
                  aria-label={`حذف ${d.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormDialog>
  );
}

/* ------------------------------- members -------------------------------- */

/**
 * "المنتسبون" — who belongs to this complex.
 *
 * Membership could only be set from the other end, by editing each provider and
 * picking a complex. Nobody worked that way, so complexes stayed empty: 3 of 35
 * partners linked to any complex, and 4 of 5 complexes with no members at all.
 *
 * That emptiness blocks the feature complexes exist for — a doctor referring a
 * patient to ITS lab or ITS pharmacy — so this is the screen that unblocks it.
 */
function MembersDialog({
  complex,
  onClose,
  onChanged,
}: {
  complex: Complex;
  onClose: () => void;
  onChanged: () => void;
}) {
  const url = `/api/complexes/${complex.id}/members`;
  const { data: current, isLoading, refetch } = useDashboardData<
    { id: string; name: string; type: string; status: string }[]
  >({ url });

  // Everyone who could join. Fetched once; the picker filters client-side.
  const { data: allPartners } = useDashboardData<
    { id: string; name: string; type: string; complexId: string | null }[]
  >({ url: "/api/partners", params: { limit: "100" } });

  const [picked, setPicked] = useState("");

  const after = useCallback(() => {
    setPicked("");
    void refetch();
    // The list embeds its members, so it is stale too.
    onChanged();
  }, [refetch, onChanged]);

  const { mutate: add, isPending: adding } = useMutation(
    async () => apiFetch(url, { method: "POST", body: JSON.stringify({ partnerId: picked }) }),
    { successMessage: "تمت إضافة الشريك", onSuccess: after }
  );

  const { mutate: removeMember } = useMutation(
    async (partnerId: string) =>
      apiFetch(`${url}?partnerId=${encodeURIComponent(partnerId)}`, { method: "DELETE" }),
    { successMessage: "تمت إزالة الشريك", onSuccess: after }
  );

  // Only partners who are free to join: already-members and the complex's own
  // owner would both be refused by the API, so they are not offered.
  const options = useMemo<SelectOption[]>(
    () =>
      (allPartners ?? [])
        .filter((p) => p.id !== complex.partnerId && p.complexId !== complex.id)
        .map((p) => ({
          value: p.id,
          label: p.name,
          hint: labelOf(PARTNER_TYPE_LABELS, p.type) + (p.complexId ? " — منتسب لمجمع آخر" : ""),
        })),
    [allPartners, complex.partnerId, complex.id]
  );

  return (
    <FormDialog
      open
      title="منتسبو المجمع"
      description={complex.name}
      submitLabel="إضافة"
      onClose={onClose}
      onSubmit={() => {
        if (picked) void add();
      }}
      isPending={adding}
      submitDisabled={!picked}
    >
      <Field
        label="إضافة شريك"
        htmlFor="member-pick"
        hint="الانتساب يفتح قناة المجمع للشريك — وبه تصبح الإحالة داخل المجمع ممكنة"
      >
        <SearchableSelect
          id="member-pick"
          value={picked}
          options={options}
          onChange={setPicked}
          placeholder="— اختر شريكاً —"
          searchPlaceholder="ابحث بالاسم أو النوع..."
          emptyMessage="لا شريك متاح للانتساب"
        />
      </Field>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-foreground">
          المنتسبون حالياً ({formatNumber(current?.length ?? 0)})
        </p>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (current ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            لا منتسبين بعد — لا يمكن للأطباء الإحالة داخل هذا المجمع
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(current ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {labelOf(PARTNER_TYPE_LABELS, m.type)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void removeMember(m.id)}
                  aria-label={`إزالة ${m.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormDialog>
  );
}
