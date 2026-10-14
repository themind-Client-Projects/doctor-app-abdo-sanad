/**
 * The doctor browse screen, rendered by BOTH storefronts.
 *
 *   /doctors        → channel="DIRECT"  — everyone, at basePrice
 *   /sanad/doctors  → channel="SANAD"   — Sanad providers, at sanadPrice
 *
 * One component with a channel prop rather than two pages, because the markup
 * is identical and the ONLY difference is which pool and which price the API
 * returns. Two copies would drift the moment either is touched.
 */
'use client';

import { useState, useMemo, Suspense } from 'react';
import { Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { FlexibleHeader } from '@/components/shared/flexible-header';

import { SearchInput } from '@/components/shared/search-input';
import { CategoryFilters } from '@/components/shared/category-filters';
import { Pagination } from '@/components/shared/pagination';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import { DoctorCard } from '@/components/shared/doctor-card';
import { useFilters } from '@/hooks/use-filters';
import { useLocationStore } from '@/stores/patient/location.store';
import { CitySelectorDrawer } from '@/components/features/patient/city-selector-drawer';
import { useDoctors } from '@/hooks/use-doctors';
import { useBookingDrawer } from '@/hooks/use-booking-drawer';
import { useStorefront, type Channel } from '@/hooks/use-storefront';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { LoadError, loadFailed } from '@/components/shared/load-error';

/** Cover images live in /public and are keyed by position — the DB stores no
 *  complex artwork, so cycling them keeps the strip looking designed rather
 *  than showing a broken image for every complex. */
// COMPLEX_COVERS removed. Three PNGs in /public handed out by LIST POSITION —
// `COMPLEX_COVERS[i % 3]` — so the photo on a complex card belonged to
// whichever complex happened to sit at that index, and reordering the list
// silently reassigned the buildings. `MedicalComplex` has no image column at
// all, so there is nothing to show; a gradient says nothing false.

type ComplexAd = { id: string; name: string; complex: { id: string; name: string } | null };

export function DoctorsBrowse({ channel = 'DIRECT' }: { channel?: Channel }) {
  // "زر تفعيل خدمات سند داخل اوبشن حجز الأطباء بالاعلى" — a switch at the top
  // of the doctor list that moves it to the Sanad pool and its prices.
  //
  // Offered only OUTSIDE Sanad: on /sanad/doctors you are already there, and a
  // toggle that turns on what is already on is noise.
  const { isEnabled } = useFeatureFlags();
  const canOfferSanad = isEnabled('sanad.in_doctor_booking') && channel === 'DIRECT';
  const [sanadOn, setSanadOn] = useState(false);

  // The switch changes the CHANNEL, so the pool and the quoted price move
  // together — showing Sanad prices against non-Sanad doctors would advertise
  // a discount those providers never agreed to.
  const activeChannel: Channel = canOfferSanad && sanadOn ? 'SANAD' : channel;

  const { allDoctors, paginatedDoctors, totalCount, itemsPerPage, isLoading, error, refetch } =
    useDoctors({ channel: activeChannel });
  // `allDoctors`, not `totalCount`: totalCount is the FILTERED count, so an
  // active search term would look like a failed fetch.
  const failed = loadFailed(error, allDoctors.length);
  const { storefront } = useStorefront(activeChannel);
  // Real complexes, scoped to the same storefront the visitor is browsing.
  const { data: complexAds } = useDashboardData<ComplexAd[]>({
    url: '/api/public/partners',
    params: { channel: activeChannel, complexesOnly: 'true', limit: '10' },
  });
  const { drawerOpen, setDrawerOpen, selectedDoctor, openBooking } = useBookingDrawer();
  const { selectedCity } = useLocationStore();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      <FlexibleHeader 
        title={`أطباء ${selectedCity || 'العراق'}`}
        showBackButton 
        showCitySelector 
        showWallet={false}
        isCompact={true}
      />

      <div className="px-5 pt-4">

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto flex gap-2">
          <SearchInput className="flex-1" placeholder="ابحث عن طبيب، تخصص، منطقة..." />
          <button className="w-12 h-[52px] bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 flex-shrink-0 active:scale-95 transition-transform hover:border-primary/50 hover:text-primary">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className="mt-6 space-y-8">
        {canOfferSanad ? (
          <section className="px-4">
            <button
              type="button"
              onClick={() => setSanadOn((v) => !v)}
              aria-pressed={sanadOn}
              className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition-colors ${
                sanadOn ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="min-w-0">
                <span className="block font-extrabold text-gray-800">أسعار سند</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {sanadOn
                    ? 'تعرض الآن أطباء سند بأسعارهم المخفّضة'
                    : 'فعّل لعرض أطباء سند بأسعار مخفّضة'}
                </span>
              </span>
              <span
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  sanadOn ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] ${
                    sanadOn ? 'start-6' : 'start-1'
                  }`}
                />
              </span>
            </button>
          </section>
        ) : null}

        {/* Clinics Ads — hidden entirely when this storefront has no complexes,
            rather than leaving an empty titled strip. */}
        <section className={(complexAds ?? []).length === 0 ? 'hidden' : undefined}>
          <div className="px-4 flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-800">إعلانات المجمعات</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x px-4 pb-2">
            {(complexAds ?? []).map((complex, i) => (
              <Link key={complex.id} href={`/complexes/${complex.complex?.id ?? complex.id}`} className="min-w-[240px] h-36 relative rounded-[2rem] shadow-sm snap-center overflow-hidden flex flex-col items-center justify-end p-5 group active:scale-95 transition-transform">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-emerald-500/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
                <h3 className="relative z-10 font-bold text-lg text-white drop-shadow-lg tracking-wide">{complex.complex?.name ?? complex.name}</h3>
              </Link>
            ))}
          </div>
        </section>
        {/* Specialties Filter */}
        <section>
          <div className="px-4 mb-4">
            <h2 className="text-base font-bold text-gray-800">فلترة التخصصات</h2>
          </div>
          <CategoryFilters
            categories={storefront.specialties.map((s) => ({ id: s.slug, name: s.name }))}
            allLabel="جميع التخصصات"
          />
        </section>

        {/* Doctors List */}
        <section className="px-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-gray-800">الأطباء المتاحين</h2>
            <span className="text-xs text-gray-500 font-medium">{failed ? '' : `${totalCount} طبيب`}</span>
          </div>

          {failed ? (
            <LoadError message="تعذّر تحميل قائمة الأطباء" onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-3xl bg-white border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">لا يوجد أطباء</h3>
              <p className="text-sm text-gray-500">جرب تغيير كلمات البحث أو الفلتر</p>
            </div>
          ) : (
            paginatedDoctors.map((doctor) => (
              <DoctorCard
                // `activeChannel`, not the prop: the سند toggle inside doctor
                // booking can switch a DIRECT browse to the Sanad pool, and the
                // profile link has to follow the pool actually being shown.
                channel={activeChannel} 
                key={doctor.id} 
                doctor={doctor} 
                onBook={openBooking} 
              />
            ))
          )}

          {/* Pagination */}
          <Pagination totalItems={totalCount} itemsPerPage={itemsPerPage} />
        </section>
      </main>

      {/* ── Booking Drawer ── */}
      <DoctorBookingDrawer
        doctor={selectedDoctor}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        // `activeChannel`, not the prop — same as DoctorCard above. With the
        // سند toggle on, the prop is still DIRECT, so the patient browsed سند
        // prices and the booking was posted (and priced) as DIRECT.
        channel={activeChannel}
      />

      <CitySelectorDrawer />
    </div>
  );
}

