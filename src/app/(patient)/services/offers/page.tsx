'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Percent,
  Star,
  MapPin,
  Clock,
  ArrowRight,
  Filter
} from 'lucide-react';
import { useLocationStore } from '@/stores/patient/location.store';
import { CitySelectorDrawer } from '@/components/features/patient/city-selector-drawer';
import Image from 'next/image';
import { useMemo, useDeferredValue } from 'react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { formatNumber } from '@/lib/format';

/**
 * العروض الطبية — live campaigns.
 *
 * The four offers here were hardcoded, priced against clinics that matched no
 * partner and could not be booked. They now come from `Campaign`, with the
 * before-and-after price derived server-side from the live `PriceConfig` so a
 * card can never advertise a saving the checkout contradicts.
 */

type Offer = {
  id: string;
  title: string;
  image: string | null;
  clinic: string | null;
  location: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  discountPercent: number | null;
  expiresInDays: number;
};

/** The server sends a day count; turning it into Arabic is the client's job. */
function expiresLabel(days: number): string {
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومين';
  if (days <= 10) return `${formatNumber(days)} أيام`;
  return `${formatNumber(days)} يوماً`;
}

/** Placeholder artwork for a campaign with no image, cycled so a grid of them
 *  does not look like one repeated card. */
const FALLBACK_IMAGES = [
  '/complexes/real_complex_1.png',
  '/complexes/real_complex_2.png',
  '/complexes/real_complex_3.png',
];

export default function OffersPage() {
  const router = useRouter();
  const { selectedCity, openCitySelector } = useLocationStore();
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  // Keeps typing responsive; the filter pass runs against the settled value.
  const deferredQuery = useDeferredValue(query);

  const { data, isLoading, error, refetch } = useDashboardData<{
    offers: Offer[];
    categories: string[];
  }>({
    url: '/api/public/offers',
    // The city picker already scopes the page, so the server does the filtering
    // rather than shipping every governorate's offers to be discarded here.
    params: { channel: 'DIRECT', governorate: selectedCity || undefined },
  });

  const offers = useMemo(() => data?.offers ?? [], [data]);
  // Derived from what is actually on offer — a chip that filters to nothing is
  // worse than one that is absent.
  const categories = useMemo(() => ['الكل', ...(data?.categories ?? [])], [data]);

  const filteredOffers = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesCategory = activeCategory === 'الكل' || offer.category === activeCategory;
      const matchesQuery =
        !q ||
        offer.title.toLowerCase().includes(q) ||
        (offer.clinic ?? '').toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [offers, activeCategory, deferredQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 font-sans" dir="rtl">
      
      {/* Top Header */}
      <header className="bg-white px-5 pt-6 pb-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-extrabold text-gray-900">العروض الطبية</h1>
          </div>
          
          <button
            onClick={openCitySelector}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="truncate max-w-[80px]">{selectedCity || 'كل المدن'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="ابحث عن العروض"
              className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm font-medium"
              placeholder="ابحث عن العروض، العيادات..."
            />
          </div>
          <button className="w-12 h-[50px] rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors active:scale-95 shrink-0">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="mt-4">
        
        {/* Categories Horizontal Scroll */}
        <div className="px-5 mb-6 overflow-x-auto hide-scrollbar flex items-center gap-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
                activeCategory === cat 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured Promo Banner */}
        <section className="px-5 mb-8">
          <div className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-500 to-primary shadow-lg shadow-primary/20">
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 end-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 start-0 w-24 h-24 bg-black/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 p-6 flex items-center justify-between">
              <div className="text-white max-w-[65%]">
                <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold mb-3 border border-white/10">
                  <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                  عروض حصرية لفترة محدودة
                </div>
                <h2 className="text-2xl font-black mb-1 leading-tight">وفر حتى 70%</h2>
                <p className="text-sm text-emerald-50 opacity-90 leading-relaxed font-medium">على باقات الفحص الشامل وعيادات التجميل المختارة.</p>
              </div>
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shrink-0 shadow-xl relative">
                <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20"></div>
                <Percent className="w-10 h-10 text-primary" strokeWidth={3} />
              </div>
            </div>
          </div>
        </section>

        {/* Offers Grid */}
        <section className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-gray-900">أحدث العروض</h2>
            <span className="text-sm font-bold text-primary">{filteredOffers.length} عروض</span>
          </div>

          {error ? (
            <div className="text-center py-12">
              <h3 className="text-gray-900 font-bold mb-1">تعذّر تحميل العروض</h3>
              <button onClick={() => void refetch()} className="text-sm text-primary font-bold mt-2">إعادة المحاولة</button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-3 border border-gray-100 h-[340px] animate-pulse" />
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOffers.map((offer, i) => (
              <div key={offer.id} className="bg-white rounded-3xl p-3 border border-gray-100 shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] flex flex-col group cursor-pointer hover:border-primary/30 transition-colors">
                
                {/* Card Image Area */}
                <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-3 bg-gray-100">
                  <Image
                    src={offer.image ?? FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                    alt={offer.title}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  
                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <div className="bg-rose-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-md border border-rose-400">
                      خصم {formatNumber(offer.discountPercent ?? 0)}%
                    </div>
                  </div>
                  
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {offer.rating?.toFixed(1) ?? '—'} <span className="text-gray-400 text-[10px] font-medium">({formatNumber(offer.reviews ?? 0)})</span>
                  </div>

                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    ينتهي خلال {expiresLabel(offer.expiresInDays)}
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="px-2 pb-1 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-primary/70" />
                    {offer.clinic ?? 'كل المزوّدين'}
                    {offer.location ? (<><span className="text-gray-300 mx-0.5">•</span> {offer.location}</>) : null}
                  </div>

                  <h3 className="font-bold text-[15px] text-gray-900 mb-4 line-clamp-2 leading-snug group-hover:text-primary transition-colors flex-1">
                    {offer.title}
                  </h3>

                  {/* Pricing and Action */}
                  <div className="flex items-end justify-between pt-3 border-t border-gray-50">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-400 font-medium text-[13px] line-through decoration-rose-400/50">{formatNumber(offer.oldPrice ?? 0)}</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-primary">
                        <span className="font-black text-xl leading-none">{formatNumber(offer.newPrice ?? 0)}</span>
                        <span className="font-bold text-xs">د.ع</span>
                      </div>
                    </div>
                    <button className="bg-emerald-50 text-primary group-hover:bg-primary group-hover:text-white transition-colors w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 shrink-0">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
          )}

          {!isLoading && !error && filteredOffers.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-bold mb-1">لا توجد عروض حالياً</h3>
              <p className="text-gray-500 text-sm">جرب اختيار قسم آخر من القائمة أعلاه</p>
            </div>
          )}

        </section>

      </main>

      <CitySelectorDrawer />
    </div>
  );
}
