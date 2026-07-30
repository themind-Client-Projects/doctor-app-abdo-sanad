'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import {
  Heart, LogOut, ChevronLeft, ShieldQuestion, UserCog, KeyRound,
  Wallet, ReceiptText, Info, User, Loader2,
} from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useMe } from '@/hooks/use-me';
import { formatNumber } from '@/lib/format';

/**
 * حسابي — the signed-in user's account.
 *
 * Name, phone and the three stat tiles were all literals: "أحمد محمد",
 * "+964 770 123 4567", and 12 / 3 / 8. Every account showed the same person
 * with the same history. The counts now come from `/api/v1/me`, computed rather
 * than stored — a stored total drifts the moment an order is cancelled.
 *
 * The menu had no destinations: seven rows, one `href`, and a logout button with
 * no handler. Rows that lead somewhere now navigate; the ones with no screen
 * behind them are visibly disabled rather than silently inert, because a row
 * that looks tappable and does nothing reads as a broken app.
 */

type MenuItem = {
  id: number;
  title: string;
  icon: typeof UserCog;
  color: string;
  bg: string;
  href?: string;
  external?: boolean;
  /** No screen behind it yet — rendered dimmed and not tappable. */
  soon?: boolean;
};

const MENU: MenuItem[] = [
  { id: 1, title: 'تعديل المعلومات', icon: UserCog, color: 'text-gray-700', bg: 'bg-gray-100', soon: true },
  { id: 2, title: 'تغيير كلمة المرور', icon: KeyRound, color: 'text-gray-700', bg: 'bg-gray-100', soon: true },
  { id: 3, title: 'المحفظة والاشتراكات', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100', href: '/wallet' },
  { id: 4, title: 'سجلات المعاملات', icon: ReceiptText, color: 'text-blue-600', bg: 'bg-blue-100', href: '/wallet' },
  { id: 5, title: 'المفضلات', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100', soon: true },
  { id: 6, title: 'مركز المساعدة', icon: ShieldQuestion, color: 'text-green-600', bg: 'bg-green-100', href: 'https://wa.me/9647701234567', external: true },
  { id: 7, title: 'حول التطبيق', icon: Info, color: 'text-amber-600', bg: 'bg-amber-100', soon: true },
];

export default function ProfilePage() {
  const { user, stats, isSignedIn, isLoading } = useMe();

  const tiles = useMemo(
    () => [
      { value: stats?.completedOrders ?? 0, label: 'حجز مكتمل' },
      { value: stats?.prescriptions ?? 0, label: 'وصفات طبية' },
      { value: stats?.labReports ?? 0, label: 'تقارير مختبر' },
    ],
    [stats]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      <FlexibleHeader
        title="حسابي"
        subtitle="إدارة إعداداتك"
        icon={<User className="w-6 h-6" />}
        showWallet
      />
      {/* Profile Card */}
      <div className="px-5 mt-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-3 overflow-hidden relative">
              {user?.image ? (
                <Image src={user.image} alt={user.name ?? ''} fill unoptimized className="object-cover" />
              ) : (
                <User className="w-9 h-9 text-primary" />
              )}
            </div>
            <h2 className="text-xl font-extrabold text-gray-800">
              {isLoading ? '—' : (user?.name ?? 'زائر')}
            </h2>
            <p className="text-sm text-gray-500 mb-4 font-medium" dir="ltr">
              {user?.phone ?? user?.email ?? (isLoading ? '' : 'لم تسجّل الدخول')}
            </p>
            {isSignedIn ? (
              <button
                disabled
                className="w-full bg-primary/40 text-primary-foreground py-3 rounded-xl text-sm font-bold cursor-not-allowed"
              >
                تعديل الحساب — قريباً
              </button>
            ) : (
              // A visitor got an "تعديل الحساب" button for an account they do
              // not have; the useful action is signing in.
              <Link
                href="/login"
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors active:scale-[0.98] text-center"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="px-4 mt-6 space-y-6">
        {/* Stats Section */}
        <section className="grid grid-cols-3 gap-3">
          {tiles.map((stat) => (
            <div key={stat.label} className="bg-white p-3.5 rounded-2xl border border-gray-100 text-center shadow-sm">
              <h4 className="text-2xl font-extrabold text-primary mb-1">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : formatNumber(stat.value)}
              </h4>
              <p className="text-[11px] text-gray-500 font-bold">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Menu Section */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-2">
            {MENU.map((item) => {
              const Icon = item.icon;
              const content = (
                <div
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition-colors ${
                    item.soon ? 'opacity-45' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="font-bold text-gray-800 text-sm">{item.title}</span>
                    {item.soon ? (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        قريباً
                      </span>
                    ) : null}
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-300" />
                </div>
              );

              if (item.soon) return <div key={item.id}>{content}</div>;
              if (item.external) {
                return (
                  <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                );
              }
              return (
                <Link key={item.id} href={item.href!}>
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Logout — was a button with no handler at all. */}
        {isSignedIn ? (
          <button
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mb-8 transition-colors active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        ) : null}
      </main>
    </div>
  );
}
