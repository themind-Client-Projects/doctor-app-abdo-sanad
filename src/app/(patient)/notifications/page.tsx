'use client';

import { Bell, CalendarCheck, Megaphone } from 'lucide-react';

export default function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      type: 'booking',
      title: 'تذكير بموعدك',
      desc: 'لديك موعد غداً الساعة 10:30 صباحاً مع د. سمير محمود.',
      time: 'منذ ساعتين',
      icon: CalendarCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      unread: true
    },
    {
      id: 2,
      type: 'offer',
      title: 'عرض خاص لك!',
      desc: 'احصل على خصم 20% على التحاليل الشاملة في مختبرات الشفاء.',
      time: 'منذ يومين',
      icon: Megaphone,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      unread: false
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24">
      {/* Header */}
      <header className="bg-primary px-4 pt-12 pb-6 rounded-b-[2rem] shadow-sm flex justify-between items-center">
        <div className="w-8"></div> {/* Spacer */}
        <h1 className="text-xl font-bold text-center text-white">الإشعارات</h1>
        <button className="text-white/80 text-sm font-medium hover:text-white">قراءة الكل</button>
      </header>

      <main className="px-4 mt-6 space-y-3">
        {notifications.map((notif) => {
          const Icon = notif.icon;
          return (
            <div key={notif.id} className={`bg-white p-4 rounded-2xl border ${notif.unread ? 'border-primary/30 shadow-md' : 'border-border shadow-sm'} flex gap-4 relative`}>
              {notif.unread && (
                <div className="absolute top-4 start-4 w-2 h-2 rounded-full bg-primary"></div>
              )}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.bg}`}>
                <Icon className={`w-6 h-6 ${notif.color}`} />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm mb-1">{notif.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{notif.desc}</p>
                <span className="text-[10px] text-gray-400">{notif.time}</span>
              </div>
            </div>
          );
        })}
        
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-16 h-16 mb-4 opacity-20" />
            <p>لا توجد إشعارات حالياً</p>
          </div>
        )}
      </main>
    </div>
  );
}
