'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Share2, Heart, Star, Plus, Check } from 'lucide-react';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import type { Doctor } from '@/types/patient';
import type { StorefrontChannel } from '@/lib/channel-routes';

/** What the profile adds on top of the list's `Doctor`. */
type DoctorDetail = Doctor & {
  services: { serviceType: string; name: string }[];
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
};

/**
 * A doctor's profile, priced for the storefront the patient came from.
 *
 * Shared by `/doctors/profile/[id]` and `/sanad/doctors/profile/[id]` — the
 * same screen against a different channel, exactly as the two browse pages
 * share `DoctorsBrowse`. Before this the page always asked for the DIRECT
 * price, so a doctor browsed inside سند at 20,000 opened at 25,000 with nothing
 * explaining the jump.
 */
export function DoctorProfile({ id, channel = 'DIRECT' }: { id: string; channel?: StorefrontChannel }) {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'services' | 'safety'>('services');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  // This page opens the booking drawer directly, so the shared hook's gate
  // does not reach it.
  const { ensureSignedIn } = useAuthGuard();

  // The id is a real `DoctorProfile.id` from the listing. This page used to
  // look it up in `demo-data.ts`, so every link from the wired list resolved to
  // nothing and rendered "لم يتم العثور على الطبيب".
  const { data: doctor, isLoading, error } = useDashboardData<DoctorDetail>({
    url: `/api/public/doctors/${id}`,
    // The endpoint prices by channel — the list already did this, the profile
    // did not.
    params: { channel },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 space-y-4">
        <div className="h-40 rounded-3xl bg-white border border-gray-100 animate-pulse" />
        <div className="h-24 rounded-3xl bg-white border border-gray-100 animate-pulse" />
        <div className="h-64 rounded-3xl bg-white border border-gray-100 animate-pulse" />
      </div>
    );
  }

  // A genuine 404 and a network failure read differently, so they say so.
  if (error || !doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4 px-6 text-center">
        <h1 className="font-bold text-gray-800">
          {error ? 'تعذّر تحميل بيانات الطبيب' : 'لم يتم العثور على الطبيب'}
        </h1>
        <button onClick={() => router.back()} className="px-6 py-2 bg-primary text-white rounded-xl">العودة</button>
      </div>
    );
  }

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) ? prev.filter(sId => sId !== serviceId) : [...prev, serviceId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">


      {/* ── Doctor Info ── */}
      <div className="bg-white px-5 py-6 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative w-28 h-28 rounded-[2rem] overflow-hidden bg-[#eaf6ef] border border-[#10b981]/10 flex-shrink-0">
            {doctor.image ? (
              <Image src={doctor.image} alt={doctor.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[#10b981] font-extrabold text-3xl">{doctor.name.charAt(0)}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 text-right">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{doctor.name}</h2>
            <div className="flex items-center justify-start gap-1.5 mb-2 text-[#10b981]">
              <div className="flex text-amber-400 ml-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(doctor.rating) ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <span className="text-xs font-bold">التقييم العام من {doctor.reviewCount} زائر</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">{doctor.specialty}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white flex border-b border-gray-200 px-5">
        <button 
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-4 text-center font-bold text-[15px] transition-colors relative ${
            activeTab === 'services' ? 'text-[#10b981] border-b-[3px] border-[#10b981]' : 'text-gray-500'
          }`}
        >
          الخدمات
        </button>
        <button 
          onClick={() => setActiveTab('safety')}
          className={`flex-1 py-4 text-center font-bold text-[15px] transition-colors ${
            activeTab === 'safety' ? 'text-[#10b981] border-b-[3px] border-[#10b981]' : 'text-gray-500'
          }`}
        >
          السلامة
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white flex-1 flex flex-col">
        {activeTab === 'services' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {doctor.services.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  لا توجد خدمات مفعّلة لهذا الطبيب حالياً
                </p>
              ) : null}
              {doctor.services.map((service, idx) => {
                const isSelected = selectedServices.includes(service.serviceType);
                return (
                  <div 
                    key={service.serviceType} 
                    className={`flex items-center justify-between py-5 cursor-pointer group ${
                      idx !== doctor.services.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                    onClick={() => toggleService(service.serviceType)}
                  >
                    <span className="font-bold text-gray-800 text-[15px] text-right flex-1 ml-4 leading-relaxed group-hover:text-[#10b981] transition-colors">{service.name}</span>
                    <button 
                      className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected 
                          ? 'bg-[#10b981] text-white shadow-md shadow-[#10b981]/20 scale-105' 
                          : 'bg-[#eaf6ef] text-[#10b981] hover:bg-[#10b981]/20'
                      }`}
                    >
                      {isSelected ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 pb-8 mt-auto space-y-3">
              <button className="w-full bg-[#eaf6ef] text-[#10b981] font-extrabold text-[15px] py-4 rounded-2xl hover:bg-[#10b981]/20 transition-colors">
                عرض المزيد
              </button>
              
              {/* Optional Checkout Action if items are selected */}
              {selectedServices.length > 0 && (
                <button 
                  onClick={() => ensureSignedIn(() => setIsBookingOpen(true))}
                  className="w-full bg-[#10b981] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#10b981]/30 transition-transform active:scale-95 animate-in slide-in-from-bottom-2 fade-in"
                >
                  تأكيد واختيار موعد ({selectedServices.length} خدمات)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm font-medium">
            لا توجد معلومات سلامة حالياً.
          </div>
        )}
      </div>

      {/* Booking Drawer */}
      <DoctorBookingDrawer 
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        doctor={doctor}
      />
    </div>
  );
}
