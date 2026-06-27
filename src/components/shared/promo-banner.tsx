import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface PromoBannerProps {
  title: string;
  subtitle: string;
  brandName?: string;
  href?: string;
  className?: string;
}

export function PromoBanner({ 
  title, 
  subtitle, 
  brandName, 
  href = '#', 
  className = '' 
}: PromoBannerProps) {
  return (
    <Link 
      href={href} 
      className={`block relative overflow-hidden rounded-[14px] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-4 sm:p-5 shadow-sm active:scale-[0.98] transition-transform group ${className}`}
    >
      {/* Decorative background shapes mimicking the image */}
      <div className="absolute top-0 bottom-0 left-0 w-[60%] bg-gradient-to-r from-white/10 to-transparent" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }} />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-colors duration-500" />

      <div className="relative z-10 flex items-center justify-between" dir="rtl">
        <div className="text-right flex-1 min-w-0 pl-3">
          {brandName && (
            <div className="flex items-center justify-start mb-1">
              <span className="font-extrabold text-xl tracking-wide">{brandName}</span>
            </div>
          )}
          <h3 className="font-bold text-[15px] sm:text-base leading-snug mb-0.5">{title}</h3>
          <p className="text-xs sm:text-sm text-white/90">{subtitle}</p>
        </div>

        <ChevronLeft className="w-6 h-6 text-white shrink-0 opacity-90 group-hover:opacity-100 transition-opacity group-hover:-translate-x-1 duration-300" strokeWidth={2.5} />
      </div>
    </Link>
  );
}
