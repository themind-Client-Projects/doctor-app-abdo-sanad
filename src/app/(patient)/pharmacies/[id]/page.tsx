'use client';

import { use, useMemo, useState, Suspense } from 'react';
import Image from 'next/image';
import { Search, MapPin, Clock, Star, ShoppingBag, Info, AlertCircle } from 'lucide-react';
import { PageBackButton } from '@/components/shared/page-back-button';
import { DEMO_PHARMACIES, DEMO_PRODUCTS } from '@/lib/constants/demo-data';
import { ProductCard } from '@/components/shared/ecommerce/product-card';
import { CartDrawer } from '@/components/shared/ecommerce/cart-drawer';
import { useCartStore } from '@/store/cart-store';
import { useFilters } from '@/hooks/use-filters';
import { SearchInput } from '@/components/shared/search-input';
import { CategoryFilters } from '@/components/shared/category-filters';

const PRODUCT_CATEGORIES = [
  { id: 'أدوية', name: 'أدوية' },
  { id: 'فيتامينات', name: 'فيتامينات' },
  { id: 'مكملات غذائية', name: 'مكملات' },
  { id: 'عناية بالبشرة', name: 'عناية بالبشرة' },
  { id: 'عناية شخصية', name: 'عناية شخصية' },
];

function PharmacyContent({ pharmacyId }: { pharmacyId: number }) {
  const pharmacy = DEMO_PHARMACIES.find(p => p.id === pharmacyId) || DEMO_PHARMACIES[0];
  const { searchQuery, category: activeCategory } = useFilters();
  const [cartOpen, setCartOpen] = useState(false);
  const { getTotalItems } = useCartStore();

  const filteredProducts = useMemo(() => {
    return DEMO_PRODUCTS.filter(product => {
      // Filter by pharmacy
      if (product.pharmacyId !== pharmacy.id) return false;
      
      // Filter by category
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      
      // Filter by search
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [pharmacy.id, activeCategory, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* ── Header ── */}
      <header className="relative w-full h-64 sm:h-72 bg-gray-900 rounded-b-[2.5rem] shadow-lg overflow-hidden flex-shrink-0">
        <Image 
          src={pharmacy.image} 
          alt={pharmacy.name} 
          fill 
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        <PageBackButton className="text-white bg-black/20 hover:bg-black/30 backdrop-blur-md" />
        
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm backdrop-blur-sm ${pharmacy.status === 'مفتوح الآن' ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                  {pharmacy.status}
                </span>
                <span className="text-[10px] font-bold text-gray-200 drop-shadow flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pharmacy.time}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
                {pharmacy.name}
              </h1>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-white">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400 mb-0.5" />
              <span className="text-xs font-bold">4.8</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mt-6">
        {/* ── Search & Filters ── */}
        <section className="px-4 mb-6">
          <SearchInput placeholder="ابحث عن أدوية، فيتامينات، أو مستلزمات..." />
        </section>

        <section className="mb-6">
          <CategoryFilters 
            categories={PRODUCT_CATEGORIES}
            allLabel="جميع المنتجات"
          />
        </section>

        {/* ── Products Grid ── */}
        <section className="px-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-gray-800">
              {activeCategory === 'all' ? 'المنتجات المتاحة' : `نتائج: ${PRODUCT_CATEGORIES.find(c => c.id === activeCategory)?.name}`}
            </h2>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
              {filteredProducts.length} منتج
            </span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">لم نتمكن من العثور على المنتج</h3>
              <p className="text-sm text-gray-500">جرب البحث بكلمات مختلفة أو إزالة بعض الفلاتر.</p>
            </div>
          )}
        </section>
      </main>

      {/* ── Floating Cart Button ── */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm">
          <button 
            onClick={() => setCartOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-lg shadow-emerald-600/30 transition-all active:scale-95 group"
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
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  );
}

export default function PharmacyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <PharmacyContent pharmacyId={Number(id)} />
    </Suspense>
  );
}
