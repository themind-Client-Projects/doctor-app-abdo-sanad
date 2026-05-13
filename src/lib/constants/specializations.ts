import { 
  Droplet, Users, Activity, Baby, HeartPulse, 
  Salad, Sparkles, Leaf, Stethoscope, Bone, 
  Brain, Eye, Ear
} from 'lucide-react';

export const SPECIALIZATIONS = [
  { id: 'oncology', name: 'أورام وأمراض دم', icon: Droplet, color: 'bg-rose-100 text-rose-600' },
  { id: 'gynecology', name: 'أمراض نسائية', icon: Users, color: 'bg-fuchsia-100 text-fuchsia-600' },
  { id: 'urology', name: 'مسالك بولية وأمراض الذكورة', icon: Activity, color: 'bg-blue-100 text-blue-600' },
  { id: 'pediatrics', name: 'صحة الطفل', icon: Baby, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'internal-medicine', name: 'الباطنية والجهاز الهضمي والسكر', icon: HeartPulse, color: 'bg-emerald-100 text-emerald-600' },
  { id: 'nutrition', name: 'التغذية', icon: Salad, color: 'bg-lime-100 text-lime-600' },
  { id: 'dermatology', name: 'الجلدية والتجميل', icon: Sparkles, color: 'bg-pink-100 text-pink-600' },
  { id: 'palliative-care', name: 'التلطيف', icon: Leaf, color: 'bg-teal-100 text-teal-600' },
  { id: 'dentistry', name: 'الأسنان', icon: Stethoscope, color: 'bg-cyan-100 text-cyan-600' },
  { id: 'orthopedics', name: 'المفاصل والكسور', icon: Bone, color: 'bg-orange-100 text-orange-600' },
  // Suggested Additions
  { id: 'mental-health', name: 'الطب النفسي والإرشاد', icon: Brain, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'ophthalmology', name: 'طب العيون', icon: Eye, color: 'bg-sky-100 text-sky-600' },
  { id: 'ent', name: 'الأنف والأذن والحنجرة', icon: Ear, color: 'bg-violet-100 text-violet-600' },
];
