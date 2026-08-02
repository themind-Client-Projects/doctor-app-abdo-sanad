'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useLocationStore } from '@/stores/patient/location.store';
import { CitySelectorDrawer } from '@/components/features/patient/city-selector-drawer';
import { SurgeryBookingDrawer } from '@/components/features/patient/surgery-booking-drawer';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { Button } from '@/components/ui/button';

export default function SurgeriesPage() {
  const router = useRouter();
  const { selectedCity, openCitySelector } = useLocationStore();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const { ensureSignedIn } = useAuthGuard();

  // Both entry points route through here, so the rule cannot be applied to one
  // button and forgotten on the other.
  const openBooking = () => ensureSignedIn(() => setIsBookingOpen(true));

  const steps = [
    { num: 1, title: 'اختار المنطقة', desc: 'يمكنك اختيار الفرع الأقرب إليك' },
    { num: 2, title: 'اضف العملية', desc: 'عمليات متنوعة في مختلف التخصصات' },
    { num: 3, title: 'اختار الفرع', desc: 'قارن الأسعار والموقع وساعات العمل' },
    { num: 4, title: 'قراءة تحضيرات الخدمات', desc: 'اتبع التعليمات قبل موعدك' },
    { num: 5, title: 'اختر التاريخ', desc: 'حدد موعدا لزيارة الفرع' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-36 font-sans relative">
      {/* Page Title */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold text-gray-900">العمليات الجراحية</h1>
          <button 
            onClick={openCitySelector}
            className="flex items-center gap-1.5 font-bold text-xs text-primary hover:text-primary/80 bg-primary/5 px-2.5 py-1.5 rounded-full transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            {selectedCity ? `${selectedCity}، كل الأحياء` : 'اختر مدينة'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 border border-gray-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-sm font-medium placeholder:text-gray-400 transition-colors"
            placeholder="ابحث عن عملية جراحية..."
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="px-5 mt-4 space-y-6">
        
        {/* Top Promo Banner with Real Image */}
        <div 
          onClick={openBooking}
          className="relative rounded-[2rem] overflow-hidden shadow-sm cursor-pointer active:scale-[0.98] transition-colors h-[170px] flex flex-col justify-center px-6 group border border-gray-100"
        >
          <Image 
            src="/surgery-promo.png" 
            alt="خصومات العمليات الجراحية" 
            fill 
            className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
          />
          {/* Darker, elegant gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-l from-gray-900/95 via-gray-900/70 to-transparent" />
          
          <div className="relative z-10 max-w-[70%]">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full mb-3 backdrop-blur-md border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              حصرياً عبر التطبيق
            </div>
            <h2 className="text-xl font-extrabold leading-tight mb-2 text-white">
              خصومات كبرى على<br />العمليات الجراحية
            </h2>
            <p className="text-xs text-gray-300 font-medium">
              نضمن لك أفضل رعاية بأقل تكلفة
            </p>
          </div>
        </div>

        <h2 className="text-lg font-extrabold text-gray-900 mb-5 px-1">كيف تعمل</h2>
        
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative">
          {/* Vertical Line */}
          <div className="absolute top-8 bottom-8 right-[2.6rem] w-[2px] bg-gray-100 z-0"></div>
          
          <div className="space-y-8 relative z-10">
            {steps.map((step) => (
              <div key={step.num} className="flex gap-4">
                <div className="w-9 h-9 shrink-0 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-blue-100 mt-1">
                  {step.num}
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-extrabold text-gray-900 text-[15px]">{step.title}</h3>
                  <p className="text-xs text-gray-500 font-medium">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Button 
            onClick={openBooking} 
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl py-7 text-lg font-extrabold shadow-lg shadow-primary/25 active:scale-[0.98] transition-colors"
          >
            ابدأ حجز عمليتك الآن
          </Button>
        </div>
      </main>



      <CitySelectorDrawer />
      <SurgeryBookingDrawer open={isBookingOpen} onOpenChange={setIsBookingOpen} />
    </div>
  );
}
