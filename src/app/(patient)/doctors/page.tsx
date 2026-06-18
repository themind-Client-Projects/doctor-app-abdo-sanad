'use client';

import { useState, useMemo, Suspense } from 'react';
import { Search, Filter, MapPin, Star, CalendarClock, Stethoscope, Check, Briefcase, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { SearchInput } from '@/components/shared/search-input';
import { CategoryFilters } from '@/components/shared/category-filters';
import { Pagination } from '@/components/shared/pagination';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import { useFilters } from '@/hooks/use-filters';
import { useLocationStore } from '@/stores/patient/location.store';
import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { DEMO_DOCTORS } from '@/lib/constants/demo-data';
import type { Doctor } from '@/types/patient';

const COMPLEXES_ADS = [
  { id: 1, name: 'مجمع النور الطبي', image: '/complexes/real_complex_1.png' },
  { id: 2, name: 'عيادات السلام', image: '/complexes/real_complex_2.png' },
  { id: 3, name: 'مركز ابن سينا', image: '/complexes/real_complex_3.png' },
];

function DoctorsContent() {
  const { searchQuery, category: activeSpecialty, page } = useFilters();
  const { selectedCity } = useLocationStore();
  const ITEMS_PER_PAGE = 5;

  // ── Reservation Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Flatten all doctors
  const allDoctors = useMemo(() => {
    return Object.values(DEMO_DOCTORS).flat();
  }, []);

  // Filter doctors based on search, specialty, and selected city
  const filteredDoctors = useMemo(() => {
    return allDoctors.filter(doctor => {
      const matchesSpecialty = activeSpecialty === 'all' || doctor.specialtyId === activeSpecialty;
      const matchesCity = !selectedCity || doctor.location.includes(selectedCity);
      const matchesSearch = doctor.name.includes(searchQuery) ||
        doctor.specialty.includes(searchQuery) ||
        doctor.location.includes(searchQuery);
      return matchesSpecialty && matchesSearch && matchesCity;
    });
  }, [allDoctors, activeSpecialty, searchQuery, selectedCity]);

  // Paginate doctors
  const paginatedDoctors = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredDoctors.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDoctors, page]);

  // ── Handle booking flow ──
  const openBooking = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* Page Title */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold text-gray-900">أطباء {selectedCity || 'العراق'}</h1>
          <button
            className="flex items-center gap-1.5 font-bold text-xs text-primary hover:text-primary/80 bg-primary/5 px-2.5 py-1.5 rounded-full transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            {selectedCity ? selectedCity : 'تغيير المدينة'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto flex gap-2">
          <SearchInput className="flex-1" placeholder="ابحث عن طبيب، تخصص، منطقة..." />
          <button className="w-12 h-[52px] bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 flex-shrink-0 active:scale-95 transition-transform hover:border-primary/50 hover:text-primary">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className="mt-6 space-y-8">

        {/* Clinics Ads */}
        <section>
          <div className="px-4 flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-800">إعلانات المجمعات</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x px-4 pb-2">
            {COMPLEXES_ADS.map((complex) => (
              <Link key={complex.id} href={`/complexes/${complex.id}`} className="min-w-[240px] h-36 relative rounded-[2rem] shadow-sm snap-center overflow-hidden flex flex-col items-center justify-end p-5 group active:scale-95 transition-transform">
                <Image src={complex.image} alt={complex.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
                <h3 className="relative z-10 font-bold text-lg text-white drop-shadow-lg tracking-wide">{complex.name}</h3>
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
            categories={SPECIALIZATIONS}
            allLabel="جميع التخصصات"
          />
        </section>

        {/* Doctors List */}
        <section className="px-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-gray-800">الأطباء المتاحين</h2>
            <span className="text-xs text-gray-500 font-medium">{filteredDoctors.length} طبيب</span>
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">لا يوجد أطباء</h3>
              <p className="text-sm text-gray-500">جرب تغيير كلمات البحث أو الفلتر</p>
            </div>
          ) : (
            paginatedDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="bg-white rounded-[2rem] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col group"
              >
                <Link href={`/doctors/profile/${doctor.id}`} className="block flex-1 cursor-pointer">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/10">
                        <Stethoscope className="w-7 h-7 text-primary" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-extrabold text-gray-800 text-base truncate pe-2 group-hover:text-primary transition-colors">{doctor.name}</h3>
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                          <Star className="w-3 h-3 fill-amber-500" />
                          {doctor.rating}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">{doctor.specialty}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-primary/60" />
                      <span className="truncate">{doctor.location} - {doctor.clinic}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Briefcase className="w-3.5 h-3.5 text-primary/60" />
                      <span>خبرة {doctor.experience}</span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-0.5">سعر الكشفية</span>
                    <span className="text-sm font-extrabold text-primary block leading-none">{doctor.price}</span>
                  </div>
                  <button
                    onClick={() => openBooking(doctor)}
                    disabled={!doctor.isAvailable}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${doctor.isAvailable
                      ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    {doctor.isAvailable ? 'احجز موعد' : 'غير متاح'}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          <Pagination totalItems={filteredDoctors.length} itemsPerPage={ITEMS_PER_PAGE} />
        </section>
      </main>

      {/* ── Booking Drawer ── */}
      <DoctorBookingDrawer
        doctor={selectedDoctor}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

export default function DoctorsDiscoveryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <DoctorsContent />
    </Suspense>
  );
}
