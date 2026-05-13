'use client';

import { useState, useRef, use } from 'react';
import { Filter, MapPin, Star, Phone, CalendarClock, Clock, Stethoscope, UserCheck, ChevronLeft, Check, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageBackButton } from '@/components/shared/page-back-button';
import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { DEMO_DOCTORS, DEMO_TIME_SLOTS, DEMO_AVAILABLE_DATES, isDateAvailable } from '@/lib/constants/demo-data';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
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
  
  // Find the specialization from our constants
  const specialization = SPECIALIZATIONS.find(s => s.id === id);
  const SpecIcon = specialization?.icon;
  const doctors = DEMO_DOCTORS[id] || [];

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'nearest'>('all');
  const [isLoading, setIsLoading] = useState(false);

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
        return doctors.filter(d => d.isAvailable);
      case 'nearest':
        return [...doctors].sort((a, b) => b.rating - a.rating);
      default:
        return doctors;
    }
  })();

  // ── Handle filter change with simulated loading ──
  const handleFilterChange = (filter: 'all' | 'available' | 'nearest') => {
    setActiveFilter(filter);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  // ── Handle booking flow ──
  const openBooking = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setBookingConfirmed(false);
    setDrawerOpen(true);
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
      <header className="bg-gradient-to-r from-primary to-primary/80 px-4 pt-14 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <PageBackButton />
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
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeFilter === 'all'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
          }`}
        >
          الكل
        </button>
        <button
          onClick={() => handleFilterChange('available')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
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
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
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
          <div
            key={doctor.id}
            className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-start gap-4 mb-4">
              {/* Doctor Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/10 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-7 h-7 text-primary" />
                </div>
                {doctor.isAvailable && (
                  <div className="absolute -bottom-1 -end-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* Doctor Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-extrabold text-gray-800 text-base truncate pe-2">{doctor.name}</h3>
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                    <Star className="w-3 h-3 fill-amber-500" />
                    {doctor.rating}
                    <span className="text-amber-400 font-normal">({doctor.reviewCount})</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-medium">{doctor.specialty}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-primary/60" />
                    <span className="truncate">{doctor.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Briefcase className="w-3 h-3 text-primary/60" />
                    <span>{doctor.experience}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & Action */}
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm font-bold text-primary">
                {doctor.price}
              </div>
              <button
                onClick={() => openBooking(doctor)}
                disabled={!doctor.isAvailable}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  doctor.isAvailable
                    ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <CalendarClock className="w-4 h-4" />
                {doctor.isAvailable ? 'احجز موعد' : 'غير متاح'}
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* ── Reservation Drawer ────────────────────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="!max-h-[85vh] h-[85vh]">
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

            <div className="px-5 py-4 flex-1 overflow-y-auto space-y-6">
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
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
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
                        className="rounded-md"
                        modifiers={{ available: DEMO_AVAILABLE_DATES }}
                        modifiersClassNames={{
                          available: 'ring-2 ring-primary/20 ring-inset font-bold',
                        }}
                      />
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 px-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span>التاريخ المختار</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded ring-2 ring-primary/30 bg-white" />
                        <span>متاح</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded bg-gray-200" />
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
                      <div className="grid grid-cols-3 gap-3">
                        {DEMO_TIME_SLOTS.map(({ time, available }) => (
                          <button
                            key={time}
                            disabled={!available}
                            onClick={() => setSelectedTime(time)}
                            className={`py-3 px-2 rounded-xl text-base font-bold border transition-all ${
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
