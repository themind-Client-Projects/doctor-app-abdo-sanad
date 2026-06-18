'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Car, MapPin, ChevronRight, Check, CheckCircle2, Wallet, Navigation } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

const TAXI_PACKAGES = [
  { 
    id: 1, 
    name: 'تكسي اقتصادي', 
    description: 'سيارات عملية ومريحة لمشاويرك اليومية', 
    price: '5,000', 
    priceNum: 5000,
    theme: 'from-blue-50/50 to-white border-blue-100',
    iconBg: 'bg-blue-100 text-blue-600',
    features: ['تكييف ممتاز', 'سائق محترف', 'وصول سريع'] 
  },
  { 
    id: 2, 
    name: 'تكسي مميز (VIP)', 
    description: 'سيارات فخمة لراحة تامة وخصوصية عالية', 
    price: '12,000', 
    priceNum: 12000,
    theme: 'from-emerald-50/50 to-white border-emerald-200 ring-2 ring-emerald-500/20',
    iconBg: 'bg-emerald-100 text-emerald-600',
    popular: true, 
    features: ['سيارة حديثة', 'واي فاي مجاني', 'مياه معبأة', 'أولوية الحجز'] 
  },
  { 
    id: 3, 
    name: 'تكسي عائلي', 
    description: 'مساحة واسعة تناسب عائلتك وأمتعتك', 
    price: '15,000', 
    priceNum: 15000,
    theme: 'from-purple-50/50 to-white border-purple-100',
    iconBg: 'bg-purple-100 text-purple-600',
    features: ['تتسع لـ 6 أشخاص', 'سعة أمتعة كبيرة', 'تكييف مركزي'] 
  },
];

export default function TaxiServicePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // 1: Form, 2: Packages
  
  // Form State
  const [tripType, setTripType] = useState<'one-way' | 'return' | 'round-trip'>('one-way');
  const [pickupLocation, setPickupLocation] = useState('');
  const [landmark, setLandmark] = useState('');
  const [destination, setDestination] = useState('');

  // Booking State
  const [selectedPackage, setSelectedPackage] = useState<typeof TAXI_PACKAGES[0] | null>(null);
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

  const handleSelectPackage = (pkg: typeof TAXI_PACKAGES[0]) => {
    setSelectedPackage(pkg);
    setPaymentDrawerOpen(true);
  };

  const confirmPayment = () => {
    setBookingConfirmed(true);
    setTimeout(() => {
      setPaymentDrawerOpen(false);
      setBookingConfirmed(false);
      router.push('/'); // Navigate back to home or success page
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
      {/* Header */}
      <header className="bg-white px-4 pt-6 pb-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="w-10"></div>
        <h1 className="text-xl font-bold text-gray-800">تكسي سند</h1>
        <button 
          onClick={() => step === 2 ? setStep(1) : router.back()} 
          className="p-2 -mr-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </header>

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
              {/* Trip Type */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">نوع الرحلة</h3>
                <div className="flex bg-gray-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setTripType('return')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tripType === 'return' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                  >
                    عودة فقط
                  </button>
                  <button
                    onClick={() => setTripType('round-trip')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tripType === 'round-trip' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                  >
                    ذهاب وعودة
                  </button>
                  <button
                    onClick={() => setTripType('one-way')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tripType === 'one-way' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                  >
                    ذهاب فقط
                  </button>
                </div>
              </div>

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
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
                      className="w-full bg-gray-50 text-gray-900 rounded-2xl py-3.5 pr-10 pl-4 border border-gray-100 focus:border-primary/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
              {TAXI_PACKAGES.map((pkg) => (
                <div key={pkg.id} className={`bg-gradient-to-b ${pkg.theme} rounded-3xl p-5 shadow-sm border relative transition-all`}>
                  {pkg.popular && (
                    <div className="absolute top-0 left-5 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                      الأكثر طلباً
                    </div>
                  )}
                  
                  <div className="flex gap-4 mb-4">
                    <div className={`w-14 h-14 ${pkg.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <Car className="w-7 h-7" />
                    </div>
                    <div className="flex-1 text-right pt-1">
                      <h4 className="font-extrabold text-gray-800 text-lg mb-0.5">{pkg.name}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{pkg.description}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/50 rounded-2xl p-4 mb-5">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${pkg.popular ? 'text-emerald-500' : 'text-blue-500'}`} />
                          <span className="text-xs text-gray-700 font-bold">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <span className="font-extrabold text-gray-900 text-2xl">{pkg.price} <span className="text-xs text-gray-400 font-normal">د.ع</span></span>
                    <button 
                      onClick={() => handleSelectPackage(pkg)}
                      className={`text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-md active:scale-95 ${
                        pkg.popular ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
                      }`}
                    >
                      طلب الآن
                    </button>
                  </div>
                </div>
              ))}
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
                  <h3 className="text-xl font-extrabold text-gray-800 mb-2">تم تأكيد رحلتك!</h3>
                  <p className="text-sm text-gray-500 mb-1">السائق في طريقه إليك الآن</p>
                  <p className="text-xs font-bold text-primary mt-2">رقم الرحلة: #TX-{Math.floor(Math.random() * 10000)}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-500">الباقة المختارة</span>
                      <span className="font-bold text-gray-800">{selectedPackage?.name}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-500">من</span>
                      <span className="font-bold text-gray-800 text-left line-clamp-1">{pickupLocation}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-500">إلى</span>
                      <span className="font-bold text-gray-800 text-left line-clamp-1">{destination}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-gray-500 font-bold">الإجمالي</span>
                      <span className="font-extrabold text-xl text-primary">{selectedPackage?.price} د.ع</span>
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
                      سيتم استقطاع مبلغ <span className="font-bold text-gray-800">{selectedPackage?.price} د.ع</span> من محفظة سند الخاصة بك.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!bookingConfirmed && (
              <DrawerFooter className="px-5 pb-8 pt-4">
                <Button 
                  className="w-full py-6 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
                  onClick={confirmPayment}
                >
                  تأكيد واستقطاع من المحفظة
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
