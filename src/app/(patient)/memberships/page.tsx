'use client';

import { useCallback, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  Check,
  CreditCard,
  Crown,
  Info,
  Lock,
  Minus,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useStorefront, type StorefrontPlan, type StorefrontPlanBenefit } from '@/hooks/use-storefront';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { formatDate, formatNumber } from '@/lib/format';

/**
 * عضويات وريد وسند — "عضوية واحدة .. كل الخدمات".
 *
 * THERE IS NO PAYMENT GATEWAY. A membership is bought out of the wallet, which
 * the admin credits by hand. That shapes this screen more than anything else:
 * the balance is shown next to the price on every card, and a package the
 * patient cannot afford says how much is missing instead of failing at the tap.
 * Sending someone to a checkout that cannot take their money would be the worst
 * version of this page.
 *
 * The client's sheet is a four-column desktop table. This shell is a phone
 * (`max-w-md`, light only), so the same information becomes a stack: every row
 * of every card is here, including the ones the card deliberately shows as
 * unavailable. A package that lists a benefit it does not yet honour has to say
 * so on the row — dropping "معلق" rows would quietly promise more than the
 * business delivers.
 */

type Entitlement = {
  id: string;
  label: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  state: string;
  serviceType: string | null;
};

type Membership = {
  id: string;
  planName: string;
  discountPercent: number;
  expiresAt: string;
  daysRemaining: number;
  entitlements: Entitlement[];
};

type Wallet = { balance: number };

/** Palette keys the server sends; the client owns the actual colours. */
const ACCENTS: Record<string, { ring: string; chip: string; button: string; text: string }> = {
  emerald: {
    ring: 'border-emerald-200',
    chip: 'bg-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    text: 'text-emerald-700',
  },
  blue: {
    ring: 'border-blue-200',
    chip: 'bg-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700',
    text: 'text-blue-700',
  },
  amber: {
    ring: 'border-amber-200',
    chip: 'bg-amber-500',
    button: 'bg-amber-500 hover:bg-amber-600',
    text: 'text-amber-700',
  },
  slate: {
    ring: 'border-gray-200',
    chip: 'bg-gray-800',
    button: 'bg-gray-800 hover:bg-gray-900',
    text: 'text-gray-700',
  },
  purple: {
    ring: 'border-purple-200',
    chip: 'bg-purple-600',
    button: 'bg-purple-600 hover:bg-purple-700',
    text: 'text-purple-700',
  },
  rose: {
    ring: 'border-rose-200',
    chip: 'bg-rose-500',
    button: 'bg-rose-500 hover:bg-rose-600',
    text: 'text-rose-700',
  },
};

const accentOf = (key: string) => ACCENTS[key] ?? ACCENTS.blue;

/** "صالح لمدة 30 يوم" — the card's own wording for each duration. */
function durationLabel(days: number): string {
  if (days === 1) return 'صالح لمدة يوم واحد';
  if (days === 7) return 'صالح لمدة 7 أيام';
  if (days >= 365) return `صالح لمدة ${Math.round(days / 30)} شهر`;
  return `صالح لمدة ${days} يوم`;
}

export default function MembershipsPage() {
  const { storefront, isLoading } = useStorefront();
  const {
    data: membership,
    refetch: refetchMembership,
  } = useDashboardData<Membership | null>({ url: '/api/v1/me/membership' });
  const { data: wallet, refetch: refetchWallet } = useDashboardData<Wallet>({
    url: '/api/v1/me/wallet',
  });

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const { mutate: subscribe } = useMutation(
    (planId: string) =>
      apiFetch<{ message: string }>('/api/v1/me/membership', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }),
    {
      successMessage: 'تم تفعيل عضويتك',
      onSuccess: () => {
        // Both change together — the balance dropped and the membership
        // appeared — so refetching one would leave the screen half-updated.
        void refetchMembership();
        void refetchWallet();
      },
    }
  );

  // The hook's own `isPending` is a single boolean, which would spin all four
  // buttons at once. The card that was tapped is tracked here instead.
  const handleSubscribe = useCallback(
    async (planId: string) => {
      setPendingPlanId(planId);
      try {
        await subscribe(planId);
      } finally {
        setPendingPlanId(null);
      }
    },
    [subscribe]
  );

  const balance = wallet?.balance ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <FlexibleHeader
        title="عضويات وريد وسند"
        subtitle="عضوية واحدة .. كل الخدمات"
        icon={<Crown className="w-6 h-6" />}
        showBackButton
        showWallet={false}
      />

      <main className="p-4 space-y-4">
        {membership ? <ActiveMembershipCard membership={membership} /> : null}

        <WalletStrip balance={balance} />

        {/* The client's "ملاحظة مهمة" — stated before the prices, because it is
            the condition under which every number below is true. */}
        <div className="flex gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-[11px] leading-relaxed text-blue-900">
            الخصومات والمزايا متاحة فقط لدى مقدمي الخدمات والمجمعات المشتركين في برنامج
            وريد وسند.
          </p>
        </div>

        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-[1.75rem] border border-gray-100 bg-white" />
          ))
        ) : storefront.plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Crown className="mb-4 h-16 w-16 text-gray-300 opacity-50" />
            <p className="font-medium">لا توجد باقات متاحة حالياً</p>
          </div>
        ) : (
          storefront.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              balance={balance}
              isCurrent={membership?.planName === plan.name}
              isPending={pendingPlanId === plan.id}
              onSubscribe={handleSubscribe}
            />
          ))
        )}

        <HowItWorks />
        <Terms />
      </main>
    </div>
  );
}

/* ----------------------------- active membership --------------------------- */

function ActiveMembershipCard({ membership }: { membership: Membership }) {
  return (
    <section className="rounded-[1.75rem] bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-100">
            <BadgeCheck className="h-3.5 w-3.5" />
            عضويتك الحالية
          </p>
          <h2 className="mt-0.5 truncate text-xl font-extrabold">{membership.planName}</h2>
        </div>
        <div className="flex-shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-center">
          <p className="text-lg font-extrabold leading-none">{membership.discountPercent}%</p>
          <p className="mt-0.5 text-[9px] text-emerald-100">خصم</p>
        </div>
      </div>

      <p className="text-xs text-emerald-50">
        سارية حتى {formatDate(membership.expiresAt)}
        {/* The countdown, because "حتى 12 أكتوبر" does not tell a patient
            whether to renew today. */}
        <span className="mx-1.5 text-emerald-200">•</span>
        متبقٍ {membership.daysRemaining} يوم
      </p>

      {membership.entitlements.some((e) => e.quota !== null) ? (
        <div className="mt-4 space-y-1.5 border-t border-white/15 pt-3.5">
          {membership.entitlements
            .filter((e) => e.quota !== null && e.state === 'AVAILABLE')
            .map((entitlement) => (
              <div key={entitlement.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-emerald-50">{entitlement.label}</span>
                <span className="flex-shrink-0 text-xs font-bold">
                  {/* Remaining out of total, not a bare count: "2" alone does
                      not say whether that is generous or nearly spent. */}
                  {entitlement.remaining} / {entitlement.quota}
                </span>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------- wallet --------------------------------- */

function WalletStrip({ balance }: { balance: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-medium text-gray-600">
        <Wallet className="h-4 w-4 text-gray-400" />
        رصيد محفظتك
      </span>
      <span className="text-sm font-extrabold text-gray-900">
        {formatNumber(balance)} <span className="text-[10px] font-normal text-gray-400">د.ع</span>
      </span>
    </div>
  );
}

/* -------------------------------- plan card -------------------------------- */

function PlanCard({
  plan,
  balance,
  isCurrent,
  isPending,
  onSubscribe,
}: {
  plan: StorefrontPlan;
  balance: number;
  isCurrent: boolean;
  isPending: boolean;
  onSubscribe: (planId: string) => void;
}) {
  const accent = accentOf(plan.accent);
  const shortfall = plan.price - balance;
  const affordable = shortfall <= 0;

  return (
    <section
      className={`overflow-hidden rounded-[1.75rem] border bg-white shadow-sm ${
        plan.isPopular ? 'border-amber-300 ring-1 ring-amber-200' : accent.ring
      } ${plan.isComingSoon ? 'opacity-75' : ''}`}
    >
      <header className={`${accent.chip} px-5 py-4 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold">{plan.name}</h3>
            <p className="mt-0.5 text-[11px] text-white/80">{durationLabel(plan.durationDays)}</p>
          </div>
          <Calendar className="h-5 w-5 flex-shrink-0 text-white/70" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-5 py-4 text-center">
        <p className="text-3xl font-extrabold text-gray-900">
          {formatNumber(plan.price)}
          <span className="ms-1.5 text-sm font-normal text-gray-400">د.ع</span>
        </p>
        <p className="mt-1.5 text-[11px] text-gray-500">نسبة الخصم الأساسية</p>
        <span
          className={`mt-1.5 inline-block rounded-full ${accent.chip} px-3.5 py-1 text-xs font-bold text-white`}
        >
          {plan.discountPercent}%
        </span>
      </div>

      <ul className="divide-y divide-gray-50 px-5">
        {plan.benefits.map((benefit) => (
          <BenefitRow key={benefit.id} benefit={benefit} />
        ))}
      </ul>

      <div className="p-4">
        {plan.isComingSoon ? (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-gray-800 py-3.5 text-sm font-bold text-white opacity-70"
          >
            <Lock className="h-4 w-4" />
            متوفر قريباً
          </button>
        ) : (
          <>
            <button
              type="button"
              // Disabled on affordability too, not just while pending: the
              // wallet is the only payment method, so a tap that can only
              // return "رصيدك لا يكفي" is a dead control.
              disabled={isPending || !affordable}
              onClick={() => onSubscribe(plan.id)}
              className={`w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
            >
              {isPending ? 'جارٍ التنفيذ…' : isCurrent ? 'تجديد العضوية' : 'اشتراك'}
            </button>

            {!affordable ? (
              // The number, not just a refusal. The admin tops wallets up by
              // hand, so "اشحن 12,000" is the actual next step.
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-700">
                <CreditCard className="h-3.5 w-3.5" />
                ينقصك {formatNumber(shortfall)} د.ع — راجع الإدارة لشحن محفظتك
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function BenefitRow({ benefit }: { benefit: StorefrontPlanBenefit }) {
  const locked = benefit.state === 'LOCKED';
  const suspended = benefit.state === 'SUSPENDED';

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span
        className={`truncate text-xs ${locked ? 'text-gray-300' : suspended ? 'text-gray-400' : 'text-gray-700'}`}
      >
        {benefit.label}
      </span>

      <span className="flex flex-shrink-0 items-center gap-2">
        {benefit.quota !== null && !locked ? (
          <span className="text-xs font-bold text-gray-900">عدد {benefit.quota}</span>
        ) : null}

        {/* Three states, three marks — the card's own vocabulary. "معلق" is
            printed rather than hidden: the business shows the line
            deliberately, and a reader must be able to tell a benefit that is
            live from one that is announced. */}
        {locked ? (
          <Lock className="h-3.5 w-3.5 text-gray-300" />
        ) : suspended ? (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            معلق
          </span>
        ) : (
          <Check className="h-4 w-4 text-emerald-500" />
        )}
      </span>
    </li>
  );
}

/* --------------------------------- footer --------------------------------- */

const STEPS = [
  { icon: Wallet, label: 'اشحن محفظتك' },
  { icon: Crown, label: 'اشترك بالباقة' },
  { icon: Calendar, label: 'احجز من التطبيق' },
  { icon: Sparkles, label: 'استفد من الخصومات' },
];

function HowItWorks() {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="mb-3.5 text-sm font-bold text-gray-800">كيف تستفيد من عضويتك؟</h3>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((step, index) => (
          <li key={step.label} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500">
              <step.icon className="h-4 w-4" />
            </span>
            <span className="text-[10px] leading-tight text-gray-600">{step.label}</span>
            <span className="sr-only">الخطوة {index + 1}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TERMS = [
  'الخصومات والمزايا متاحة فقط لدى مقدم الخدمة المشترك.',
  'تطبق الخصومات على الخدمات المتاحة لدى مقدمي الخدمة المشتركين في برنامج وريد وسند.',
  'الأسعار قابلة للتغيير من قبل مقدم الخدمة.',
  'العضويات شخصية وغير قابلة للمشاركة.',
  'يمكنك إلغاء التجديد في أي وقت.',
];

function Terms() {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-800">معلومات مهمة</h3>
      <ul className="space-y-2">
        {TERMS.map((term) => (
          <li key={term} className="flex gap-2">
            <Minus className="mt-1 h-3 w-3 flex-shrink-0 text-gray-300" />
            <span className="text-[11px] leading-relaxed text-gray-600">{term}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
