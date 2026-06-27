'use client';

import { useState, useMemo, Suspense } from 'react';
import { Search, Filter, MapPin, Star, CalendarClock, Stethoscope, Check, Briefcase, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FlexibleHeader } from '@/components/shared/flexible-header';

import { SearchInput } from '@/components/shared/search-input';
import { CategoryFilters } from '@/components/shared/category-filters';
import { Pagination } from '@/components/shared/pagination';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import { DoctorCard } from '@/components/shared/doctor-card';
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
              <DoctorCard 
                key={doctor.id} 
                doctor={doctor} 
                onBook={openBooking} 
              />
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
