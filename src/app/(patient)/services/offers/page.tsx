'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Percent,
  Sparkles,
  Eye,
  Activity,
  Stethoscope,
  Clock,
  Star,
  MapPin,
  Flame
} from 'lucide-react';
import { useLocationStore } from '@/stores/patient/location.store';
import { CitySelectorDrawer } from '@/components/features/patient/city-selector-drawer';
import Image from 'next/image';

export default function OffersPage() {
  const router = useRouter();
  const { selectedCity, openCitySelector } = useLocationStore();

  const mostViewed = [
    {
      id: 1,
      title: 'باقة تنظيف وتلميع الأسنان الاحترافية',
      clinic: 'مجمع النور التخصصي',
      location: 'المنصور',
      oldPrice: '٦٠,٠٠٠ د.ع',
      newPrice: '٣٠,٠٠٠ د.ع',
      discount: '50%',
      rating: '٤.٩',
      image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 2,
      title: 'جلسة ديرما بن مع بلازما للبشرة',
      clinic: 'عيادات الجمال',
      location: 'الكرادة',
      oldPrice: '١٥٠,٠٠٠ د.ع',
      newPrice: '٩٠,٠٠٠ د.ع',
      discount: '40%',
      rating: '٤.٨',
      image: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 3,
      title: 'عملية ليزك لتصحيح النظر',
      clinic: 'مركز العيون التخصصي',
      location: 'الجادرية',
      oldPrice: '٨٠٠,٠٠٠ د.ع',
      newPrice: '٦٠٠,٠٠٠ د.ع',
      discount: '25%',
      rating: '٤.٩',
      image: 'https://images.unsplash.com/photo-1580281658223-9b93f18a8398?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24 font-sans relative">
      {/* Hero Header */}
      <header className="bg-gradient-to-b from-primary to-primary/90 text-primary-foreground px-5 pt-4 pb-8 rounded-b-[2.5rem] shadow-sm relative z-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

        <div className="flex flex-col items-center mb-6 relative z-10">
          <h1 className="text-xl font-extrabold text-white mb-3">العروض الطبية</h1>
          <button
            onClick={openCitySelector}
            className="flex items-center gap-1.5 font-bold text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors backdrop-blur-sm border border-white/10"
          >
            <MapPin className="w-3.5 h-3.5" />
            {selectedCity ? selectedCity : 'كل المدن'}
            <ChevronDown className="w-4 h-4 ms-0.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative z-10 max-w-md mx-auto">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-white text-gray-900 rounded-2xl py-4 ps-12 pe-4 outline-none focus:ring-4 focus:ring-white/20 shadow-sm text-sm font-medium transition-all"
            placeholder="ابحث عن العروض، العيادات..."
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mt-6 space-y-8">

        {/* Banner Section */}
        <section className="px-5">
          <div className="w-full h-48 bg-white rounded-[2rem] border border-gray-100 relative overflow-hidden shadow-sm flex items-center p-6">
            {/* Banner Background Image - Beautiful crisp image on the left */}
            <div className="absolute left-0 top-0 w-2/3 h-full">
              <Image
                src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80"
                alt="Medical Offer"
                fill
                className="object-cover object-left"
              />
            </div>

            {/* Gradient Overlay for Text Readability - Fading nicely to white on the right */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/90 to-white"></div>

            <div className="relative z-10 flex-1 text-right">
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-black px-2.5 py-1 rounded-lg mb-2 border border-primary/20">
                <Flame className="w-3.5 h-3.5" />
                عروض حصرية
              </div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight mb-1">
                خصومات تصل إلى <br />
                <span className="text-4xl text-primary font-black">70%</span>
              </h2>
              <p className="text-gray-600 text-[11px] font-medium max-w-[180px] ms-auto">
                على أفضل العيادات والمراكز الطبية في العراق
              </p>
            </div>

            <div className="relative z-10 shrink-0 ms-2">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                <Percent className="w-8 h-8 text-primary" strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </section>



        {/* Most Viewed Offers */}
        <section>
          <div className="flex items-center justify-between px-5 mb-4">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
              الأكثر طلباً ومبيعاً
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </h2>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar gap-4 px-5 pb-6 snap-x">
            {mostViewed.map((item) => (
              <div key={item.id} className="snap-start shrink-0 w-[280px] bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 group">
                {/* Image */}
                <div className="w-full h-40 relative overflow-hidden bg-gray-100">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

                  <div className="absolute top-3 right-3 bg-red-500 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-md border border-red-400/50">
                    خصم {item.discount}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-gray-900 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {item.rating}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 mb-2.5">
                    <MapPin className="w-3 h-3 text-primary/60" />
                    {item.location} • {item.clinic}
                  </div>

                  <h3 className="font-extrabold text-[14px] text-gray-900 mb-4 line-clamp-2 leading-snug group-hover:text-primary transition-colors text-start">
                    {item.title}
                  </h3>

                  <div className="flex items-end justify-between pt-1 border-t border-gray-50">
                    <div className="text-start">
                      <span className="text-gray-400 font-medium text-[11px] line-through block mb-0.5">{item.oldPrice}</span>
                      <span className="text-primary font-black text-lg leading-none">{item.newPrice}</span>
                    </div>
                    <button className="bg-primary/10 hover:bg-primary text-primary hover:text-white transition-colors w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <CitySelectorDrawer />
    </div>
  );
}

// Ensure ChevronLeft is imported, let's fix the import if I missed it
// Actually I need to add ChevronLeft to the imports at the top!
