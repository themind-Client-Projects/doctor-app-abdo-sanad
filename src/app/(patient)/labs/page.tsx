'use client';

import { Lock, MapPin, Phone, Star, ChevronLeft, Search, Calendar, Activity, Home, Clock, Filter, Beaker, Droplet, Bone, ClipboardList, Dna, Microscope, TestTube } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageBackButton } from '@/components/shared/page-back-button';

export default function LabsPage() {
  const router = useRouter();

  // بيانات توضيحية لتمثيل حالة المستخدم لو كان لديه حجز قادم
  const activeAppointments = [
    { id: 1, labName: 'مختبرات الشفاء التخصصية', testName: 'باقة الفحص الشامل (VIP)', date: 'غداً، 10:30 صباحاً', status: 'مؤكد' }
  ];

  // تصنيفات الفحوصات لتسهيل البحث
  const categories = [
    { id: 1, name: 'تحاليل الدم', icon: <Droplet className="w-8 h-8" />, color: 'bg-red-50 text-red-600' },
    { id: 2, name: 'الأشعة والسونار', icon: <Bone className="w-8 h-8" />, color: 'bg-blue-50 text-blue-600' },
    { id: 3, name: 'الفحص الشامل', icon: <ClipboardList className="w-8 h-8" />, color: 'bg-emerald-50 text-emerald-600' },
    { id: 4, name: 'التحاليل الوراثية', icon: <Dna className="w-8 h-8" />, color: 'bg-purple-50 text-purple-600' },
    { id: 5, name: 'مسحات كورونا', icon: <Microscope className="w-8 h-8" />, color: 'bg-amber-50 text-amber-600' },
  ];

  // بيانات المختبرات مع مميزات إضافية
  const labs = [
    { id: 1, name: 'مختبرات الشفاء التخصصية', location: 'بغداد - المنصور', phone: '0771 234 5678', rating: 4.8, icon: <Microscope className="w-10 h-10" />, features: ['خدمة منزلية', 'نتائج فورية'], isOpen: true },
    { id: 2, name: 'مختبر النور للتحاليل', location: 'بغداد - الكرادة', phone: '0780 987 6543', rating: 4.5, icon: <TestTube className="w-10 h-10" />, features: ['مفتوح 24 ساعة', 'يقبل التأمين'], isOpen: true },
    { id: 3, name: 'مختبرات الحياة المتقدمة', location: 'بغداد - زيونة', phone: '0750 111 2222', rating: 4.9, icon: <Dna className="w-10 h-10" />, features: ['أحدث الأجهزة', 'دقة عالية'], isOpen: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-28 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-700 to-purple-500 px-4 pt-14 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <PageBackButton />
        <div className="relative z-10 text-center mt-2">
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">المختبرات والأشعة</h1>
          <p className="text-purple-100 text-sm font-medium">احجز فحوصاتك بسهولة مع أفضل المختبرات</p>
        </div>

        {/* Search Bar */}
        <div className="relative z-10 mt-6 max-w-md mx-auto">
          <div className="relative flex items-center">
            <div className="absolute right-4 text-gray-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="ابحث عن مختبر، تحليل، أو أشعة..." 
              className="w-full bg-white/95 backdrop-blur text-gray-800 rounded-2xl py-3.5 pr-12 pl-12 shadow-md outline-none focus:ring-2 focus:ring-purple-300 transition-all font-medium placeholder:text-gray-400"
            />
            <button className="absolute left-2 p-2 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-8">
        
        {/* Active Appointments (if any) */}
        {activeAppointments.length > 0 && (
          <section className="relative z-20">
            <h2 className="font-bold text-gray-800 mb-3 px-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              مواعيدي القادمة
            </h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-purple-500"></div>
              {activeAppointments.map(appt => (
                <div key={appt.id} className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{appt.testName}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                        <Beaker className="w-4 h-4" /> {appt.labName}
                      </p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                      {appt.status}
                    </span>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 flex items-center gap-3 text-sm font-semibold text-purple-700">
                    <Clock className="w-4 h-4" />
                    {appt.date}
                  </div>
                  <button className="w-full mt-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
                    إدارة الحجز
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories Horizontal Scroll */}
        <section>
          <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
            {categories.map((cat) => (
              <button key={cat.id} className="snap-start flex flex-col items-center gap-3 min-w-[80px]">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-white/50 ${cat.color} transition-transform hover:scale-105 active:scale-95`}>
                  {cat.icon}
                </div>
                <span className="text-xs font-bold text-gray-700 text-center w-full truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Referral Lock Warning - Enhanced Design */}
        <section>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-orange-200/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-white text-orange-500 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-orange-100">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-orange-900 mb-1.5 text-lg">أسعار حصرية عبر الإحالة</h3>
                <p className="text-sm text-orange-800/80 leading-relaxed mb-4 font-medium">
                  احصل على خصومات تصل إلى 40% على كافة التحاليل عند حجز موعد مع طبيب والحصول على إحالة إلكترونية.
                </p>
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => router.push('/doctors')}>
                  احجز طبيباً الآن
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Labs List */}
        <section>
          <div className="flex justify-between items-end mb-5 px-1">
            <h2 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              أفضل المختبرات
            </h2>
            <button className="text-sm font-bold text-purple-600 hover:text-purple-700">عرض الكل</button>
          </div>
          
          <div className="space-y-4">
            {labs.map((lab) => (
              <div key={lab.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center text-purple-600 flex-shrink-0 border border-purple-100/50 group-hover:scale-105 transition-transform">
                      {lab.icon}
                    </div>
                    {lab.isOpen && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border-2 border-white shadow-sm">
                        متاح
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-extrabold text-gray-800 text-base truncate pr-2">{lab.name}</h3>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        {lab.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      <span className="truncate">{lab.location}</span>
                    </div>
                    
                    {/* Tags / Features */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {lab.features.map((feature, idx) => (
                        <span key={idx} className="bg-gray-50 border border-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-md">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                    قائمة الفحوصات
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
      
      {/* CSS for hiding scrollbar but keeping functionality */}
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

