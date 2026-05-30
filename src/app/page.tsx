'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { HomecareReservationForm } from '@/components/forms/homecare-reservation-form';
import { 
  Bell, 
  Search, 
  Stethoscope, 
  PhoneCall, 
  Home as HomeIcon, 
  Syringe, 
  BookOpen, 
  Car, 
  Droplet,
  ChevronLeft,
  Activity,
  CheckCircle2,
  Star
} from 'lucide-react';

export default function RootLandingPage() {
  const [homecareDrawerOpen, setHomecareDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 bg-white shadow-sm flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">مرحباً بك،</p>
            <h1 className="text-sm font-bold text-gray-900">أحمد محمد</h1>
          </div>
        </div>
        <Link href="/notifications" className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </Link>
      </header>

      <main className="px-4 mt-5 space-y-8">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 border border-gray-100 outline-none focus:ring-2 focus:ring-primary/50 shadow-sm text-sm"
            placeholder="ابحث عن أطباء، خدمات، أو باقات..."
          />
        </div>

        {/* Ads Carousel */}
        <section>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-2">
            {[1, 2, 3].map((item) => (
              <div 
                key={item} 
                className="min-w-[85vw] sm:min-w-[300px] h-40 rounded-[2rem] p-6 text-white flex justify-start items-center shadow-md snap-center relative overflow-hidden group"
              >
                <Image src="/ads/real_clinic_banner.png" alt="عيادة" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-l from-emerald-900/80 via-emerald-800/60 to-transparent" />
                
                <div className="relative z-10 flex flex-col justify-center max-w-[80%]">
                  <h3 className="font-extrabold text-2xl mb-1.5 leading-tight drop-shadow-md">إعلانات وتخفيضات</h3>
                  <p className="text-sm text-white/90 leading-relaxed font-medium drop-shadow">تعرف على أحدث العروض والخدمات في مجمعاتنا</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories Grid (7 items) */}
        <section>
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: 1, name: 'حجز اطباء', icon: Stethoscope, color: 'bg-blue-50 text-blue-600', href: '/doctors' },
              { id: 2, name: 'مكالمة اطباء', icon: PhoneCall, color: 'bg-emerald-50 text-emerald-600', href: '#' },
              { id: 3, name: 'رعاية منزلية', icon: HomeIcon, color: 'bg-purple-50 text-purple-600', onClick: () => setHomecareDrawerOpen(true) },
              { id: 4, name: 'خدمة او عملية', icon: Syringe, color: 'bg-rose-50 text-rose-600', href: '#' },
              { id: 5, name: 'دليل اطباء', icon: BookOpen, color: 'bg-amber-50 text-amber-600', href: '#' },
              { id: 6, name: 'تكسي', icon: Car, color: 'bg-indigo-50 text-indigo-600', href: '#' },
              { id: 7, name: 'بنك الدم', icon: Droplet, color: 'bg-red-50 text-red-600', href: '#' },
            ].map((cat) => (
              cat.href ? (
                <Link key={cat.id} href={cat.href} className="flex flex-col items-center gap-2 transition-transform active:scale-95 group">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] flex items-center justify-center shadow-sm ${cat.color} overflow-hidden group-hover:shadow-md transition-all relative`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current`} />
                    <cat.icon className="w-8 h-8 sm:w-10 sm:h-10 relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-700 text-center leading-tight">{cat.name}</span>
                </Link>
              ) : (
                <button key={cat.id} onClick={cat.onClick} className="flex flex-col items-center gap-2 transition-transform active:scale-95 group">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] flex items-center justify-center shadow-sm ${cat.color} overflow-hidden group-hover:shadow-md transition-all relative`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current`} />
                    <cat.icon className="w-8 h-8 sm:w-10 sm:h-10 relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-700 text-center leading-tight">{cat.name}</span>
                </button>
              )
            ))}
          </div>
        </section>

        {/* Sanad Board (Link to /home) */}
        <section>
          <Link href="/home" className="block">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex items-center justify-between group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-xl translate-y-1/3 -translate-x-1/4" />
              
              <div className="relative z-10">
                <h2 className="text-xl font-extrabold mb-1">لوحة سند</h2>
                <p className="text-sm text-gray-300 font-medium">الوصول إلى خدماتك الطبية وإدارة حجوزاتك</p>
              </div>
              
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative z-10 group-hover:bg-white/20 transition-colors">
                <ChevronLeft className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        </section>

        {/* Subscriptions & Packages */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-gray-800">الاشتراكات والباقات</h3>
            <span className="text-xs text-primary font-medium cursor-pointer">عرض الكل</span>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-4">
            {[
              {
                id: 1,
                name: 'الأساسية',
                description: 'رعاية صحية أولية للأفراد',
                price: '15,000',
                icon: <Activity className="w-6 h-6" />,
                theme: 'from-blue-50/50 to-white border-blue-100',
                iconBg: 'bg-blue-100 text-blue-600',
                popular: false,
                features: ['كشفية مجانية شهرياً', 'خصم 10% على التحاليل'],
                btnColor: 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              },
              {
                id: 2,
                name: 'الشاملة',
                description: 'تغطية متكاملة لجميع احتياجاتك',
                price: '25,000',
                icon: <Star className="w-6 h-6" />,
                theme: 'from-emerald-50/50 to-white border-emerald-200 ring-2 ring-emerald-500/20',
                iconBg: 'bg-emerald-100 text-emerald-600',
                popular: true,
                features: ['3 كشفيات مجانية', 'خصم 25% على التحاليل', 'استشارة هاتفية 24/7'],
                btnColor: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
              },
              {
                id: 3,
                name: 'العائلة',
                description: 'رعاية صحية لك ولعائلتك',
                price: '45,000',
                icon: <HomeIcon className="w-6 h-6" />,
                theme: 'from-purple-50/50 to-white border-purple-100',
                iconBg: 'bg-purple-100 text-purple-600',
                popular: false,
                features: ['تغطية لـ 4 أفراد', 'خصم 30% على التحاليل', 'طبيب العائلة المنزلي'],
                btnColor: 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }
            ].map((pkg) => (
              <div key={pkg.id} className={`min-w-[280px] bg-gradient-to-b ${pkg.theme} rounded-[2rem] p-5 shadow-sm border snap-center relative transition-all`}>
                {pkg.popular && (
                  <div className="absolute top-0 left-5 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                    الأكثر طلباً
                  </div>
                )}
                <div className={`w-12 h-12 ${pkg.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                  {pkg.icon}
                </div>
                <h4 className="font-extrabold text-gray-800 text-lg mb-1">{pkg.name}</h4>
                <p className="text-xs text-gray-500 mb-4">{pkg.description}</p>
                
                <div className="space-y-2 mb-5 min-h-[70px]">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100/50">
                  <span className="font-extrabold text-gray-900 text-xl">{pkg.price} <span className="text-[10px] text-gray-400 font-normal">د.ع / شهر</span></span>
                  <button className={`text-xs font-bold px-5 py-2.5 rounded-xl transition-colors ${pkg.btnColor}`}>
                    اشتراك
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Partners */}
        <section className="pb-8">
          <h3 className="text-base font-bold text-gray-800 mb-4">شركاؤنا</h3>
          <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-2">
            {[
              { id: 1, name: 'مستشفى السلام' },
              { id: 2, name: 'مختبرات الأمل' },
              { id: 3, name: 'صيدلية الشفاء' },
              { id: 4, name: 'مركز النور' },
              { id: 5, name: 'عيادات بغداد' },
            ].map((partner) => (
              <div key={partner.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                <div className="w-16 h-16 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm">
                  {/* Placeholder for partner logo */}
                  <Activity className="w-6 h-6 text-gray-300" />
                </div>
                <span className="text-xs font-bold text-gray-600 text-center">{partner.name}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Homecare Reservation Drawer ── */}
      <Drawer open={homecareDrawerOpen} onOpenChange={setHomecareDrawerOpen}>
        <DrawerContent className="max-h-[92vh] h-auto">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-y-auto hide-scrollbar pb-safe">
            <DrawerHeader className="text-right px-5 pt-6 pb-2">
              <DrawerTitle className="text-xl font-extrabold text-gray-900">
                حجز خدمة تمريضية منزلية
              </DrawerTitle>
            </DrawerHeader>
            
            <div className="p-5 pb-8">
              <HomecareReservationForm 
                onSuccess={() => {
                  setTimeout(() => setHomecareDrawerOpen(false), 2000);
                }} 
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
