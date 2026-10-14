'use client';

import Image from 'next/image';
import { MapPin, Calendar, Stethoscope, Microscope, Pill, Syringe, Activity, CalendarX } from 'lucide-react';
import Link from 'next/link';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { storefrontCategories } from '@/lib/channel-routes';
import { HomeSearchBox } from '@/components/features/patient/home-search-box';
import { getBookingStatusConfig, type BookingStatus } from '@/components/features/patient/booking-status';
import { useStorefront } from '@/hooks/use-storefront';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { formatDate } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// سند — the home screen, on real data.
//
// Three things on this page were invented and presented as fact:
//
//   · a promo — «خصم 20% على التحاليل … في مختبرات الشفاء» — for a discount
//     nobody set, at a lab that does not exist. The main home has read its
//     banners from `Banner` since the storefront endpoint landed; this one
//     never did, so the client could not run a سند campaign at all, and the
//     offer on screen was unretractable without a deploy.
//
//   · «حجوزاتي القادمة» — a confirmed appointment with «د. سمير محمود،
//     أخصائي أمراض القلب، غداً 10:30 صباحاً، مستشفى السلام». Hardcoded, so a
//     patient who had never booked anything was shown a confirmed cardiology
//     appointment for tomorrow, and a patient with a real appointment was
//     shown someone else's.
//
//   · two «الكل» / «عرض الكل» spans and a «التفاصيل» button, none of which
//     were links or had handlers.
// ─────────────────────────────────────────────────────────────────────────

/** Every category here stays inside سند — see `channel-routes`. */
const SANAD_ROUTES = storefrontCategories('SANAD');

type BookingCard = {
  id: string;
  providerName: string;
  subtitle: string;
  date: string;
  time: string | null;
  location: string;
  status: BookingStatus;
};

export default function HomePage() {
  const { storefront } = useStorefront('SANAD');
  const { isSignedIn } = useAuthGuard();

  // A visitor has no bookings to show and no token to ask with, so the request
  // is not made at all rather than fired and 401'd.
  const { data: bookings, isLoading: bookingsLoading } = useDashboardData<{
    upcoming: BookingCard[];
  }>({ url: '/api/v1/me/bookings', enabled: isSignedIn });

  const nextBooking = bookings?.upcoming?.[0] ?? null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24">
      <FlexibleHeader 
        subtitle="مرحباً بك في سند،" 
        icon={<Activity className="w-6 h-6" />} 
        showWallet 
      />

      <main className="px-4 mt-4 space-y-8">
        {/* Search */}
        <HomeSearchBox placeholder="ابحث عن طبيب، تخصص، مستشفى..." channel="SANAD" />
        {/* Billboard / Announcements — `Banner` rows scoped to سند. With no
            live campaign the section is absent, rather than showing a
            standing offer that was never granted. */}
        {storefront.banners.length > 0 && (
          <section>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-2">
              {storefront.banners.map((banner) => {
                const face = (
                  <>
                    <Image src={banner.imageUrl} alt={banner.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-l from-teal-900/80 via-emerald-800/55 to-transparent" />
                    <div className="relative z-10 w-2/3">
                      <h2 className="text-lg font-bold mb-1 drop-shadow-md">{banner.title}</h2>
                      {banner.subtitle && (
                        <p className="text-sm text-white/90 drop-shadow">{banner.subtitle}</p>
                      )}
                    </div>
                  </>
                );
                const className =
                  'min-w-[85vw] sm:min-w-[320px] h-36 rounded-2xl p-5 text-white shadow-md snap-center relative overflow-hidden flex items-center';
                // A banner with no href stays an image rather than a dead link.
                return banner.href ? (
                  <Link key={banner.id} href={banner.href} className={className}>
                    {face}
                  </Link>
                ) : (
                  <div key={banner.id} className={className}>
                    {face}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Categories Carousel (Mocked as grid for now) */}
        <section>
          {/* No «الكل» link: all five categories are on screen, so it had
              nothing to open — and it never had a handler. */}
          <h3 className="text-lg font-bold text-gray-800 mb-4">الأقسام الطبية</h3>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 pt-1">
            {[
              { id: 1, name: 'الأطباء', icon: <Stethoscope className="w-8 h-8" />, color: 'bg-blue-100 text-blue-600 shadow-blue-100', href: SANAD_ROUTES.doctors },
              { id: 2, name: 'المختبرات', icon: <Microscope className="w-8 h-8" />, color: 'bg-purple-100 text-purple-600 shadow-purple-100', href: SANAD_ROUTES.labs },
              { id: 3, name: 'الصيدليات', icon: <Pill className="w-8 h-8" />, color: 'bg-emerald-100 text-emerald-600 shadow-emerald-100', href: SANAD_ROUTES.pharmacies },
              { id: 4, name: 'التمريض', icon: <Syringe className="w-8 h-8" />, color: 'bg-rose-100 text-rose-600 shadow-rose-100', href: SANAD_ROUTES.nursing },
              // «العلاج الطبيعي», not «أخرى»: the tile goes to exactly one
              // place — SANAD_ROUTES.physiotherapy — so labelling it "other"
              // hid the destination. /search already names it correctly.
              { id: 5, name: 'العلاج الطبيعي', icon: <Activity className="w-8 h-8" />, color: 'bg-amber-100 text-amber-600 shadow-amber-100', href: SANAD_ROUTES.physiotherapy },
            ].map((cat) => (
              <Link key={cat.id} href={cat.href} className="flex flex-col items-center gap-3 min-w-[80px] transition-transform active:scale-95 group">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform ${cat.color}`}>
                  {cat.icon}
                </div>
                <span className="text-xs font-bold text-gray-700">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Surgeries Section */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4">العمليات الجراحية</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-800 mb-1">احجز عمليتك الآن</h4>
              <p className="text-sm text-gray-500">نوفر لك أفضل المستشفيات بأسعار مناسبة</p>
            </div>
            <Link
              href="/services/surgeries"
              className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap"
            >
              التفاصيل
            </Link>
          </div>
        </section>

        {/* My Bookings Preview — the patient's own next booking, or nothing */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">حجوزاتي القادمة</h3>
            <Link href="/bookings" className="text-sm text-primary font-medium">
              عرض الكل
            </Link>
          </div>

          {!isSignedIn ? (
            <Link
              href="/bookings"
              className="bg-white rounded-2xl p-5 shadow-sm border border-border flex flex-col items-center gap-2 text-center"
            >
              <Calendar className="w-7 h-7 text-gray-300" />
              <p className="text-sm font-bold text-gray-700">سجّل الدخول لعرض حجوزاتك</p>
            </Link>
          ) : bookingsLoading && !nextBooking ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-border animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-1/2 rounded bg-gray-100" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                </div>
              </div>
              <div className="h-10 rounded-xl bg-gray-50" />
            </div>
          ) : !nextBooking ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border flex flex-col items-center gap-2 text-center">
              <CalendarX className="w-7 h-7 text-gray-300" />
              <p className="text-sm font-bold text-gray-700">لا حجوزات قادمة</p>
              <p className="text-xs text-gray-500">اختر قسماً من الأقسام الطبية أعلاه لتحجز موعدك.</p>
            </div>
          ) : (
            <Link
              href="/bookings"
              className="block bg-white rounded-2xl p-4 shadow-sm border border-border"
            >
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex gap-3 min-w-0">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-800 truncate">{nextBooking.providerName}</h4>
                    {nextBooking.subtitle ? (
                      <p className="text-xs text-gray-500 truncate">{nextBooking.subtitle}</p>
                    ) : null}
                  </div>
                </div>
                {(() => {
                  const cfg = getBookingStatusConfig(nextBooking.status);
                  return (
                    <span
                      className={`${cfg.bg} ${cfg.text} text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap flex-shrink-0`}
                    >
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>
                    {formatDate(nextBooking.date)}
                    {nextBooking.time ? `، ${nextBooking.time}` : ''}
                  </span>
                </div>
                {nextBooking.location ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate">{nextBooking.location}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          )}
        </section>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
