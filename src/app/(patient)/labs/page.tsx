'use client';

import { Lock, MapPin, Phone, Star, ChevronLeft, Calendar, Activity, Clock, Filter, Beaker, Droplet, Bone, ClipboardList, Dna, Microscope, TestTube, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlexibleHeader } from '@/components/shared/flexible-header';

export default function LabsPage() {
  const router = useRouter();

  const activeAppointments = [
    { id: 1, labName: 'مختبرات الشفاء التخصصية', testName: 'باقة الفحص الشامل (VIP)', date: 'غداً، 10:30 صباحاً', status: 'مؤكد' }
  ];

  const categories = [
    { id: 1, name: 'تحاليل الدم', icon: <Droplet className="w-8 h-8" strokeWidth={1.5} />, color: 'from-rose-400 to-red-500', shadow: 'shadow-red-500/20' },
    { id: 2, name: 'الأشعة والسونار', icon: <Bone className="w-8 h-8" strokeWidth={1.5} />, color: 'from-blue-400 to-indigo-500', shadow: 'shadow-blue-500/20' },
    { id: 3, name: 'الفحص الشامل', icon: <ClipboardList className="w-8 h-8" strokeWidth={1.5} />, color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/20' },
    { id: 4, name: 'التحاليل الوراثية', icon: <Dna className="w-8 h-8" strokeWidth={1.5} />, color: 'from-purple-400 to-fuchsia-500', shadow: 'shadow-purple-500/20' },
    { id: 5, name: 'مسحات كورونا', icon: <Microscope className="w-8 h-8" strokeWidth={1.5} />, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-500/20' },
  ];

  const labs = [
    { id: 1, name: 'مختبرات الشفاء التخصصية', location: 'بغداد - المنصور', phone: '0771 234 5678', rating: 4.8, reviews: 124, icon: <Microscope className="w-8 h-8" />, features: ['خدمة منزلية', 'نتائج فورية'], isOpen: true },
    { id: 2, name: 'مختبر النور للتحاليل', location: 'بغداد - الكرادة', phone: '0780 987 6543', rating: 4.5, reviews: 89, icon: <TestTube className="w-8 h-8" />, features: ['مفتوح 24 ساعة', 'يقبل التأمين'], isOpen: true },
    { id: 3, name: 'مختبرات الحياة المتقدمة', location: 'بغداد - زيونة', phone: '0750 111 2222', rating: 4.9, reviews: 210, icon: <Dna className="w-8 h-8" />, features: ['أحدث الأجهزة', 'دقة عالية'], isOpen: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-28 font-sans selection:bg-purple-100">
      <FlexibleHeader 
        title="المختبرات والأشعة" 
        subtitle="احجز فحوصاتك الطبية بدقة وسهولة"
        showBackButton 
        showSearch
        searchPlaceholder="ابحث عن مختبر، تحليل، أو أشعة..."
      />

      <main className="px-5 mt-6 space-y-8">
        
        {/* Active Appointments */}
        {activeAppointments.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-extrabold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                مواعيدي القادمة
              </h2>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-[2rem] p-5 shadow-xl shadow-purple-900/10 relative overflow-hidden group">
              {/* Premium Glow */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 group-hover:bg-purple-400/30 transition-all duration-700"></div>
              
              {activeAppointments.map(appt => (
                <div key={appt.id} className="relative z-10 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-flex items-center gap-1.5 bg-white/10 text-purple-100 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {appt.status}
                      </span>
                      <h3 className="font-extrabold text-white text-lg leading-tight mb-1 drop-shadow-sm">{appt.testName}</h3>
                      <p className="text-sm text-purple-200 font-medium flex items-center gap-1.5">
                        <Beaker className="w-4 h-4 opacity-80" /> {appt.labName}
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-2xl p-3.5 flex items-center justify-between backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-3 text-sm font-bold text-white">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-purple-200" />
                      </div>
                      {appt.date}
                    </div>
                    <button className="text-sm font-bold text-purple-200 hover:text-white transition-colors flex items-center gap-1">
                      التفاصيل
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories Horizontal Scroll */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-extrabold text-gray-900 text-lg">التصنيفات</h2>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar px-1">
            {categories.map((cat) => (
              <button key={cat.id} className="snap-start flex flex-col items-center gap-3 group min-w-[85px]">
                <div className={`w-[72px] h-[72px] rounded-[1.5rem] bg-gradient-to-br ${cat.color} flex items-center justify-center text-white shadow-lg ${cat.shadow} transform group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-95 transition-all duration-300 relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 drop-shadow-md">
                    {cat.icon}
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-700 text-center w-full truncate group-hover:text-gray-900 transition-colors">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Referral Lock Warning - Premium UI */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-gradient-to-br from-amber-100/80 to-orange-50 rounded-[2rem] p-5 shadow-sm relative overflow-hidden group border border-amber-200/50">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 transform group-hover:rotate-12 transition-transform duration-300">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="font-extrabold text-orange-900 mb-1 text-base">أسعار حصرية عبر الإحالة</h3>
                <p className="text-xs text-orange-800/80 leading-relaxed mb-4 font-medium pr-1">
                  احصل على خصومات تصل إلى 40% على كافة التحاليل عند حجز موعد مع طبيب والحصول على إحالة إلكترونية.
                </p>
                <button 
                  onClick={() => router.push('/doctors')}
                  className="bg-white/80 hover:bg-white text-orange-600 border border-orange-200/60 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 w-max backdrop-blur-md"
                >
                  احجز طبيباً الآن
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Labs List */}
        <section className="animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              أفضل المختبرات
            </h2>
            <button className="text-sm font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full transition-colors">عرض الكل</button>
          </div>
          
          <div className="space-y-4">
            {labs.map((lab) => (
              <div key={lab.id} className="bg-white rounded-[2rem] p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100 hover:border-purple-200/60 hover:shadow-xl hover:shadow-purple-900/5 transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-purple-600 flex-shrink-0 border border-gray-100 group-hover:bg-purple-50 group-hover:scale-105 transition-all duration-300">
                      {lab.icon}
                    </div>
                    <div className={`absolute -bottom-2 -right-2 text-[10px] font-bold px-2.5 py-1 rounded-xl border-2 border-white shadow-sm flex items-center gap-1 ${lab.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${lab.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      {lab.isOpen ? 'متاح الآن' : 'مغلق'}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-extrabold text-gray-900 text-base truncate pr-2 group-hover:text-purple-700 transition-colors">{lab.name}</h3>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {lab.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{lab.location}</span>
                    </div>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {lab.features.map((feature, idx) => (
                        <span key={idx} className="bg-purple-50/50 text-purple-700 border border-purple-100/50 text-[10px] font-bold px-2 py-1 rounded-md">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                    قائمة الفحوصات
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
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
