'use client';

import { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  Syringe, 
  Building2, 
  ClipboardList, 
  Calendar, 
  CheckCircle2, 
  Info,
  Clock
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useLocationStore } from '@/stores/patient/location.store';

interface SurgeryBookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SURGERIES = [
  { id: 1, name: 'عملية ليزك لتصحيح النظر', icon: '👁️', category: 'عيون' },
  { id: 2, name: 'تكميم المعدة (قص المعدة)', icon: '🩺', category: 'جراحة عامة' },
  { id: 3, name: 'تجميل الأنف', icon: '👃', category: 'تجميل' },
  { id: 4, name: 'خلع ضرس العقل الجراحي', icon: '🦷', category: 'أسنان' },
];

const HOSPITALS = [
  { id: 1, name: 'مستشفى النور التخصصي', location: 'حي المنصور', price: '١,٢٠٠,٠٠٠ د.ع', rating: '٤.٨' },
  { id: 2, name: 'مدينة الطب', location: 'باب المعظم', price: '٩٥٠,٠٠٠ د.ع', rating: '٤.٥' },
  { id: 3, name: 'مستشفى السلام الدولي', location: 'حي الكرادة', price: '١,٤٠٠,٠٠٠ د.ع', rating: '٤.٩' },
];

const DATES = [
  { id: 1, day: 'اليوم', date: '١٢ أكتوبر', time: '٠٤:٣٠ م' },
  { id: 2, day: 'غداً', date: '١٣ أكتوبر', time: '١٠:٠٠ ص' },
  { id: 3, day: 'الأربعاء', date: '١٥ أكتوبر', time: '٠١:١٥ م' },
];

export function SurgeryBookingDrawer({ open, onOpenChange }: SurgeryBookingDrawerProps) {
  const { selectedCity } = useLocationStore();
  
  const [step, setStep] = useState(1);
  const [selectedSurgery, setSelectedSurgery] = useState<number | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  const [agreedToPrep, setAgreedToPrep] = useState(false);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const handleNext = () => setStep((s) => Math.min(s + 1, 5));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setSelectedSurgery(null);
      setSelectedHospital(null);
      setAgreedToPrep(false);
      setSelectedDate(null);
    }, 300);
  };

  const currentCity = selectedCity || 'بغداد';

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: 'العملية' },
      { num: 2, label: 'المستشفى' },
      { num: 3, label: 'التحضيرات' },
      { num: 4, label: 'الموعد' },
    ];

    if (step === 5) return null; // Hide in success screen

    return (
      <div className="flex justify-between items-center px-4 mb-6 relative">
        <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
        <div 
          className="absolute top-1/2 right-8 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all duration-300"
          style={{ width: `${((step - 1) / 3) * 100}%` }}
        ></div>
        
        {steps.map((s) => (
          <div key={s.num} className="flex flex-col items-center gap-1.5 bg-gray-50 px-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              step >= s.num ? 'bg-primary text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
            }`}>
              {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] h-[85vh] flex flex-col rounded-t-[2.5rem] bg-gray-50">
        
        {/* Header */}
        <div className="bg-white rounded-t-[2.5rem] px-5 pt-6 pb-4 flex items-center border-b border-gray-100 shrink-0 sticky top-0 z-10 shadow-sm">
          {step > 1 && step < 5 ? (
            <button onClick={handleBack} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-600 hover:bg-gray-100 active:scale-95 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-8"></div>
          )}
          <DrawerTitle className="flex-1 text-center font-extrabold text-lg text-gray-900">
            {step === 1 && 'اختر العملية'}
            {step === 2 && 'اختر المستشفى'}
            {step === 3 && 'تحضيرات هامة'}
            {step === 4 && 'تحديد الموعد'}
            {step === 5 && 'تأكيد الحجز'}
          </DrawerTitle>
          <div className="w-8"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-6">
          {renderStepIndicator()}

          {/* STEP 1: Select Surgery */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-sm font-bold text-gray-600 px-1 mb-2">العمليات الأكثر شيوعاً</p>
              {SURGERIES.map((surgery) => (
                <button
                  key={surgery.id}
                  onClick={() => setSelectedSurgery(surgery.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-[2rem] border transition-all active:scale-[0.98] ${
                    selectedSurgery === surgery.id 
                      ? 'bg-primary/5 border-primary/30 shadow-sm' 
                      : 'bg-white border-gray-100 hover:border-primary/20 shadow-sm'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                    selectedSurgery === surgery.id ? 'bg-primary/10' : 'bg-gray-50'
                  }`}>
                    {surgery.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="font-extrabold text-gray-900 text-sm">{surgery.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{surgery.category}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedSurgery === surgery.id ? 'border-primary bg-primary' : 'border-gray-200'
                  }`}>
                    {selectedSurgery === surgery.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 2: Select Hospital */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-sm font-bold text-gray-600 px-1 mb-2">المستشفيات المتاحة في {currentCity}</p>
              {HOSPITALS.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => setSelectedHospital(hospital.id)}
                  className={`w-full text-right p-4 rounded-[2rem] border transition-all active:scale-[0.98] ${
                    selectedHospital === hospital.id 
                      ? 'bg-primary/5 border-primary/30 shadow-sm' 
                      : 'bg-white border-gray-100 hover:border-primary/20 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedHospital === hospital.id ? 'bg-primary/10 text-primary' : 'bg-blue-50 text-blue-500'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-900 text-[15px]">{hospital.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{hospital.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                      ⭐ {hospital.rating}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">تكلفة العملية التقريبية</span>
                      <span className="text-sm font-extrabold text-primary">{hospital.price}</span>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedHospital === hospital.id ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
                    }`}>
                      {selectedHospital === hospital.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 3: Preparations */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Info className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-blue-900 text-base">تعليمات قبل العملية</h3>
                </div>
                
                <ul className="space-y-3 relative z-10">
                  <li className="flex items-start gap-2.5 text-sm text-gray-700 font-medium leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                    يرجى الصيام عن الأكل والشرب لمدة 8 ساعات قبل الموعد المحدد.
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-gray-700 font-medium leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                    إحضار كافة التحاليل والأشعة السابقة إن وجدت.
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-gray-700 font-medium leading-relaxed">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                    التوقف عن أخذ مميعات الدم قبل 48 ساعة بعد استشارة طبيبك.
                  </li>
                </ul>
              </div>

              <label className="flex items-start gap-3 p-4 bg-white rounded-[2rem] border border-gray-100 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                <div className={`w-6 h-6 mt-0.5 rounded-md flex items-center justify-center border-2 transition-colors ${
                  agreedToPrep ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                }`}>
                  {agreedToPrep && <Check className="w-4 h-4 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={agreedToPrep}
                  onChange={(e) => setAgreedToPrep(e.target.checked)}
                />
                <div className="flex-1">
                  <span className="font-bold text-gray-900 text-sm block mb-0.5">أتعهد بالالتزام بالتعليمات أعلاه</span>
                  <span className="text-xs text-gray-500">موافقتك ضرورية لتأكيد حجز العملية بنجاح.</span>
                </div>
              </label>
            </div>
          )}

          {/* STEP 4: Date Selection */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-sm font-bold text-gray-600 px-1 mb-2">المواعيد المتاحة للزيارة المبدئية</p>
              
              <div className="grid gap-3">
                {DATES.map((date) => (
                  <button
                    key={date.id}
                    onClick={() => setSelectedDate(date.id)}
                    className={`w-full flex justify-between items-center p-4 rounded-[2rem] border transition-all active:scale-[0.98] ${
                      selectedDate === date.id 
                        ? 'bg-primary/5 border-primary/30 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-primary/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${
                        selectedDate === date.id ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-gray-50 text-gray-600'
                      }`}>
                        <span className="text-[10px] font-bold opacity-80">{date.day}</span>
                        <span className="font-extrabold text-sm">{date.date.split(' ')[0]}</span>
                      </div>
                      <div className="text-right">
                        <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" />
                          {date.time}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">الموعد متاح للحجز الفوري</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedDate === date.id ? 'border-primary bg-primary' : 'border-gray-200'
                    }`}>
                      {selectedDate === date.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Success */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500 text-center">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">تم الحجز المبدئي بنجاح!</h2>
              <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-[250px] mb-8">
                تم استلام طلبك للعملية. سيتواصل معك فريق المستشفى قريباً لتأكيد التفاصيل النهائية.
              </p>
              
              <div className="w-full bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-right space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400">رقم الحجز</span>
                  <span className="text-sm font-bold text-gray-900">#SURG-9842</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400">العملية</span>
                  <span className="text-sm font-bold text-gray-900">
                    {SURGERIES.find(s => s.id === selectedSurgery)?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                  <span className="text-xs text-gray-400">المستشفى</span>
                  <span className="text-sm font-bold text-gray-900">
                    {HOSPITALS.find(h => h.id === selectedHospital)?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">الموعد</span>
                  <span className="text-sm font-bold text-gray-900">
                    {DATES.find(d => d.id === selectedDate)?.time} - {DATES.find(d => d.id === selectedDate)?.date}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-white border-t border-gray-100 rounded-b-[2.5rem] sticky bottom-0 z-10 shrink-0">
          {step === 1 && (
            <Button 
              disabled={!selectedSurgery}
              onClick={handleNext}
              className="w-full rounded-2xl py-6 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              متابعة اختيار المستشفى
            </Button>
          )}
          {step === 2 && (
            <Button 
              disabled={!selectedHospital}
              onClick={handleNext}
              className="w-full rounded-2xl py-6 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              متابعة قراءة التحضيرات
            </Button>
          )}
          {step === 3 && (
            <Button 
              disabled={!agreedToPrep}
              onClick={handleNext}
              className="w-full rounded-2xl py-6 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              متابعة تحديد الموعد
            </Button>
          )}
          {step === 4 && (
            <Button 
              disabled={!selectedDate}
              onClick={handleNext}
              className="w-full rounded-2xl py-6 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              تأكيد حجز العملية
            </Button>
          )}
          {step === 5 && (
            <Button 
              onClick={handleClose}
              className="w-full rounded-2xl py-6 text-base font-bold bg-gray-900 hover:bg-gray-800 text-white shadow-lg transition-all active:scale-[0.98]"
            >
              العودة للصفحة الرئيسية
            </Button>
          )}
        </div>

      </DrawerContent>
    </Drawer>
  );
}
