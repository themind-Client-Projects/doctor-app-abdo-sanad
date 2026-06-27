import { Check, User } from 'lucide-react';

export interface SubscriptionPackageCardProps {
  title: string;
  price: string;
  billingCycle: string;
  userCount: string;
  userSavings?: string;
  features: string[];
}

export function SubscriptionPackageCard({
  title,
  price,
  billingCycle,
  userCount,
  userSavings,
  features,
}: SubscriptionPackageCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full max-w-md mx-auto">
      {/* Title */}
      <div className="mb-4">
        <h3 className="text-gray-600 font-bold text-sm mb-1">{title}</h3>
      </div>
      
      <hr className="border-gray-100 mb-4" />

      {/* Pricing */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-primary font-extrabold text-2xl" dir="rtl">{price}</span>
        </div>
        <div className="text-primary text-xs font-bold mt-1">| {billingCycle}</div>
      </div>

      <hr className="border-gray-100 mb-4" />

      {/* Users / Savings */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-primary">
          <span className="font-bold text-sm">{userCount}</span>
          {userSavings && (
            <span className="text-xs font-bold opacity-90">| {userSavings}</span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" strokeWidth={2.5} />
        </div>
      </div>

      <hr className="border-gray-100 mb-4" />

      {/* Features */}
      <div className="space-y-4 mb-6">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <span className="font-bold text-sm text-gray-800 flex-1 leading-snug">{feature}</span>
            <div className="shrink-0 mt-0.5">
              <Check className="w-5 h-5 text-primary" strokeWidth={3} />
            </div>
          </div>
        ))}
      </div>

      <hr className="border-gray-100 mb-4" />
    </div>
  );
}
