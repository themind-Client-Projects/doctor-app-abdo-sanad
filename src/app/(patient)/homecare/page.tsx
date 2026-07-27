'use client';

import { useState } from 'react';
import { HeartHandshake, Stethoscope } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { HomecareReservationForm } from '@/components/forms/homecare-reservation-form';

export default function HomecarePage() {
  const [activeTab, setActiveTab] = useState<'nursing' | 'doctor'>('nursing');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 font-sans">
      <FlexibleHeader 
        title="الرعاية المنزلية" 
        showBackButton 
      />

      <main className="px-0 space-y-6">
        {/* Banner Section */}
        <div className="bg-[#0070CD] rounded-b-[2.5rem] overflow-hidden shadow-md relative pb-10">
          <div className="pt-6 px-6 text-center text-white flex flex-col items-center">
            <div className="w-48 h-40 relative mb-4 bg-white/10 rounded-3xl flex items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <HeartHandshake className="w-20 h-20 text-white opacity-95" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold mb-3 mt-2 text-white drop-shadow-md">احجز رعاية منزلية موثوقة</h2>
            <p className="text-sm text-white/90 leading-relaxed font-medium max-w-[280px] mx-auto drop-shadow-sm">
              سند تعطي الأولوية لراحتكم وعافيتكم لمنحكم رعاية عالية الجودة في مكانكم
            </p>


          </div>
        </div>

        {/* Form Section */}
        <div className="px-4">
          <div className="bg-white rounded-[1.5rem] p-5 sm:p-6 shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-gray-100">
            {/* Tabs */}
            <div className="flex bg-gray-50 rounded-2xl p-1.5 mb-6 border border-gray-100 shadow-inner">
              <button 
                onClick={() => setActiveTab('nursing')}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'nursing' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <HeartHandshake className={`w-4 h-4 ${activeTab === 'nursing' ? 'text-primary' : 'text-gray-400'}`} />
                خدمة تمريضية
              </button>
              <button 
                onClick={() => setActiveTab('doctor')}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'doctor' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Stethoscope className={`w-4 h-4 ${activeTab === 'doctor' ? 'text-primary' : 'text-gray-400'}`} />
                زيارة طبيب
              </button>
            </div>

            <div className="text-center mb-6 pt-2">
              <h3 className="text-gray-500 text-sm font-medium">
                {activeTab === 'nursing' ? 'ادخل بياناتك لطلب خدمة تمريضية وسنتواصل معك فوراً' : 'ادخل بياناتك لطلب زيارة طبيب مختص للمنزل'}
              </h3>
            </div>
            
            {/* Using key to force remount when tab changes so form resets properly */}
            <HomecareReservationForm key={activeTab} type={activeTab} />
          </div>
        </div>
      </main>
    </div>
  );
}
