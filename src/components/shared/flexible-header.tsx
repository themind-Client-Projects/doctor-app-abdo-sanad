'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Wallet, MapPin, ChevronDown, Search } from 'lucide-react';
import { useLocationStore } from '@/stores/patient/location.store';

interface FlexibleHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode; // E.g. Activity or User icon for main pages
  showBackButton?: boolean;
  showWallet?: boolean;
  showCitySelector?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  isCompact?: boolean;
  onBack?: () => void;
}

export function FlexibleHeader({
  title,
  subtitle,
  icon,
  showBackButton = false,
  showWallet = false,
  showCitySelector = false,
  showSearch = false,
  searchPlaceholder = 'ابحث...',
  isCompact = false,
  onBack,
}: FlexibleHeaderProps) {
  const router = useRouter();
  const { selectedCity, openCitySelector } = useLocationStore();

  const hasMiddleRow = !isCompact && (showCitySelector || (title && (showCitySelector || showSearch)));

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-md mx-auto px-5 py-4 flex flex-col gap-4">
        
        {/* Top Row: Back/Icon & Wallet & potentially title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={onBack ? onBack : () => router.back()}
                className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
                aria-label="رجوع"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
            
            {icon && (
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner shrink-0">
                {icon}
              </div>
            )}
            
            {/* If compact or no middle row is needed, show title here */}
            {(!hasMiddleRow) && title && (
              <div>
                {subtitle && <p className="text-xs text-gray-500 font-medium leading-tight mb-0.5">{subtitle}</p>}
                <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{title}</h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isCompact && showCitySelector && (
              <button
                onClick={openCitySelector}
                className="flex items-center gap-1 text-xs font-bold text-[#10b981] hover:text-[#10b981]/80 transition-colors bg-[#eaf6ef] px-3 py-2 rounded-full shrink-0 border border-[#10b981]/10"
              >
                <MapPin className="w-3.5 h-3.5" />
                {selectedCity ? selectedCity : 'اختر مدينتك'}
                <ChevronDown className="w-3 h-3 ms-0.5" />
              </button>
            )}

            {showWallet && (
              <Link href="/wallet" className="flex items-center gap-1.5 bg-[#eaf6ef] text-[#10b981] px-3 py-1.5 rounded-full border border-[#10b981]/20 shrink-0 cursor-pointer active:scale-95 transition-transform hover:bg-[#dcf0e6]">
                <span className="font-bold text-sm mt-0.5 whitespace-nowrap">150,000 د.ع</span>
                <Wallet className="w-5 h-5 stroke-[2.5]" />
              </Link>
            )}
          </div>
        </div>

        {/* Middle Row: Title & City Selector (if not compact) */}
        {hasMiddleRow && (
          <div className="flex items-center justify-between">
            {title && (
              <div>
                {subtitle && <p className="text-xs text-gray-500 font-medium leading-tight mb-0.5">{subtitle}</p>}
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">{title}</h1>
              </div>
            )}

            {!isCompact && showCitySelector && (
              <button
                onClick={openCitySelector}
                className="flex items-center gap-1 text-xs font-bold text-[#10b981] hover:text-[#10b981]/80 transition-colors bg-[#eaf6ef] px-3 py-2 rounded-full shrink-0 border border-[#10b981]/10"
              >
                <MapPin className="w-3.5 h-3.5" />
                {selectedCity ? selectedCity : 'اختر مدينتك'}
                <ChevronDown className="w-3 h-3 ms-0.5" />
              </button>
            )}
          </div>
        )}

        {/* Bottom Row: Search Row */}
        {showSearch && (
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl py-3 ps-11 pe-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
              placeholder={searchPlaceholder}
            />
          </div>
        )}

      </div>
    </div>
  );
}
