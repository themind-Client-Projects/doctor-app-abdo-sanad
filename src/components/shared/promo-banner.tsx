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
      className={`block relative overflow-hidden rounded-[14px] text-white p-4 sm:p-5 shadow-lg active:scale-[0.98] transition-transform group ${className}`}
      style={{ background: 'linear-gradient(135deg, #8B1A2B 0%, #6B0F1A 40%, #4A0A12 100%)' }}
    >
      {/* Decorative gold accent shapes */}
      <div 
        className="absolute top-0 bottom-0 left-0 w-[60%]" 
        style={{ 
          background: 'linear-gradient(to right, rgba(212,175,55,0.15), transparent)',
          clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' 
        }} 
      />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl group-hover:opacity-80 transition-opacity duration-500" style={{ background: 'rgba(212,175,55,0.12)' }} />
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-30" style={{ background: 'rgba(212,175,55,0.2)' }} />

      <div className="relative z-10 flex items-center justify-between" dir="rtl">
        <div className="text-right flex-1 min-w-0 pl-3">
          {brandName && (
            <div className="flex items-center justify-start mb-1">
              <span className="font-extrabold text-xl tracking-wide" style={{ color: '#D4AF37' }}>{brandName}</span>
            </div>
          )}
          <h3 className="font-bold text-[15px] sm:text-base leading-snug mb-0.5">{title}</h3>
          <p className="text-xs sm:text-sm text-white/80">{subtitle}</p>
        </div>

        <ChevronLeft className="w-6 h-6 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity group-hover:-translate-x-1 duration-300" style={{ color: '#D4AF37' }} strokeWidth={2.5} />
      </div>
    </Link>
  );
}
