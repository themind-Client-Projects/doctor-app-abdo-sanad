'use client';

import { useState, useRef, useCallback } from 'react';
import { CalendarClock, MapPin, Check, X, Clock, Stethoscope, TestTubes, Building2, Activity } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { formatCurrency, formatDate } from '@/lib/format';
import { SERVICE_TYPE_LABELS, labelOf } from '@/lib/labels';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * حجوزاتي — real appointments and orders.
 *
 * Both lists were hardcoded, so every account saw the same five bookings and
 * neither إلغاء nor إعادة جدولة did anything. The two kinds are merged
 * server-side (see /api/v1/me/bookings) because "my bookings" is one list to
 * the person reading it.
 */
type BookingCard = {
  id: string;
  kind: 'appointment' | 'order';
  providerName: string;
  subtitle: string;
  date: string;
  time: string | null;
  location: string;
  type: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  price: number | null;
  reference: string;
  source: string | null;
};

const availableTimes = [
  { time: '09:00 ص', available: true },
  { time: '09:30 ص', available: false },
  { time: '10:00 ص', available: true },
  { time: '10:30 ص', available: true },
  { time: '11:00 ص', available: false },
  { time: '11:30 ص', available: true },
  { time: '12:00 م', available: false },
  { time: '01:00 م', available: true },
  { time: '02:00 م', available: true },
  { time: '04:00 م', available: true },
  { time: '04:30 م', available: false },
  { time: '05:30 م', available: true },
];

// ─── Helpers ────────────────────────────────────────────────────────────
function getStatusConfig(status: BookingCard['status']) {
  switch (status) {
    case 'confirmed':
      return { label: 'مؤكد', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: <Check className="w-3 h-3" /> };
    case 'pending':
      return { label: 'بانتظار التأكيد', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: <Clock className="w-3 h-3" /> };
    case 'completed':
      return { label: 'مكتمل', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: <Check className="w-3 h-3" /> };
    case 'cancelled':
      return { label: 'ملغي', bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-100', icon: <X className="w-3 h-3" /> };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'doctor': return <Stethoscope className="w-4 h-4 text-primary" />;
    case 'lab': return <TestTubes className="w-4 h-4 text-purple-500" />;
    case 'physio': return <Building2 className="w-4 h-4 text-teal-500" />;
  }
}

function getTypeCardIcon(type: string) {
  switch (type) {
    case 'doctor': return <Stethoscope className="w-6 h-6 text-primary" />;
    case 'lab': return <TestTubes className="w-6 h-6 text-purple-500" />;
    case 'physio': return <Building2 className="w-6 h-6 text-teal-500" />;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'doctor': return 'عيادة';
    case 'lab': return 'مختبر';
    case 'physio': return 'علاج طبيعي';
  }
}

// Dates that are "available" for rescheduling (mock)
const availableDates = [
  new Date(2026, 4, 13),
  new Date(2026, 4, 14),
  new Date(2026, 4, 15),
  new Date(2026, 4, 18),
  new Date(2026, 4, 19),
  new Date(2026, 4, 20),
  new Date(2026, 4, 21),
  new Date(2026, 4, 25),
  new Date(2026, 4, 26),
  new Date(2026, 4, 27),
];

function isDateAvailable(day: Date) {
  return availableDates.some(
    (d) => d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
  );
}

// ─── Component ──────────────────────────────────────────────────────────
export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Drawer state (controlled)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingCard | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Dialog state (controlled)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingCard | null>(null);
  const timeSectionRef = useRef<HTMLDivElement>(null);

  const openReschedule = (booking: BookingCard) => {
    setRescheduleTarget(booking);
    setDate(undefined);
    setSelectedTime(null);
    setDrawerOpen(true);
  };

  const openCancel = (booking: BookingCard) => {
    setCancelTarget(booking);
    setCancelDialogOpen(true);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, isLoading, error, refetch } = useDashboardData<{
    upcoming: BookingCard[];
    past: BookingCard[];
  }>({ url: '/api/v1/me/bookings' });

  const bookings = (activeTab === 'upcoming' ? data?.upcoming : data?.past) ?? [];

  const { mutate: cancelBooking, isPending: cancelling } = useMutation(
    async (id: string) =>
      apiFetch(`/api/v1/me/bookings/${id}/cancel`, { method: 'POST' }),
    { successMessage: 'تم إلغاء الحجز', onSuccess: () => void refetch() }
  );

  // Confirmed through the existing dialog, then closed on success — the button
  // below used to only close the dialog, so "نعم، إلغاء الحجز" cancelled
  // nothing at all.
  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const result = await cancelBooking(cancelTarget.id);
    // Left open on failure so the error toast is read against the booking it
    // refers to, rather than dismissed along with its context.
    if (result !== undefined) setCancelDialogOpen(false);
  }, [cancelTarget, cancelBooking]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      <FlexibleHeader 
        title="حجوزاتي" 
        subtitle={`${data?.upcoming.length ?? 0} حجوزات قادمة`} 
        icon={<Activity className="w-6 h-6" />} 
        showWallet 
      />
      <main className="px-4 mt-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            القادمة ({data?.upcoming.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'past'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            السابقة ({data?.past.length ?? 0})
          </button>
        </div>

        {/* Booking Cards */}
        <div className="space-y-4">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 rounded-3xl bg-white border border-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-gray-500 font-medium">تعذّر تحميل الحجوزات</p>
              <button onClick={() => void refetch()} className="text-sm text-primary font-bold">
                إعادة المحاولة
              </button>
            </div>
          )}

          {!isLoading && !error && bookings.length === 0 && (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                <CalendarClock className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">لا توجد حجوزات</p>
            </div>
          )}

          {!isLoading && !error && bookings.map((booking) => {
            const statusConfig = getStatusConfig(booking.status);
            const isUpcoming = activeTab === 'upcoming';

            return (
              <div
                key={booking.id}
                className={`bg-white rounded-3xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-gray-100 transition-colors ${
                  !isUpcoming ? 'opacity-80' : ''
                }`}
              >
                {/* Top Row: Doctor Info + Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center border border-primary/10 flex-shrink-0">
                      {getTypeCardIcon(booking.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-gray-800 text-base truncate">{booking.providerName}</h4>
                      <p className="text-sm text-gray-500 font-medium truncate">{booking.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* BELOW the title, not beside it: sharing the row forced the
                    name to truncate — "مختبرات الشفاء التخ…" — and the longer
                    the status label, the more of the provider disappeared. */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} text-[11px] px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1`}>
                    {statusConfig.icon} {statusConfig.label}
                  </span>
                  {booking.source === 'SANAD' ? (
                    <span className="bg-primary/10 text-primary text-[11px] px-2.5 py-1.5 rounded-lg font-bold">
                      عبر سند
                    </span>
                  ) : null}
                </div>

                {/* Details Section */}
                <div className="bg-gray-50/80 p-3.5 rounded-2xl mb-4 border border-gray-100 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
                    <CalendarClock className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{formatDate(booking.date)}{booking.time ? `، ${booking.time}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate">{booking.location || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      {getTypeIcon(booking.type)}
                      <span>{labelOf(SERVICE_TYPE_LABELS, booking.type)}</span>
                      <span className="mx-1 text-gray-300">|</span>
                      <span className="text-gray-400">#{booking.reference}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {booking.price === null ? '—' : formatCurrency(booking.price)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                {isUpcoming ? (
                  <div className="flex gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openReschedule(booking)}
                      onKeyDown={(e) => e.key === 'Enter' && openReschedule(booking)}
                      className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary py-3 rounded-xl text-sm font-bold transition-colors text-center cursor-pointer select-none"
                    >
                      إعادة جدولة
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openCancel(booking)}
                      onKeyDown={(e) => e.key === 'Enter' && openCancel(booking)}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 py-3 rounded-xl text-sm font-bold transition-colors text-center cursor-pointer select-none"
                    >
                      إلغاء الحجز
                    </div>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full bg-white border-2 border-primary/20 text-primary hover:bg-primary hover:text-white py-2.5 rounded-xl text-sm font-bold transition-colors text-center cursor-pointer select-none"
                  >
                    حجز مرة أخرى
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Reschedule Drawer (Controlled) ───────────────────────────────── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="!max-h-[92vh] h-[92vh]">
          <div className="mx-auto w-full flex flex-col h-full">
            <DrawerHeader className="text-right px-5">
              <DrawerTitle className="text-2xl font-extrabold">إعادة جدولة الموعد</DrawerTitle>
              <DrawerDescription>
                {rescheduleTarget && (
                  <span className="block text-right mt-1 text-base">
                    <span className="font-bold text-gray-700">{rescheduleTarget.providerName}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    {rescheduleTarget.subtitle}
                  </span>
                )}
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Calendar */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                  <CalendarClock className="w-5 h-5 text-primary" />
                  اختر التاريخ
                </h4>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setSelectedTime(null);
                      if (d) {
                        setTimeout(() => {
                          timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 150);
                      }
                    }}
                    disabled={(day) => {
                      const d = new Date(day);
                      d.setHours(0, 0, 0, 0);
                      return d < today || !isDateAvailable(d);
                    }}
                    className="rounded-md [--cell-size:40px] !w-full"
                    modifiers={{ available: availableDates }}
                    modifiersClassNames={{
                      available: 'ring-2 ring-primary/20 ring-inset font-bold',
                    }}
                  />
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 px-1 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-primary flex-shrink-0" />
                    <span>التاريخ المختار</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded ring-2 ring-primary/30 bg-white flex-shrink-0" />
                    <span>متاح</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gray-200 flex-shrink-0" />
                    <span>غير متاح</span>
                  </div>
                </div>
              </div>

              {/* Available Times */}
              {date && (
                <div ref={timeSectionRef}>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-primary" />
                    الأوقات المتاحة
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {availableTimes.map(({ time, available }) => (
                      <button
                        key={time}
                        disabled={!available}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-sm sm:text-base font-bold border transition-colors ${
                          !available
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                            : selectedTime === time
                              ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-[1.02]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {date && selectedTime && (
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-primary">ملخص الموعد الجديد</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CalendarClock className="w-4 h-4 text-primary" />
                    <span>{date.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>{selectedTime}</span>
                  </div>
                </div>
              )}
            </div>

            <DrawerFooter>
              <Button
                className="w-full rounded-xl py-6 font-bold text-base"
                disabled={!date || !selectedTime}
                onClick={() => setDrawerOpen(false)}
              >
                تأكيد الموعد الجديد
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl py-6 font-bold">
                  إلغاء
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Cancel Dialog (Controlled) ───────────────────────────────────── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl" showCloseButton={false}>
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold text-gray-800">
              إلغاء الحجز
            </DialogTitle>
            <DialogDescription className="text-center pt-2 text-gray-600">
              هل أنت متأكد من رغبتك في إلغاء حجزك مع{' '}
              <span className="font-bold text-gray-800">{cancelTarget?.providerName}</span>؟
              <br />
              <span className="text-red-500 text-xs font-medium mt-1 block">لا يمكن التراجع عن هذا الإجراء.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center mt-2 border-none bg-transparent">
            <button
              type="button"
              onClick={() => void confirmCancel()}
              disabled={cancelling}
              className="flex-1 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl font-bold py-3.5 text-center cursor-pointer select-none text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cancelling ? 'جاري الإلغاء...' : 'نعم، إلغاء الحجز'}
            </button>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCancelDialogOpen(false)}
              onKeyDown={(e) => e.key === 'Enter' && setCancelDialogOpen(false)}
              className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold py-3.5 text-center cursor-pointer select-none text-sm transition-colors"
            >
              تراجع
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
