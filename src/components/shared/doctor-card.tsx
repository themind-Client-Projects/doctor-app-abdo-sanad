import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, Briefcase, CalendarClock, Stethoscope, User } from 'lucide-react';
import type { Doctor } from '@/types/patient';

interface DoctorCardProps {
  doctor: Doctor;
  onBook: (doctor: Doctor) => void;
  buttonText?: string;
  buttonIcon?: React.ElementType;
  priceLabel?: string;
}

export function DoctorCard({ doctor, onBook, buttonText = 'احجز موعد', buttonIcon: ButtonIcon = CalendarClock, priceLabel = 'سعر الكشفية' }: DoctorCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col group">
      <Link href={`/doctors/profile/${doctor.id}`} className="block flex-1 cursor-pointer">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative flex-shrink-0">
            {doctor.image ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
                <Image 
                  src={doctor.image} 
                  alt={doctor.name} 
                  fill 
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/10">
                {doctor.gender === 'female' ? (
                  <User className="w-7 h-7 text-primary/70" />
                ) : (
                  <Stethoscope className="w-7 h-7 text-primary" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-extrabold text-gray-800 text-base truncate pe-2 group-hover:text-primary transition-colors">
                {doctor.name}
              </h3>
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                <Star className="w-3 h-3 fill-amber-500" />
                {doctor.rating}
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium">{doctor.specialty}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <MapPin className="w-3.5 h-3.5 text-primary/60" />
            <span className="truncate">{doctor.location} - {doctor.clinic}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Briefcase className="w-3.5 h-3.5 text-primary/60" />
            <span>خبرة {doctor.experience}</span>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-3 pt-3 border-t border-gray-50 mt-4">
        <div className="flex-1">
          <span className="text-[10px] text-gray-400 block mb-0.5">{priceLabel}</span>
          <span className="text-sm font-extrabold text-primary block leading-none">{doctor.price}</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBook(doctor);
          }}
          disabled={!doctor.isAvailable}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            doctor.isAvailable
              ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ButtonIcon className="w-4 h-4" />
          {doctor.isAvailable ? buttonText : 'غير متاح'}
        </button>
      </div>
    </div>
  );
}
