'use client';

import { useState } from 'react';
import { Lock, MapPin, Phone, Star, ChevronLeft, HeartHandshake, Syringe, Activity, HeartPulse } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageBackButton } from '@/components/shared/page-back-button';
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
    { id: 1, name: 'مركز الرحمة للعناية المنزلية', location: 'يغطي بغداد بالكامل', phone: '0773 456 7890', rating: 4.8, icon: <HeartHandshake className="w-8 h-8" /> },
    { id: 2, name: 'المركز التخصصي للتمريض', location: 'بغداد - الأعظمية', phone: '0782 345 6789', rating: 4.5, icon: <Syringe className="w-8 h-8" /> },
    { id: 3, name: 'مؤسسة الشفاء الطبي', location: 'بغداد - البياع', phone: '0751 234 5678', rating: 4.9, icon: <Activity className="w-8 h-8" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24">
      <header className="bg-gradient-to-r from-rose-600 to-rose-400 px-4 pt-14 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <PageBackButton />
        <div className="relative z-10 text-center mt-2">
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">التمريض والعناية المنزلية</h1>
          <p className="text-rose-100 text-sm font-medium">خدمات تمريضية متخصصة في راحة منزلك</p>
        </div>
      </header>

      <main className="px-4 mt-6 space-y-6">
        
        {/* Referral Lock Warning - Enhanced Design */}
        <section>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-orange-200/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-white text-orange-500 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-orange-100">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-orange-900 mb-1.5 text-lg">الأسعار المخفضة مقفلة</h3>
                <p className="text-sm text-orange-800/80 leading-relaxed mb-4 font-medium">
                  للحصول على خصومات خدمات التمريض المعتمدة، يجب أن تحصل على إحالة من طبيب عبر التطبيق أولاً.
                </p>
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => router.push('/doctors')}>
                  استشر طبيباً الآن
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Centers List */}
        <section>
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-600" />
              مراكز التمريض المعتمدة
            </h2>
          </div>
          <div className="space-y-4">
            {centers.map((center) => (
              <div key={center.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-rose-200 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl flex items-center justify-center text-rose-600 flex-shrink-0 border border-rose-100/50 group-hover:scale-105 transition-transform">
                    {center.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-extrabold text-gray-800 text-base truncate pr-2">{center.name}</h3>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {center.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{center.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-rose-500" />
                      <span dir="ltr">{center.phone}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => openReservation(center)}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all">
                    احجز خدمة الآن
                  </button>
                  <button className="w-12 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-100 transition-colors">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ── Reservation Drawer ── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[92vh] h-auto">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-y-auto hide-scrollbar pb-safe">
            <DrawerHeader className="text-right px-5 pt-6">
              <DrawerTitle className="text-xl font-extrabold mb-1 text-gray-900">
                حجز خدمة تمريضية
              </DrawerTitle>
              {selectedCenter && (
                <p className="text-sm text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg inline-block mt-2">
                  مع {selectedCenter.name}
                </p>
              )}
            </DrawerHeader>
            
            <div className="p-5 pb-8">
              <HomecareReservationForm 
                centerName={selectedCenter?.name} 
                onSuccess={() => {
                  // The form shows a success message for 2 seconds, then we close the drawer
                  setTimeout(() => setDrawerOpen(false), 2000);
                }} 
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
