'use client';

import { useState } from 'react';
import { Lock, MapPin, Phone, Star, ChevronLeft, HeartHandshake, Syringe, Activity, HeartPulse, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlexibleHeader } from '@/components/shared/flexible-header';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { HomecareReservationForm } from '@/components/forms/homecare-reservation-form';

export default function NursingPage() {
  const router = useRouter();
  
  const [selectedCenter, setSelectedCenter] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openReservation = (center: any) => {
    setSelectedCenter(center);
    setDrawerOpen(true);
  };

  const centers = [
    { id: 1, name: 'مركز الرحمة للعناية المنزلية', location: 'يغطي بغداد بالكامل', phone: '0773 456 7890', rating: 4.8, reviews: 245, icon: <HeartHandshake className="w-8 h-8" /> },
    { id: 2, name: 'المركز التخصصي للتمريض', location: 'بغداد - الأعظمية', phone: '0782 345 6789', rating: 4.5, reviews: 112, icon: <Syringe className="w-8 h-8" /> },
    { id: 3, name: 'مؤسسة الشفاء الطبي', location: 'بغداد - البياع', phone: '0751 234 5678', rating: 4.9, reviews: 380, icon: <Activity className="w-8 h-8" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 font-sans selection:bg-rose-100">
      <FlexibleHeader 
        title="خدمات التمريض" 
        subtitle="ممرضون محترفون لرعايتك في منزلك" 
        showBackButton 
      />

      <main className="px-5 mt-6 space-y-8">
        
        {/* Referral Lock Warning - Premium Design */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-br from-amber-100/80 to-orange-50 rounded-[2rem] p-5 shadow-sm relative overflow-hidden group border border-amber-200/50">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 transform group-hover:rotate-12 transition-transform duration-300">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="font-extrabold text-orange-900 mb-1 text-base">الأسعار المخفضة مقفلة</h3>
                <p className="text-xs text-orange-800/80 leading-relaxed mb-4 font-medium pr-1">
                  للحصول على خصومات خدمات التمريض المعتمدة، يجب أن تحصل على إحالة من طبيب عبر التطبيق أولاً.
                </p>
                <button 
                  onClick={() => router.push('/doctors')}
                  className="bg-white/80 hover:bg-white text-orange-600 border border-orange-200/60 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 w-max backdrop-blur-md"
                >
                  استشر طبيباً الآن
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Centers List */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-600" />
              مراكز التمريض المعتمدة
            </h2>
          </div>
          
          <div className="space-y-4">
            {centers.map((center) => (
              <div key={center.id} className="bg-white rounded-[2rem] p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100 hover:border-rose-200/60 hover:shadow-xl hover:shadow-rose-900/5 transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-rose-600 flex-shrink-0 border border-gray-100 group-hover:bg-rose-50 group-hover:scale-105 transition-all duration-300">
                    {center.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-extrabold text-gray-900 text-base truncate pr-2 group-hover:text-rose-700 transition-colors">{center.name}</h3>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {center.rating}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{center.location}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span dir="ltr">{center.phone}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <button 
                    onClick={() => openReservation(center)}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                  >
                    احجز خدمة الآن
                  </button>
                  <button className="w-12 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-100 transition-colors active:scale-95">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Reservation Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="font-sans px-2 pb-6 max-h-[90vh] overflow-y-auto">
          <DrawerHeader className="text-right border-b border-gray-100 mb-4 pb-4">
            <DrawerTitle className="font-extrabold text-xl text-gray-900">
              حجز خدمة تمريضية
            </DrawerTitle>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              أنت تقوم بالحجز لدى: <span className="font-bold text-rose-600">{selectedCenter?.name}</span>
            </p>
          </DrawerHeader>
          <div className="px-4">
            <HomecareReservationForm 
              type="nursing"
              onSuccess={() => {
                setDrawerOpen(false);
                // In real app, maybe show a success toast or redirect to bookings
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
