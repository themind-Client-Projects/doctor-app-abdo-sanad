'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Calendar as CalendarClock, Clock, Check, MapPin, Stethoscope, Wallet, ArrowRight } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { Button } from '@/components/ui/button';
import { LOCALE, formatCurrency } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { invalidate } from "@/lib/request-cache";
import type { Channel } from "@/hooks/use-storefront";
import { toast } from "sonner";

interface Doctor {
  /** `DoctorProfile.id` — what `Appointment.doctorId` references. */
  id: string;
  /** `Partner.id` — what the booking endpoint prices against. */
  partnerId?: string | null;
  name: string;
  specialty: string;
  clinic?: string;
  location?: string;
  price?: string;
}

interface DoctorBookingDrawerProps {
  doctor: Doctor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Which storefront this was opened from. It decides the price the server
   * quotes, so a سند booking posted as DIRECT is charged the public rate.
   */
  channel?: Channel;
  /** IN_PERSON_CONSULT for a clinic visit, ONLINE_CONSULT for a call. */
  serviceType?: 'IN_PERSON_CONSULT' | 'ONLINE_CONSULT';
}

export function DoctorBookingDrawer({
  doctor,
  open,
  onOpenChange,
  channel = 'DIRECT',
  serviceType = 'IN_PERSON_CONSULT',
}: DoctorBookingDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'select_time' | 'payment' | 'success'>('select_time');
  // Both are admin-controlled and OFF until switched on.
  //   الحجز الإلكتروني — the patient completes the booking in-app.
  //   الاستقطاع الإلكتروني — the fee comes out of the wallet on confirm.
  // Suspended, the drawer still takes the request but says an employee
  // will call to confirm, which is what happens today anyway.
  const { isEnabled } = useFeatureFlags();
  const eBooking = isEnabled('booking.electronic_booking');
  const eDeduction = isEnabled('booking.electronic_deduction');
  const [useWallet, setUseWallet] = useState(true);

  // The patient's REAL balance, from GET /api/v1/me/wallet via `useMe()`.
  //
  // This was `const walletBalance = "150,000"` — a constant, rendered as
  // «الرصيد المتاح: 150,000 د.ع» directly above the confirm button, to every
  // patient, whatever they actually held. The owner caught it against a real
  // account holding 45,000.
  //
  // `balance` is null for a visitor and while the request is in flight, which
  // the render below distinguishes from a real zero — telling someone they
  // have 0 د.ع when we simply do not know yet is the same kind of lie.
  const { balance } = useMe();

  const timeSectionRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const today = new Date();

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('select_time');
        setSelectedDate(undefined);
        setSelectedTime(null);
        setUseWallet(true);
        setOutcome(null);
      }, 300);
      timersRef.current.push(t);
    }
  }, [open]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  const upcomingDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // THE DOCTOR'S REAL WORKING WEEK.
  //
  // This was `DEMO_AVAILABLE_DATES` — an invented set of dates — and every
  // date card advertised «من 9:00 ص إلى 9:00 م», a working day nobody
  // entered. `DoctorSchedule` has held the real thing all along: one row per
  // weekday with `startTime`/`endTime`, 75 rows across 15 doctors, and
  // `/api/public/doctors/[id]` already returns them.
  //
  // Fetched only while the drawer is open, keyed by doctor.
  const { data: profile } = useDashboardData<{
    schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
  }>({
    url: doctor ? `/api/public/doctors/${doctor.id}` : '',
    params: { channel, service: serviceType },
    enabled: open && Boolean(doctor),
  });

  /** The doctor's row for a weekday, or null if they do not work that day. */
  const scheduleFor = useCallback(
    (date: Date) => profile?.schedules?.find((r) => r.dayOfWeek === date.getDay()) ?? null,
    [profile]
  );

  // Until the schedule has loaded nothing is offered as bookable — guessing
  // and then retracting is worse than waiting.
  const isDateAvailable = useCallback(
    (date: Date) => scheduleFor(date) !== null,
    [scheduleFor]
  );

  /** "09:00"–"17:00" → selectable half-hours inside the doctor's own window.
   *
   *  The old grid was twelve fixed times with four of them marked «غير متاح»
   *  for every doctor on every day — an availability pattern nobody had
   *  recorded. These come from the doctor's real start and end time.
   *
   *  NOTE: the 30-minute step is a default, not something the client has
   *  chosen, and booked slots are NOT yet subtracted — `Appointment` rows for
   *  that doctor and day would have to be excluded for this to mean "free".
   *  It no longer invents unavailability, which is the part that was false. */
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const row = scheduleFor(selectedDate);
    if (!row) return [];
    const [sh, sm] = row.startTime.split(':').map(Number);
    const [eh, em] = row.endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return [];
    const out: string[] = [];
    for (let mins = sh * 60 + sm; mins + 30 <= eh * 60 + em; mins += 30) {
      out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
    }
    return out;
  }, [selectedDate, scheduleFor]);

  /** What the server actually recorded, rendered on the success step. */
  const [outcome, setOutcome] = useState<{
    reference: string | null;
    total: number | null;
    paid: boolean;
    paymentError: string | null;
    pricingError: string | null;
  } | null>(null);

  // ───────────────────────────────────────────────────────────────────────
  // THE BOOKING. This used to be `setStep('success')` and a 2s timer — the
  // whole of it. No request was made from this file at all (there was no
  // `fetch`, `apiFetch` or `useMutation` in it), and the success panel then
  // told the patient «تم الحجز والدفع بنجاح!» and «سيتم إشعارك قبل الموعد
  // بساعة». No order, no appointment, no wallet movement, nothing in
  // حجوزاتي. The drawer is mounted on five patient surfaces, so this was
  // every booking path the app has.
  //
  // Two real writes exist and they carry different things:
  //
  //   POST /api/appointments      — `Appointment`, which HAS `date` and
  //                                 `time`; keyed by `DoctorProfile.id`,
  //                                 patients may book for themselves, and
  //                                 price is deliberately server-side only.
  //   POST /api/v1/me/bookings    — an `Order`, priced by `priceOrder` and
  //                                 settled by `payOrderFromWallet`; keyed by
  //                                 `Partner.id`, and it has NO date column.
  //
  // So the flag decides the endpoint, because the flag decides what is being
  // promised. With الاستقطاع الإلكتروني off — which is its state in this
  // database — confirm records the appointment at the chosen date and time
  // and no money moves, which is exactly what the button says. With it on,
  // the button promises a deduction, so the priced order is what must be
  // created; the chosen time rides in `notes`, the only field that route has
  // for it.
  //
  // Exactly ONE row either way: `GET /api/v1/me/bookings` merges appointments
  // and orders into one feed, so writing both would list one visit twice.
  const { mutate: confirmBooking, isPending: confirming } = useMutation(
    async () => {
      if (!doctor || !selectedDate || !selectedTime) {
        throw new Error('اختر اليوم والوقت أولاً');
      }

      if (eDeduction) {
        if (!doctor.partnerId) {
          // Refusing beats posting a `DoctorProfile.id` as a `Partner.id`:
          // the route would answer «مقدم الخدمة غير موجود» and the real cause
          // would be invisible.
          throw new Error('تعذّر تحديد عيادة هذا الطبيب — لا يمكن إتمام الدفع');
        }
        return apiFetch<{
          orderNumber: string;
          totalAmount: number | null;
          paid: boolean;
          pricingError: string | null;
          paymentError: string | null;
        }>('/api/v1/me/bookings', {
          method: 'POST',
          body: JSON.stringify({
            serviceType,
            providerId: doctor.partnerId,
            source: channel,
            payFromWallet: useWallet,
            // Local components, not `toISOString().slice(0,10)`: Baghdad is
            // UTC+3, so a booking confirmed between midnight and 03:00 shifted
            // the requested date one day EARLIER in the note dispatch reads.
            notes: `موعد مطلوب: ${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')} ${selectedTime}`,
          }),
        }).then((r) => ({
          reference: r.orderNumber,
          total: r.totalAmount,
          paid: r.paid,
          paymentError: r.paymentError,
          pricingError: r.pricingError,
        }));
      }

      const appointment = await apiFetch<{ id: string }>('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          // 'ONLINE', not 'TELECONSULTATION'. `AppointmentType` is
          // IN_PERSON | ONLINE | HOME_VISIT | SURGERY (prisma/schema.prisma),
          // so the old value was a member of nothing and `appointmentType`
          // rejected it — every مكالمة أطباء booking 400'd on validation.
          type: serviceType === 'ONLINE_CONSULT' ? 'ONLINE' : 'IN_PERSON',
          // `date` is coerced server-side; the time is its own column.
          date: selectedDate.toISOString(),
          time: selectedTime,
        }),
      });
      return {
        reference: appointment.id,
        total: null,
        paid: false,
        paymentError: null,
        pricingError: null,
      };
    },
    {
      successMessage: null,
      onSuccess: (result) => {
        setOutcome(result);
        setStep('success');
        // The header's wallet chip and حجوزاتي both read cached URLs; without
        // this the balance and the list stay as they were before the booking.
        invalidate('/api/v1/me');
        invalidate('/api/v1/me/bookings');
        invalidate('/api/v1/me/wallet');
        invalidate('/api/v1/me/appointments');
      },
      onError: (error) => {
        // The server's own sentence — «أكمل اسمك ورقم هاتفك قبل الحجز»,
        // «الرصيد غير كافٍ», «مقدم الخدمة لا يقدم هذه الخدمة» — not a green
        // check mark.
        toast.error(error.message);
      },
    }
  );


  const handleContinueToPayment = () => {
    if (selectedDate && selectedTime) {
      setStep('payment');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <div className="mx-auto w-full max-w-md flex flex-col h-full bg-white rounded-t-3xl overflow-hidden">
          <DrawerHeader className="text-right px-5 pb-2 pt-6 shrink-0 bg-white z-10 border-b border-gray-50/50 flex items-center justify-between">
            {step === 'payment' && (
              <button onClick={() => setStep('select_time')} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div className={`flex-1 ${step === 'payment' ? 'text-center' : 'text-right'}`}>
              <DrawerTitle className="text-xl font-extrabold mb-1">
                {step === 'success' ? 'تأكيد الحجز' : step === 'payment' ? 'الدفع والتأكيد' : 'حجز موعد جديد'}
              </DrawerTitle>
              {step !== 'success' && doctor && (
                <p className="text-sm text-gray-500 font-medium">مع {doctor.name}</p>
              )}
            </div>
            {step === 'payment' && <div className="w-8" />} {/* Spacer for centering */}
          </DrawerHeader>

          <div className="px-5 py-4 overflow-y-auto overscroll-contain hide-scrollbar flex-1 space-y-6 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
            {step === 'success' ? (
              /* Every line here is read back from the server's response. The
                 panel used to say «تم الحجز والدفع بنجاح!» and «سيتم إشعارك
                 قبل الموعد بساعة» unconditionally — a payment that never
                 happened and a reminder nothing sends. */
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                  <Check className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-800 mb-2">
                  {outcome?.paid ? 'تم الحجز والدفع بنجاح!' : 'تم تسجيل حجزك'}
                </h3>
                <p className="text-sm text-gray-500 mb-1">
                  {doctor?.name ? `مع ${doctor.name}` : ''}
                </p>
                {selectedDate && selectedTime ? (
                  <p className="text-sm font-bold text-gray-700 mb-3">
                    {selectedDate.toLocaleDateString(LOCALE, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {' — '}
                    {selectedTime}
                  </p>
                ) : null}

                {outcome?.total !== null && outcome?.total !== undefined ? (
                  <p className="text-sm text-gray-600 mb-2">
                    المبلغ: <span className="font-extrabold text-primary">{formatCurrency(outcome.total)}</span>
                  </p>
                ) : null}

                {/* Reported, not swallowed — the route returns these precisely
                    so the patient is not shown a confident success. */}
                {outcome?.paymentError ? (
                  <p className="text-xs font-bold text-amber-600 mb-2 leading-relaxed">
                    تم تثبيت الحجز، لكن الدفع من المحفظة لم يتم: {outcome.paymentError}
                  </p>
                ) : null}
                {outcome?.pricingError ? (
                  <p className="text-xs font-bold text-amber-600 mb-2 leading-relaxed">
                    سيتم تحديد المبلغ من قبل الإدارة: {outcome.pricingError}
                  </p>
                ) : null}

                <p className="text-xs text-gray-400 leading-relaxed">
                  {eBooking
                    ? 'يمكنك متابعة الحجز من «حجوزاتي».'
                    : 'سيصلك اتصال من موظف التطبيق لتأكيد الموعد.'}
                </p>
                {outcome?.reference ? (
                  <p className="text-[10px] text-gray-400 mt-2 font-mono" dir="ltr">
                    {outcome.reference}
                  </p>
                ) : null}
              </div>
            ) : step === 'payment' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Booking Summary for Payment */}
                <div className="bg-gradient-to-br from-primary/5 to-white border border-primary/10 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <h4 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
                    <CalendarClock className="w-4 h-4 text-primary" />
                    تفاصيل الموعد
                  </h4>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">الطبيب</span>
                      <span className="font-bold text-gray-900">{doctor?.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">التاريخ</span>
                      <span className="font-bold text-gray-900">{selectedDate?.toLocaleDateString(LOCALE, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">الوقت</span>
                      <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{selectedTime}</span>
                    </div>
                    {doctor?.price && (
                      <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-gray-600 font-bold">المبلغ المطلوب</span>
                        <span className="text-lg font-black text-primary">{formatCurrency(doctor.price)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Methods — only when الاستقطاع الإلكتروني is on.
                    With the flag off nothing is charged on confirm, so a
                    payment-method chooser was a control whose selection was
                    never submitted; `useWallet` only reaches the request on
                    the eDeduction branch. */}
                {eDeduction && (
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 text-base">طريقة الدفع</h4>
                  <div className="space-y-3">
                    {/* Wallet Option */}
                    <button
                      onClick={() => setUseWallet(true)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${useWallet
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                          : 'border-gray-100 bg-white hover:border-primary/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${useWallet ? 'bg-primary text-white shadow-inner' : 'bg-gray-50 text-gray-400'
                          }`}>
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <h5 className={`font-extrabold text-sm ${useWallet ? 'text-primary' : 'text-gray-700'}`}>محفظة سند</h5>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            الرصيد المتاح:{" "}
                            <span className="font-bold">
                              {balance === null ? "—" : formatCurrency(balance)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${useWallet ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                        }`}>
                        {useWallet && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  </div>
                </div>
                )}

                {/* No «مدفوعاتك آمنة ومشفرة بالكامل» badge: on this step no
                    payment is processed at all unless الاستقطاع الإلكتروني is
                    on, and when it is, the movement is an internal wallet
                    debit — there is no card and nothing to encrypt. The
                    sentence reassured the patient about something that was
                    not happening. */}
              </div>
            ) : (
              <>
                {/* Date Selection */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                    اختر ميعاد حجزك
                  </h4>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-1 snap-x">
                    {upcomingDates.map((date, idx) => {
                      const isAvailable = isDateAvailable(date);
                      const isSelected = selectedDate?.toDateString() === date.toDateString();
                      
                      let dayLabel = '';
                      if (idx === 0) dayLabel = 'اليوم';
                      else if (idx === 1) dayLabel = 'غداً';
                      else dayLabel = date.toLocaleDateString(LOCALE, { weekday: 'long', month: 'numeric', day: 'numeric' });

                      return (
                        <div 
                          key={date.toISOString()}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedDate(date);
                              setSelectedTime(null);
                              setTimeout(() => {
                                timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 150);
                            }
                          }}
                          className={`min-w-[110px] p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors snap-center ${
                            isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                          } ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-gray-100 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-full text-center py-1.5 rounded text-sm font-bold ${isSelected ? 'bg-primary text-white' : 'bg-primary text-white'}`}>
                            {dayLabel}
                          </div>
                          
                          {isAvailable ? (
                            <>
                              {/* The doctor's real hours for THAT weekday. */}
                              <span className="text-[10px] text-gray-600 font-bold text-center leading-tight mt-1">
                                من {scheduleFor(date)?.startTime}<br/>إلى {scheduleFor(date)?.endTime}
                              </span>
                              <button className={`mt-2 w-full py-1.5 rounded text-xs font-bold transition-colors ${isSelected ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'bg-primary text-white hover:bg-primary/90'}`}>احجز</button>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-gray-400 font-medium text-center leading-tight mt-1">لا يوجد<br/>موعد متاح</span>
                              <button disabled className="mt-2 w-full py-1.5 rounded text-xs font-bold bg-gray-400 text-white">احجز</button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Available Times */}
                {selectedDate && (
                  <div ref={timeSectionRef} className="scroll-mt-4 pt-2">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                      <Clock className="w-5 h-5 text-primary" />
                      الأوقات المتاحة
                    </h4>
                    {timeSlots.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        لا توجد أوقات متاحة في هذا اليوم.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`py-2.5 px-1.5 rounded-xl text-sm font-bold border transition-colors ${
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
                {selectedDate && selectedTime && doctor && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-primary">ملخص الحجز</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Stethoscope className="w-4 h-4 text-primary" />
                      <span>{doctor.name} — {doctor.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CalendarClock className="w-4 h-4 text-primary" />
                      <span>{selectedDate.toLocaleDateString(LOCALE, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{selectedTime}</span>
                    </div>
                    {(doctor.clinic || doctor.location) && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{doctor.clinic} {doctor.clinic && doctor.location ? '—' : ''} {doctor.location}</span>
                      </div>
                    )}
                    {doctor.price && (
                      <div className="pt-2 border-t border-primary/10 flex justify-between items-center">
                        <span className="text-xs text-gray-500">رسوم الكشف</span>
                        <span className="font-extrabold text-primary">{formatCurrency(doctor.price)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {step === 'success' ? (
            /* The old panel closed itself after 2s. There is something to read
               now — the amount, the reference, any payment problem — so the
               patient closes it. */
            <div className="shrink-0 bg-white border-t border-gray-100 p-4 z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 8px)' }}>
              <Button
                className="w-full rounded-xl py-5 font-bold text-base"
                onClick={() => onOpenChange(false)}
              >
                تم
              </Button>
            </div>
          ) : (
            <div className="shrink-0 bg-white border-t border-gray-100 p-4 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 8px)' }}>
              <DrawerFooter className="p-0 flex flex-col gap-2">
                {step === 'payment' && !eDeduction ? (
                  <p className="text-xs text-gray-500 leading-relaxed text-center pb-1">
                    {eBooking
                      ? 'سيتم تأكيد حجزك مباشرة، والدفع عند الوصول.'
                      : 'سيصلك اتصال من موظف التطبيق لتأكيد الموعد والدفع.'}
                  </p>
                ) : null}
                {step === 'select_time' ? (
                  <Button
                    className="w-full rounded-xl py-5 font-bold text-base shadow-lg shadow-primary/20 transition-colors hover:shadow-primary/30 active:scale-[0.98]"
                    disabled={!selectedDate || !selectedTime}
                    onClick={handleContinueToPayment}
                  >
                    متابعة للدفع
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-xl py-5 font-bold text-base shadow-lg shadow-primary/20 transition-colors hover:shadow-primary/30 active:scale-[0.98]"
                    disabled={confirming}
                    onClick={() => void confirmBooking()}
                  >
                    {/* The label must describe what the button actually does.
                        Promising a wallet deduction while the flag is off would
                        be a lie the next screen contradicts. */}
                    {confirming
                      ? 'جاري التأكيد...'
                      : eDeduction
                        ? 'تأكيد والاستقطاع من المحفظة'
                        : eBooking
                          ? 'تأكيد الحجز'
                          : 'إرسال طلب الحجز'}
                  </Button>
                )}
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full rounded-xl py-5 font-bold text-gray-600 hover:bg-gray-50">
                    إلغاء
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
