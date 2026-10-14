'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { Filter, MapPin, Star, User } from 'lucide-react';

import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import type { Doctor } from '@/types/patient';
import { useDoctors } from '@/hooks/use-doctors';
import { useBookingDrawer } from '@/hooks/use-booking-drawer';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { SearchInput } from '@/components/shared/search-input';
import { LoadError, loadFailed } from '@/components/shared/load-error';
import { useFilters } from '@/hooks/use-filters';

// ─────────────────────────────────────────────────────────────
// صفحة المجمع الطبي.
//
// Every real complex opened as an invented one. `COMPLEXES_DATA` was a map
// keyed '1' | '2' | '3' read as `COMPLEXES_DATA[id] || COMPLEXES_DATA['1']`,
// while the only link into this route — the «إعلانات المجمعات» strip on
// /doctors — passes a real `MedicalComplex` cuid. A cuid never matches a key,
// so the fallback fired every time: tapping «مجمع الكرخ الطبي» showed
// «مجمع النور الطبي» in «بغداد - المنصور», and so did all five of the
// complexes in the database.
//
// The rest of the page was invented too: «أطباء المجمع» called `useDoctors()`
// with no argument and listed the first six doctors on the WHOLE platform,
// and the pharmacies and labs were `DEMO_PHARMACIES` / a local `DEMO_LABS`
// with invented names, ratings and opening hours — businesses that do not
// exist, under headings claiming they belong to this complex.
//
// All of it is real now. `Partner.complexId` and `DoctorProfile.complexId`
// have always held the membership (both indexed); the two public endpoints
// just never exposed a filter. Where a complex has no member a patient can
// actually reach, the section says so instead of inventing three.
//
// «متاحة حالياً», not «مسجّلة»: the public endpoints require `status: ACTIVE`,
// and in this database every complex member is PAUSED or PENDING — registered
// but not approved. Saying "none registered" would be its own small untruth.
//
// No cover photo: `MedicalComplex` has no image column, so the old
// `/complexes/real_complex_1.png` could not have been that complex's picture
// under any circumstances.
// ─────────────────────────────────────────────────────────────

type ComplexOwner = {
  id: string;
  name: string;
  location: string;
  address: string;
  complex: { id: string; name: string } | null;
};

type Member = {
  id: string;
  name: string;
  type: string;
  location: string;
  address: string;
  rating: number;
};

export default function ComplexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { searchQuery } = useFilters();
  const { drawerOpen, setDrawerOpen, selectedDoctor, openBooking } = useBookingDrawer();

  // The complex's own identity, from the same endpoint the link came from.
  const {
    data: owners,
    isLoading: loadingComplex,
    error: complexError,
    refetch: refetchComplex,
  } = useDashboardData<ComplexOwner[]>({
    url: '/api/public/partners',
    params: { complexesOnly: 'true', limit: '100' },
  });

  const owner = useMemo(
    () => (owners ?? []).find((o) => o.complex?.id === id) ?? null,
    [owners, id]
  );

  const { allDoctors, isLoading: loadingDoctors, error: doctorsError, refetch: refetchDoctors } =
    useDoctors({ complexId: id });

  const { data: members, isLoading: loadingMembers } = useDashboardData<Member[]>({
    url: '/api/public/partners',
    params: { complexId: id, limit: '50' },
  });

  const pharmacies = useMemo(
    () => (members ?? []).filter((m) => m.type === 'PHARMACY'),
    [members]
  );
  const labs = useMemo(() => (members ?? []).filter((m) => m.type === 'LAB'), [members]);

  // The search box writes `?q=` to the URL and the page used to render the
  // unfiltered list, so typing in «ابحث داخل …» changed nothing on screen.
  const doctors = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return allDoctors;
    return allDoctors.filter(
      (d) => d.name.includes(q) || d.specialty.includes(q)
    );
  }, [allDoctors, searchQuery]);

  const complexName = owner?.complex?.name ?? '';
  const complexLocation = [owner?.location, owner?.address].filter(Boolean).join(' - ');

  if (!loadingComplex && !complexError && !owner) {
    // Never another complex's identity. An id that is not in the list is
    // either gone or not sold through this storefront, and saying so is the
    // only honest answer.
    return (
      <div className="min-h-screen bg-gray-50 pb-20 font-sans">
        <main className="px-5 pt-16">
          <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="font-bold text-gray-800">هذا المجمع غير متاح</p>
            <p className="mt-2 text-sm text-gray-500">
              قد يكون المجمع قد توقّف عن العمل أو لم يَعُد معروضاً هنا.
            </p>
            <Link
              href="/doctors"
              className="mt-5 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              تصفّح الأطباء
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* A gradient, not a photograph: there is no image for a complex to show. */}
      <div className="relative h-44 w-full bg-gradient-to-br from-primary to-primary/70" />

      <main className="relative z-10 -mt-8 space-y-8 px-5">
        <div className="flex flex-col items-center rounded-[2rem] border border-gray-100 bg-white p-6 text-center shadow-sm">
          {loadingComplex ? (
            <>
              <div className="mb-2 h-7 w-48 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
            </>
          ) : complexError ? (
            <LoadError message="تعذّر تحميل بيانات المجمع" onRetry={() => void refetchComplex()} />
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-extrabold text-gray-900">{complexName}</h1>
              {complexLocation ? (
                <p className="flex items-center justify-center gap-1 text-sm font-medium text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {complexLocation}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex gap-3">
          <SearchInput
            className="flex-1"
            placeholder={complexName ? `ابحث داخل ${complexName}...` : 'ابحث...'}
          />
          {/* The filter button had no handler at all. The search box is the
              real control; this stays as a disabled affordance rather than a
              live-looking button that does nothing. */}
          <button
            type="button"
            disabled
            aria-label="تصفية (غير متاحة)"
            className="flex h-[52px] w-[56px] flex-shrink-0 items-center justify-center rounded-[1.5rem] bg-white text-gray-300 shadow-sm"
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>

        {/* ── Doctors ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-base font-bold text-gray-900">أطباء المجمع</h2>
          {loadFailed(doctorsError, allDoctors.length) ? (
            <LoadError message="تعذّر تحميل الأطباء" onRetry={() => void refetchDoctors()} />
          ) : loadingDoctors ? (
            <div className="flex gap-4 overflow-hidden">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 min-w-[240px] animate-pulse rounded-3xl bg-white" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <EmptySection text="لا يوجد أطباء متاحون في هذا المجمع حالياً" />
          ) : (
            <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 hide-scrollbar">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="min-w-[240px] snap-center rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-sm font-bold text-gray-900">{doctor.name}</h3>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">{doctor.specialty}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-bold text-gray-700">{doctor.rating}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openBooking(doctor as Doctor)}
                    className="w-full rounded-xl bg-primary/10 py-2 text-xs font-bold text-primary transition-transform hover:bg-primary/20 active:scale-95"
                  >
                    حجز موعد
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Pharmacies ──────────────────────────────────────────── */}
        <MemberSection
          title="صيدليات المجمع"
          members={pharmacies}
          isLoading={loadingMembers}
          emptyText="لا توجد صيدليات متاحة في هذا المجمع حالياً"
        />

        {/* ── Labs ────────────────────────────────────────────────── */}
        <MemberSection
          title="المختبرات والتحاليل"
          members={labs}
          isLoading={loadingMembers}
          emptyText="لا توجد مختبرات متاحة في هذا المجمع حالياً"
        />
      </main>

      <DoctorBookingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        doctor={selectedDoctor}
        // Booked inside a complex, so the complex price applies — the server
        // reads `source` to decide which of the three it quotes.
        channel="COMPLEX"
      />
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-center">
      <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
}

/**
 * A complex's member pharmacies or labs — real `Partner` rows.
 *
 * No opening hours and no «مفتوح الآن» badge: `Partner` has no hours column,
 * and the invented version of this strip showed both.
 */
function MemberSection({
  title,
  members,
  isLoading,
  emptyText,
}: {
  title: string;
  members: Member[];
  isLoading: boolean;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-gray-900">{title}</h2>
      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 min-w-[220px] animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptySection text={emptyText} />
      ) : (
        <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 hide-scrollbar">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex min-w-[220px] snap-center items-center gap-3 rounded-3xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 line-clamp-1 text-xs font-bold text-gray-900">{m.name}</h3>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] font-bold text-gray-600">{m.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
