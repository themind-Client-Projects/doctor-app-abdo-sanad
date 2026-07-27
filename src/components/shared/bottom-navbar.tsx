'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Stethoscope, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'الرئيسية', href: '/', icon: Home },
  { name: 'الحجوزات', href: '/bookings', icon: Calendar },
  { name: 'سند', href: '/sanad', icon: Stethoscope },
  { name: 'الإشعارات', href: '/notifications', icon: Bell },
  { name: 'البروفايل', href: '/profile', icon: User },
];

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-100 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.03)]">
      <div className="flex justify-around items-end h-[68px] px-1 pb-1.5 relative">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isSanad = item.name === 'سند';
          const Icon = item.icon;

          if (isSanad) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-end flex-1 pb-1 relative h-full z-10 group"
              >
                <div className="absolute -top-5 flex flex-col items-center justify-center">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300',
                      isActive 
                        ? 'bg-primary text-white shadow-primary/40 scale-105' 
                        : 'bg-primary text-white/95 shadow-primary/20 group-hover:scale-105'
                    )}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] leading-tight transition-colors truncate max-w-[56px] text-center mt-auto pt-[36px]',
                    isActive ? 'text-primary font-bold' : 'text-gray-500 font-medium'
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-end flex-1 pb-1 gap-1 h-full"
            >
              <div
                className={cn(
                  'p-1.5 rounded-xl transition-colors duration-300',
                  isActive
                    ? 'bg-primary/10 text-primary scale-110'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  'text-[10px] leading-tight transition-colors truncate max-w-[56px] text-center mt-auto',
                  isActive ? 'text-primary font-bold' : 'text-gray-500 font-medium'
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
