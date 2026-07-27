'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Clock, MapPin, Star, Stethoscope, Microscope, Pill, Syringe, Activity, ChevronLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { buildSearchPool, DEFAULT_RECENT_SEARCHES } from '@/lib/constants/demo-data';
import type { SearchResult, SearchCategory } from '@/types/patient';

// ─── Category Config ────────────────────────────────────────────────────

interface CategoryTab {
  id: SearchCategory;
  label: string;
  icon: React.ReactNode;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'الكل', icon: <Search className="w-4 h-4" /> },
  { id: 'doctors', label: 'أطباء', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'labs', label: 'مختبرات', icon: <Microscope className="w-4 h-4" /> },
  { id: 'pharmacies', label: 'صيدليات', icon: <Pill className="w-4 h-4" /> },
];

const BROWSE_CATEGORIES = [
  { name: 'أطباء', icon: <Stethoscope className="w-7 h-7" />, color: 'bg-blue-50 text-blue-600', href: '/doctors' },
  { name: 'مختبرات', icon: <Microscope className="w-7 h-7" />, color: 'bg-purple-50 text-purple-600', href: '/labs' },
  { name: 'صيدليات', icon: <Pill className="w-7 h-7" />, color: 'bg-emerald-50 text-emerald-600', href: '/pharmacies' },
  { name: 'تمريض', icon: <Syringe className="w-7 h-7" />, color: 'bg-rose-50 text-rose-600', href: '/nursing' },
  { name: 'علاج طبيعي', icon: <Activity className="w-7 h-7" />, color: 'bg-amber-50 text-amber-600', href: '/physiotherapy' },
];

function getCategoryIcon(category: SearchCategory) {
  switch (category) {
    case 'doctors': return <Stethoscope className="w-5 h-5" />;
    case 'labs': return <Microscope className="w-5 h-5" />;
    case 'pharmacies': return <Pill className="w-5 h-5" />;
    default: return <Search className="w-5 h-5" />;
  }
}

function getCategoryColor(category: SearchCategory) {
  switch (category) {
    case 'doctors': return 'bg-blue-50 text-blue-600';
    case 'labs': return 'bg-purple-50 text-purple-600';
    case 'pharmacies': return 'bg-emerald-50 text-emerald-600';
    default: return 'bg-gray-50 text-gray-600';
  }
}

function getCategoryLabel(category: SearchCategory) {
  switch (category) {
    case 'doctors': return 'طبيب';
    case 'labs': return 'مختبر';
    case 'pharmacies': return 'صيدلية';
    default: return '';
  }
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const searchPool = useMemo(() => buildSearchPool(), []);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(DEFAULT_RECENT_SEARCHES);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Debounced search ──
  const performSearch = useCallback((searchQuery: string, category: SearchCategory) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    // Simulate network delay for realistic feel
    const timer = setTimeout(() => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const filtered = searchPool.filter((item) => {
        const matchesQuery =
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.subtitle.toLowerCase().includes(normalizedQuery) ||
          item.location.toLowerCase().includes(normalizedQuery);
        const matchesCategory = category === 'all' || item.category === category;
        return matchesQuery && matchesCategory;
      });
      setResults(filtered);
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchPool]);

  useEffect(() => {
    const cleanup = performSearch(query, activeCategory);
    return cleanup;
  }, [query, activeCategory, performSearch]);

  // ── Recent search handlers ──
  const addToRecent = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== searchTerm);
      return [searchTerm, ...filtered].slice(0, 8);
    });
  };

  const removeFromRecent = (term: string) => {
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    addToRecent(term);
  };

  const handleSearchSubmit = () => {
    if (query.trim()) {
      addToRecent(query.trim());
    }
  };

  const showBrowseMode = !query.trim() && !hasSearched;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* Page Title */}
      <div className="px-5 pt-2 pb-4">
        <h1 className="text-xl font-extrabold text-gray-900 mb-4">البحث</h1>
        
        {/* Search Bar */}
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-10 outline-none border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-sm font-medium placeholder:text-gray-400 transition-colors"
              placeholder="ابحث عن طبيب، تخصص، مختبر..."
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setHasSearched(false); }}
                className="absolute inset-y-0 end-0 flex items-center pe-3"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="px-4 mt-6 space-y-6">

        {/* Category Filter Tabs (shown when there's a query) */}
        {query.trim() && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0 ${
                  activeCategory === tab.id
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <LoadingSkeleton variant="search-result" count={4} />
        )}

        {/* Search Results */}
        {!isLoading && hasSearched && results.length > 0 && (
          <section>
            <p className="text-xs text-gray-500 font-medium mb-3 px-1">
              {results.length} نتيجة
            </p>
            <div className="space-y-3">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={result.href}
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-primary/30 hover:shadow-md transition-colors flex items-center gap-3 group"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getCategoryColor(result.category)} group-hover:scale-105 transition-transform`}>
                    {getCategoryIcon(result.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{result.name}</h4>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{result.subtitle}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="font-bold text-gray-700">{result.rating}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{result.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCategoryColor(result.category)}`}>
                      {getCategoryLabel(result.category)}
                    </span>
                    <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty Results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <EmptyState
            icon={SearchX}
            title="لا توجد نتائج"
            description={`لم نجد نتائج تطابق "${query}". جرّب كلمات بحث مختلفة.`}
          />
        )}

        {/* Browse Mode (when no query) */}
        {showBrowseMode && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    عمليات البحث الأخيرة
                  </h3>
                  <button
                    onClick={clearAllRecent}
                    className="text-xs text-primary font-bold hover:text-primary/70 transition-colors"
                  >
                    مسح الكل
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs text-gray-600 shadow-sm flex items-center gap-2 hover:border-primary/30 transition-colors group cursor-pointer"
                    >
                      <button
                        onClick={() => handleRecentClick(term)}
                        className="flex items-center gap-1.5"
                      >
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="font-medium">{term}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromRecent(term); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Browse Categories */}
            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-3">تصفح الأقسام</h3>
              <div className="grid grid-cols-3 gap-3">
                {BROWSE_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center gap-3 cursor-pointer hover:border-primary/30 hover:shadow-md transition-colors active:scale-95 group"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cat.color} group-hover:scale-105 transition-transform`}>
                      {cat.icon}
                    </div>
                    <span className="font-bold text-gray-800 text-xs">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Trending / Quick Access */}
            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-3">الأكثر بحثاً</h3>
              <div className="space-y-2">
                {['طبيب أطفال بغداد', 'تحليل دم شامل', 'صيدلية قريبة', 'طبيب عيون'].map((term, i) => (
                  <button
                    key={term}
                    onClick={() => handleRecentClick(term)}
                    className="w-full bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:border-primary/30 transition-colors text-right"
                  >
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-700 flex-1">{term}</span>
                    <ChevronLeft className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* CSS for hiding scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
