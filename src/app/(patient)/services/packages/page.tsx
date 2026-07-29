'use client';

import { useRouter } from 'next/navigation';
import { X, HelpCircle, User, Hospital, Microscope, Clapperboard } from 'lucide-react';
import { InfoBadge } from '@/components/shared/info-badge';
import { StoryCircle } from '@/components/shared/story-circle';
import { SubscriptionPackageCard } from '@/components/shared/subscription-package-card';

export default function SanadPackagesPage() {
  const router = useRouter();

  const mockStories = [
    { id: 1, isActive: true },
    { id: 2, isActive: false },
    { id: 3, isActive: false },
    { id: 4, isActive: false },
    { id: 5, isActive: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-20 font-sans" dir="rtl">
      {/* Custom Top Navigation for this specific flow */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between bg-white border-b border-gray-100">
        <button 
          className="flex items-center gap-1.5 bg-sky-50 text-sky-600 px-3 py-1.5 rounded-full font-bold text-xs active:scale-95 transition-transform"
        >
          <HelpCircle className="w-4 h-4" />
          مساعدة
        </button>

        {/* Logo Text */}
        <h1 className="font-extrabold text-2xl tracking-wide text-primary">سند</h1>

        <button 
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <main className="px-5 mt-6">
        {/* Hero Section */}
        <section className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-primary mb-2">سند رعاية أشمل صحة أوفر</h2>
          <p className="text-sm font-medium text-gray-600 mb-6">
            وفر حتى 50% على جميع احتياجاتك من الرعاية الصحية
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            <InfoBadge icon={<User className="w-3.5 h-3.5 text-blue-500" />} text="300+ دكتور" />
            <InfoBadge icon={<Microscope className="w-3.5 h-3.5 text-blue-500" />} text="2+ مركز أشعة" />
            <InfoBadge icon={<Hospital className="w-3.5 h-3.5 text-blue-500" />} text="13+ المستشفيات والعيادات" />
          </div>

          <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors active:scale-[0.98]">
            اكتشف باقات سند
          </button>
        </section>

        {/* Stories Section */}
        <section className="bg-white rounded-3xl p-5 mb-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-gray-800">اعرف المزيد عن سند</h3>
            <Clapperboard className="w-5 h-5 text-gray-600" />
          </div>
          
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {mockStories.map((story) => (
              <StoryCircle key={story.id} isActive={story.isActive} />
            ))}
          </div>
        </section>

        {/* Packages Section */}
        <section className="mb-8">
          <h2 className="text-center font-extrabold text-xl text-gray-900 mb-6">اختر باقتك</h2>
          
          <SubscriptionPackageCard 
            title="اشتراك فردي"
            price="١٦.٥٠"
            billingCycle="ريال/شهر | تدفع سنويا"
            userCount="مستخدم واحد"
            userSavings="وفر ١,٢٠٠ ريال/عام"
            features={[
              "خصم يصل إلى ٥٠٪ على الكشوفات والخدمات مع سند",
              "خصم يصل إلى ٥٠٪ مع سند.",
              "أسعار مخفضة شاملة للعمليات مع سند"
            ]}
          />
        </section>

      </main>
    </div>
  );
}
