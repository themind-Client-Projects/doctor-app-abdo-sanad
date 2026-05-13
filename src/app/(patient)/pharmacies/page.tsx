'use client';

import { Lock, MapPin, Phone, Star, ChevronLeft, Pill, Hospital, Cross, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageBackButton } from '@/components/shared/page-back-button';

export default function PharmaciesPage() {
  const router = useRouter();

  const pharmacies = [
    { id: 1, name: 'صيدلية الرازي الكبرى', location: 'بغداد - اليرموك', phone: '0770 000 1111', rating: 4.7, icon: <Pill className="w-8 h-8" /> },
    { id: 2, name: 'صيدلية الشفاء الحديثة', location: 'بغداد - الجادرية', phone: '0781 222 3333', rating: 4.6, icon: <Hospital className="w-8 h-8" /> },
    { id: 3, name: 'صيدلية بغداد المركزية', location: 'بغداد - الحارثية', phone: '0790 444 5555', rating: 4.9, icon: <Cross className="w-8 h-8" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24">
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-400 px-4 pt-14 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <PageBackButton />
        <div className="relative z-10 text-center mt-2">
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">الصيدليات</h1>
          <p className="text-emerald-100 text-sm font-medium">اطلب أدويتك من أفضل الصيدليات المعتمدة</p>
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
                <h3 className="font-extrabold text-orange-900 mb-1.5 text-lg">خصومات الأدوية مقفلة</h3>
                <p className="text-sm text-orange-800/80 leading-relaxed mb-4 font-medium">
                  للحصول على الخصومات الحصرية للأدوية من الصيدليات المعتمدة، يجب أن يرسل الطبيب وصفة إلكترونية عبر التطبيق.
                </p>
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => router.push('/doctors')}>
                  استشر طبيباً الآن
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Pharmacies List */}
        <section>
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              الصيدليات المعتمدة
            </h2>
          </div>
          <div className="space-y-4">
            {pharmacies.map((pharmacy) => (
              <div key={pharmacy.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0 border border-emerald-100/50 group-hover:scale-105 transition-transform">
                    {pharmacy.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-extrabold text-gray-800 text-base truncate pr-2">{pharmacy.name}</h3>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {pharmacy.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{pharmacy.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                      <span dir="ltr">{pharmacy.phone}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                    طلب دواء وتصفح الأسعار
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
