'use client';

import { Lock, MapPin, Phone, Star, ChevronLeft, Activity, Bone, HeartPulse, PersonStanding } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlexibleHeader } from '@/components/shared/flexible-header';


export default function PhysiotherapyPage() {
  const router = useRouter();

  const clinics = [
    { id: 1, name: 'مركز التأهيل الطبي الشامل', location: 'بغداد - الكرادة', phone: '0770 123 4567', rating: 4.8, icon: <Bone className="w-8 h-8" /> },
    { id: 2, name: 'عيادة الحركة للعلاج الطبيعي', location: 'بغداد - المنصور', phone: '0781 234 5678', rating: 4.6, icon: <Activity className="w-8 h-8" /> },
    { id: 3, name: 'مركز الحياة لطب المفاصل', location: 'بغداد - زيونة', phone: '0790 345 6789', rating: 4.9, icon: <PersonStanding className="w-8 h-8" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      <FlexibleHeader 
        title="العلاج الطبيعي" 
        subtitle="أفضل المراكز لاستعادة حركتك ونشاطك" 
        showBackButton 
      />

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
                  للحصول على جلسات العلاج الطبيعي المخفضة، تحتاج إلى تحويل من طبيب المفاصل أو الأعصاب عبر التطبيق.
                </p>
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => router.push('/doctors')}>
                  استشر طبيباً الآن
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sessions Example (Kept from original but styled better) */}
        <section>
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              أمثلة لأسعار الجلسات
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { id: 1, name: 'جلسة مساج طبي علاجي', price: '25,000 د.ع', icon: <HeartPulse className="w-5 h-5" /> },
              { id: 2, name: 'تأهيل ما بعد الكسور', price: '35,000 د.ع', icon: <Bone className="w-5 h-5" /> },
            ].map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between hover:border-amber-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
                    {item.icon}
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                </div>
                <span className="font-extrabold text-gray-900">{item.price}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Clinics List */}
        <section>
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <PersonStanding className="w-5 h-5 text-amber-600" />
              مراكز العلاج المعتمدة
            </h2>
          </div>
          <div className="space-y-4">
            {clinics.map((clinic) => (
              <div key={clinic.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-amber-200 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0 border border-amber-100/50 group-hover:scale-105 transition-transform">
                    {clinic.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-extrabold text-gray-800 text-base truncate pr-2">{clinic.name}</h3>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {clinic.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      <span className="truncate">{clinic.location}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                    احجز جلسة الآن
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
    </div>
  );
}
