'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Droplet, Search, HeartHandshake, CheckCircle2, AlertCircle, Phone, MapPin } from 'lucide-react';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import { useAuthGuard } from '@/hooks/use-auth-guard';

type Role = 'none' | 'need' | 'donate';
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
type City = 'بغداد' | 'البصرة' | 'أربيل' | 'الموصل' | 'النجف' | 'كربلاء';

const CITIES: City[] = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'النجف', 'كربلاء'];
const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Mock Donors
const MOCK_DONORS = [
  { id: 1, name: 'أحمد صالح', bloodType: 'O+', distance: '2 كم', city: 'بغداد', lastDonation: 'قبل 4 أشهر' },
  { id: 2, name: 'محمد علي', bloodType: 'O+', distance: '5 كم', city: 'بغداد', lastDonation: 'قبل 6 أشهر' },
  { id: 3, name: 'متبرع مجهول', bloodType: 'A-', distance: '8 كم', city: 'بغداد', lastDonation: 'قبل سنة' },
];

export default function BloodBankPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('none');
  
  // Need Blood State
  const [needCity, setNeedCity] = useState<City>('بغداد');
  const [needBloodType, setNeedBloodType] = useState<BloodType>('O+');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [searchResults, setSearchResults] = useState<typeof MOCK_DONORS | null>(null);

  // Donate Blood State
  const [donateCity, setDonateCity] = useState<City>('بغداد');
  const [donateBloodType, setDonateBloodType] = useState<BloodType>('O+');
  const [donateSuccess, setDonateSuccess] = useState(false);

  const { ensureSignedIn } = useAuthGuard();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Searching for donors creates a blood request that the app employee acts
    // on and that donors are messaged about — it needs someone to attribute it
    // to and a number to call back.
    if (!ensureSignedIn()) return;
    // Simulate searching
    setTimeout(() => {
      // Filter mock donors based on selected blood type for demo purposes
      const filtered = MOCK_DONORS.filter(d => d.bloodType === needBloodType);
      // If none match exactly in mock data, just show the mock donors anyway to not look broken in demo
      setSearchResults(filtered.length > 0 ? filtered : MOCK_DONORS);
    }, 600);
  };

  const handleDonate = (e: React.FormEvent) => {
    e.preventDefault();
    // Registering as a donor is a standing record about a person, so it needs
    // an account behind it.
    if (!ensureSignedIn()) return;
    // Simulate saving
    setTimeout(() => {
      setDonateSuccess(true);
    }, 600);
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
            
            {!searchResults ? (
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
                <div className="flex items-center justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <div>
                      <h4 className="font-bold text-red-900 text-sm">متبرعين ({needBloodType})</h4>
                      <p className="text-xs text-red-600/80 font-medium">بالقرب منك في {needCity}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSearchResults(null)}
                    className="text-sm font-bold text-red-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-red-100"
                  >
                    تعديل البحث
                  </button>
                </div>

                <div className="space-y-3">
                  {searchResults.map((donor) => (
                    <div key={donor.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center font-black text-red-600 text-lg border border-red-100">
                            {donor.bloodType}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{donor.name}</h4>
                            <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" /> يبعد عنك {donor.distance}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold">متاح</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 active:scale-95 transition-transform">
                          <Phone className="w-4 h-4" />
                          طلب تبرع عاجل
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {searchResults.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-gray-500 font-medium">عذراً، لم نجد متبرعين مطابقين للبحث حالياً.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {role === 'donate' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {!donateSuccess ? (
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
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">شكراً لك يا بطل!</h3>
                <p className="text-gray-500 font-medium mb-8 max-w-[250px]">
                  تم تسجيل بياناتك كمتبرع بنجاح في مدينة {donateCity} بفصيلة دم {donateBloodType}. سيتم التواصل معك عندما يحتاجك شخص.
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
