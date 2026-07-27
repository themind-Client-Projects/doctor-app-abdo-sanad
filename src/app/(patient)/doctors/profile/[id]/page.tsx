'use client';

import { useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Share2, Heart, Star, Plus, Check } from 'lucide-react';
import { DEMO_DOCTORS } from '@/lib/constants/demo-data';
import { DoctorBookingDrawer } from '@/components/shared/doctor-booking-drawer';

// Mock Services specific for the UI
const MOCK_SERVICES = [
  { id: 1, name: 'جلسة علاج البشرة بالبلازما للوجه' },
  { id: 2, name: 'جلسة بلازما للشعر' },
  { id: 3, name: 'حقن فيلر 1 مل (StylAge L/ XL / الشفاه)' },
  { id: 4, name: 'تقشير بارد لجلسة واحدة' },
  { id: 5, name: 'حقن فيلر 1 مل (Juvederm Voluma/Volift)' },
];

export default function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [activeTab, setActiveTab] = useState<'services' | 'safety'>('services');
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Find doctor
  const doctor = useMemo(() => {
    const allDoctors = Object.values(DEMO_DOCTORS).flat();
    return allDoctors.find(d => d.id === id);
  }, [id]);

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <h1 className="font-bold text-gray-800">لم يتم العثور على الطبيب</h1>
        <button onClick={() => router.back()} className="px-6 py-2 bg-primary text-white rounded-xl">العودة</button>
      </div>
    );
  }

  const toggleService = (serviceId: number) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) ? prev.filter(sId => sId !== serviceId) : [...prev, serviceId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">


      {/* ── Doctor Info ── */}
      <div className="bg-white px-5 py-6 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative w-28 h-28 rounded-[2rem] overflow-hidden bg-[#eaf6ef] border border-[#10b981]/10 flex-shrink-0">
            {doctor.image ? (
              <Image src={doctor.image} alt={doctor.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[#10b981] font-extrabold text-3xl">{doctor.name.charAt(0)}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 text-right">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{doctor.name}</h2>
            <div className="flex items-center justify-start gap-1.5 mb-2 text-[#10b981]">
              <div className="flex text-amber-400 ml-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(doctor.rating) ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <span className="text-xs font-bold">التقييم العام من {doctor.reviewCount} زائر</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">{doctor.specialty}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white flex border-b border-gray-200 px-5">
        <button 
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-4 text-center font-bold text-[15px] transition-colors relative ${
            activeTab === 'services' ? 'text-[#10b981] border-b-[3px] border-[#10b981]' : 'text-gray-500'
          }`}
        >
          الخدمات
        </button>
        <button 
          onClick={() => setActiveTab('safety')}
          className={`flex-1 py-4 text-center font-bold text-[15px] transition-colors ${
            activeTab === 'safety' ? 'text-[#10b981] border-b-[3px] border-[#10b981]' : 'text-gray-500'
          }`}
        >
          السلامة
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white flex-1 flex flex-col">
        {activeTab === 'services' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {MOCK_SERVICES.map((service, idx) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div 
                    key={service.id} 
                    className={`flex items-center justify-between py-5 cursor-pointer group ${
                      idx !== MOCK_SERVICES.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                    onClick={() => toggleService(service.id)}
                  >
                    <span className="font-bold text-gray-800 text-[15px] text-right flex-1 ml-4 leading-relaxed group-hover:text-[#10b981] transition-colors">{service.name}</span>
                    <button 
                      className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected 
                          ? 'bg-[#10b981] text-white shadow-md shadow-[#10b981]/20 scale-105' 
                          : 'bg-[#eaf6ef] text-[#10b981] hover:bg-[#10b981]/20'
                      }`}
                    >
                      {isSelected ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 pb-8 mt-auto space-y-3">
              <button className="w-full bg-[#eaf6ef] text-[#10b981] font-extrabold text-[15px] py-4 rounded-2xl hover:bg-[#10b981]/20 transition-colors">
                عرض المزيد
              </button>
              
              {/* Optional Checkout Action if items are selected */}
              {selectedServices.length > 0 && (
                <button 
                  onClick={() => setIsBookingOpen(true)}
                  className="w-full bg-[#10b981] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#10b981]/30 transition-transform active:scale-95 animate-in slide-in-from-bottom-2 fade-in"
                >
                  تأكيد واختيار موعد ({selectedServices.length} خدمات)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm font-medium">
            لا توجد معلومات سلامة حالياً.
          </div>
        )}
      </div>

      {/* Booking Drawer */}
      <DoctorBookingDrawer 
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        doctor={doctor}
      />
    </div>
  );
}
