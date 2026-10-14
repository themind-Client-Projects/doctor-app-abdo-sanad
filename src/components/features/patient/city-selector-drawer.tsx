'use client';

import { useMemo, useState } from 'react';
import { Search, MapPin, CheckCircle2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useLocationStore } from '@/stores/patient/location.store';
import { LoadError } from '@/components/shared/load-error';
import { STALE_TIME } from '@/lib/request-cache';

/**
 * The city list comes from the governorates table, not from a constant.
 *
 * It used to be ten hardcoded names while the platform has eighteen
 * governorates — so a patient in الأنبار، ديالى، دهوك، واسط، ميسان، المثنى،
 * القادسية or صلاح الدين could not pick their city at all. That is not a
 * cosmetic gap: `/services` refuses to open العيادات، العمليات or العروض until
 * a city is chosen, so eight governorates were locked out of the service entry
 * points entirely.
 *
 * This stays a NAME, deliberately. The store persists a string and
 * `useDoctors` matches it with `doctor.location.includes(selectedCity)`
 * against the governorate's name — so switching to `Governorate.id` here would
 * silently break every filter that reads the store. Changing that is a wider
 * refactor than this defect needs.
 */
type Governorate = { id: string; name: string };

export function CitySelectorDrawer() {
  const { selectedCity, isCitySelectorOpen, setCity, closeCitySelector } = useLocationStore();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useDashboardData<Governorate[]>({
    url: '/api/public/governorates',
    staleTime: STALE_TIME.reference,
  });

  const cities = useMemo(() => (data ?? []).map((g) => g.name), [data]);
  const filteredCities = useMemo(
    () => cities.filter((city) => city.includes(searchQuery)),
    [cities, searchQuery]
  );
  // Distinct from "no match": without this a failed fetch reads as
  // «لا توجد مدن مطابقة للبحث», which blames the patient's search for an
  // outage and leaves them stuck behind the /services city gate.
  const failed = error != null && cities.length === 0;

  return (
    <Drawer open={isCitySelectorOpen} onOpenChange={(open) => !open && closeCitySelector()}>
      <DrawerContent className="max-h-[85vh] h-full flex flex-col rounded-t-[2rem]">
        <div className="mx-auto w-full max-w-md flex flex-col h-full bg-gray-50/30">
          <DrawerHeader className="text-right px-5 pt-6 pb-4 border-b border-gray-100 bg-white rounded-t-[2rem]">
            <DrawerTitle className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              اختر مدينة
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-5 py-4 bg-white sticky top-0 z-10 shadow-sm">
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 border border-gray-100 outline-none focus:ring-2 focus:ring-primary/50 shadow-inner text-sm transition-colors"
                placeholder="ابحث عن مدينة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 pb-safe">
            <div className="space-y-2">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  onClick={() => setCity(city)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors active:scale-95 ${
                    selectedCity === city
                      ? 'bg-primary/10 border-2 border-primary/20 text-primary shadow-sm'
                      : 'bg-white border border-gray-100 text-gray-700 hover:border-primary/30 hover:shadow-sm'
                  }`}
                >
                  <span className={`text-sm ${selectedCity === city ? 'font-bold' : 'font-medium'}`}>
                    {city}
                  </span>
                  {selectedCity === city && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
              
              {failed && (
                <LoadError message="تعذّر تحميل قائمة المدن" onRetry={() => void refetch()} />
              )}

              {!failed && isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 rounded-2xl bg-white border border-gray-100 animate-pulse" />
                  ))}
                </div>
              )}

              {!failed && !isLoading && filteredCities.length === 0 && (
                <div className="text-center py-10">
                  <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">لا توجد مدن مطابقة للبحث</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
