'use client';

import { useState, useMemo, Suspense } from 'react';
import { 
  Search, Filter, MapPin, Star, Stethoscope, 
  Briefcase, Phone, Share2, Award, ChevronLeft, ShieldCheck, 
  Clock, X, PhoneCall, Copy, Check, Wallet
} from 'lucide-react';
import Image from 'next/image';
import { SPECIALIZATIONS } from '@/lib/constants/specializations';
import { DEMO_DOCTORS } from '@/lib/constants/demo-data';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { FlexibleHeader } from '@/components/shared/flexible-header';
import type { Doctor } from '@/types/patient';
import { useDoctors } from '@/hooks/use-doctors';

const AREAS = [
  { id: 'all', name: 'كل المناطق' },
  { id: 'منصور', name: 'المنصور' },
  { id: 'كرادة', name: 'الكرادة' },
  { id: 'زيونة', name: 'زيونة' },
  { id: 'أعظمية', name: 'الأعظمية' },
  { id: 'جادرية', name: 'الجادرية' },
  { id: 'حارثية', name: 'الحارثية' },
  { id: 'يرموك', name: 'اليرموك' },
];

function DoctorsDirectoryContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedExperience, setSelectedExperience] = useState('all'); // 'all', '10+', '15+'
  
  // Dialog & Drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [copiedDoctorId, setCopiedDoctorId] = useState<string | null>(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const { allDoctors } = useDoctors();

  // Filter doctors list
  const filteredDoctors = useMemo(() => {
    return allDoctors.filter(doctor => {
      // 1. Search Query (name, specialty, clinic, location)
      const matchesSearch = searchQuery === '' || 
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.clinic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 2. Specialty
      const matchesSpecialty = activeSpecialty === 'all' || doctor.specialtyId === activeSpecialty;
      
      // 3. Gender
      const matchesGender = selectedGender === 'all' || doctor.gender === selectedGender;
      
      // 4. Area
      const matchesArea = selectedArea === 'all' || doctor.location.includes(selectedArea);
      
      // 5. Experience
      let matchesExperience = true;
      if (selectedExperience !== 'all') {
        const expYears = parseInt(doctor.experience.replace(/[^0-9]/g, ''), 10) || 0;
        if (selectedExperience === '10+') {
          matchesExperience = expYears >= 10;
        } else if (selectedExperience === '15+') {
          matchesExperience = expYears >= 15;
        }
      }
      
      return matchesSearch && matchesSpecialty && matchesGender && matchesArea && matchesExperience;
    });
  }, [allDoctors, searchQuery, activeSpecialty, selectedGender, selectedArea, selectedExperience]);

  const handleOpenDetails = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setDetailDrawerOpen(true);
  };



  const handleOpenCall = (doctor: Doctor, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDoctor(doctor);
    setCallDialogOpen(true);
  };

  const copyPhoneNumber = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedDoctorId(selectedDoctor?.id || 'copied');
    setTimeout(() => setCopiedDoctorId(null), 2000);
  };

  const resetFilters = () => {
    setSelectedGender('all');
    setSelectedArea('all');
    setSelectedExperience('all');
    setShowFilterDrawer(false);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedGender !== 'all') count++;
    if (selectedArea !== 'all') count++;
    if (selectedExperience !== 'all') count++;
    return count;
  }, [selectedGender, selectedArea, selectedExperience]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans antialiased">
      <FlexibleHeader 
        title="دليل الأطباء" 
        subtitle="ابحث عن أفضل الأطباء والعيادات التخصصية"
        showBackButton 
        isCompact={false}
      />
      <div className="px-5 pt-4 pb-2">
        
        {/* Search & Filter Trigger */}
        <div className="relative max-w-md mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-900 rounded-2xl py-3.5 pr-11 pl-10 border border-gray-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-sm font-medium"
              placeholder="ابحث بالاسم، التخصص، أو اسم العيادة..."
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowFilterDrawer(true)}
            className={`w-12 h-[52px] rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0 active:scale-95 transition-colors relative ${
              activeFiltersCount > 0 ? 'bg-amber-400 text-gray-900 font-extrabold' : 'bg-white text-primary'
            }`}
          >
            <Filter className="w-5 h-5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <main className="mt-6 space-y-6 flex-1">
        {/* Specialties Horizontal Scroll */}
        <section>
          <div className="px-4 flex justify-between items-center mb-3">
            <h2 className="text-base font-bold text-gray-800">التخصصات الطبية</h2>
            <span className="text-xs text-gray-400 font-semibold">اسحب للمشاهدة</span>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 pb-2 snap-x">
            {/* "All" Specialty Card */}
            <button
              onClick={() => setActiveSpecialty('all')}
              className={`min-w-[110px] p-4 rounded-3xl flex flex-col items-center justify-center gap-2 border transition-colors snap-center ${
                activeSpecialty === 'all'
                  ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.03]'
                  : 'bg-white border-gray-100 text-gray-700 hover:border-primary/20 shadow-sm'
              }`}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                activeSpecialty === 'all' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
              }`}>
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold whitespace-nowrap">جميع الأطباء</span>
            </button>

            {/* Specialty Cards */}
            {SPECIALIZATIONS.map((spec) => {
              const IconComponent = spec.icon;
              const isSelected = activeSpecialty === spec.id;
              
              // Count doctors in this specialty
              const docCount = DEMO_DOCTORS[spec.id]?.length || 0;
              if (docCount === 0) return null; // Only show specialties with doctors

              return (
                <button
                  key={spec.id}
                  onClick={() => setActiveSpecialty(spec.id)}
                  className={`min-w-[110px] p-4 rounded-3xl flex flex-col items-center justify-center gap-2 border transition-colors snap-center ${
                    isSelected
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.03]'
                      : 'bg-white border-gray-100 text-gray-700 hover:border-primary/20 shadow-sm'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-white/20 text-white' : spec.color
                  }`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap truncate max-w-[90px]">{spec.name}</span>
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                    {docCount} {docCount > 10 ? 'طبيب' : 'أطباء'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Doctors Directory List */}
        <section className="px-4 pb-8 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-gray-800">الأطباء المدرجين</h2>
            <span className="text-xs text-gray-500 font-medium">{filteredDoctors.length} طبيب</span>
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">لم نجد أي تطابق</h3>
              <p className="text-sm text-gray-500 max-w-[200px] mx-auto">جرب البحث بكلمة مختلفة أو إعادة تعيين الفلاتر.</p>
              {(activeFiltersCount > 0 || searchQuery !== '' || activeSpecialty !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSpecialty('all');
                    resetFilters();
                  }}
                  className="mt-4 text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-xl active:scale-95 transition-transform"
                >
                  إعادة تعيين الكل
                </button>
              )}
            </div>
          ) : (
            filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                onClick={() => handleOpenDetails(doctor)}
                className="bg-white rounded-[2rem] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-colors duration-300 cursor-pointer flex flex-col gap-4 relative overflow-hidden"
              >
                {/* Visual Premium Ribbon */}
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-primary/30 to-transparent" />

                <div className="flex items-start gap-4">
                  {/* Doctor Avatar */}
                  <div className="relative flex-shrink-0">
                    {doctor.image ? (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm relative">
                        <Image 
                          src={doctor.image} 
                          alt={doctor.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-xl text-primary bg-primary/10 border border-primary/20">
                        {doctor.name.replace('د. ', '').split(' ').slice(0, 2).map(w => w[0]).join('') || 'طبيب'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -end-1 w-5 h-5 bg-primary rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>

                  {/* Doctor Primary Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className="font-extrabold text-gray-800 text-base truncate pe-2 flex items-center gap-1.5">
                        {doctor.name}
                      </h3>
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg text-[11px] font-bold flex-shrink-0 border border-amber-100/50">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {doctor.rating}
                      </div>
                    </div>
                    
                    <p className="text-xs text-primary font-bold mb-2.5">{doctor.specialty}</p>
                    
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{doctor.location.split(' - ')[1]}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">خبرة {doctor.experience}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Section & Quick Actions */}
                <div className="flex items-center justify-between pt-3.5 border-t border-gray-50 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-0.5">رسوم العيادة</span>
                    <span className="text-sm font-extrabold text-gray-900">{doctor.price}</span>
                  </div>
                  
                  <div className="flex gap-2 flex-1 justify-end">
                    <button
                      onClick={(e) => handleOpenCall(doctor, e)}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center bg-gray-50/50 active:scale-95 shrink-0"
                      title="اتصال بالعيادة"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* ── Doctor Details Drawer ── */}
      <Drawer open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DrawerContent className="max-h-[92vh] h-[92vh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full bg-white rounded-t-3xl overflow-hidden">
            <DrawerHeader className="text-right px-5 pb-3 pt-6 shrink-0 border-b border-gray-100 flex items-center justify-between">
              <DrawerTitle className="text-xl font-extrabold">بطاقة الطبيب المهنية</DrawerTitle>
              <DrawerClose className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </DrawerClose>
            </DrawerHeader>

            {selectedDoctor && (
              <div className="px-6 py-2 overflow-y-auto flex-1 pb-28">
                {/* Profile Header Row */}
                <div className="flex items-center gap-4 mb-8">
                  {selectedDoctor.image ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-50 border border-gray-200 flex-shrink-0 shadow-sm relative">
                      <Image 
                        src={selectedDoctor.image} 
                        alt={selectedDoctor.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center font-extrabold text-2xl text-primary bg-primary/10 border border-primary/20 flex-shrink-0 shadow-sm">
                      {selectedDoctor.name.replace('د. ', '').split(' ').slice(0, 2).map(w => w[0]).join('')}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-black text-gray-900 mb-1">{selectedDoctor.name}</h3>
                    <p className="text-sm text-primary font-bold mb-2">{selectedDoctor.specialty}</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-gray-900 font-bold">{selectedDoctor.rating}</span>
                      <span>({selectedDoctor.reviewCount} مراجعة)</span>
                    </div>
                  </div>
                </div>

                {/* Info List */}
                <div className="space-y-5">
                  {/* Experience */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="pt-2">
                      <p className="text-sm font-bold text-gray-900 mb-1">خبرة {selectedDoctor.experience}</p>
                      <p className="text-xs text-gray-500 leading-relaxed font-medium">
                        استشاري معتمد، متخصص في تقديم الرعاية الطبية والتشخيص الدقيق.
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 ms-14" />

                  {/* Clinic */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="pt-2">
                      <p className="text-sm font-bold text-gray-900 mb-1">{selectedDoctor.clinic}</p>
                      <p className="text-xs text-gray-500 font-medium">{selectedDoctor.location}</p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 ms-14" />

                  {/* Price */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="flex-1 flex justify-between items-center pt-1 border-b border-transparent">
                      <span className="text-sm font-bold text-gray-900">رسوم الكشفية</span>
                      <span className="text-sm font-extrabold text-primary bg-primary/5 px-3 py-1 rounded-lg">{selectedDoctor.price}</span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 ms-14" />

                  {/* Hours */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 flex justify-between items-center pt-1">
                      <span className="text-sm font-bold text-gray-900">أوقات الدوام</span>
                      <span className="text-sm font-bold text-gray-600">٤:٠٠ م - ٨:٣٠ م</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Sticky Action Bar inside Details Drawer */}
            {selectedDoctor && (
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-5 pt-4 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3">
                  <button
                    onClick={(e) => handleOpenCall(selectedDoctor, e)}
                    className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/95 active:scale-95 transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    اتصال بالعيادة
                  </button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Call Details Dialog ── */}
      <Drawer open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DrawerContent className="h-auto">
          <div className="mx-auto w-full max-w-md p-6 bg-white rounded-t-3xl text-right">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneCall className="w-6 h-6 animate-pulse" />
            </div>
            
            <h3 className="text-lg font-black text-gray-900 text-center mb-1">الاتصال بالعيادة</h3>
            <p className="text-xs text-gray-500 text-center mb-6">يمكنك الاستفسار هاتفياً أو الحجز عبر أرقام العيادة المعتمدة</p>
            
            {selectedDoctor && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="text-left font-mono font-bold text-gray-800 text-lg tracking-wide dir-ltr">
                    {selectedDoctor.phone}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyPhoneNumber(selectedDoctor.phone)}
                      className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-primary/30 active:scale-95 transition-transform"
                      title="نسخ الرقم"
                    >
                      {copiedDoctorId === selectedDoctor.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    
                    <a
                      href={`tel:${selectedDoctor.phone.replace(/\s+/g, '')}`}
                      className="px-4 h-10 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      اتصال مباشر
                    </a>
                  </div>
                </div>
                
                <button
                  onClick={() => setCallDialogOpen(false)}
                  className="w-full py-3.5 border border-gray-200 bg-white rounded-xl text-gray-500 font-bold text-sm hover:bg-gray-50 active:scale-95 transition-colors text-center mt-2 block"
                >
                  إغلاق النافذة
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Filter Drawer ── */}
      <Drawer open={showFilterDrawer} onOpenChange={setShowFilterDrawer}>
        <DrawerContent className="max-h-[80vh]">
          <div className="mx-auto w-full max-w-md p-5 pb-8 bg-white rounded-t-3xl overflow-y-auto">
            <DrawerHeader className="text-right p-0 pb-4 border-b border-gray-100 flex items-center justify-between mb-5">
              <DrawerTitle className="text-lg font-black text-gray-900">تصفية متقدمة للأطباء</DrawerTitle>
              <button onClick={() => setShowFilterDrawer(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </DrawerHeader>

            <div className="space-y-6">
              {/* Filter Area/City */}
              <div>
                <h4 className="text-xs font-black text-gray-800 mb-3">المنطقة الجغرافية</h4>
                <div className="flex flex-wrap gap-2">
                  {AREAS.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => setSelectedArea(area.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        selectedArea === area.id
                          ? 'bg-primary/10 text-primary border-primary font-black shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Gender */}
              <div>
                <h4 className="text-xs font-black text-gray-800 mb-3">جنس الطبيب</h4>
                <div className="flex gap-2">
                  {[
                    { id: 'all', name: 'الكل' },
                    { id: 'male', name: 'طبيب (ذكر)' },
                    { id: 'female', name: 'طبيبة (أنثى)' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGender(g.id as 'all' | 'male' | 'female')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors text-center ${
                        selectedGender === g.id
                          ? 'bg-primary/10 text-primary border-primary font-black shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Experience */}
              <div>
                <h4 className="text-xs font-black text-gray-800 mb-3">الخبرة العملية</h4>
                <div className="flex gap-2">
                  {[
                    { id: 'all', name: 'أي خبرة' },
                    { id: '10+', name: 'أكثر من ١٠ سنوات' },
                    { id: '15+', name: 'أكثر من ١٥ سنة' },
                  ].map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedExperience(e.id)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors text-center ${
                        selectedExperience === e.id
                          ? 'bg-primary/10 text-primary border-primary font-black shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
              <button
                onClick={resetFilters}
                className="flex-1 py-3.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-500 active:scale-95 transition-transform"
              >
                إعادة تعيين
              </button>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="flex-1.5 py-3.5 bg-primary text-white rounded-xl text-xs font-bold active:scale-95 transition-transform text-center"
              >
                تطبيق التصفية
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>


    </div>
  );
}

export default function DoctorsDirectoryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <DoctorsDirectoryContent />
    </Suspense>
  );
}
