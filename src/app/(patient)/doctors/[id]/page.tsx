'use client';

import { useState, useMemo, useRef, use } from 'react';
import { Filter, MapPin, Star, Phone, CalendarClock, Clock, Stethoscope, UserCheck, ChevronLeft, Check, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { useAuthGuard } from '@/hooks/use-auth-guard';
// Time slots and the availability calendar are still demo data — real slots
// need DoctorSchedule joined against existing appointments, which is the
// booking work, not this fix.
import { DEMO_TIME_SLOTS, DEMO_AVAILABLE_DATES, isDateAvailable } from '@/lib/constants/demo-data';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useStorefront } from '@/hooks/use-storefront';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { DoctorCard } from '@/components/shared/doctor-card';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import type { Doctor } from '@/types/patient';

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

  const { data: fetchedDoctors, isLoading, error } = useDashboardData<Doctor[]>({
    url: '/api/public/doctors',
    params: { specialty: id, channel: 'DIRECT' },
  });
  const doctors = useMemo(() => fetchedDoctors ?? [], [fetchedDoctors]);

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'nearest'>('all');

  // ── Reservation Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const timeSectionRef = useRef<HTMLDivElement>(null);

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
      setSelectedDate(undefined);
      setSelectedTime(null);
      setBookingConfirmed(false);
      setDrawerOpen(true);
    });
  };

  const confirmBooking = () => {
    setBookingConfirmed(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setBookingConfirmed(false);
    }, 2000);
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

        {/* Doctor Cards */}
        {!isLoading && filteredDoctors.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="لا يوجد أطباء متاحين"
            description="جرّب تغيير عوامل التصفية أو ارجع لاحقاً"
            actionLabel="عرض الكل"
            onAction={() => setActiveFilter('all')}
          />
        )}

        {!isLoading && filteredDoctors.map((doctor) => (
          <DoctorCard 
            key={doctor.id} 
            doctor={doctor} 
            onBook={openBooking} 
          />
        ))}
      </main>

      {/* ── Reservation Drawer ────────────────────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="!max-h-[92vh] h-[92vh]">
          <div className="mx-auto w-full flex flex-col h-full">
            <DrawerHeader className="text-right px-5">
              <DrawerTitle className="text-2xl font-extrabold">حجز موعد</DrawerTitle>
              <DrawerDescription>
                {selectedDoctor && (
                  <span className="block text-right mt-1 text-base">
                    <span className="font-bold text-gray-700">{selectedDoctor.name}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    {selectedDoctor.specialty}
                  </span>
                )}
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Success State */}
              {bookingConfirmed ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <Check className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-800 mb-2">تم الحجز بنجاح!</h3>
                  <p className="text-sm text-gray-500 mb-1">تم تأكيد موعدك مع {selectedDoctor?.name}</p>
                  <p className="text-xs text-gray-400">سيتم إشعارك قبل الموعد بساعة</p>
                </div>
              ) : (
                <>
                  {/* Calendar */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                      <CalendarClock className="w-5 h-5 text-primary" />
                      اختر التاريخ
                    </h4>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          setSelectedDate(d);
                          setSelectedTime(null);
                          if (d) {
                            setTimeout(() => {
                              timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 150);
                          }
                        }}
                        disabled={(day) => {
                          const d = new Date(day);
                          d.setHours(0, 0, 0, 0);
                          return d < today || !isDateAvailable(d);
                        }}
                        className="rounded-md [--cell-size:40px] !w-full"
                        modifiers={{ available: DEMO_AVAILABLE_DATES }}
                        modifiersClassNames={{
                          available: 'ring-2 ring-primary/20 ring-inset font-bold',
                        }}
                      />
                    </div>
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 px-1 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary flex-shrink-0" />
                        <span>التاريخ المختار</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded ring-2 ring-primary/30 bg-white flex-shrink-0" />
                        <span>متاح</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gray-200 flex-shrink-0" />
                        <span>غير متاح</span>
                      </div>
                    </div>
                  </div>

                  {/* Available Times */}
                  {selectedDate && (
                    <div ref={timeSectionRef}>
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                        <Clock className="w-5 h-5 text-primary" />
                        الأوقات المتاحة
                      </h4>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {DEMO_TIME_SLOTS.map(({ time, available }) => (
                          <button
                            key={time}
                            disabled={!available}
                            onClick={() => setSelectedTime(time)}
                            className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-sm sm:text-base font-bold border transition-colors ${
                              !available
                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                                : selectedTime === time
                                  ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-[1.02]'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selectedDate && selectedTime && (
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-2">
                      <h4 className="text-sm font-bold text-primary">ملخص الحجز</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Stethoscope className="w-4 h-4 text-primary" />
                        <span>{selectedDoctor?.name} — {selectedDoctor?.specialty}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CalendarClock className="w-4 h-4 text-primary" />
                        <span>{selectedDate.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{selectedTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{selectedDoctor?.clinic} — {selectedDoctor?.location}</span>
                      </div>
                      <div className="pt-2 border-t border-primary/10 flex justify-between items-center">
                        <span className="text-xs text-gray-500">رسوم الكشف</span>
                        <span className="font-extrabold text-primary">{selectedDoctor?.price}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!bookingConfirmed && (
              <DrawerFooter>
                <Button
                  className="w-full rounded-xl py-6 font-bold text-base"
                  disabled={!selectedDate || !selectedTime}
                  onClick={confirmBooking}
                >
                  تأكيد الحجز
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full rounded-xl py-6 font-bold">
                    إلغاء
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
