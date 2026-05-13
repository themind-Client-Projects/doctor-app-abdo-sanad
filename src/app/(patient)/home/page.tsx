'use client';

import { Search, MapPin, Wallet, Calendar, Stethoscope, Microscope, Pill, Syringe, Activity } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24">
      {/* Header / Wallet Section */}
      <header className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-[2rem] shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-xl font-bold">أ</span>
            </div>
            <div>
              <p className="text-sm text-primary-foreground/80">مرحباً بك،</p>
              <h1 className="text-lg font-bold">أحمد محمد</h1>
            </div>
          </div>
          <Link href="/wallet" className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-sm hover:bg-white/30 transition-colors active:scale-95">
            <Wallet className="w-4 h-4" />
            <span className="font-semibold text-sm">1,250 د.ع</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-white text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
            placeholder="ابحث عن طبيب، تخصص، مستشفى..."
          />
        </div>
      </header>

      <main className="px-4 mt-6 space-y-8">
        {/* Billboard / Announcements */}
        <section>
          <div className="bg-gradient-to-r from-teal-500 to-emerald-400 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 w-2/3">
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-md mb-2 inline-block">جديد</span>
              <h2 className="text-lg font-bold mb-1">خصم 20% على التحاليل</h2>
              <p className="text-sm text-white/90">احجز الان من خلال التطبيق في مختبرات الشفاء</p>
            </div>
            {/* Decorative circles */}
            <div className="absolute -end-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -end-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          </div>
        </section>

        {/* Categories Carousel (Mocked as grid for now) */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">الأقسام الطبية</h3>
            <span className="text-sm text-primary font-medium cursor-pointer">الكل</span>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 pt-1">
            {[
              { id: 1, name: 'الأطباء', icon: <Stethoscope className="w-8 h-8" />, color: 'bg-blue-100 text-blue-600 shadow-blue-100', href: '/doctors' },
              { id: 2, name: 'المختبرات', icon: <Microscope className="w-8 h-8" />, color: 'bg-purple-100 text-purple-600 shadow-purple-100', href: '/labs' },
              { id: 3, name: 'الصيدليات', icon: <Pill className="w-8 h-8" />, color: 'bg-emerald-100 text-emerald-600 shadow-emerald-100', href: '/pharmacies' },
              { id: 4, name: 'التمريض', icon: <Syringe className="w-8 h-8" />, color: 'bg-rose-100 text-rose-600 shadow-rose-100', href: '/nursing' },
              { id: 5, name: 'أخرى', icon: <Activity className="w-8 h-8" />, color: 'bg-amber-100 text-amber-600 shadow-amber-100', href: '/physiotherapy' },
            ].map((cat) => (
              <Link key={cat.id} href={cat.href} className="flex flex-col items-center gap-3 min-w-[80px] transition-transform active:scale-95 group">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform ${cat.color}`}>
                  {cat.icon}
                </div>
                <span className="text-xs font-bold text-gray-700">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Surgeries Section */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-4">العمليات الجراحية</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-800 mb-1">احجز عمليتك الآن</h4>
              <p className="text-sm text-gray-500">نوفر لك أفضل المستشفيات بأسعار مناسبة</p>
            </div>
            <button className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold">
              التفاصيل
            </button>
          </div>
        </section>

        {/* My Bookings Preview */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">حجوزاتي القادمة</h3>
            <span className="text-sm text-primary font-medium cursor-pointer">عرض الكل</span>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">د. سمير محمود</h4>
                  <p className="text-xs text-gray-500">أخصائي أمراض القلب</p>
                </div>
              </div>
              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-md font-medium">مؤكد</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>غداً، 10:30 صباحاً</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" />
                <span>مستشفى السلام</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
