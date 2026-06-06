'use client';

import { useState, useRef } from 'react';
import { Calendar as CalendarClock, Clock, Check, MapPin, Stethoscope, Wallet, ArrowRight, ShieldCheck, CreditCard } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { DEMO_AVAILABLE_DATES, DEMO_TIME_SLOTS } from '@/lib/constants/demo-data';

interface Doctor {
  id: string;
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
}

export function DoctorBookingDrawer({ doctor, open, onOpenChange }: DoctorBookingDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'select_time' | 'payment' | 'success'>('select_time');
  const [useWallet, setUseWallet] = useState(true);
  
  // Mock wallet balance for demo
  const walletBalance = "150,000";

  
  const timeSectionRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  
  const isDateAvailable = (date: Date) => {
    return DEMO_AVAILABLE_DATES.some(d => 
      d.getDate() === date.getDate() && 
      d.getMonth() === date.getMonth() && 
      d.getFullYear() === date.getFullYear()
    );
  };

  const confirmBooking = () => {
    setStep('success');
    setTimeout(() => {
      onOpenChange(false);
      // Reset state after drawer closes
      setTimeout(() => {
        setStep('select_time');
        setSelectedDate(undefined);
        setSelectedTime(null);
      }, 500);
    }, 2000);
  };

  const handleContinueToPayment = () => {
    if (selectedDate && selectedTime) {
      setStep('payment');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92vh] max-h-[92vh]">
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

          <div className="px-5 py-6 pb-32 overflow-y-auto overscroll-contain hide-scrollbar flex-1 space-y-8 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
            {step === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 animate-bounce shadow-lg shadow-emerald-500/20">
                  <Check className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-800 mb-2">تم الحجز والدفع بنجاح!</h3>
                <p className="text-sm text-gray-500 mb-1">تم تأكيد موعدك مع {doctor?.name}</p>
                <p className="text-xs text-gray-400">سيتم إشعارك قبل الموعد بساعة</p>
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
                      <span className="font-bold text-gray-900">{selectedDate?.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">الوقت</span>
                      <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{selectedTime}</span>
                    </div>
                    {doctor?.price && (
                      <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-gray-600 font-bold">المبلغ المطلوب</span>
                        <span className="text-lg font-black text-primary">{doctor.price}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 text-base">طريقة الدفع</h4>
                  <div className="space-y-3">
                    {/* Wallet Option */}
                    <button 
                      onClick={() => setUseWallet(true)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        useWallet 
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                          : 'border-gray-100 bg-white hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          useWallet ? 'bg-primary text-white shadow-inner' : 'bg-gray-50 text-gray-400'
                        }`}>
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <h5 className={`font-extrabold text-sm ${useWallet ? 'text-primary' : 'text-gray-700'}`}>محفظة سند</h5>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">الرصيد المتاح: <span className="font-bold">{walletBalance} د.ع</span></p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        useWallet ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                      }`}>
                        {useWallet && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>

                    {/* Credit Card Option (Disabled/Visual Only for demo) */}
                    <button 
                      onClick={() => setUseWallet(false)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        !useWallet 
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                          : 'border-gray-100 bg-white hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          !useWallet ? 'bg-primary text-white shadow-inner' : 'bg-gray-50 text-gray-400'
                        }`}>
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <h5 className={`font-extrabold text-sm ${!useWallet ? 'text-primary' : 'text-gray-700'}`}>بطاقة ائتمان</h5>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">فيزا، ماستركارد، زين كاش</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        !useWallet ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                      }`}>
                        {!useWallet && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-medium py-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  مدفوعاتك آمنة ومشفرة بالكامل
                </div>
              </div>
            ) : (
              <>
                {/* Calendar */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                    <CalendarClock className="w-5 h-5 text-primary" />
                    اختر التاريخ
                  </h4>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => {
                        setSelectedDate(d);
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
                      modifiers={{ available: DEMO_AVAILABLE_DATES }}
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
                {selectedDate && (
                  <div ref={timeSectionRef} className="scroll-mt-4 pt-2">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
                      <Clock className="w-5 h-5 text-primary" />
                      الأوقات المتاحة
                    </h4>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {DEMO_TIME_SLOTS.map(({ time, available }) => (
                        <button
                          key={time}
                          disabled={!available}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-sm sm:text-base font-bold border transition-all ${
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
                {selectedDate && selectedTime && doctor && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-primary">ملخص الحجز</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Stethoscope className="w-4 h-4 text-primary" />
                      <span>{doctor.name} — {doctor.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CalendarClock className="w-4 h-4 text-primary" />
                      <span>{selectedDate.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
                        <span className="font-extrabold text-primary">{doctor.price}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {step !== 'success' && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-5 pt-4 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <DrawerFooter className="p-0 flex flex-col gap-3">
                {step === 'select_time' ? (
                  <Button
                    className="w-full rounded-xl py-6 font-bold text-base shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]"
                    disabled={!selectedDate || !selectedTime}
                    onClick={handleContinueToPayment}
                  >
                    متابعة للدفع
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-xl py-6 font-bold text-base shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]"
                    onClick={confirmBooking}
                  >
                    {useWallet ? 'تأكيد الدفع من المحفظة' : 'المتابعة للبطاقة الائتمانية'}
                  </Button>
                )}
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full rounded-xl py-6 font-bold text-gray-600 hover:bg-gray-50">
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
