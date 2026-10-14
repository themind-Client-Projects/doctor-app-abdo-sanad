'use client';

import { useState, useMemo, use } from 'react';
import { Filter, MapPin, Star, Phone, CalendarClock, Clock, Stethoscope, UserCheck, ChevronLeft, Check, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useStorefront } from '@/hooks/use-storefront';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { DoctorCard } from '@/components/shared/doctor-card';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import type { Doctor } from '@/types/patient';
import { LoadError, loadFailed } from '@/components/shared/load-error';

// ─── Component ──────────────────────────────────────────────────────────

export default function DoctorListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  // `id` is a Specialty SLUG. The icon still comes from the constant — it is a
  // React component and cannot come over the wire — but the NAME and the doctor
  // list now come from the database, which is what makes this page agree with
  // the listing that linked to it.
  const specConstant = SPECIALIZATIONS.find(s => s.id === id);
  const SpecIcon = specConstant?.icon;

  const { storefront } = useStorefront('DIRECT');
  const specialization = useMemo(() => {
    const fromDb = storefront.specialties.find(s => s.slug === id);
    return fromDb ? { id: fromDb.slug, name: fromDb.name } : specConstant;
  }, [storefront.specialties, id, specConstant]);

  const { data: fetchedDoctors, isLoading, error, refetch } = useDashboardData<Doctor[]>({
    url: '/api/public/doctors',
    params: { specialty: id, channel: 'DIRECT' },
  });
  const doctors = useMemo(() => fetchedDoctors ?? [], [fetchedDoctors]);
  // Failed AND nothing cached to show. A background revalidation that fails
  // must not hide rows the patient is already reading.
  const failed = loadFailed(error, doctors.length);

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'nearest'>('all');

  // ── Reservation Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Filter doctors ──
  const filteredDoctors = (() => {
    switch (activeFilter) {
      case 'available':
        return doctors.filter((d: Doctor) => d.isAvailable);
      case 'nearest':
        return [...doctors].sort((a: Doctor, b: Doctor) => b.rating - a.rating);
      default:
        return doctors;
    }
  })();

  // Filtering is client-side over an already-loaded list, so it is instant —
  // the old 300ms simulated spinner was there only because filtering a
  // hardcoded array had no latency to show.
  const handleFilterChange = (filter: 'all' | 'available' | 'nearest') => {
    setActiveFilter(filter);
  };

  const { ensureSignedIn } = useAuthGuard();

  // ── Handle booking flow ──
  //
  // This page keeps its OWN drawer state rather than going through
  // `useBookingDrawer`, so gating the shared hook does not cover it — it needs
  // the guard applied here too. That divergence is exactly why the audit went
  // surface by surface instead of trusting one choke point.
  const openBooking = (doctor: Doctor) => {
    ensureSignedIn(() => {
      setSelectedDoctor(doctor);
      setDrawerOpen(true);
    });
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-primary/80 px-4 pt-4 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10 flex flex-col items-center mt-2">
          {SpecIcon && (
            <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-3">
              <SpecIcon className="w-9 h-9 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {specialization?.name || 'الأطباء'}
          </h1>
          <p className="text-primary-foreground/70 text-sm mt-1 font-medium">
            {doctors.length} طبيب متاح
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 mt-5 flex gap-2">
        <button
          onClick={() => handleFilterChange('all')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeFilter === 'all'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
          }`}
        >
          الكل
        </button>
        <button
          onClick={() => handleFilterChange('available')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeFilter === 'available'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          المتاحين
        </button>
        <button
          onClick={() => handleFilterChange('nearest')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeFilter === 'nearest'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
          }`}
        >
          <Star className="w-4 h-4" />
          الأعلى تقييماً
        </button>
      </div>

      <main className="px-4 mt-5 space-y-4">
        {/* Loading */}
        {isLoading && <LoadingSkeleton variant="card" count={3} />}

        {/* A failed read said «لا يوجد أطباء متاحين» — a statement about the
            platform, made on the strength of a request that never answered. */}
        {failed && <LoadError message="تعذّر تحميل قائمة الأطباء" onRetry={() => void refetch()} />}

        {/* Doctor Cards */}
        {!isLoading && !failed && filteredDoctors.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="لا يوجد أطباء متاحين"
            description="جرّب تغيير عوامل التصفية أو ارجع لاحقاً"
            actionLabel="عرض الكل"
            onAction={() => setActiveFilter('all')}
          />
        )}

        {!isLoading && !failed && filteredDoctors.map((doctor) => (
          <DoctorCard 
            key={doctor.id} 
            doctor={doctor} 
            onBook={openBooking} 
          />
        ))}
      </main>

      {/* ── Reservation Drawer ──────────────────────────────────────────────
          Was a SECOND copy of the booking drawer, ~150 lines, with its own
          `confirmBooking` that set a flag and closed after 2s — so this screen
          announced «تم تأكيد الحجز» and wrote nothing, independently of the
          shared drawer's identical bug. One flow now, which brings the real
          wallet balance and the real write with it. */}
      <DoctorBookingDrawer
        doctor={selectedDoctor}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        channel="DIRECT"
      />
    </div>
  );
}
