'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, Search, HeartHandshake, AlertCircle } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';

type Role = 'none' | 'need' | 'donate';
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
type City = 'بغداد' | 'البصرة' | 'أربيل' | 'الموصل' | 'النجف' | 'كربلاء';

const CITIES: City[] = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'النجف', 'كربلاء'];
const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─────────────────────────────────────────────────────────────
// بنك الدم — the patient's half, told truthfully.
//
// This screen used to invent three donors with names, distances and a «متاح»
// badge, show them even when none matched the blood type asked for ("to not
// look broken in demo", said the code), offer a «طلب تبرع عاجل» button wired
// to nothing, and then announce «تم تسجيل بياناتك كمتبرع بنجاح … سيتم التواصل
// معك» over a `setTimeout` that saved nothing at all.
//
// There is no donor registry in the product and no patient-reachable endpoint:
// both `/api/blood-bank` verbs are ROLES.OPERATIONS. The staff side of this
// service is fully built; the patient side is not. So the screen still
// explains the service and still collects both intents, and it now says
// plainly that nothing was sent and nobody will call — instead of promising a
// record that does not exist.
//
// What it deliberately does NOT do: build the patient endpoint, or delete the
// service. Both are the owner's call.
// ─────────────────────────────────────────────────────────────

export default function BloodBankPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('none');
  
  // Need Blood State
  const [needCity, setNeedCity] = useState<City>('بغداد');
  const [needBloodType, setNeedBloodType] = useState<BloodType>('O+');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [needNotice, setNeedNotice] = useState(false);

  // Donate Blood State
  const [donateCity, setDonateCity] = useState<City>('بغداد');
  const [donateBloodType, setDonateBloodType] = useState<BloodType>('O+');
  const [donateNotice, setDonateNotice] = useState(false);


  // No sign-in guard on either of these: `useAuthGuard` exists to attribute a
  // WRITE to a patient id, and there is no write here. Forcing a sign-in for an
  // action that cannot happen only adds a second dead end. Restore it in both
  // places on the day a patient endpoint exists.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setNeedNotice(true);
  };

  const handleDonate = (e: React.FormEvent) => {
    e.preventDefault();
    setDonateNotice(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 font-sans">
      <FlexibleHeader 
        title="بنك الدم" 
        showBackButton 
        icon={<Droplet className="w-6 h-6 text-red-600 fill-red-100" />}
      />

      {/* Main Content */}
      <div className="flex-1 px-5 pt-6">
        {role === 'none' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                <HeartHandshake className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">قطرة دم تنقذ حياة</h2>
              <p className="text-gray-500 font-medium">اختر كيف يمكننا مساعدتك اليوم</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => setRole('need')}
                className="w-full bg-white border-2 border-red-100 rounded-3xl p-6 flex flex-col items-center text-center gap-3 transition-colors active:scale-95 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/10"
              >
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                  <Search className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">أحتاج دماً</h3>
                  <p className="text-sm text-gray-500 mt-1">ابحث عن متبرعين مسجلين بالقرب منك</p>
                </div>
              </button>

              <button 
                onClick={() => setRole('donate')}
                className="w-full bg-red-600 text-white rounded-3xl p-6 flex flex-col items-center text-center gap-3 transition-colors active:scale-95 shadow-lg shadow-red-600/20 hover:bg-red-700"
              >
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Droplet className="w-8 h-8 text-white fill-white/20" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">أريد التبرع</h3>
                  <p className="text-sm text-white/80 mt-1">سجل كمتبرع وكن سبباً في إنقاذ حياة</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {role === 'need' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">البحث عن متبرعين</h2>
            
            {!needNotice ? (
              <form onSubmit={handleSearch} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">المدينة</label>
                  <select 
                    value={needCity}
                    onChange={(e) => setNeedCity(e.target.value as City)}
                    className="w-full bg-white border-2 border-gray-100 rounded-xl p-4 text-base font-bold text-gray-900 focus:border-red-500 outline-none transition-colors"
                  >
                    {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">فصيلة الدم المطلوبة</label>
                  <div className="grid grid-cols-4 gap-2 text-ltr" dir="ltr">
                    {BLOOD_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNeedBloodType(type)}
                        className={`py-3 rounded-xl font-black text-lg transition-colors border-2 ${
                          needBloodType === type 
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20' 
                            : 'bg-white text-red-600 border-red-100 hover:border-red-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">مستوى الحالة</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setUrgency('normal')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-colors border-2 ${
                        urgency === 'normal'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-100 text-gray-500'
                      }`}
                    >
                      طبيعية
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgency('urgent')}
                      className={`flex-1 py-3 flex justify-center items-center gap-1 rounded-xl font-bold transition-colors border-2 ${
                        urgency === 'urgent'
                          ? 'bg-red-50 border-red-600 text-red-600'
                          : 'bg-white border-gray-100 text-gray-500'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                      طارئة جداً
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/30 transition-transform active:scale-95 mt-4"
                >
                  البحث عن متبرعين
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Was three invented donors with distances and a «متاح» badge,
                    plus a «طلب تبرع عاجل» button with no handler. There is no
                    donor registry to search and no endpoint to request from, so
                    the screen says that rather than showing people who do not
                    exist. */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <h4 className="font-bold text-amber-900 mb-2">البحث عن المتبرعين غير مفعّل بعد</h4>
                  <p className="text-sm text-amber-800 leading-relaxed font-medium">
                    لا يوجد سجل متبرعين داخل التطبيق حتى الآن. لم يُرسل طلبك ولم تُحفظ أي من بياناتك،
                    ولن يتواصل معك أحد بناءً على هذه الشاشة.
                  </p>
                </div>
                <button
                  onClick={() => setNeedNotice(false)}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  تعديل البحث
                </button>
              </div>
            )}
          </div>
        )}

        {role === 'donate' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {!donateNotice ? (
              <>
                <h2 className="text-xl font-extrabold text-gray-900 mb-2">التسجيل كمتبرع</h2>
                <p className="text-gray-500 text-sm mb-6 font-medium">تبرعك بالدم قد ينقذ حياة إنسان، كن مستعداً للنداء.</p>
                
                <form onSubmit={handleDonate} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">مدينتك الحالية</label>
                    <select 
                      value={donateCity}
                      onChange={(e) => setDonateCity(e.target.value as City)}
                      className="w-full bg-white border-2 border-gray-100 rounded-xl p-4 text-base font-bold text-gray-900 focus:border-red-500 outline-none transition-colors"
                    >
                      {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">فصيلة دمك</label>
                    <div className="grid grid-cols-4 gap-2 text-ltr" dir="ltr">
                      {BLOOD_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDonateBloodType(type)}
                          className={`py-3 rounded-xl font-black text-lg transition-colors border-2 ${
                            donateBloodType === type 
                              ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20' 
                              : 'bg-white text-red-600 border-red-100 hover:border-red-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                    <h4 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      إقرار بالصحة العامة
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      أقر بأنني بصحة جيدة ولا أعاني من أمراض مزمنة أو معدية تمنعني من التبرع بالدم، ومستعد للتبرع في الحالات الطارئة.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/30 transition-transform active:scale-95 mt-2"
                  >
                    تسجيل كمتبرع
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-500">
                {/* Was a green tick over «شكراً لك يا بطل!» and «تم تسجيل
                    بياناتك كمتبرع بنجاح … سيتم التواصل معك», after a
                    `setTimeout` that wrote nothing. The city and blood type
                    were read back to the user, which is what made it read like
                    a stored record — so they are gone too. */}
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="w-12 h-12 text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">التسجيل الإلكتروني غير مفعّل بعد</h3>
                <p className="text-gray-500 font-medium mb-8 max-w-[280px] leading-relaxed">
                  شكراً لرغبتك بالتبرع. لم تُحفظ بياناتك: تسجيل المتبرعين داخل التطبيق غير مفعّل حتى الآن،
                  ولن يتواصل معك أحد بناءً على هذه الشاشة.
                </p>
                <button 
                  onClick={() => router.push('/')}
                  className="bg-gray-100 text-gray-700 font-bold px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  العودة للرئيسية
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
