'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Clock, MapPin, Star, Stethoscope, Microscope, Pill, Syringe, Activity, ChevronLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadError, loadFailed } from '@/components/shared/load-error';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useStorefront } from '@/hooks/use-storefront';
import { doctorProfilePath, storefrontCategories, type StorefrontChannel } from '@/lib/channel-routes';
import type { SearchResult, SearchCategory } from '@/types/patient';

// ─────────────────────────────────────────────────────────────────────────
// البحث — now against the database.
//
// The pool was `buildSearchPool()` from `src/lib/constants/demo-data.ts`:
// fourteen invented doctors plus three invented labs and three invented
// pharmacies, with invented ratings and invented addresses. Every search any
// patient ran returned those and only those — a real doctor on the platform
// could not be found by name, and a result that was tapped went to
// `/doctors/{specialtySlug}`, a specialty listing, never to the doctor.
//
// Three real reads replace it, one per category, each skipped when its tab is
// not showing. The 400ms `setTimeout` that used to "simulate network delay"
// is gone; there is a network now.
//
// «عمليات البحث الأخيرة» was five hardcoded phrases presented as the reader's
// own history, identical on every device and on a first-ever visit. It is now
// this browser's actual history, and starts empty.
// ─────────────────────────────────────────────────────────────────────────

/**
 * `/search` serves BOTH storefronts. It used to hardcode DIRECT, so a search
 * started from the سند home — where the home search box now passes
 * `?channel=SANAD` — returned the public pool, linked to public profiles and
 * quoted public prices, with nothing on screen saying the patient had left
 * سند.
 */
function readChannel(value: string | null): StorefrontChannel {
  return value === 'SANAD' || value === 'COMPLEX' ? value : 'DIRECT';
}

const RECENT_KEY = 'warid:recent-searches';
const RECENT_LIMIT = 8;

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

/** Built per render, because the channel decides where each one goes. */
function browseCategories(routes: ReturnType<typeof storefrontCategories>) {
  return [
    { name: 'أطباء', icon: <Stethoscope className="w-7 h-7" />, color: 'bg-blue-50 text-blue-600', href: routes.doctors },
    { name: 'مختبرات', icon: <Microscope className="w-7 h-7" />, color: 'bg-purple-50 text-purple-600', href: routes.labs },
    { name: 'صيدليات', icon: <Pill className="w-7 h-7" />, color: 'bg-emerald-50 text-emerald-600', href: routes.pharmacies },
    { name: 'تمريض', icon: <Syringe className="w-7 h-7" />, color: 'bg-rose-50 text-rose-600', href: routes.nursing },
    { name: 'علاج طبيعي', icon: <Activity className="w-7 h-7" />, color: 'bg-amber-50 text-amber-600', href: routes.physiotherapy },
  ]
};

// The four hardcoded phrases are gone. «تحليل دم شامل» matched nothing —
// search covers doctors, labs and pharmacies by name, specialty, governorate
// and address, never lab TESTS — and «طبيب أطفال» / «طبيب عيون» only matched
// because a specialty happens to be worded that way. Suggestions now come from
// the specialties the search actually queries, so tapping one cannot return
// «لا توجد نتائج».

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

type DoctorRow = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  location: string;
  clinic: string;
};

type PartnerRow = {
  id: string;
  name: string;
  rating: number;
  location: string;
  address: string;
};

function SearchScreen() {
  // Arriving from a home-screen search box, which passes `?q=` and, inside
  // سند, `?channel=SANAD`.
  const params = useSearchParams();
  const seedQuery = params.get('q') ?? '';
  const CHANNEL = readChannel(params.get('channel'));
  // Specialty names, which `q` matches against — see the widened filter in
  // /api/public/doctors.
  const { storefront } = useStorefront(CHANNEL);
  const suggestions = useMemo(
    () => storefront.specialties.slice(0, 6).map((sp) => sp.name),
    [storefront.specialties]
  );
  const ROUTES = useMemo(() => storefrontCategories(CHANNEL), [CHANNEL]);

  const [query, setQuery] = useState(seedQuery);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // What the SERVER is asked for, settled after typing stops. Without this the
  // page fires a request per keystroke over a mobile connection.
  const [settled, setSettled] = useState(seedQuery.trim());

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // This browser's own history. Reads are guarded: Safari private mode throws
  // on access rather than returning null.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter((t): t is string => typeof t === 'string').slice(0, RECENT_LIMIT));
      }
    } catch {
      // No history available — the section simply does not render.
    }
  }, []);

  const persistRecent = useCallback((next: string[]) => {
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable; the list still works for this visit.
    }
  }, []);

  const hasQuery = settled.length > 0;
  const wantsDoctors = activeCategory === 'all' || activeCategory === 'doctors';
  const wantsLabs = activeCategory === 'all' || activeCategory === 'labs';
  const wantsPharmacies = activeCategory === 'all' || activeCategory === 'pharmacies';

  const doctors = useDashboardData<DoctorRow[]>({
    url: '/api/public/doctors',
    params: { channel: CHANNEL, q: settled, limit: '20' },
    enabled: hasQuery && wantsDoctors,
  });
  const labs = useDashboardData<PartnerRow[]>({
    url: '/api/public/partners',
    params: { channel: CHANNEL, type: 'LAB', q: settled, limit: '20' },
    enabled: hasQuery && wantsLabs,
  });
  const pharmacies = useDashboardData<PartnerRow[]>({
    url: '/api/public/partners',
    params: { channel: CHANNEL, type: 'PHARMACY', q: settled, limit: '20' },
    enabled: hasQuery && wantsPharmacies,
  });

  const results = useMemo<SearchResult[]>(() => {
    if (!hasQuery) return [];
    const out: SearchResult[] = [];

    if (wantsDoctors) {
      for (const d of doctors.data ?? []) {
        out.push({
          id: `doctor-${d.id}`,
          name: d.name,
          subtitle: d.specialty || d.clinic || '',
          category: 'doctors',
          rating: d.rating,
          location: d.location || d.clinic || '',
          // The doctor's own profile. The demo pool pointed at the specialty
          // listing, so tapping a named doctor opened a list of strangers.
          href: doctorProfilePath(CHANNEL, d.id),
        });
      }
    }
    // Neither labs nor pharmacies have a detail route, so the browse list is
    // the honest destination rather than a link that 404s.
    if (wantsLabs) {
      for (const l of labs.data ?? []) {
        out.push({
          id: `lab-${l.id}`,
          name: l.name,
          // Was «مختبر معتمد» — "accredited lab". Nothing in the schema
          // records accreditation, so a lab with no address was given a
          // credential instead of a blank. Falls back to what the row has.
          subtitle: l.address || l.location || '',
          category: 'labs',
          rating: l.rating,
          location: l.location,
          href: ROUTES.labs,
        });
      }
    }
    if (wantsPharmacies) {
      for (const p of pharmacies.data ?? []) {
        out.push({
          id: `pharmacy-${p.id}`,
          name: p.name,
          subtitle: p.address || p.location || '',
          category: 'pharmacies',
          rating: p.rating,
          location: p.location,
          href: ROUTES.pharmacies,
        });
      }
    }
    return out;
    // CHANNEL and ROUTES belong here now that they are derived per render from
    // `?channel=` rather than being module constants — without them a channel
    // switch would keep serving the previous storefront's hrefs.
  }, [hasQuery, wantsDoctors, wantsLabs, wantsPharmacies, doctors.data, labs.data, pharmacies.data, CHANNEL, ROUTES]);

  const active = [
    ...(wantsDoctors ? [doctors] : []),
    ...(wantsLabs ? [labs] : []),
    ...(wantsPharmacies ? [pharmacies] : []),
  ];
  const isLoading = hasQuery && active.some((s) => s.isLoading);
  // A failed read must not be reported as "no results" — that is a claim about
  // the platform, made on the strength of a request that never answered.
  // `loadFailed` takes the row count on purpose: the cache keeps serving the
  // previous rows while it revalidates, so an error alongside results is a
  // background refresh that failed, not a screen that has nothing to show.
  const failed = hasQuery && !isLoading && active.some((s) => loadFailed(s.error, results.length));

  const retryAll = useCallback(() => {
    for (const s of active) void s.refetch();
    // `active` is rebuilt every render; depending on it would re-create the
    // callback each time for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors.refetch, labs.refetch, pharmacies.refetch, wantsDoctors, wantsLabs, wantsPharmacies]);

  const addToRecent = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;
    persistRecent([term, ...recentSearches.filter((s) => s !== term)].slice(0, RECENT_LIMIT));
  };

  const removeFromRecent = (term: string) => {
    persistRecent(recentSearches.filter((s) => s !== term));
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    addToRecent(term);
  };

  const showBrowseMode = !query.trim();

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
              onKeyDown={(e) => e.key === 'Enter' && addToRecent(query)}
              className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-10 outline-none border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-sm font-medium placeholder:text-gray-400 transition-colors"
              placeholder="ابحث عن طبيب، تخصص، مختبر..."
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="مسح البحث"
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
                type="button"
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
        {isLoading && <LoadingSkeleton variant="search-result" count={4} />}

        {/* Read failed — not the same as "nothing matched" */}
        {failed && <LoadError message="تعذّر تحميل نتائج البحث" onRetry={retryAll} />}

        {/* Search Results */}
        {!isLoading && !failed && hasQuery && results.length > 0 && (
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
                    {result.subtitle ? (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{result.subtitle}</p>
                    ) : null}
                    <div className="flex items-center gap-3 mt-1.5">
                      {/* A rating of 0 means "not rated yet", so printing "0"
                          beside a star would read as a bad review. */}
                      {result.rating > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span className="font-bold text-gray-700">{result.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {result.location ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{result.location}</span>
                        </div>
                      ) : null}
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
        {!isLoading && !failed && hasQuery && results.length === 0 && (
          <EmptyState
            icon={SearchX}
            title="لا توجد نتائج"
            description={`لم نجد نتائج تطابق "${settled}". جرّب كلمات بحث مختلفة.`}
          />
        )}

        {/* Browse Mode (when no query) */}
        {showBrowseMode && (
          <>
            {/* Recent Searches — this browser's own, absent until there are any */}
            {recentSearches.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    عمليات البحث الأخيرة
                  </h3>
                  <button
                    type="button"
                    onClick={() => persistRecent([])}
                    className="text-xs text-primary font-bold hover:text-primary/70 transition-colors"
                  >
                    مسح الكل
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs text-gray-600 shadow-sm flex items-center gap-2 hover:border-primary/30 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => handleRecentClick(term)}
                        className="flex items-center gap-1.5"
                      >
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="font-medium">{term}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFromRecent(term); }}
                        aria-label={`إزالة ${term}`}
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
                {browseCategories(ROUTES).map((cat) => (
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

            {/* Suggestions — phrases that seed a search, not platform statistics.
                The heading used to read «الأكثر بحثاً», which claimed these were
                the most-searched terms; nothing counts searches. */}
            {suggestions.length > 0 ? (
            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-3">اقتراحات للبحث</h3>
              <div className="space-y-2">
                {suggestions.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleRecentClick(term)}
                    className="w-full bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:border-primary/30 transition-colors text-right"
                  >
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 flex-1">{term}</span>
                    <ChevronLeft className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            </section>
            ) : null}
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

export default function SearchPage() {
  // `useSearchParams` reads the `?q=` the home search boxes pass; a client
  // component that calls it needs a boundary to prerender.
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 px-5 pt-2">
          <h1 className="text-xl font-extrabold text-gray-900 mb-4">البحث</h1>
          <div className="h-12 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        </div>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}
