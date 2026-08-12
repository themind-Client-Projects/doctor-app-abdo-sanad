"use client";

import { useCallback, useMemo, useState } from "react";
import { useCrudDialogs } from "@/hooks/use-crud-dialogs";
import { AlertCircle, Calculator, Loader2, Percent } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, RowActions } from "@/components/data/crud-kit";
import {
  PARTNER_TYPE_LABELS,
  SERVICE_TYPE_KEYS,
  SERVICE_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// محرك النسب (req L210-230) — "أهم جزء في وريد"
//
// The rules were read-only: the screen listed them and simulated a split, but
// the percentages that decide who gets paid could only be changed by editing
// the seed. POST / PUT / DELETE have existed on /api/commissions all along.
//
// The one rule that governs this whole screen: the five shares must total
// exactly 100%. The server enforces it on save AND on update against the merged
// row — so the form enforces it too, live, rather than letting someone fill in
// a split that is guaranteed to be rejected.
// ─────────────────────────────────────────────────────────────

const PARTY_LABELS: Record<string, string> = {
  PARTNER: "الشريك",
  COMPLEX: "المجمع",
  NURSE: "الممرض",
  DRIVER: "السائق",
  REFERRER: "المُحيل",
  WARID: "وريد",
};

const PARTY_COLORS: Record<string, string> = {
  PARTNER: "bg-blue-500",
  COMPLEX: "bg-emerald-500",
  NURSE: "bg-pink-500",
  DRIVER: "bg-amber-500",
  REFERRER: "bg-teal-500",
  WARID: "bg-purple-500",
};

type CommissionRule = {
  id: string;
  contractId: string;
  serviceType: string;
  partnerShare: number | string;
  complexShare: number | string;
  waridShare: number | string;
  nurseShare: number | string;
  driverShare: number | string;
  referralShare: number | string;
  effectiveFrom: string;
  contract: {
    partnerId: string;
    isActive: boolean;
    endDate: string;
    partner: { name: string; type: string } | null;
  };
};

type Partner = {
  id: string;
  name: string;
  type: string;
  contract: { id: string; isActive: boolean; endDate: string } | null;
};

type PreviewShare = { party: string; amount: string; percentage: string };
type PreviewResult = { totalAmount: string; shares: PreviewShare[] };

type FormState = {
  contractId: string;
  serviceType: string;
  partnerShare: string;
  complexShare: string;
  waridShare: string;
  nurseShare: string;
  driverShare: string;
  referralShare: string;
};

const EMPTY: FormState = {
  contractId: "",
  serviceType: "",
  partnerShare: "",
  complexShare: "0",
  waridShare: "",
  nurseShare: "0",
  driverShare: "0",
  referralShare: "0",
};

/** The five share columns as the parties that actually take a cut. */
function partiesOf(rule: CommissionRule) {
  return (
    [
      { party: "PARTNER", pct: Number(rule.partnerShare) },
      { party: "COMPLEX", pct: Number(rule.complexShare) },
      { party: "NURSE", pct: Number(rule.nurseShare) },
      { party: "DRIVER", pct: Number(rule.driverShare) },
      { party: "REFERRER", pct: Number(rule.referralShare) },
      { party: "WARID", pct: Number(rule.waridShare) },
    ] as const
  ).filter((p) => p.pct > 0);
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ruleTotal = (r: CommissionRule) =>
  Number(r.partnerShare) +
  Number(r.complexShare) +
  Number(r.waridShare) +
  Number(r.nurseShare) +
  Number(r.driverShare) +
  Number(r.referralShare);

const contractLive = (c: { isActive: boolean; endDate: string }) =>
  c.isActive && new Date(c.endDate) > new Date();

export default function CommissionsPage() {
  const { data: rules, isLoading, error, refetch } = useDashboardData<CommissionRule[]>({
    url: "/api/commissions",
  });

  // Contracts come from the partner directory — a rule hangs off a contract,
  // and there is no other list of them.
  const { data: partners } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { limit: "100" },
  });

  // Dialog state, form state, close and done — all of it is the same on every
  // CRUD screen, so none of it is written here.
  const crud = useCrudDialogs<CommissionRule, FormState>(EMPTY, refetch);
  const { editing, deleting, form, setForm } = crud;

  const [amount, setAmount] = useState("100000");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const withContract = useMemo(
    () => (partners ?? []).filter((p): p is Partner & { contract: NonNullable<Partner["contract"]> } =>
      p.contract !== null
    ),
    [partners]
  );

  // One rule per service per contract (@@unique). Offering a service the
  // selected contract already prices would only ever produce a duplicate error.
  const takenForContract = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rules ?? []) {
      const set = map.get(r.contractId) ?? new Set<string>();
      set.add(r.serviceType);
      map.set(r.contractId, set);
    }
    return map;
  }, [rules]);

  const availableServices = useMemo(() => {
    if (!form.contractId) return SERVICE_TYPE_KEYS;
    const taken = takenForContract.get(form.contractId) ?? new Set<string>();
    // While editing, the rule's own service must stay selectable.
    return SERVICE_TYPE_KEYS.filter(
      (t) => !taken.has(t) || (editing && t === editing.serviceType)
    );
  }, [form.contractId, takenForContract, editing]);

  const total =
    num(form.partnerShare) +
    num(form.complexShare) +
    num(form.waridShare) +
    num(form.nurseShare) +
    num(form.driverShare) +
    num(form.referralShare);
  const totalValid = total === 100;

  const { mutate: save, isPending: saving } = useMutation(
    async () => {
      const shares = {
        partnerShare: num(form.partnerShare),
        complexShare: num(form.complexShare),
        waridShare: num(form.waridShare),
        nurseShare: num(form.nurseShare),
        driverShare: num(form.driverShare),
        referralShare: num(form.referralShare),
      };
      return editing
        ? apiFetch(`/api/commissions/${editing.id}`, {
            method: "PUT",
            // `contractId` is not accepted here — a rule must not be repointed
            // at another partner's contract.
            body: JSON.stringify({ serviceType: form.serviceType, ...shares }),
          })
        : apiFetch("/api/commissions", {
            method: "POST",
            body: JSON.stringify({
              contractId: form.contractId,
              serviceType: form.serviceType,
              ...shares,
            }),
          });
    },
    { successMessage: editing ? "فُتحت نسخة جديدة من القاعدة" : "تمت إضافة القاعدة", onSuccess: crud.done }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async () => apiFetch(`/api/commissions/${deleting!.id}`, { method: "DELETE" }),
    { successMessage: "تم إيقاف العمل بالقاعدة", onSuccess: crud.done }
  );

  const selectedRule = useMemo(
    () => (rules ?? []).find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const { mutate: runPreview, isPending: previewing } = useMutation(
    async () => {
      if (!selectedRule) throw new Error("اختر قاعدة أولاً");
      return apiFetch<PreviewResult>("/api/commissions/preview", {
        method: "POST",
        body: JSON.stringify({
          partnerId: selectedRule.contract.partnerId,
          serviceType: selectedRule.serviceType,
          totalAmount: Number(amount),
        }),
      });
    },
    { successMessage: null, onSuccess: setPreview }
  );

  /** The only per-screen part: how a row seeds the form. */
  const seedForm = useCallback(
    (r: CommissionRule): FormState => ({
      contractId: r.contractId,
      serviceType: r.serviceType,
      partnerShare: String(Number(r.partnerShare)),
      complexShare: String(Number(r.complexShare)),
      waridShare: String(Number(r.waridShare)),
      nurseShare: String(Number(r.nurseShare)),
      driverShare: String(Number(r.driverShare)),
      referralShare: String(Number(r.referralShare)),
    }),
    []
  );

  const columns: Column<CommissionRule>[] = useMemo(
    () => [
      {
        key: "partner",
        header: "الشريك",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {r.contract.partner?.name ?? r.contract.partnerId}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {labelOf(PARTNER_TYPE_LABELS, r.contract.partner?.type)}
            </p>
          </div>
        ),
        sortValue: (r) => r.contract.partner?.name ?? "",
      },
      {
        key: "serviceType",
        header: "الخدمة",
        render: (r) => (
          <span className="text-foreground">{labelOf(SERVICE_TYPE_LABELS, r.serviceType)}</span>
        ),
        sortValue: (r) => labelOf(SERVICE_TYPE_LABELS, r.serviceType),
      },
      {
        key: "split",
        header: "التوزيع",
        render: (r) => {
          const parties = partiesOf(r);
          return (
            <div className="min-w-[180px]">
              <div className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                {parties.map((p) => (
                  <div
                    key={p.party}
                    className={PARTY_COLORS[p.party] ?? "bg-gray-400"}
                    style={{ width: `${p.pct}%` }}
                    title={`${PARTY_LABELS[p.party]} ${p.pct}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                {parties.map((p) => (
                  <span key={p.party} className="inline-flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${PARTY_COLORS[p.party] ?? "bg-gray-400"}`}
                    />
                    {PARTY_LABELS[p.party]} {p.pct}%
                  </span>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        key: "total",
        header: "المجموع",
        align: "end",
        render: (r) => {
          const t = ruleTotal(r);
          // A rule that does not total 100 cannot settle — the engine refuses
          // it, so it is flagged here rather than at payout time.
          return t === 100 ? (
            <span className="tabular-nums text-muted-foreground">١٠٠٪</span>
          ) : (
            <Pill tone="danger">{formatNumber(t)}% — لا تُسوّى</Pill>
          );
        },
        sortValue: (r) => ruleTotal(r),
      },
      {
        key: "contract",
        header: "العقد",
        secondary: true,
        render: (r) =>
          contractLive(r.contract) ? (
            <Pill tone="positive">فعّال</Pill>
          ) : (
            <Pill tone="warning">غير فعّال</Pill>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="محرك النسب"
        subtitle="النسب تُقرأ من عقد كل شريك — مجموع كل قاعدة يجب أن يساوي ١٠٠٪"
        icon={Percent}
        action={
          withContract.length > 0
            ? {
                label: "قاعدة جديدة",
                onClick: crud.openCreate,
              }
            : undefined
        }
      />

      {/* Simulator — runs the real engine and writes nothing. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
          <Calculator size={18} className="text-primary" aria-hidden />
          محاكاة التوزيع
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="rule" className="mb-1.5 block text-[13px] font-semibold text-foreground">
              القاعدة
            </label>
            <select
              id="rule"
              value={selectedRuleId}
              onChange={(e) => {
                setSelectedRuleId(e.target.value);
                setPreview(null);
              }}
              className={fieldClass}
            >
              <option value="">— اختر —</option>
              {(rules ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.contract.partner?.name ?? r.contract.partnerId} —{" "}
                  {labelOf(SERVICE_TYPE_LABELS, r.serviceType)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="amount"
              className="mb-1.5 block text-[13px] font-semibold text-foreground"
            >
              المبلغ (د.ع)
            </label>
            <input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              className={fieldClass}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={!selectedRuleId || previewing}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {previewing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          احسب التوزيع
        </button>

        {preview ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              إجمالي {formatNumber(Number(preview.totalAmount))} د.ع
            </p>
            <ul className="space-y-2">
              {preview.shares.map((s) => (
                <li key={s.party} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${PARTY_COLORS[s.party] ?? "bg-gray-400"}`}
                    />
                    {labelOf(PARTY_LABELS, s.party)}
                    <span className="text-xs text-muted-foreground">
                      ({Number(s.percentage)}%)
                    </span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(Number(s.amount))} د.ع
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <DataTable
        rows={rules}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.contract.partner?.name ?? ""} ${labelOf(SERVICE_TYPE_LABELS, r.serviceType)}`
        }
        searchPlaceholder="بحث بالشريك أو الخدمة..."
        filters={[
          {
            key: "serviceType",
            label: "كل الخدمات",
            options: optionsOf(SERVICE_TYPE_LABELS),
            match: (r, v) => r.serviceType === v,
          },
          {
            key: "health",
            label: "كل القواعد",
            options: [
              { value: "broken", label: "لا تساوي ١٠٠٪" },
              { value: "expired", label: "عقد غير فعّال" },
            ],
            match: (r, v) =>
              v === "broken" ? ruleTotal(r) !== 100 : !contractLive(r.contract),
          },
        ]}
        emptyMessage="لا توجد قواعد نسب بعد — أضف قاعدة لعقد شريك"
        actions={(r) => (
          <RowActions
            label={`${r.contract.partner?.name ?? ""} — ${labelOf(SERVICE_TYPE_LABELS, r.serviceType)}`}
            onEdit={() => crud.openEdit(r, seedForm)}
            onDelete={() => crud.openDelete(r)}
          />
        )}
      />

      <FormDialog
        open={crud.isFormOpen}
        title={editing ? "تعديل قاعدة النسب" : "قاعدة نسب جديدة"}
        description={
          editing
            ? `${editing.contract.partner?.name ?? ""} — ${labelOf(SERVICE_TYPE_LABELS, editing.serviceType)} · الحفظ يفتح نسخة جديدة سارية من الآن، والطلبات السابقة تبقى على نسبتها`
            : "نسبة كل طرف من قيمة الطلب. المجموع يجب أن يساوي ١٠٠٪ بالضبط."
        }
        onClose={crud.close}
        onSubmit={() => void save()}
        isPending={saving}
        submitDisabled={!totalValid || !form.serviceType || (!editing && !form.contractId)}
      >
        <Field label="الشريك (العقد)" htmlFor="c-contract">
          <select
            id="c-contract"
            className={fieldClass}
            value={form.contractId}
            // A rule cannot be moved to another partner's contract — the API
            // refuses `contractId` on update.
            disabled={editing !== null}
            onChange={(e) =>
              setForm((f) => ({ ...f, contractId: e.target.value, serviceType: "" }))
            }
          >
            <option value="">— اختر —</option>
            {withContract.map((p) => (
              <option key={p.contract.id} value={p.contract.id}>
                {p.name} — {labelOf(PARTNER_TYPE_LABELS, p.type)}
                {contractLive(p.contract) ? "" : " (عقد غير فعّال)"}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="الخدمة"
          htmlFor="c-service"
          hint="لكل خدمة قاعدة واحدة في العقد — الخدمات المُسعّرة مسبقاً لا تظهر"
        >
          <select
            id="c-service"
            className={fieldClass}
            value={form.serviceType}
            disabled={!form.contractId}
            onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
          >
            <option value="">— اختر —</option>
            {availableServices.map((t) => (
              <option key={t} value={t}>
                {labelOf(SERVICE_TYPE_LABELS, t)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <ShareField
            id="c-partner"
            label="الشريك %"
            value={form.partnerShare}
            onChange={(v) => setForm((f) => ({ ...f, partnerShare: v }))}
          />
          <ShareField
            id="c-warid"
            label="وريد %"
            value={form.waridShare}
            onChange={(v) => setForm((f) => ({ ...f, waridShare: v }))}
          />
          <ShareField
            id="c-complex"
            label="المجمع %"
            value={form.complexShare}
            onChange={(v) => setForm((f) => ({ ...f, complexShare: v }))}
            hint="فقط إذا كان الشريك تابعاً لمجمع"
          />
          <ShareField
            id="c-nurse"
            label="الممرض %"
            value={form.nurseShare}
            onChange={(v) => setForm((f) => ({ ...f, nurseShare: v }))}
            hint="يتطلب تعيين ممرض على الطلب"
          />
          <ShareField
            id="c-driver"
            label="السائق %"
            value={form.driverShare}
            onChange={(v) => setForm((f) => ({ ...f, driverShare: v }))}
            hint="يتطلب تعيين سائق على الطلب"
          />
          <ShareField
            id="c-referrer"
            label="المُحيل %"
            value={form.referralShare}
            onChange={(v) => setForm((f) => ({ ...f, referralShare: v }))}
            hint="عضو المجمع الذي أحال المريض — يتطلب إحالة على الطلب"
          />
        </div>

        {/* Live total. The server rejects anything but 100, so the form says so
            before the request rather than after it. */}
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            totalValid
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <span className="font-medium">المجموع</span>
          <span className="flex items-center gap-2 font-bold tabular-nums">
            {!totalValid ? <AlertCircle size={15} aria-hidden /> : null}
            {formatNumber(total)}%
            {!totalValid ? (
              <span className="text-xs font-normal">
                (يجب ١٠٠٪ — {total > 100 ? "زائد" : "ناقص"} {formatNumber(Math.abs(100 - total))})
              </span>
            ) : null}
          </span>
        </div>
      </FormDialog>

      <FormDialog
        open={deleting !== null}
        title="إيقاف العمل بالقاعدة"
        description={
          deleting
            ? `سيتوقف العمل بنسب «${labelOf(SERVICE_TYPE_LABELS, deleting.serviceType)}» لـ ${
                deleting.contract.partner?.name ?? ""
              } من الآن. الطلبات السابقة تبقى مسوّاة بنسبتها، والطلبات الجديدة لن تُسوّى حتى تُضاف قاعدة بديلة.`
            : undefined
        }
        submitLabel="إيقاف"
        submitTone="danger"
        onClose={crud.close}
        onSubmit={() => void remove()}
        isPending={removing}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ShareField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="number"
        min={0}
        max={100}
        step="0.1"
        dir="ltr"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
