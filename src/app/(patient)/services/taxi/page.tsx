'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Car, MapPin, ChevronRight, Check, CheckCircle2, Wallet, Navigation, Bus, ChevronDown } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { formatNumber } from '@/lib/format';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { invalidate } from '@/lib/request-cache';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

// TAXI_PACKAGES removed. Three invented fare tiers — «تكسي اقتصادي» 5,000,
// «تكسي مميز (VIP)» 12,000 and «تكسي عائلي» 15,000, each with its own invented
// feature list — while `PriceConfig` holds exactly ONE real TAXI row: 7,500
// (6,000 in سند). The tiers were not a mispriced product; they were a product
// line that does not exist, with no model behind the three names, so no admin
// could change a fare or retire a tier.
//
// The real price now comes from /api/public/prices, which applies the same
// channel precedence `quoteService()` uses when the order is placed.

export default function TaxiServicePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // 1: Form, 2: Packages

  // Form State
  const [tripType, setTripType] = useState<'one-way' | 'return' | 'round-trip'>('one-way');
  const [pickupLocation, setPickupLocation] = useState('');
  const [landmark, setLandmark] = useState('');
  const [destination, setDestination] = useState('');

  const [vehicleType, setVehicleType] = useState<'taxi' | 'bus'>('taxi');
  const [passengerCount, setPassengerCount] = useState<'4' | '7' | 'more'>('4');
  const [subscription, setSubscription] = useState<'none' | 'weekly' | 'monthly'>('none');

  // Booking State
  // The real fare, and whether anyone can actually drive it. A booking is
  // validated against a DRIVER partner that offers TAXI — so if the pool is
  // empty the honest thing is to say so BEFORE the patient fills the form,
  // not after they tap «تأكيد».
  const { data: priceRow } = useDashboardData<{ price: number | null }>({
    url: '/api/public/prices',
    params: { service: 'TAXI', channel: 'DIRECT' },
  });
  const { data: drivers, isLoading: driversLoading } = useDashboardData<{ id: string; name: string; phone: string }[]>({
    url: '/api/public/partners',
    params: { type: 'DRIVER', service: 'TAXI', channel: 'DIRECT', limit: '1' },
  });
  const fare = priceRow?.price ?? null;
  const driver = drivers?.[0] ?? null;
  const taxiAvailable = Boolean(driver);
  // "زر تفعيل الخدمة التمريضية ضمن اجرائات تحديد نوع الرحلة" — part of choosing
  // the trip, not a separate flow, and only offered while the admin has it on.
  const [withNurse, setWithNurse] = useState(false);
  const { isEnabled, valueOf } = useFeatureFlags();
  const nurseEnabled = isEnabled('taxi.nursing_addon');
  // The admin sets the price; the client never invents one.
  const nursePrice = valueOf('taxi.nursing_addon') ?? 0;
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const handleContinueToPackages = () => {
    if (pickupLocation && destination) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('يرجى تحديد موقع الانطلاق والوجهة');
    }
  };

  const { ensureSignedIn } = useAuthGuard();

  // Total = fare + the add-on when it is both switched on AND chosen. Derived,
  // never stored, so switching the flag off cannot leave a charge behind.
  // The real TAXI fare plus the admin-priced add-on. Was the selected tier's
  // invented `priceNum`.
  const total = (fare ?? 0) + (nurseEnabled && withNurse ? nursePrice : 0);

  const handleRequestRide = () => {
    // The next screen takes payment, so the gate belongs here — not after
    // someone has reviewed a fare they cannot actually pay.
    ensureSignedIn(() => setPaymentDrawerOpen(true));
  };

  /** What the server actually recorded. */
  const [outcome, setOutcome] = useState<{
    orderNumber: string;
    total: number | null;
    paid: boolean;
    paymentError: string | null;
  } | null>(null);

  // THE RIDE. `confirmPayment` used to be `setBookingConfirmed(true)` and a
  // 2.5s timer, under a button reading «تأكيد واستقطاع من المحفظة». No order
  // was created, no money moved, and the panel then said «تم تأكيد رحلتك!
  // السائق في طريقه إليك الآن» over a trip number generated with
  // `Math.random()` — a reference that matched nothing and differed every
  // render. A patient could be standing outside waiting for a car nobody had
  // been asked to send.
  const { mutate: confirmPayment, isPending: booking } = useMutation<{
    orderNumber: string;
    totalAmount: number | null;
    paid: boolean;
    paymentError: string | null;
  }>(
    async () => {
      if (!driver) throw new Error('لا يوجد سائق متاح حالياً');
      return apiFetch('/api/v1/me/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: 'TAXI',
          providerId: driver.id,
          source: 'DIRECT',
          payFromWallet: true,
          address: pickupLocation || undefined,
          notes: [
            pickupLocation ? `من: ${pickupLocation}` : null,
            destination ? `إلى: ${destination}` : null,
            nurseEnabled && withNurse ? 'مع مرافقة تمريضية' : null,
          ].filter(Boolean).join(' — ') || undefined,
        }),
      });
    },
    {
      successMessage: null,
      onSuccess: (r) => {
        setOutcome({
          orderNumber: r.orderNumber,
          total: r.totalAmount,
          paid: r.paid,
          paymentError: r.paymentError,
        });
        setBookingConfirmed(true);
        invalidate('/api/v1/me');
      },
      onError: (e) => toast.error(e.message),
    }
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 font-sans">
      <FlexibleHeader
        title="تكسي سند"
        showBackButton={true}
        showWallet={true}
        onBack={() => step === 2 ? setStep(1) : router.back()}
      />

      <main className="flex-1">
        {step === 1 ? (
          <div className="animate-in slide-in-from-right fade-in duration-300">
            {/* Banner */}
            <div className="w-full h-48 relative mb-6">
              <Image src="/ads/real_clinic_banner.png" alt="تكسي إعلان" fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
              <div className="absolute bottom-6 px-6 text-white text-right w-full">
                <h2 className="text-2xl font-extrabold mb-1">مشوارك صار أسهل</h2>
                <p className="text-sm font-medium text-white/80">احجز تكسي بكل أمان وسرعة وبأسعار تناسب الجميع</p>
              </div>
            </div>

            <div className="px-5 space-y-6">

              {/* Vehicle Type */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <label className="block font-bold text-gray-800 mb-4">نوع المركبة</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    {vehicleType === 'taxi' ? <Car className="w-5 h-5 text-primary" /> : <Bus className="w-5 h-5 text-primary" />}
                  </div>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as 'taxi' | 'bus')}
                    className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-12 pl-10 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors appearance-none font-bold"
                  >
                    <option value="taxi">تكسي</option>
                    <option value="bus">باص</option>
                  </select>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Passenger Count (Only for Bus) */}
              {vehicleType === 'bus' && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block font-bold text-gray-800 mb-4">عدد الركاب</label>
                  <div className="relative">
                    <select
                      value={passengerCount}
                      onChange={(e) => setPassengerCount(e.target.value as '4' | '7' | 'more')}
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-4 pl-10 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors appearance-none font-bold"
                    >
                      <option value="4">4 ركاب</option>
                      <option value="7">7 ركاب</option>
                      <option value="more">أكثر من 7 ركاب</option>
                    </select>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* Subscription Type */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <label className="block font-bold text-gray-800 mb-4">نوع الحجز</label>
                <div className="relative">
                  <select
                    value={subscription}
                    onChange={(e) => setSubscription(e.target.value as 'none' | 'weekly' | 'monthly')}
                    className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-4 pl-10 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors appearance-none font-bold"
                  >
                    <option value="none">رحلة عادية</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="monthly">شهري</option>
                  </select>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Trip Type */}
              {subscription === 'none' && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block font-bold text-gray-800 mb-4">اتجاه الرحلة</label>
                  <div className="relative">
                    <select
                      value={tripType}
                      onChange={(e) => setTripType(e.target.value as 'one-way' | 'return' | 'round-trip')}
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-4 pl-10 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors appearance-none font-bold"
                    >
                      <option value="one-way">ذهاب فقط</option>
                      <option value="round-trip">ذهاب وعودة</option>
                      <option value="return">عودة فقط</option>
                    </select>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* Locations */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">من أين ننطلق؟ (الموقع الحالي)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <Navigation className="w-5 h-5 text-primary" />
                    </div>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      placeholder="أدخل موقعك الحالي أو اسم المنطقة"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نقطة دالة (اختياري)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      placeholder="مثال: بالقرب من صيدلية الشفاء"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">إلى أين نتجه؟ (الوجهة)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <MapPin className="w-5 h-5 text-rose-500" />
                    </div>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      placeholder="أدخل نقطة الوصول"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full py-6 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20"
                onClick={handleContinueToPackages}
              >
                متابعة لاختيار الباقة
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 animate-in slide-in-from-left fade-in duration-300">
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">اختر الباقة المناسبة</h2>
            <p className="text-sm text-gray-500 mb-6">لقد حددنا لك أفضل الخيارات بناءً على وجهتك</p>

            <div className="space-y-4">
              {nurseEnabled ? (
                <button
                  type="button"
                  onClick={() => setWithNurse((v) => !v)}
                  aria-pressed={withNurse}
                  className={`w-full mb-4 flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition-colors ${
                    withNurse
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-extrabold text-gray-800">مرافقة ممرض</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      ممرض مختص يرافقك خلال الرحلة — {formatNumber(nursePrice)} د.ع تُضاف إلى الأجرة
                    </span>
                  </span>
                  <span
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      withNurse ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] ${
                        withNurse ? 'start-6' : 'start-1'
                      }`}
                    />
                  </span>
                </button>
              ) : null}

              {/* One fare, because there is one TAXI price. */}
              {!taxiAvailable && !driversLoading ? (
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
                  <Car className="w-9 h-9 text-gray-300 mx-auto mb-3" aria-hidden />
                  <h3 className="font-extrabold text-gray-800 mb-1">خدمة التكسي غير متاحة حالياً</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    لا يوجد سائق مفعّل لهذه الخدمة في الوقت الحالي. جرّب لاحقاً.
                  </p>
                </div>
              ) : (
                <div className="bg-gradient-to-b from-blue-50/50 to-white rounded-3xl p-5 shadow-sm border border-blue-100">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Car className="w-6 h-6" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-gray-900 mb-1">تكسي سند</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        توصيل من وإلى موقعك مع سائق معتمد من المنصة.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="font-extrabold text-gray-900 text-2xl">
                      {/* «—» while the price is unknown: 0 would read as free. */}
                      {fare === null ? '—' : formatNumber(fare)}{' '}
                      <span className="text-xs text-gray-400 font-normal">د.ع</span>
                    </span>
                    <button
                      type="button"
                      disabled={driversLoading || !taxiAvailable}
                      onClick={handleRequestRide}
                      className="text-sm font-bold px-8 py-3 rounded-xl transition-colors shadow-md active:scale-95 bg-primary text-white hover:bg-primary/90 shadow-primary/20 disabled:opacity-40"
                    >
                      طلب الآن
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Wallet Payment Drawer ── */}
      <Drawer open={paymentDrawerOpen} onOpenChange={setPaymentDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full">
            <DrawerHeader className="text-right px-5">
              <DrawerTitle className="text-2xl font-extrabold">تأكيد الطلب والدفع</DrawerTitle>
            </DrawerHeader>

            <div className="px-5 py-2">
              {bookingConfirmed ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <Check className="w-10 h-10 text-emerald-500" />
                  </div>
                  {/* Read back from the order. The reference is the real
                      `orderNumber`, and nothing here claims a driver is
                      moving — dispatch assigns one, and the patient is told
                      that instead of being told it already happened. */}
                  <h3 className="text-xl font-extrabold text-gray-800 mb-2">
                    {outcome?.paid ? 'تم تأكيد طلبك والدفع' : 'تم تسجيل طلبك'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1">سيتم إسناد سائق والتواصل معك لتأكيد الرحلة.</p>
                  {outcome?.total !== null && outcome?.total !== undefined ? (
                    <p className="text-sm text-gray-600 mt-1">
                      المبلغ: <span className="font-extrabold text-primary">{formatNumber(outcome.total)} د.ع</span>
                    </p>
                  ) : null}
                  {outcome?.paymentError ? (
                    <p className="text-xs font-bold text-amber-600 mt-2">
                      تم تسجيل الطلب، لكن الدفع من المحفظة لم يتم: {outcome.paymentError}
                    </p>
                  ) : null}
                  {outcome?.orderNumber ? (
                    <p className="text-[10px] text-gray-400 mt-2 font-mono" dir="ltr">{outcome.orderNumber}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-500">الخدمة</span>
                      <span className="font-bold text-gray-800">تكسي سند</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-500">من</span>
                      <span className="font-bold text-gray-800 text-left line-clamp-1">{pickupLocation}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-500">إلى</span>
                      <span className="font-bold text-gray-800 text-left line-clamp-1">{destination}</span>
                    </div>
                    {nurseEnabled && withNurse ? (
                      <div className="flex justify-between items-center pt-3">
                        <span className="text-sm text-gray-500">مرافقة ممرض</span>
                        <span className="font-bold text-gray-800">+{formatNumber(nursePrice)} د.ع</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-gray-500 font-bold">الإجمالي</span>
                      <span className="font-extrabold text-xl text-primary">{formatNumber(total)} د.ع</span>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-gray-800">الدفع عبر المحفظة</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-right leading-relaxed">
                      سيتم استقطاع مبلغ <span className="font-bold text-gray-800">{formatNumber(total)} د.ع</span> من محفظتك.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!bookingConfirmed && (
              <DrawerFooter className="px-5 pb-8 pt-4">
                <Button
                  className="w-full py-6 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
                  disabled={booking}
                  onClick={() => void confirmPayment()}
                >
                  {booking ? 'جاري التأكيد...' : 'تأكيد واستقطاع من المحفظة'}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full py-6 rounded-xl font-bold mt-2">
                    إلغاء
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
