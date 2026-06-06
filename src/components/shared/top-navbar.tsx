'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Wallet, ChevronRight, CalendarClock, Bell, User } from 'lucide-react';

// Main pages where greeting is shown (bottom nav destinations)
const MAIN_PATHS = ['/', '/sanad', '/bookings', '/notifications', '/profile'];

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isMainPage = MAIN_PATHS.includes(pathname);

  const getHeaderContent = () => {
    switch (pathname) {
      case '/bookings':
        return {
          icon: <Activity className="w-6 h-6" />,
          title: 'حجوزاتي',
          subtitle: '3 حجوزات قادمة',
          reverse: false,
        };
      case '/notifications':
        return {
          icon: <Bell className="w-6 h-6" />,
          title: 'الإشعارات',
          subtitle: 'تنبيهاتك وتحديثاتك',
          reverse: false,
        };
      case '/profile':
        return {
          icon: <User className="w-6 h-6" />,
          title: 'حسابي',
          subtitle: 'إدارة إعداداتك',
          reverse: false,
        };
      case '/':
      case '/sanad':
      default:
        return {
          icon: <Activity className="w-6 h-6" />,
          title: 'أحمد محمد',
          subtitle: 'مرحباً بك،',
          reverse: true,
        };
    }
  };

  const content = getHeaderContent();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <header className="max-w-md mx-auto px-5 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isMainPage ? (
            /* Main pages: show dynamic content */
            <>
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
                {content.icon}
              </div>
              <div>
                {content.reverse ? (
                  <>
                    <p className="text-xs text-gray-500 font-medium">{content.subtitle}</p>
                    <h1 className="text-sm font-bold text-gray-900">{content.title}</h1>
                  </>
                ) : (
                  <>
                    <h1 className="text-base font-bold text-gray-900">{content.title}</h1>
                    <p className="text-xs text-gray-500 font-medium leading-tight">{content.subtitle}</p>
                  </>
                )}
              </div>
            </>
          ) : (
            /* Sub-pages: show back button */
            <button
              onClick={() => router.back()}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-200 transition-colors active:scale-95"
              aria-label="رجوع"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
        <Link href="/wallet" className="flex items-center gap-2 bg-[#eaf6ef] text-[#10b981] px-4 py-1.5 rounded-full transition-transform active:scale-95 shadow-sm border border-[#10b981]/20">
          <span className="font-bold text-base mt-1 whitespace-nowrap">1,250 د.ع</span>
          <Wallet className="w-[22px] h-[22px] stroke-[2.5]" />
        </Link>
      </header>
    </div>
  );
}
