'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Search, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'الرئيسية', href: '/home', icon: Home },
  { name: 'حجوزاتي', href: '/bookings', icon: Calendar },
  { name: 'بحث', href: '/search', icon: Search },
  { name: 'إشعارات', href: '/sanad-notifications', icon: Bell },
  { name: 'حسابي', href: '/profile', icon: User },
];

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="flex justify-around items-end h-[68px] px-1 pb-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 pt-2 pb-1 gap-0.5"
            >
              <div
                className={cn(
                  'p-1.5 rounded-xl transition-all duration-300',
                  isActive
                    ? 'bg-primary/10 text-primary scale-110'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span
                className={cn(
                  'text-[10px] leading-tight transition-colors truncate max-w-[56px] text-center',
                  isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'
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
