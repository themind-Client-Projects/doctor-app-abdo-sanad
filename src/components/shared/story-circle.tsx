import Image from 'next/image';
import { Play } from 'lucide-react';

interface StoryCircleProps {
  imageUrl?: string;
  isActive?: boolean;
}

export function StoryCircle({ imageUrl, isActive = false }: StoryCircleProps) {
  return (
    <div className={`relative shrink-0 w-[60px] h-[60px] rounded-full p-0.5 ${isActive ? 'bg-gradient-to-tr from-primary to-rose-400' : 'bg-gray-200'}`}>
      <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-100 flex items-center justify-center relative">
        {imageUrl ? (
          <Image src={imageUrl} alt="Story" fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-300">
              <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
        )}
        
        {isActive && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
            <Play className="w-5 h-5 text-white fill-white opacity-90 ml-0.5" />
          </div>
        )}
      </div>
    </div>
  );
}
