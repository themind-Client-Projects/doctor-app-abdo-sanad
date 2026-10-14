'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, HelpCircle, User, Hospital, Microscope } from 'lucide-react';
import { useStorefront } from '@/hooks/use-storefront';
import { LoadError, loadFailed } from '@/components/shared/load-error';
import { formatNumber } from '@/lib/format';
import { InfoBadge } from '@/components/shared/info-badge';
import { SubscriptionPackageCard } from '@/components/shared/subscription-package-card';

/**
 * باقات سند — now the real plans, in dinars.
 *
 * This page sold «اشتراك فردي» at «١٦.٥٠ ريال/شهر» with «وفر ١,٢٠٠ ريال/عام» —
 * SAUDI RIYALS, in a product priced entirely in Iraqi dinars, for a plan that
 * exists in no table. Nothing links here, so it was only reachable by URL, but
 * a URL is enough: the figures were invented and the currency was another
 * country's.
 *
 * The real plans come from the سند storefront, the same source /memberships
 * uses, so the two screens cannot quote different prices. Subscribing still
 * happens on /memberships, which is where the wallet balance and the shortfall
 * message live — this page shows what is on offer and sends the patient there.
 */
export default function SanadPackagesPage() {
  const router = useRouter();
  const { storefront, isLoading, error, refetch } = useStorefront('SANAD');
  const plansFailed = loadFailed(error, storefront.plans.length);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-20 font-sans" dir="rtl">
      {/* Custom Top Navigation for this specific flow */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between bg-white border-b border-gray-100">
        <button 
          className="flex items-center gap-1.5 bg-sky-50 text-sky-600 px-3 py-1.5 rounded-full font-bold text-xs active:scale-95 transition-transform"
        >
          <HelpCircle className="w-4 h-4" />
          مساعدة
        </button>

        {/* Logo Text */}
        <h1 className="font-extrabold text-2xl tracking-wide text-primary">سند</h1>

        <button 
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <main className="px-5 mt-6">
        {/* Hero Section */}
        <section className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-primary mb-2">سند رعاية أشمل صحة أوفر</h2>
          <p className="text-sm font-medium text-gray-600 mb-6">
            وفر حتى 50% على جميع احتياجاتك من الرعاية الصحية
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            {/* The counts were literals — "300+ دكتور" against a platform that
                currently lists 8, "2+ مركز أشعة", "13+ المستشفيات". Nothing
                counts any of them, so the categories stay and the invented
                numbers go; a real count needs an endpoint that does not exist
                yet, and a made-up one is worse than none. */}
            <InfoBadge icon={<User className="w-3.5 h-3.5 text-blue-500" />} text="أطباء" />
            <InfoBadge icon={<Microscope className="w-3.5 h-3.5 text-blue-500" />} text="مراكز أشعة" />
            <InfoBadge icon={<Hospital className="w-3.5 h-3.5 text-blue-500" />} text="مستشفيات وعيادات" />
          </div>

          <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors active:scale-[0.98]">
            اكتشف باقات سند
          </button>
        </section>

        {/* The "اعرف المزيد عن سند" strip was five empty story circles from a
            `mockStories` constant — no content behind any of them. */}

        {/* Packages Section */}
        <section className="mb-8">
          <h2 className="text-center font-extrabold text-xl text-gray-900 mb-6">اختر باقتك</h2>
          
          {plansFailed ? (
            <LoadError message="تعذّر تحميل الباقات" onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl border border-gray-100 bg-white" />
              ))}
            </div>
          ) : storefront.plans.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-gray-500">
              لا توجد باقات متاحة حالياً
            </p>
          ) : (
            <div className="space-y-4">
              {storefront.plans.map((plan) => (
                <SubscriptionPackageCard
                  key={plan.id}
                  title={plan.name}
                  price={formatNumber(plan.price)}
                  billingCycle={`د.ع / ${
                    plan.durationDays === 1
                      ? 'يوم'
                      : plan.durationDays === 7
                        ? 'أسبوع'
                        : plan.durationDays >= 365
                          ? 'سنة'
                          : 'شهر'
                  }`}
                  userCount={plan.description ?? ''}
                  // No invented saving. The real figure the plan carries is its
                  // discount rate, which is what the patient actually gets.
                  userSavings={`خصم ${plan.discountPercent}% لدى المشتركين في البرنامج`}
                  features={plan.benefits
                    .filter((b) => b.state === 'AVAILABLE')
                    .slice(0, 3)
                    .map((b) => `${b.label}${b.quota !== null ? ` — عدد ${b.quota}` : ''}`)}
                />
              ))}
              <Link
                href="/memberships"
                className="block w-full rounded-2xl bg-primary py-3.5 text-center text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                الاشتراك وإدارة العضوية
              </Link>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
