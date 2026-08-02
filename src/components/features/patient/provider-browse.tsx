'use client';

import { useMemo } from 'react';
import { MapPin, Phone, Star } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { BrowseToolbar, useBrowseState, type Facet } from '@/components/shared/browse/browse-toolbar';
import { InfiniteList } from '@/components/shared/browse/infinite-list';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import type { Channel } from '@/hooks/use-storefront';
import { formatNumber } from '@/lib/format';

/**
 * المختبرات · الصيدليات · التمريض · العلاج الطبيعي — one screen.
 *
 * Those four pages were four hand-written copies of the same list, each with
 * its own hardcoded providers and its own decorative search box that filtered
 * nothing. They differ only in which SERVICE they sell, so that is the prop.
 *
 * Filtering by service rather than by partner type is also what makes
 * /physiotherapy work at all: the client's partner taxonomy has no
 * physiotherapy category, because it is a service.
 */

export type Provider = {
  id: string;
  name: string;
  type: string;
  phone: string;
  location: string;
  address: string;
  rating: number;
  reviewCount: number;
  services: string[];
  hasHomeService: boolean;
  hasBloodDraw: boolean;
  complex: { id: string; name: string } | null;
};

type Governorate = { id: string; name: string };

export function ProviderBrowse({
  serviceType,
  channel = 'DIRECT',
  title,
  subtitle,
  searchPlaceholder,
  emptyTitle,
}: {
  /** The `ServiceType` this screen sells. */
  serviceType: string;
  channel?: Channel;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyTitle: string;
}) {
  const { ensureSignedIn } = useAuthGuard();

  // Cities come from the same table the admin edits, so a governorate switched
  // off in إعدادات النظام stops being offered here without a deploy.
  const { data: governorates } = useDashboardData<Governorate[]>({
    url: '/api/public/governorates',
  });

  const facets = useMemo<Facet[]>(
    () => [
      {
        key: 'governorate',
        label: 'كل المحافظات',
        options: (governorates ?? []).map((g) => ({ value: g.name, label: g.name })),
      },
    ],
    [governorates]
  );

  const browse = useBrowseState(facets);

  const { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, refetch } =
    useInfiniteList<Provider>({
      url: '/api/public/partners',
      params: { ...browse.params, service: serviceType, channel },
    });

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] pb-28 font-sans">
      <FlexibleHeader title={title} subtitle={subtitle} showBackButton />

      <main className="mt-5 space-y-5">
        <BrowseToolbar placeholder={searchPlaceholder} facets={facets} state={browse} />

        <section className="px-4">
          <InfiniteList
            items={items}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            error={error}
            sentinelRef={sentinelRef}
            onRetry={refetch}
            isFiltered={browse.activeCount > 0}
            emptyTitle={emptyTitle}
            emptyHint="لا يوجد مزوّدون لهذه الخدمة في الوقت الحالي"
            renderItem={(p) => (
              <article
                key={p.id}
                className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/5 text-primary">
                    <MapPin className="h-6 w-6" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold text-gray-800">{p.name}</h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                      {[p.location, p.address].filter(Boolean).join(' - ') || '—'}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {p.rating > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                          {p.rating.toFixed(1)}
                          <span className="font-medium text-amber-600/70">
                            ({formatNumber(p.reviewCount)})
                          </span>
                        </span>
                      ) : null}
                      {p.hasHomeService ? <Tag>خدمة منزلية</Tag> : null}
                      {p.hasBloodDraw ? <Tag>سحب دم</Tag> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => ensureSignedIn(() => window.open(`tel:${p.phone}`, '_self'))}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 active:scale-[0.98]"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    اتصل الآن
                  </button>
                </div>
              </article>
            )}
          />
        </section>
      </main>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
      {children}
    </span>
  );
}
