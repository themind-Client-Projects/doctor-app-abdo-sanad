'use client';

import { Bell, CalendarCheck, Megaphone, Stethoscope, Clock, CheckCircle2 } from 'lucide-react';

const NOTIFICATIONS = [
  {
    id: 1,
    title: 'تم تأكيد حجزك!',
    message: 'تم تأكيد موعدك مع د. سامي العبيدي يوم الخميس الساعة 10:00 صباحاً.',
    time: 'منذ ساعتين',
    type: 'booking',
    icon: CalendarCheck,
    color: 'bg-emerald-100 text-emerald-600',
    unread: true,
  },
  {
    id: 2,
    title: 'عرض خاص لك!',
    message: 'احصل على خصم 20% على تحاليل الدم الشاملة في مختبرات النور. العرض ساري لمدة يومين.',
    time: 'منذ 5 ساعات',
    type: 'offer',
    icon: Megaphone,
    color: 'bg-amber-100 text-amber-600',
    unread: true,
  },
  {
    id: 3,
    title: 'تذكير بالموعد',
    message: 'موعدك القادم في عيادة الأسنان غداً الساعة 4:30 عصراً. نرجو الحضور قبل الموعد بـ 15 دقيقة.',
    time: 'أمس',
    type: 'reminder',
    icon: Clock,
    color: 'bg-blue-100 text-blue-600',
    unread: false,
  },
  {
    id: 4,
    title: 'نتائج التحاليل جاهزة',
    message: 'تم إصدار نتائج الفحوصات المخبرية الخاصة بك. يمكنك الاطلاع عليها من ملفك الطبي.',
    time: 'منذ يومين',
    type: 'medical',
    icon: Stethoscope,
    color: 'bg-purple-100 text-purple-600',
    unread: false,
  },
  {
    id: 5,
    title: 'تحديث الحساب',
    message: 'تم تفعيل التغطية الصحية الشاملة الخاصة بك بنجاح.',
    time: 'منذ أسبوع',
    type: 'system',
    icon: CheckCircle2,
    color: 'bg-gray-100 text-gray-600',
    unread: false,
  },
];

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="px-5 pt-2 pb-2">
        <h1 className="text-xl font-extrabold text-gray-900">الإشعارات</h1>
      </div>

      <main className="p-4 space-y-3">
        {NOTIFICATIONS.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-16 h-16 mb-4 text-gray-300 opacity-50" />
            <p className="font-medium">لا توجد إشعارات جديدة</p>
          </div>
        ) : (
          NOTIFICATIONS.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-4 rounded-[1.5rem] border flex gap-4 transition-all active:scale-95 cursor-pointer ${
                notif.unread ? 'bg-white border-primary/20 shadow-sm' : 'bg-gray-50/50 border-gray-100 opacity-80'
              }`}
            >
              <div className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center ${notif.color}`}>
                <notif.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`text-sm font-bold truncate pe-2 ${notif.unread ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notif.title}
                  </h3>
                  <span className="text-[10px] font-medium text-gray-400 flex-shrink-0 mt-0.5">{notif.time}</span>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed line-clamp-2 font-medium">
                  {notif.message}
                </p>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
