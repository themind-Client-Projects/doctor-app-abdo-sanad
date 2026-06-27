'use client';

import { Lock, MapPin, Phone, Star, ChevronLeft, Pill, Hospital, Cross, ShoppingBag, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlexibleHeader } from '@/components/shared/flexible-header';

export default function PharmaciesPage() {
  const router = useRouter();

  const pharmacies = [
    { id: 1, name: 'صيدلية الرازي الكبرى', location: 'بغداد - اليرموك', phone: '0770 000 1111', rating: 4.7, reviews: 156, icon: <Pill className="w-8 h-8" /> },
    { id: 2, name: 'صيدلية الشفاء الحديثة', location: 'بغداد - الجادرية', phone: '0781 222 3333', rating: 4.6, reviews: 92, icon: <Hospital className="w-8 h-8" /> },
    { id: 3, name: 'صيدلية بغداد المركزية', location: 'بغداد - الحارثية', phone: '0790 444 5555', rating: 4.9, reviews: 340, icon: <Cross className="w-8 h-8" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 font-sans selection:bg-emerald-100">
      <FlexibleHeader 
        title="الصيدليات" 
        subtitle="اطلب أدويتك من أفضل الصيدليات المعتمدة" 
        showBackButton 
        showSearch 
        searchPlaceholder="ابحث عن صيدلية، دواء..."
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
                <h3 className="font-extrabold text-orange-900 mb-1 text-base">أسعار حصرية عبر الإحالة</h3>
                <p className="text-xs text-orange-800/80 leading-relaxed mb-4 font-medium pr-1">
                  للحصول على الخصومات الحصرية للأدوية من الصيدليات المعتمدة، يجب أن يرسل الطبيب وصفة إلكترونية عبر التطبيق.
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

        {/* Pharmacies List */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              الصيدليات المعتمدة
            </h2>
            <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full transition-colors">تصفح الخريطة</button>
          </div>
          
          <div className="space-y-4">
            {pharmacies.map((pharmacy) => (
              <div key={pharmacy.id} className="bg-white rounded-[2rem] p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100 hover:border-emerald-200/60 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-emerald-600 flex-shrink-0 border border-gray-100 group-hover:bg-emerald-50 group-hover:scale-105 transition-all duration-300">
                    {pharmacy.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-extrabold text-gray-900 text-base truncate pr-2 group-hover:text-emerald-700 transition-colors">{pharmacy.name}</h3>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {pharmacy.rating}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{pharmacy.location}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span dir="ltr">{pharmacy.phone}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                    طلب دواء وتصفح الأسعار
                  </button>
                  <button className="w-12 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-100 transition-colors active:scale-95">
                    <MapPin className="w-4 h-4" />
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
