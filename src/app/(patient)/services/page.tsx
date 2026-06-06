'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Stethoscope, Bed, PercentSquare, MapPin, ChevronDown } from 'lucide-react';
import { useLocationStore } from '@/stores/patient/location.store';
import { CitySelectorDrawer } from '@/components/features/patient/city-selector-drawer';

export default function ServicesPage() {
  const router = useRouter();
  const { selectedCity, openCitySelector, isCitySelectorOpen } = useLocationStore();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCity && pendingPath) {
      router.push(pendingPath);
    }
  }, [selectedCity, pendingPath, router]);

  useEffect(() => {
    if (!isCitySelectorOpen && !selectedCity && pendingPath) {
      setPendingPath(null);
    }
  }, [isCitySelectorOpen, selectedCity, pendingPath]);

  const handleNavigation = (path: string) => {
    if (!selectedCity) {
      setPendingPath(path);
      openCitySelector();
    } else {
      router.push(path);
    }
  };

  const services = [
    {
      title: 'خدمات العيادات',
      description: 'ابحث عن الخدمات و احجزها في عيادات متعددة',
      icon: Stethoscope,
      iconBg: 'bg-primary/8',
      iconColor: 'text-primary',
      path: '/doctors',
    },
    {
      title: 'العمليات الجراحية',
      description: 'احجز العمليات الجراحية مع مختلف المستشفيات',
      icon: Bed,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500',
      path: '/services/surgeries',
    },
    {
      title: 'العروض',
      description: 'عروض على الخدمات الطبية',
      icon: PercentSquare,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      path: '/services/offers',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Page Title */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">خدمة أو عملية</h1>
        <button 
          onClick={() => openCitySelector()}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors bg-primary/5 px-2.5 py-1.5 rounded-full"
        >
          <MapPin className="w-3.5 h-3.5" />
          {selectedCity ? selectedCity : 'اختر مدينتك'}
          <ChevronDown className="w-3 h-3 ms-0.5" />
        </button>
      </div>

      <main className="px-5 space-y-3">
        {services.map((service) => (
          <button 
            key={service.path}
            onClick={() => handleNavigation(service.path)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 group hover:border-primary/20 hover:shadow-sm transition-all active:scale-[0.98] text-right"
          >
            {/* Icon - Right side (RTL) */}
            <div className={`w-12 h-12 ${service.iconBg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
              <service.icon className={`w-6 h-6 ${service.iconColor}`} strokeWidth={1.8} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-gray-900">{service.title}</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{service.description}</p>
            </div>

            {/* Arrow - Left side (RTL) */}
            <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
          </button>
        ))}
      </main>

      <CitySelectorDrawer />
    </div>
  );
}
