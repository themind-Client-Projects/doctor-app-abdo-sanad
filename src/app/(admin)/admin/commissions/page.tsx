"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Calculator, Loader2, Percent } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";

// ─────────────────────────────────────────────────────────────
// Section 5: محرك النسب ⭐ (req L210-230) — "أهم جزء في وريد"
//
// This screen previously rendered four hardcoded splits from useState, under a
// banner asserting that no percentages were hardcoded. It now reads the real
// CommissionRule rows and simulates splits through the engine.
// ─────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  IN_PERSON_CONSULT: "استشارة حضورية",
  ONLINE_CONSULT: "استشارة أونلاين",
  HOME_VISIT: "زيارة منزلية",
  HOME_BLOOD_DRAW: "سحب دم منزلي",
  HOME_LAB_TEST: "تحليل منزلي",
  LAB_TEST: "تحاليل مختبرية",
  RADIOLOGY: "أشعة",
  PHARMACY_DISPENSE: "صرف وصفات",
  MEDICINE_DELIVERY: "دواء مع توصيل",
  NURSING: "تمريض",
  PHYSIOTHERAPY: "علاج طبيعي",
  SURGERY: "عمليات",
  BLOOD_BANK: "بنك الدم",
  TAXI: "نقل",
};

const PARTY_LABELS: Record<string, string> = {
  PARTNER: "الشريك",
  COMPLEX: "المجمع",
  NURSE: "الممرض",
  DRIVER: "السائق",
  WARID: "وريد",
};

const PARTY_COLORS: Record<string, string> = {
  PARTNER: "bg-blue-500",
  COMPLEX: "bg-emerald-500",
  NURSE: "bg-pink-500",
  DRIVER: "bg-amber-500",
  WARID: "bg-purple-500",
};

type CommissionRule = {
  id: string;
  contractId: string;
  serviceType: string;
  partnerShare: number;
  complexShare: number;
  waridShare: number;
  nurseShare: number;
  driverShare: number;
  contract: {
    partnerId: string;
    isActive: boolean;
    endDate: string;
    partner: { name: string; type: string } | null;
  };
};

type PreviewShare = { party: string; amount: string; percentage: string };
type PreviewResult = { totalAmount: string; shares: PreviewShare[] };

/** The five share columns, as the parties that actually apply. */
function partiesOf(rule: CommissionRule) {
  return (
    [
      { party: "PARTNER", pct: Number(rule.partnerShare) },
      { party: "COMPLEX", pct: Number(rule.complexShare) },
      { party: "NURSE", pct: Number(rule.nurseShare) },
      { party: "DRIVER", pct: Number(rule.driverShare) },
      { party: "WARID", pct: Number(rule.waridShare) },
    ] as const
  ).filter((p) => p.pct > 0);
}

export default function CommissionsPage() {
  const { data: rules, isLoading, error } = useDashboardData<CommissionRule[]>({
    url: "/api/commissions",
  });

  const [amount, setAmount] = useState("100000");
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const selectedRule = useMemo(
    () => rules?.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const { mutate: runPreview, isPending } = useMutation(
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

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Percent size={22} className="text-primary" />
          محرك النسب
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          ⭐ أهم جزء في وريد — النسب تُقرأ من عقد كل شريك (req L210-230)
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          تعذّر تحميل قواعد النسب
        </div>
      ) : null}

      {/* Split simulator — runs the real engine, writes nothing */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
          <Calculator size={18} className="text-primary" />
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
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">— اختر —</option>
              {(rules ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.contract.partner?.name ?? r.contract.partnerId} —{" "}
                  {SERVICE_LABELS[r.serviceType] ?? r.serviceType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="amount" className="mb-1.5 block text-[13px] font-semibold text-foreground">
              المبلغ (د.ع)
            </label>
            <input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            />
          </div>
        </div>

        <button
          onClick={() => void runPreview()}
          disabled={!selectedRuleId || isPending}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : "احسب التوزيع"}
        </button>

        {preview ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              إجمالي {Number(preview.totalAmount).toLocaleString("ar-IQ")} د.ع
            </p>
            <ul className="space-y-2">
              {preview.shares.map((s) => (
                <li key={s.party} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${PARTY_COLORS[s.party] ?? "bg-gray-400"}`} />
                    {PARTY_LABELS[s.party] ?? s.party}
                    <span className="text-xs text-muted-foreground">({Number(s.percentage)}%)</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {Number(s.amount).toLocaleString("ar-IQ")} د.ع
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Real rules, straight from the contracts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (rules ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            لا توجد قواعد نسب بعد — أضف عقداً لشريك ثم عرّف النسب لكل خدمة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(rules ?? []).map((rule) => {
            const parties = partiesOf(rule);
            const total = parties.reduce((s, p) => s + p.pct, 0);
            return (
              <div key={rule.id} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {SERVICE_LABELS[rule.serviceType] ?? rule.serviceType}
                  </h3>
                  {/* An expired or inactive contract cannot settle an order —
                      surface it here rather than at settlement time. */}
                  {!rule.contract.isActive || new Date(rule.contract.endDate) < new Date() ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      عقد غير فعّال
                    </span>
                  ) : null}
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {rule.contract.partner?.name ?? rule.contract.partnerId}
                </p>

                <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {parties.map((p) => (
                    <div
                      key={p.party}
                      className={PARTY_COLORS[p.party] ?? "bg-gray-400"}
                      style={{ width: `${p.pct}%` }}
                    />
                  ))}
                </div>

                <ul className="space-y-1.5">
                  {parties.map((p) => (
                    <li key={p.party} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${PARTY_COLORS[p.party]}`} />
                        {PARTY_LABELS[p.party]}
                      </span>
                      <span className="font-semibold text-foreground">{p.pct}%</span>
                    </li>
                  ))}
                </ul>

                {total !== 100 ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertCircle size={13} />
                    المجموع {total}% — لن تتم التسوية حتى يساوي 100%
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
