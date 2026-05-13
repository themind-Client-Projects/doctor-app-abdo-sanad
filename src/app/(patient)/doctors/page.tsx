'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { PageBackButton } from '@/components/shared/page-back-button';
import { SPECIALIZATIONS } from '@/lib/constants/specializations';

export default function DoctorsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-primary/80 px-4 pt-14 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <PageBackButton />
        <div className="relative z-10 text-center mt-2">
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">طبيبي</h1>
          <p className="text-primary-foreground/70 text-sm font-medium">اختر التخصص للعثور على طبيبك</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mt-6 z-10">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-white/95 backdrop-blur text-gray-900 rounded-2xl py-3.5 ps-11 pe-4 outline-none shadow-md text-sm font-medium placeholder:text-gray-400"
            placeholder="ابحث عن تخصص معين..."
          />
        </div>
      </header>

      <main className="px-4 mt-8 space-y-8">
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">التخصصات الطبية</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {SPECIALIZATIONS.map((spec) => (
              <Link 
                key={spec.id} 
                href={`/doctors/${spec.id}`}
                className="bg-white rounded-3xl p-5 shadow-sm border border-border flex flex-col items-center gap-3 transition-all hover:border-primary/30 hover:shadow-md active:scale-95"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-inner ${spec.color}`}>
                  <spec.icon className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm text-center leading-tight h-10 flex items-center">
                  {spec.name}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
