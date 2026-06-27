import { ReactNode } from 'react';

interface InfoBadgeProps {
  icon: ReactNode;
  text: string;
}

export function InfoBadge({ icon, text }: InfoBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-100/80 px-2.5 py-1.5 rounded-full border border-gray-200">
      <div className="shrink-0">
        {icon}
      </div>
      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{text}</span>
    </div>
  );
}
