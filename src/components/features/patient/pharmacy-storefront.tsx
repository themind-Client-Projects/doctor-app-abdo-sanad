'use client';

import { Suspense, useMemo, useState } from 'react';
import { MapPin, Clock, Star, ShoppingBag, Phone, Pill } from 'lucide-react';

import { ProductCard } from '@/components/shared/ecommerce/product-card';
import { CartDrawer } from '@/components/shared/ecommerce/cart-drawer';
import { useCartStore } from '@/stores/ecommerce/cart.store';
import { SearchInput } from '@/components/shared/search-input';
import { CategoryFilters } from '@/components/shared/category-filters';
import { useFilters } from '@/hooks/use-filters';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { LoadError, loadFailed } from '@/components/shared/load-error';
import type { Product } from '@/types/patient';
import type { Channel } from '@/hooks/use-storefront';

// ─────────────────────────────────────────────────────────────────────────
// صفحة الصيدلية — real pharmacy, real catalogue.
//
// This page took its route param, ran `Number(id)` on it, and looked the
// result up in `DEMO_PHARMACIES`. A `Partner.id` is a cuid, so `Number()`
// returned NaN, the lookup missed, and `|| DEMO_PHARMACIES[0]` meant EVERY
// pharmacy on the platform rendered as «صيدلية النور المركزية» — the same
// three invented products, the same invented opening hours, the same invented
// 4.8 rating, for all four real pharmacies.
//
// The products came from `DEMO_PRODUCTS`, which is also where their prices
// came from. `Product` has 38 real rows seeded against real pharmacies and
// nothing had ever read them, because no endpoint exposed them.
//
// What this page still cannot do is place an order — see the note in
// `cart-drawer.tsx`. It prices a basket and hands the patient the phone.
//
// One component, two routes — `/pharmacies/[id]` and
// `/sanad/pharmacies/[id]` — exactly as `DoctorProfile` is paired. The channel
// comes from the ROUTE, so a patient who opens a pharmacy from سند stays
// inside سند and is shown the سند pool.
// ─────────────────────────────────────────────────────────────────────────

type Pharmacy = {
  id: string;
  name: string;
  type: string;
  phone: string;
  location: string;
  address: string;
  rating: number;
};

function PharmacyContent({ pharmacyId, channel }: { pharmacyId: string; channel: Channel }) {
  const { searchQuery, category: activeCategory } = useFilters();
  const [cartOpen, setCartOpen] = useState(false);
  const { getTotalItems } = useCartStore();

  const pharmacyReq = useDashboardData<Pharmacy>({
    url: `/api/public/partners/${pharmacyId}`,
    // `type`, so a lab's or a driver's id cannot render as a pharmacy with a
    // «صيدلية» badge over an empty product grid.
    params: { channel, type: 'PHARMACY' },
  });
  const productsReq = useDashboardData<Product[]>({
    url: '/api/public/products',
    params: { pharmacyId, channel, limit: '100' },
  });

  const pharmacy = pharmacyReq.data ?? null;
  const products = useMemo(() => productsReq.data ?? [], [productsReq.data]);

  // The category row is built from what this pharmacy actually stocks, so it
  // can no longer offer a filter that returns nothing. The old list was five
  // hardcoded category names shared by every pharmacy.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) {
      if (p.category && !seen.has(p.category)) seen.set(p.category, p.category);
    }
    return [...seen.values()].map((c) => ({ id: c, name: c }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  if (loadFailed(pharmacyReq.error, pharmacy ? 1 : 0)) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center px-4">
        <LoadError message="تعذّر تحميل بيانات الصيدلية" onRetry={() => void pharmacyReq.refetch()} />
      </div>
    );
  }

  if (!pharmacy && pharmacyReq.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="h-56 bg-gray-200 animate-pulse rounded-b-[2.5rem]" />
        <div className="px-4 mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-3xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Resolved, and there is no such pharmacy — or it is not ACTIVE, which the
  // endpoint treats identically on purpose: an unlisted pharmacy must not have
  // a reachable page.
  if (!pharmacy) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center px-4 text-center gap-3">
        <Pill className="w-10 h-10 text-gray-300" aria-hidden />
        <h1 className="text-lg font-bold text-gray-800">لم يتم العثور على الصيدلية</h1>
        <p className="text-sm text-gray-500">قد تكون غير متاحة حالياً أو تم إيقافها.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* ── Header ── */}
      {/* A gradient, not a photo: `Partner` carries no image, and the old page
          filled the gap with `/complexes/real_complex_1.png` — a picture of a
          different building entirely. */}
      <header className="relative w-full h-56 sm:h-64 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-b-[2.5rem] shadow-lg overflow-hidden flex-shrink-0">
        <div className="absolute -end-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -start-6 bottom-0 w-36 h-36 bg-white/10 rounded-full blur-xl" />

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex justify-between items-end gap-3">
            <div className="min-w-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm backdrop-blur-sm bg-white/20 text-white inline-block mb-2">
                صيدلية
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
                {pharmacy.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-white/90">
                {pharmacy.location || pharmacy.address ? (
                  <span className="flex items-center gap-1 drop-shadow">
                    <MapPin className="w-3 h-3" aria-hidden />
                    {[pharmacy.location, pharmacy.address].filter(Boolean).join(' — ')}
                  </span>
                ) : null}
                {pharmacy.phone ? (
                  <a href={`tel:${pharmacy.phone}`} className="flex items-center gap-1 drop-shadow">
                    <Phone className="w-3 h-3" aria-hidden />
                    {pharmacy.phone}
                  </a>
                ) : null}
              </div>
            </div>
            {/* Only a pharmacy that HAS been rated shows a rating. The old card
                printed a constant 4.8 for every one of them. */}
            {pharmacy.rating > 0 && (
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-white flex-shrink-0">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400 mb-0.5" aria-hidden />
                <span className="text-xs font-bold">{pharmacy.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mt-6">
        {/* ── Search & Filters ── */}
        <section className="px-4 mb-6">
          <SearchInput placeholder="ابحث عن أدوية، فيتامينات، أو مستلزمات..." />
        </section>

        {categories.length > 0 && (
          <section className="mb-6">
            <CategoryFilters categories={categories} allLabel="جميع المنتجات" />
          </section>
        )}

        {/* ── Products Grid ── */}
        <section className="px-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-gray-800">
              {activeCategory === 'all'
                ? 'المنتجات المتاحة'
                : `نتائج: ${categories.find((c) => c.id === activeCategory)?.name ?? activeCategory}`}
            </h2>
            {/* A count only once the catalogue has actually answered. While
                the request was in flight — or after it failed, since
                `isLoading` goes false on error — this printed «0 منتج» as a
                statement about the pharmacy's stock. */}
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
              {productsReq.isLoading || loadFailed(productsReq.error, products.length)
                ? '—'
                : `${filteredProducts.length} منتج`}
            </span>
          </div>

          {loadFailed(productsReq.error, products.length) ? (
            <LoadError message="تعذّر تحميل منتجات الصيدلية" onRetry={() => void productsReq.refetch()} />
          ) : productsReq.isLoading && products.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 rounded-3xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Pill className="w-8 h-8 text-gray-300" aria-hidden />
              </div>
              {/* Two different facts, two different sentences: an empty
                  catalogue is not a search that matched nothing. */}
              {products.length === 0 ? (
                <>
                  <h3 className="font-bold text-gray-800 mb-2">لا منتجات معروضة بعد</h3>
                  <p className="text-sm text-gray-500">
                    لم تضف هذه الصيدلية منتجاتها إلى المنصة. يمكنك الاتصال بها للسؤال عن توفر دواء.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-gray-800 mb-2">لم نتمكن من العثور على المنتج</h3>
                  <p className="text-sm text-gray-500">جرب البحث بكلمات مختلفة أو إزالة بعض الفلاتر.</p>
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ── Floating Cart Button ── */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-lg shadow-emerald-600/30 transition-colors active:scale-95 group"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm border-2 border-emerald-600">
                  {getTotalItems()}
                </span>
              </div>
              <span className="font-extrabold text-sm sm:text-base">عرض سلة المشتريات</span>
            </div>
            <span className="text-emerald-100 text-xs sm:text-sm font-medium group-hover:translate-x-1 transition-transform">
              متابعة
            </span>
          </button>
        </div>
      )}

      {/* ── Cart Drawer ── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        pharmacyName={pharmacy.name}
        pharmacyPhone={pharmacy.phone}
      />
    </div>
  );
}

export function PharmacyStorefront({ id, channel }: { id: string; channel: Channel }) {
  // `useFilters` calls `useSearchParams`, which needs a boundary or the route
  // fails to prerender.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50/50">
          <div className="h-56 bg-gray-200 animate-pulse rounded-b-[2.5rem]" />
        </div>
      }
    >
      {/* The id goes through as the cuid it is. `Number(id)` was the whole bug. */}
      <PharmacyContent pharmacyId={id} channel={channel} />
    </Suspense>
  );
}
