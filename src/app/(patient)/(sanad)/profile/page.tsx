'use client';

import { Heart, LogOut, ChevronLeft, ShieldQuestion, UserCog, KeyRound, Wallet, ReceiptText, Info, User } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';

interface MenuItem {
  id: number;
  title: string;
  icon: typeof UserCog;
  color: string;
  bg: string;
  href?: string;
}

export default function ProfilePage() {
  const menuItems: MenuItem[] = [
    { id: 1, title: 'تعديل المعلومات', icon: UserCog, color: 'text-gray-700', bg: 'bg-gray-100' },
    { id: 2, title: 'تغيير كلمة المرور', icon: KeyRound, color: 'text-gray-700', bg: 'bg-gray-100' },
    { id: 3, title: 'المحفظة والاشتراكات', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 4, title: 'سجلات المعاملات', icon: ReceiptText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 5, title: 'المفضلات', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100' },
    { id: 6, title: 'مركز المساعدة', icon: ShieldQuestion, color: 'text-green-600', bg: 'bg-green-100', href: 'https://wa.me/1234567890' },
    { id: 7, title: 'حول التطبيق', icon: Info, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

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
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <User className="w-9 h-9 text-primary" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-800">أحمد محمد</h2>
            <p className="text-sm text-gray-500 mb-4 font-medium">+964 770 123 4567</p>
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors active:scale-[0.98]">
              تعديل الحساب
            </button>
          </div>
        </div>
      </div>

      <main className="px-4 mt-6 space-y-6">
        {/* Stats Section */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { value: 12, label: 'حجز مكتمل' },
            { value: 3, label: 'وصفات طبية' },
            { value: 8, label: 'تقارير مختبر' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-3.5 rounded-2xl border border-gray-100 text-center shadow-sm">
              <h4 className="text-2xl font-extrabold text-primary mb-1">{stat.value}</h4>
              <p className="text-[11px] text-gray-500 font-bold">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Menu Section */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="font-bold text-gray-800 text-sm">{item.title}</span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-300" />
                </div>
              );

              return (
                <div key={item.id}>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Logout Button */}
        <button className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mb-8 transition-colors active:scale-[0.98]">
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </main>
    </div>
  );
}
