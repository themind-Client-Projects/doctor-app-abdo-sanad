'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { CalendarClock, MapPin, Check, X, Clock, Stethoscope, TestTubes, Building2, Activity, Star } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { formatCurrency, formatDate } from '@/lib/format';
import { APPOINTMENT_TYPE_LABELS, SERVICE_TYPE_LABELS, labelOf } from '@/lib/labels';
import { getBookingStatusConfig } from '@/components/features/patient/booking-status';

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
import { toast } from 'sonner';
import { invalidate } from '@/lib/request-cache';
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
  /** `DoctorProfile.id` on an appointment card; null on an order. */
  doctorId?: string | null;
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
  /** A completed order — the only kind that can be rated. */
  canRate: boolean;
  /** The patient's own rating, if given. */
  rating: number | null;
  /** `AppointmentType` for an appointment, null for an order. */
  appointmentType: string | null;
};

// `availableTimes` removed. It was twelve fixed times with four of them
// marked «غير متاح» for every provider on every day — an availability pattern
// nobody had recorded. Slots now come from the doctor's own DoctorSchedule
// window; see `timeSlots` below.

// ─── Helpers ────────────────────────────────────────────────────────────
/** Shared with the سند home, which now renders the same real bookings. */
const getStatusConfig = getBookingStatusConfig;

/**
 * A card's icon, keyed by what the API actually sends.
 *
 * Both helpers used to switch on 'doctor' | 'lab' | 'physio'. Only the first
 * is ever sent: an order card carries `o.serviceType`, a `ServiceType` enum
 * member — LAB_TEST, PHARMACY_DISPENSE, TAXI and the rest — and 'lab' and
 * 'physio' are members of nothing. So every order card, on both the list chip
 * and the card face, rendered NO icon at all: the switch fell through and
 * returned undefined.
 *
 * Grouped by what the patient is waiting for rather than one icon per member,
 * and a stethoscope as the fallback so an unmapped member degrades to a
 * clinical glyph instead of a hole.
 */
const TYPE_ICON: Record<string, typeof Stethoscope> = {
  // Appointments — `type: "doctor"` is a literal the bookings feed sets.
  doctor: Stethoscope,
  IN_PERSON_CONSULT: Stethoscope,
  ONLINE_CONSULT: Stethoscope,
  // Samples and imaging.
  LAB_TEST: TestTubes,
  HOME_LAB_TEST: TestTubes,
  HOME_BLOOD_DRAW: TestTubes,
  BLOOD_BANK: TestTubes,
  RADIOLOGY: Activity,
  // Someone comes to you, or you are taken somewhere.
  HOME_VISIT: Building2,
  NURSING: Building2,
  PHYSIOTHERAPY: Building2,
  SURGERY: Building2,
  TAXI: MapPin,
  // The pharmacy.
  PHARMACY_DISPENSE: Clock,
  MEDICINE_DELIVERY: Clock,
};

const TYPE_ICON_TONE: Record<string, string> = {
  doctor: 'text-primary',
  IN_PERSON_CONSULT: 'text-primary',
  ONLINE_CONSULT: 'text-primary',
  LAB_TEST: 'text-purple-500',
  HOME_LAB_TEST: 'text-purple-500',
  HOME_BLOOD_DRAW: 'text-purple-500',
  BLOOD_BANK: 'text-purple-500',
  RADIOLOGY: 'text-purple-500',
  HOME_VISIT: 'text-teal-500',
  NURSING: 'text-teal-500',
  PHYSIOTHERAPY: 'text-teal-500',
  SURGERY: 'text-teal-500',
  TAXI: 'text-amber-500',
  PHARMACY_DISPENSE: 'text-emerald-500',
  MEDICINE_DELIVERY: 'text-emerald-500',
};

function getTypeIcon(type: string) {
  const Icon = TYPE_ICON[type] ?? Stethoscope;
  return <Icon className={`w-4 h-4 ${TYPE_ICON_TONE[type] ?? 'text-primary'}`} />;
}

function getTypeCardIcon(type: string) {
  const Icon = TYPE_ICON[type] ?? Stethoscope;
  return <Icon className={`w-6 h-6 ${TYPE_ICON_TONE[type] ?? 'text-primary'}`} />;
}

/**
 * A card's `type` comes from TWO vocabularies, and only one of them is a
 * ServiceType.
 *
 * `/api/v1/me/bookings` sets `type: o.serviceType` for an order but the
 * literal `"doctor"` for an appointment, and `labelOf` returns its key
 * verbatim when it misses — so every doctor-appointment card printed the Latin
 * word "doctor" inside an Arabic chip. This function already existed and
 * already handled it; nothing called it.
 */
function getTypeLabel(type: string, appointmentType?: string | null) {
  // An appointment's real axis is HOW it happens — the chip must separate a
  // video call from a clinic visit.
  if (appointmentType) {
    return labelOf(APPOINTMENT_TYPE_LABELS, appointmentType);
  }
  switch (type) {
    case 'doctor': return 'عيادة';
    case 'lab': return 'مختبر';
    case 'physio': return 'علاج طبيعي';
    default: return labelOf(SERVICE_TYPE_LABELS, type);
  }
}

// `availableDates` removed. It was ten literal dates in MAY 2026; today is
// October, so every one failed the calendar's own `d < today` guard and every
// other day failed `!isDateAvailable(d)` — the result was a calendar in which
// no date in any month could be selected, forwards or backwards, so إعادة
// جدولة could never be completed by anybody.


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

  // The doctor's own working week, for the booking being rescheduled. Replaces
  // the May-2026 literal array: `/api/public/doctors/[id]` already returns
  // `schedules`, one active row per weekday with real start and end times.
  const { data: rescheduleDoctor } = useDashboardData<{
    schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
  }>({
    url: rescheduleTarget?.doctorId ? `/api/public/doctors/${rescheduleTarget.doctorId}` : '',
    enabled: Boolean(rescheduleTarget?.doctorId),
  });

  const scheduleFor = useCallback(
    (d: Date) => rescheduleDoctor?.schedules?.find((r) => r.dayOfWeek === d.getDay()) ?? null,
    [rescheduleDoctor]
  );

  /** Half-hours inside the doctor's real window for the chosen day.
   *
   *  The 30-minute step is a default rather than a client decision, and
   *  already-booked slots are not yet subtracted — but nothing here is
   *  invented, which the previous twelve-slot array was. */
  const timeSlots = useMemo(() => {
    if (!date) return [];
    const row = scheduleFor(date);
    if (!row) return [];
    const [sh, sm] = row.startTime.split(':').map(Number);
    const [eh, em] = row.endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return [];
    const out: string[] = [];
    for (let mins = sh * 60 + sm; mins + 30 <= eh * 60 + em; mins += 30) {
      out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
    }
    return out;
  }, [date, scheduleFor]);

  /** The next 60 days this doctor actually works — drives the calendar. */
  const availableDates = useMemo(() => {
    if (!rescheduleDoctor?.schedules?.length) return [];
    const days: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (scheduleFor(d)) days.push(d);
    }
    return days;
  }, [rescheduleDoctor, scheduleFor]);

  const isDateAvailable = useCallback(
    (d: Date) => scheduleFor(d) !== null,
    [scheduleFor]
  );

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
    /** The feed is capped per source; true when something was left out. */
    truncated: boolean;
  }>({ url: '/api/v1/me/bookings' });

  const bookings = (activeTab === 'upcoming' ? data?.upcoming : data?.past) ?? [];

  // إعادة جدولة, for real. «تأكيد الموعد الجديد» used to call
  // `setDrawerOpen(false)` and nothing else: the drawer closed and the booking
  // kept its original date, with no error and no sign the change was dropped.
  // `PATCH /api/appointments/[id]` already accepts { date, time } and checks
  // the caller is a party to the appointment.
  const { mutate: reschedule, isPending: rescheduling } = useMutation<
    { id: string },
    [string, Date, string]
  >(
    async (id: string, newDate: Date, newTime: string) =>
      apiFetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        // Local components, not toISOString — Baghdad is UTC+3, so slicing a
        // UTC string moves a late-evening choice to the previous day.
        body: JSON.stringify({
          date: `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`,
          time: newTime,
        }),
      }),
    {
      successMessage: 'تم تغيير موعدك',
      onSuccess: () => {
        invalidate('/api/v1/me');
        void refetch();
      },
    }
  );

  const { mutate: cancelBooking, isPending: cancelling } = useMutation<
    { refund?: { refunded: boolean; amount: string | null } | null },
    [string]
  >(
    async (id: string) =>
      apiFetch(`/api/v1/me/bookings/${id}/cancel`, { method: 'POST' }),
    {
      // The endpoint refunds a wallet-paid booking and SAYS SO in its response.
      // The page threw that away, so a patient whose money had just come back
      // was told only «تم إلغاء الحجز» — the refund was invisible.
      successMessage: null,
      onSuccess: (result) => {
        if (result?.refund?.refunded) {
          toast.success('تم إلغاء الحجز واسترجاع المبلغ إلى محفظتك');
        } else {
          toast.success('تم إلغاء الحجز');
        }
        // `/api/v1/me`, not the bookings key. `invalidate` is a PREFIX match,
        // and `refetch()` passes `/api/v1/me/bookings` — which never matches
        // the shorter `/api/v1/me` the header's wallet chip reads. So the chip
        // kept showing the pre-refund balance until a full reload: the money
        // was back and the screen said otherwise.
        invalidate('/api/v1/me');
        void refetch();
      },
    }
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
      {/* The count only once `data` has landed. `?? 0` printed «0 حجوزات
          قادمة» on first paint and again after a failed load — the header sits
          above the body's own error branch, so it told a patient with a visit
          tomorrow they had none while «تعذّر تحميل الحجوزات» showed below. */}
      <FlexibleHeader 
        title="حجوزاتي" 
        subtitle={data ? `${data.upcoming.length} حجوزات قادمة` : undefined} 
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
            القادمة{data ? ` (${data.upcoming.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'past'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            السابقة{data ? ` (${data.past.length})` : ''}
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
                      <span>{getTypeLabel(booking.type, booking.appointmentType)}</span>
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
                    {/* Only an APPOINTMENT can be rescheduled. `Order` has no
                        date and no time column at all, so there is nothing on
                        an order card for a new date to be written to — the
                        drawer would have collected a date and silently
                        discarded it. Orders keep إلغاء, which they support. */}
                    {booking.kind === 'appointment' ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openReschedule(booking)}
                        onKeyDown={(e) => e.key === 'Enter' && openReschedule(booking)}
                        className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary py-3 rounded-xl text-sm font-bold transition-colors text-center cursor-pointer select-none"
                      >
                        إعادة جدولة
                      </div>
                    ) : null}
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
                  <>
                    {booking.kind === 'order' && booking.canRate ? (
                      <RateOrder
                        orderId={booking.id}
                        initial={booking.rating}
                        onRated={() => void refetch()}
                      />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full bg-white border-2 border-primary/20 text-primary hover:bg-primary hover:text-white py-2.5 rounded-xl text-sm font-bold transition-colors text-center cursor-pointer select-none"
                    >
                      حجز مرة أخرى
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* The feed is capped at 50 per source and the server SAYS so — the
              page dropped the flag, so a patient with a longer history saw it
              silently cut, and the tab counters above plateau at the cap. The
              counters are left as they are (they count what is shown); this
              states plainly that there is more. */}
          {!isLoading && !error && data?.truncated ? (
            <p className="py-6 text-center text-xs font-medium leading-relaxed text-gray-500">
              تعرض هذه الصفحة أحدث حجوزاتك فقط — لديك سجل أطول مما هو ظاهر هنا.
            </p>
          ) : null}
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
                  {timeSlots.length === 0 ? (
                    <p className="text-sm text-gray-500">لا توجد أوقات متاحة في هذا اليوم.</p>
                  ) : null}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-sm sm:text-base font-bold border transition-colors ${
                          selectedTime === time
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
                disabled={!date || !selectedTime || rescheduling}
                onClick={async () => {
                  if (!rescheduleTarget || !date || !selectedTime) return;
                  const result = await reschedule(rescheduleTarget.id, date, selectedTime);
                  // Kept open on failure so the error toast is read against
                  // the booking it refers to — same rule as إلغاء.
                  if (result !== undefined) setDrawerOpen(false);
                }}
              >
                {rescheduling ? 'جاري الحفظ...' : 'تأكيد الموعد الجديد'}
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

/* ------------------------------- rating --------------------------------- */

/**
 * تقييم الخدمة — five stars on a completed order.
 *
 * The first thing that writes `PatientFeedback`: the owner's average rating,
 * the reports and the partner performance screens all read it and had nothing
 * to read. One tap saves; tapping a different star later edits it — the server
 * keeps one rating per order, so a second tap never counts twice.
 */
function RateOrder({
  orderId,
  initial,
  onRated,
}: {
  orderId: string;
  initial: number | null;
  onRated: () => void;
}) {
  const [rating, setRating] = useState<number | null>(initial);
  const [hover, setHover] = useState<number | null>(null);

  const { mutate: save, isPending } = useMutation(
    (value: number) =>
      apiFetch(`/api/v1/me/orders/${orderId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating: value }),
      }),
    { successMessage: 'شكراً لتقييمك', onSuccess: onRated }
  );

  const shown = hover ?? rating ?? 0;

  return (
    <div className="mb-3 flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/80 px-3.5 py-2.5">
      <span className="text-xs font-bold text-gray-600">
        {rating ? 'تقييمك' : 'قيّم الخدمة'}
      </span>
      <div className="flex items-center gap-0.5" role="radiogroup" aria-label="التقييم من 1 إلى 5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} من 5`}
            disabled={isPending}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(null)}
            onClick={async () => {
              const previous = rating;
              // Optimistic, and rolled back if the server refuses — a star that
              // stays lit after a failed save would claim a rating that is not there.
              setRating(value);
              const saved = await save(value);
              if (!saved) setRating(previous);
            }}
            className="p-0.5 transition-transform hover:scale-110 disabled:opacity-60"
          >
            <Star
              className={`h-5 w-5 ${value <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
