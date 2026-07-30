'use client';

import { useCallback } from 'react';
import { Bell, CalendarCheck, Megaphone, Stethoscope, Clock, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { formatRelative } from '@/lib/format';

/**
 * الإشعارات — the signed-in user's real inbox.
 *
 * GLOBAL, not per-storefront: one inbox whether the order came through سند or
 * outside it. Five notifications were hardcoded here, so every account saw the
 * same five and none could ever be marked read.
 *
 * `Notification.type` is a free string written by whichever service raised it
 * (order_update, result_ready, appointment_reminder…), so the icon and colour
 * are resolved HERE rather than sent. Shipping Tailwind classes from the server
 * would break the moment a native client renders the same notification.
 */

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

const PRESENTATION: Record<string, { icon: typeof Bell; color: string }> = {
  order_update: { icon: CalendarCheck, color: 'bg-emerald-100 text-emerald-600' },
  booking: { icon: CalendarCheck, color: 'bg-emerald-100 text-emerald-600' },
  offer: { icon: Megaphone, color: 'bg-amber-100 text-amber-600' },
  promotion: { icon: Megaphone, color: 'bg-amber-100 text-amber-600' },
  appointment_reminder: { icon: Clock, color: 'bg-blue-100 text-blue-600' },
  reminder: { icon: Clock, color: 'bg-blue-100 text-blue-600' },
  result_ready: { icon: Stethoscope, color: 'bg-purple-100 text-purple-600' },
  medical: { icon: Stethoscope, color: 'bg-purple-100 text-purple-600' },
  // Types the staff-side services already emit — mapped so a shared inbox does
  // not quietly render half its rows as an unlabelled grey tick.
  order: { icon: CalendarCheck, color: 'bg-emerald-100 text-emerald-600' },
  appointment: { icon: Clock, color: 'bg-blue-100 text-blue-600' },
  lab: { icon: Stethoscope, color: 'bg-purple-100 text-purple-600' },
  prescription: { icon: Stethoscope, color: 'bg-purple-100 text-purple-600' },
  report: { icon: Megaphone, color: 'bg-amber-100 text-amber-600' },
  critical: { icon: Megaphone, color: 'bg-red-100 text-red-600' },
  wallet: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
};

/** An unrecognised type still renders, rather than crashing on a missing key. */
const FALLBACK = { icon: CheckCircle2, color: 'bg-gray-100 text-gray-600' };

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<{
    items: Notification[];
    unread: number;
  }>({ url: '/api/v1/me/notifications' });

  const notifications = data?.items ?? [];

  const { mutate: markRead } = useMutation(
    async (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    // Silent: the card visibly changes state, so a toast per tap is noise.
    { successMessage: null, onSuccess: () => void refetch() }
  );

  const open = useCallback(
    (notif: Notification) => {
      if (!notif.isRead) void markRead(notif.id);
    },
    [markRead]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="px-5 pt-2 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">الإشعارات</h1>
        {data && data.unread > 0 ? (
          <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
            {data.unread} جديد
          </span>
        ) : null}
      </div>

      <main className="p-4 space-y-3">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-16 h-16 mb-4 text-gray-300 opacity-50" />
            <p className="font-medium">تعذّر تحميل الإشعارات</p>
            <button onClick={() => void refetch()} className="text-sm text-primary font-bold mt-3">
              إعادة المحاولة
            </button>
          </div>
        ) : isLoading ? (
          // An empty list mid-fetch read as "لا توجد إشعارات" — indistinguishable
          // from a genuinely empty inbox.
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-[1.5rem] bg-white border border-gray-100 h-[88px] animate-pulse"
            />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-16 h-16 mb-4 text-gray-300 opacity-50" />
            <p className="font-medium">لا توجد إشعارات جديدة</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const { icon: Icon, color } = PRESENTATION[notif.type] ?? FALLBACK;
            const unread = !notif.isRead;
            return (
              // A real <button>: the card was a div with `cursor-pointer` that
              // did nothing, so it was neither tappable nor reachable by keyboard.
              <button
                key={notif.id}
                type="button"
                onClick={() => open(notif)}
                aria-label={`${notif.title}${unread ? ' — غير مقروء' : ''}`}
                className={`w-full text-start p-4 rounded-[1.5rem] border flex gap-4 transition-colors active:scale-95 cursor-pointer ${
                  unread
                    ? 'bg-white border-primary/20 shadow-sm'
                    : 'bg-gray-50/50 border-gray-100 opacity-80'
                }`}
              >
                <div
                  className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center ${color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3
                      className={`text-sm font-bold truncate pe-2 ${unread ? 'text-gray-900' : 'text-gray-700'}`}
                    >
                      {notif.title}
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400 flex-shrink-0 mt-0.5">
                      {formatRelative(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed line-clamp-2 font-medium">
                    {notif.body}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}
