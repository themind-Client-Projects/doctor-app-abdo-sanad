"use client";

import { useCallback, useState } from "react";
import { BadgeCheck, Crown, Gift, TrendingUp, Wallet } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useServerFilters } from "@/hooks/use-server-filters";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, StatTile } from "@/components/data/crud-kit";
import { ServerFilterBar } from "@/components/data/server-filter-bar";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// العضويات المُباعة
//
// The other half of /admin/plans. That page prices the packages; this one shows
// what was actually sold — who holds a membership, what it brought in, how
// many visits are left — and lets the owner step in: grant one free, or end
// one with money back to the wallet.
//
// Before this, the only admin-side read of `Membership` was a count guarding
// plan deletion. The owner could sell memberships and not see a single one.
//
// Revenue is money RECEIVED (`pricePaid`), and a granted membership records
// zero — so comps never inflate the figure by their list price.
// ─────────────────────────────────────────────────────────────

type Entitlement = {
  id: string;
  label: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  state: string;
};

type Membership = {
  id: string;
  planId: string;
  planName: string;
  pricePaid: number;
  discountPercent: number;
  startsAt: string;
  expiresAt: string;
  status: string;
  effectiveStatus: "active" | "expired" | "cancelled";
  cancelledAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; phone: string | null };
  entitlements: Entitlement[];
};

type Summary = {
  active: number;
  sold: number;
  revenue: number;
  monthSold: number;
  monthRevenue: number;
  activeByPlan: { planId: string; planName: string; count: number }[];
};

type Plan = { id: string; name: string; price: number; durationDays: number; isActive: boolean; isComingSoon: boolean };
type Patient = { id: string; name: string | null; phone: string | null };

const STATUS: Record<Membership["effectiveStatus"], { label: string; tone: "positive" | "neutral" | "danger" }> = {
  active: { label: "سارية", tone: "positive" },
  expired: { label: "منتهية", tone: "neutral" },
  cancelled: { label: "مُنهاة", tone: "danger" },
};

const EMPTY_FILTERS = { q: "", status: "", planId: "" };

const daysLeft = (iso: string) =>
  Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000), 0);

export default function MembershipsPage() {
  const filters = useServerFilters(EMPTY_FILTERS);
  const { data, meta, isLoading, error, refetch } = useDashboardData<Membership[]>({
    url: "/api/memberships",
    params: { limit: "100", ...filters.params },
  });
  const { data: plans } = useDashboardData<Plan[]>({ url: "/api/plans" });

  const summary = (meta?.summary ?? null) as Summary | null;

  const [grantOpen, setGrantOpen] = useState(false);
  const [ending, setEnding] = useState<Membership | null>(null);

  /* ------------------------------- columns -------------------------------- */

  const columns: Column<Membership>[] = [
    {
      key: "patient",
      header: "المشترك",
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{m.user.name ?? "بلا اسم"}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {m.user.phone ?? "—"}
          </p>
        </div>
      ),
      sortValue: (m) => m.user.name ?? "",
    },
    {
      key: "plan",
      header: "الباقة",
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{m.planName}</p>
          <p className="text-xs text-muted-foreground">خصم {m.discountPercent}%</p>
        </div>
      ),
      sortValue: (m) => m.planName,
    },
    {
      key: "paid",
      header: "المدفوع",
      align: "end",
      render: (m) =>
        Number(m.pricePaid) === 0 ? (
          // A grant records zero paid. Said in words so it does not read as a
          // missing price.
          <Pill tone="info">منحة</Pill>
        ) : (
          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {formatCurrency(m.pricePaid)}
          </span>
        ),
      sortValue: (m) => Number(m.pricePaid),
    },
    {
      key: "period",
      header: "المدة",
      render: (m) => (
        <div className="whitespace-nowrap text-xs">
          <p className="text-foreground">
            {formatDate(m.startsAt)} ← {formatDate(m.expiresAt)}
          </p>
          {m.effectiveStatus === "active" ? (
            <p className="text-muted-foreground">متبقٍ {formatNumber(daysLeft(m.expiresAt))} يوم</p>
          ) : null}
        </div>
      ),
      sortValue: (m) => new Date(m.expiresAt).getTime(),
    },
    {
      key: "visits",
      header: "الاستخدام",
      secondary: true,
      render: (m) => {
        // Only counted allowances — the unlimited and informational rows have
        // no "used of total" to show.
        const counted = m.entitlements.filter((e) => e.quota !== null && e.state === "AVAILABLE");
        if (counted.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="space-y-0.5">
            {counted.slice(0, 3).map((e) => (
              <p key={e.id} className="truncate text-xs text-muted-foreground">
                {e.label}: <span className="tabular-nums text-foreground">{e.used}</span>/{e.quota}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "الحالة",
      render: (m) => <Pill tone={STATUS[m.effectiveStatus].tone}>{STATUS[m.effectiveStatus].label}</Pill>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="العضويات"
        subtitle="من اشترك، وماذا دفع، وكم تبقّى له — والمنح والإنهاء"
        icon={Crown}
        action={{ label: "منح عضوية", onClick: () => setGrantOpen(true) }}
      />

      {/* Whole-history figures from the server, not a sum over the loaded
          page — revenue cannot be derived from the first hundred rows. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={BadgeCheck}
          label="عضويات سارية"
          value={summary ? formatNumber(summary.active) : "—"}
          hint={summary?.activeByPlan[0] ? `الأكثر: ${summary.activeByPlan[0].planName}` : undefined}
        />
        <StatTile
          icon={Wallet}
          label="إجمالي الإيراد"
          value={summary ? formatCurrency(summary.revenue) : "—"}
          hint={summary ? `${formatNumber(summary.sold)} عضوية منذ البداية` : undefined}
        />
        <StatTile
          icon={TrendingUp}
          label="إيراد هذا الشهر"
          value={summary ? formatCurrency(summary.monthRevenue) : "—"}
          hint={summary ? `${formatNumber(summary.monthSold)} عضوية` : undefined}
        />
        <StatTile
          icon={Gift}
          label="حسب الباقة"
          value={summary ? formatNumber(summary.activeByPlan.length) : "—"}
          hint={
            summary && summary.activeByPlan.length > 0
              ? summary.activeByPlan.map((p) => `${p.planName} ${p.count}`).join(" · ")
              : "لا عضويات سارية"
          }
        />
      </div>

      <ServerFilterBar
        idPrefix="ms"
        search={{ placeholder: "بحث باسم المشترك أو هاتفه..." }}
        selects={[
          {
            key: "status",
            label: "الحالة",
            placeholder: "كل الحالات",
            options: [
              { value: "active", label: "سارية" },
              { value: "expired", label: "منتهية" },
              { value: "cancelled", label: "مُنهاة" },
            ],
          },
          {
            key: "planId",
            label: "الباقة",
            placeholder: "كل الباقات",
            options: (plans ?? []).map((p) => ({ value: p.id, label: p.name })),
          },
        ]}
        values={filters.values}
        onChange={(key, value) => filters.set(key as keyof typeof EMPTY_FILTERS, value)}
        isActive={filters.isActive}
        onReset={filters.reset}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage={filters.isActive ? "لا عضويات تطابق البحث" : "لم تُبع أي عضوية بعد"}
        actions={(m) =>
          m.effectiveStatus === "active" ? (
            <button
              type="button"
              onClick={() => setEnding(m)}
              className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              إنهاء
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        }
      />

      <GrantDialog
        open={grantOpen}
        plans={(plans ?? []).filter((p) => p.isActive && !p.isComingSoon)}
        onClose={() => setGrantOpen(false)}
        onDone={() => {
          setGrantOpen(false);
          void refetch();
        }}
      />

      <TerminateDialog
        membership={ending}
        onClose={() => setEnding(null)}
        onDone={() => {
          setEnding(null);
          void refetch();
        }}
      />
    </div>
  );
}

/* ------------------------------- grant dialog ------------------------------ */

function GrantDialog({
  open,
  plans,
  onClose,
  onDone,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const search = useServerFilters({ q: "" });
  const [patient, setPatient] = useState<Patient | null>(null);
  const [planId, setPlanId] = useState("");

  // Searched on the server: patients are every account on the platform, and a
  // picker over the first hundred cannot reach the one the owner means.
  const { data: results, isLoading } = useDashboardData<Patient[]>({
    url: "/api/users",
    params: { role: "PATIENT", status: "active", limit: "8", ...search.params },
    enabled: open && patient === null && search.params.q !== undefined,
  });

  // `search.reset` is stable; `search` itself is a fresh object every render.
  const resetSearch = search.reset;
  const reset = useCallback(() => {
    resetSearch();
    setPatient(null);
    setPlanId("");
  }, [resetSearch]);

  const { mutate: grant, isPending } = useMutation(
    async () =>
      apiFetch("/api/memberships", {
        method: "POST",
        body: JSON.stringify({ userId: patient!.id, planId }),
      }),
    {
      successMessage: "تم منح العضوية",
      onSuccess: () => {
        reset();
        onDone();
      },
    }
  );

  return (
    <FormDialog
      open={open}
      title="منح عضوية مجانية"
      description="بلا خصم من المحفظة — تُسجَّل بمبلغ صفر ويُحفظ اسمك في سجل النشاطات"
      onClose={() => {
        reset();
        onClose();
      }}
      onSubmit={() => void grant()}
      isPending={isPending}
      submitLabel="منح"
      submitDisabled={!patient || !planId}
    >
      <Field label="المريض" htmlFor="grant-patient" hint="ابحث بالاسم أو رقم الهاتف">
        {patient ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{patient.name ?? "بلا اسم"}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {patient.phone ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPatient(null)}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              تغيير
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <input
              id="grant-patient"
              type="search"
              className={fieldClass}
              value={search.values.q}
              onChange={(e) => search.set("q", e.target.value)}
              placeholder="أحمد / 0770..."
            />
            {search.params.q ? (
              <ul className="max-h-48 overflow-y-auto rounded-xl border border-border">
                {isLoading ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">جارٍ البحث…</li>
                ) : (results ?? []).length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">لا نتائج</li>
                ) : (
                  (results ?? []).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setPatient(r)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors hover:bg-accent"
                      >
                        <span className="truncate text-sm text-foreground">{r.name ?? "بلا اسم"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                          {r.phone ?? ""}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        )}
      </Field>

      <Field
        label="الباقة"
        htmlFor="grant-plan"
        hint="إن كان لديه عضوية سارية بنفس الباقة تُمدَّد، وإن كانت بباقة أخرى يُرفض المنح"
      >
        <select id="grant-plan" className={fieldClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">— اختر الباقة —</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatNumber(p.durationDays)} يوم
            </option>
          ))}
        </select>
      </Field>
    </FormDialog>
  );
}

/* ----------------------------- terminate dialog ---------------------------- */

function TerminateDialog({
  membership,
  onClose,
  onDone,
}: {
  membership: Membership | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("");

  // Re-seed per membership without an effect — the idiom the other dialogs use.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (!membership && loadedFor !== null) setLoadedFor(null);
  if (membership && loadedFor !== membership.id) {
    setLoadedFor(membership.id);
    setReason("");
    setRefund("");
  }

  const paid = Number(membership?.pricePaid ?? 0);
  const refundValue = refund.trim() === "" ? 0 : Number(refund);
  const refundInvalid = !Number.isFinite(refundValue) || refundValue < 0 || refundValue > paid;

  const { mutate: terminate, isPending } = useMutation(
    async () =>
      apiFetch(`/api/memberships/${membership!.id}/terminate`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          ...(refundValue > 0 ? { refundAmount: refundValue } : {}),
        }),
      }),
    { successMessage: "تم إنهاء العضوية", onSuccess: onDone }
  );

  return (
    <FormDialog
      open={membership !== null}
      title="إنهاء العضوية"
      description={
        membership
          ? `${membership.user.name ?? ""} — ${membership.planName}. تنتهي فوراً ولا يُطبَّق خصمها بعد الآن.`
          : undefined
      }
      onClose={onClose}
      onSubmit={() => void terminate()}
      isPending={isPending}
      submitLabel="إنهاء"
      submitTone="danger"
      submitDisabled={reason.trim().length < 3 || refundInvalid}
    >
      <Field label="السبب" htmlFor="end-reason" hint="يُحفظ في سجل النشاطات">
        <input
          id="end-reason"
          className={fieldClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="طلب المريض / خطأ في الاشتراك"
          maxLength={300}
        />
      </Field>

      {paid > 0 ? (
        <Field
          label="المبلغ المُسترد إلى المحفظة (د.ع)"
          htmlFor="end-refund"
          hint={`اختياري — حتى ${formatCurrency(paid)} المدفوعة`}
        >
          <input
            id="end-refund"
            type="number"
            min={0}
            max={paid}
            dir="ltr"
            className={fieldClass}
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            placeholder="0"
          />
        </Field>
      ) : (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          عضوية ممنوحة بلا مقابل — لا مبلغ يُسترد.
        </p>
      )}
    </FormDialog>
  );
}
