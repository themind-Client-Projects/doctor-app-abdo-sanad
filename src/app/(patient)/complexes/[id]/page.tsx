'use client';

import { use, useMemo, useState } from 'react';
import Image from 'next/image';

import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import type { Doctor } from '@/types/patient';
import { SearchInput } from '@/components/shared/search-input';
import { Search, Filter, Star, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { DEMO_DOCTORS, DEMO_PHARMACIES } from '@/lib/constants/demo-data';

const COMPLEXES_DATA: Record<string, any> = {
  '1': { name: 'مجمع النور الطبي', image: '/complexes/real_complex_1.png', location: 'بغداد - المنصور' },
  '2': { name: 'عيادات السلام', image: '/complexes/real_complex_2.png', location: 'بغداد - الكرادة' },
  '3': { name: 'مركز ابن سينا', image: '/complexes/real_complex_3.png', location: 'أربيل - عنكاوا' },
};

const DEMO_LABS = [
  { id: 1, name: 'مختبرات النور للتحاليل', rating: 4.9, image: '/complexes/real_complex_3.png' },
  { id: 2, name: 'مختبر الأمل', rating: 4.7, image: '/complexes/real_complex_1.png' },
  { id: 3, name: 'مختبر الحياة', rating: 4.8, image: '/complexes/real_complex_2.png' },
];

export default function ComplexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const complex = COMPLEXES_DATA[id] || COMPLEXES_DATA['1'];
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Flatten all doctors for the carousel
  const allDoctors = useMemo(() => {
    return Object.values(DEMO_DOCTORS).flat();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Cover Image & Header */}
      <div className="relative w-full h-64 sm:h-72">
        <Image src={complex.image} alt={complex.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-gray-50" />
        <div className="absolute top-12 left-0 right-0 px-5 flex justify-between items-center z-10">
        </div>
      </div>

      <main className="px-5 -mt-8 relative z-10 space-y-8">
        {/* Complex Info */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{complex.name}</h1>
          <p className="text-sm text-gray-500 font-medium flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {complex.location}
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <SearchInput className="flex-1" placeholder={`ابحث داخل ${complex.name}...`} />
          <button className="w-[56px] h-[52px] bg-white rounded-[1.5rem] shadow-sm flex items-center justify-center text-primary flex-shrink-0 active:scale-95 transition-transform">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Specialties Carousel */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900">التخصصات المتاحة</h2>
            <Link href="#" className="text-sm font-bold text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x pb-2 -mx-5 px-5">
            {SPECIALIZATIONS.map((spec) => (
              <Link 
                key={spec.id} 
                href={`/doctors/${spec.id}`}
                className="min-w-[100px] bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 active:scale-95 transition-transform snap-center group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${spec.color} group-hover:scale-110 transition-transform relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current" />
                  {spec.icon && <spec.icon className="w-6 h-6 relative z-10" strokeWidth={1.5} />}
                </div>
                <span className="font-bold text-[11px] text-gray-800 text-center leading-tight">{spec.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Doctors Carousel */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900">أطباء المجمع</h2>
            <Link href="#" className="text-sm font-bold text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-2 -mx-5 px-5">
            {allDoctors.slice(0, 6).map((doctor) => (
              <div key={doctor.id} className="min-w-[240px] bg-white rounded-3xl p-4 shadow-sm border border-gray-100 snap-center">
                <div className="flex gap-3 items-center mb-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 line-clamp-1">{doctor.name}</h3>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{doctor.specialty}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-bold text-gray-700">{doctor.rating}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedDoctor(doctor as Doctor);
                    setDrawerOpen(true);
                  }}
                  className="w-full py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold active:scale-95 transition-transform hover:bg-primary/20">
                  حجز موعد
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Pharmacies Carousel */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900">صيدليات المجمع</h2>
            <Link href="#" className="text-sm font-bold text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-2 -mx-5 px-5">
            {DEMO_PHARMACIES.map((pharmacy) => (
              <Link href={`/pharmacies/${pharmacy.id}`} key={pharmacy.id} className="min-w-[200px] h-32 relative rounded-3xl overflow-hidden snap-center group">
                <Image src={pharmacy.image} alt={pharmacy.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <h3 className="font-bold text-sm text-white mb-1 drop-shadow-md">{pharmacy.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm backdrop-blur-sm ${pharmacy.status === 'مفتوح الآن' ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                      {pharmacy.status}
                    </span>
                    <span className="text-[10px] text-gray-200 drop-shadow">{pharmacy.time}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Labs Carousel */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-900">المختبرات والتحاليل</h2>
            <Link href="#" className="text-sm font-bold text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-4 -mx-5 px-5">
            {DEMO_LABS.map((lab) => (
              <div key={lab.id} className="min-w-[220px] bg-white rounded-3xl p-3 shadow-sm border border-gray-100 snap-center flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
                  <Image src={lab.image} alt={lab.name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xs text-gray-900 mb-1 line-clamp-1">{lab.name}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-bold text-gray-600">{lab.rating}</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">تفاصيل</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Doctor Booking Drawer ── */}
      <DoctorBookingDrawer 
        doctor={selectedDoctor}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
