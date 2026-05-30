import type { Doctor, TimeSlot, SearchResult, Booking } from '@/types/patient';

// ─── Doctors Per Specialization ─────────────────────────────────────────

export const DEMO_DOCTORS: Record<string, Doctor[]> = {
  'oncology': [
    { id: 'onc-1', name: 'د. سامي العبيدي', specialty: 'استشاري أورام وأمراض دم', specialtyId: 'oncology', rating: 4.9, reviewCount: 124, location: 'بغداد - المنصور', clinic: 'مستشفى الأورام التخصصي', phone: '0770 111 2222', price: '50,000 د.ع', isAvailable: true, experience: '18 سنة', gender: 'male' },
    { id: 'onc-2', name: 'د. هدى الجبوري', specialty: 'أخصائية أورام', specialtyId: 'oncology', rating: 4.7, reviewCount: 89, location: 'بغداد - الكرادة', clinic: 'المركز الطبي الشامل', phone: '0781 333 4444', price: '45,000 د.ع', isAvailable: true, experience: '12 سنة', gender: 'female' },
    { id: 'onc-3', name: 'د. خالد الربيعي', specialty: 'استشاري أمراض الدم', specialtyId: 'oncology', rating: 4.8, reviewCount: 156, location: 'بغداد - زيونة', clinic: 'مستشفى ابن النفيس', phone: '0790 555 6666', price: '40,000 د.ع', isAvailable: false, experience: '22 سنة', gender: 'male' },
  ],
  'gynecology': [
    { id: 'gyn-1', name: 'د. نور الهدى الكاظمي', specialty: 'استشارية نسائية وتوليد', specialtyId: 'gynecology', rating: 4.9, reviewCount: 210, location: 'بغداد - المنصور', clinic: 'عيادة الأمل للمرأة', phone: '0770 222 3333', price: '40,000 د.ع', isAvailable: true, experience: '15 سنة', gender: 'female' },
    { id: 'gyn-2', name: 'د. فاطمة الشمري', specialty: 'أخصائية أمراض نسائية', specialtyId: 'gynecology', rating: 4.6, reviewCount: 98, location: 'بغداد - الكرادة', clinic: 'المستشفى الأهلي', phone: '0781 444 5555', price: '35,000 د.ع', isAvailable: true, experience: '10 سنة', gender: 'female' },
    { id: 'gyn-3', name: 'د. زينب العلي', specialty: 'استشارية عقم وأطفال أنابيب', specialtyId: 'gynecology', rating: 4.8, reviewCount: 175, location: 'بغداد - الجادرية', clinic: 'مركز الخصوبة المتقدم', phone: '0790 666 7777', price: '55,000 د.ع', isAvailable: true, experience: '20 سنة', gender: 'female' },
  ],
  'urology': [
    { id: 'uro-1', name: 'د. محمد الزبيدي', specialty: 'استشاري مسالك بولية', specialtyId: 'urology', rating: 4.8, reviewCount: 145, location: 'بغداد - المنصور', clinic: 'مستشفى السلام', phone: '0770 333 4444', price: '45,000 د.ع', isAvailable: true, experience: '16 سنة', gender: 'male' },
    { id: 'uro-2', name: 'د. عمر الدليمي', specialty: 'أخصائي أمراض الذكورة', specialtyId: 'urology', rating: 4.5, reviewCount: 67, location: 'بغداد - الأعظمية', clinic: 'العيادة التخصصية', phone: '0781 555 6666', price: '35,000 د.ع', isAvailable: true, experience: '8 سنة', gender: 'male' },
  ],
  'pediatrics': [
    { id: 'ped-1', name: 'د. أحمد الموسوي', specialty: 'استشاري طب الأطفال', specialtyId: 'pediatrics', rating: 4.9, reviewCount: 312, location: 'بغداد - المنصور', clinic: 'مستشفى الطفل التخصصي', phone: '0770 444 5555', price: '30,000 د.ع', isAvailable: true, experience: '20 سنة', gender: 'male' },
    { id: 'ped-2', name: 'د. سارة الحسيني', specialty: 'أخصائية صحة الطفل', specialtyId: 'pediatrics', rating: 4.7, reviewCount: 189, location: 'بغداد - الكرادة', clinic: 'عيادة براعم الحياة', phone: '0781 666 7777', price: '25,000 د.ع', isAvailable: true, experience: '11 سنة', gender: 'female' },
    { id: 'ped-3', name: 'د. علي الحكيم', specialty: 'استشاري أطفال وحديثي الولادة', specialtyId: 'pediatrics', rating: 4.8, reviewCount: 234, location: 'بغداد - زيونة', clinic: 'مستشفى ابن البيطار', phone: '0790 777 8888', price: '35,000 د.ع', isAvailable: false, experience: '17 سنة', gender: 'male' },
  ],
  'internal-medicine': [
    { id: 'int-1', name: 'د. حسن الباجلاني', specialty: 'استشاري باطنية وجهاز هضمي', specialtyId: 'internal-medicine', rating: 4.8, reviewCount: 198, location: 'بغداد - المنصور', clinic: 'مستشفى بغداد التعليمي', phone: '0770 555 6666', price: '40,000 د.ع', isAvailable: true, experience: '19 سنة', gender: 'male' },
    { id: 'int-2', name: 'د. منى الراوي', specialty: 'أخصائية سكر وغدد صماء', specialtyId: 'internal-medicine', rating: 4.6, reviewCount: 112, location: 'بغداد - الكرادة', clinic: 'عيادة الرعاية الشاملة', phone: '0781 777 8888', price: '35,000 د.ع', isAvailable: true, experience: '13 سنة', gender: 'female' },
  ],
  'nutrition': [
    { id: 'nut-1', name: 'د. ريم الطائي', specialty: 'أخصائية تغذية علاجية', specialtyId: 'nutrition', rating: 4.7, reviewCount: 87, location: 'بغداد - المنصور', clinic: 'مركز التغذية الصحية', phone: '0770 666 7777', price: '25,000 د.ع', isAvailable: true, experience: '7 سنة', gender: 'female' },
    { id: 'nut-2', name: 'د. عادل الجميلي', specialty: 'استشاري تغذية رياضية', specialtyId: 'nutrition', rating: 4.5, reviewCount: 56, location: 'بغداد - زيونة', clinic: 'عيادة الحياة النشطة', phone: '0781 888 9999', price: '20,000 د.ع', isAvailable: true, experience: '9 سنة', gender: 'male' },
  ],
  'dermatology': [
    { id: 'der-1', name: 'د. لمى السعدي', specialty: 'استشارية جلدية وتجميل', specialtyId: 'dermatology', rating: 4.9, reviewCount: 267, location: 'بغداد - المنصور', clinic: 'مركز الجمال الطبي', phone: '0770 777 8888', price: '45,000 د.ع', isAvailable: true, experience: '14 سنة', gender: 'female' },
    { id: 'der-2', name: 'د. يوسف العاني', specialty: 'أخصائي جلدية وليزر', specialtyId: 'dermatology', rating: 4.6, reviewCount: 134, location: 'بغداد - الكرادة', clinic: 'عيادة الليزر المتقدمة', phone: '0781 999 0000', price: '40,000 د.ع', isAvailable: true, experience: '11 سنة', gender: 'male' },
  ],
  'palliative-care': [
    { id: 'pal-1', name: 'د. نجلاء المشهداني', specialty: 'استشارية طب تلطيفي', specialtyId: 'palliative-care', rating: 4.9, reviewCount: 78, location: 'بغداد - المنصور', clinic: 'مركز الراحة الطبي', phone: '0770 888 9999', price: '35,000 د.ع', isAvailable: true, experience: '16 سنة', gender: 'female' },
  ],
  'dentistry': [
    { id: 'den-1', name: 'د. حيدر النقيب', specialty: 'استشاري تقويم أسنان', specialtyId: 'dentistry', rating: 4.8, reviewCount: 245, location: 'بغداد - المنصور', clinic: 'عيادة الابتسامة المثالية', phone: '0770 999 0000', price: '30,000 د.ع', isAvailable: true, experience: '15 سنة', gender: 'male' },
    { id: 'den-2', name: 'د. دينا الكبيسي', specialty: 'أخصائية تجميل أسنان', specialtyId: 'dentistry', rating: 4.7, reviewCount: 178, location: 'بغداد - الكرادة', clinic: 'مركز الأسنان الحديث', phone: '0781 000 1111', price: '25,000 د.ع', isAvailable: true, experience: '10 سنة', gender: 'female' },
  ],
  'orthopedics': [
    { id: 'ort-1', name: 'د. باسم الحديثي', specialty: 'استشاري جراحة عظام', specialtyId: 'orthopedics', rating: 4.8, reviewCount: 189, location: 'بغداد - المنصور', clinic: 'مستشفى العظام التخصصي', phone: '0770 000 1111', price: '50,000 د.ع', isAvailable: true, experience: '21 سنة', gender: 'male' },
    { id: 'ort-2', name: 'د. نبيل الخزاعي', specialty: 'أخصائي مفاصل وكسور', specialtyId: 'orthopedics', rating: 4.6, reviewCount: 112, location: 'بغداد - الأعظمية', clinic: 'مركز المفاصل الحديث', phone: '0781 111 2222', price: '40,000 د.ع', isAvailable: true, experience: '13 سنة', gender: 'male' },
  ],
  'mental-health': [
    { id: 'mh-1', name: 'د. سلمى الربيعي', specialty: 'استشارية طب نفسي', specialtyId: 'mental-health', rating: 4.9, reviewCount: 156, location: 'بغداد - المنصور', clinic: 'مركز السكينة النفسي', phone: '0770 111 3333', price: '40,000 د.ع', isAvailable: true, experience: '14 سنة', gender: 'female' },
    { id: 'mh-2', name: 'د. كريم الصالحي', specialty: 'أخصائي إرشاد نفسي', specialtyId: 'mental-health', rating: 4.7, reviewCount: 98, location: 'بغداد - الكرادة', clinic: 'عيادة الطمأنينة', phone: '0781 222 4444', price: '30,000 د.ع', isAvailable: true, experience: '9 سنة', gender: 'male' },
  ],
  'ophthalmology': [
    { id: 'oph-1', name: 'د. رعد الأمين', specialty: 'استشاري طب وجراحة العيون', specialtyId: 'ophthalmology', rating: 4.8, reviewCount: 201, location: 'بغداد - المنصور', clinic: 'مركز النور للعيون', phone: '0770 222 5555', price: '45,000 د.ع', isAvailable: true, experience: '18 سنة', gender: 'male' },
    { id: 'oph-2', name: 'د. آلاء الجنابي', specialty: 'أخصائية عيون وليزك', specialtyId: 'ophthalmology', rating: 4.6, reviewCount: 134, location: 'بغداد - زيونة', clinic: 'عيادة البصر الحديثة', phone: '0781 333 6666', price: '40,000 د.ع', isAvailable: true, experience: '12 سنة', gender: 'female' },
  ],
  'ent': [
    { id: 'ent-1', name: 'د. مصطفى الجبوري', specialty: 'استشاري أنف وأذن وحنجرة', specialtyId: 'ent', rating: 4.7, reviewCount: 167, location: 'بغداد - المنصور', clinic: 'مستشفى السمع والنطق', phone: '0770 333 7777', price: '40,000 د.ع', isAvailable: true, experience: '16 سنة', gender: 'male' },
    { id: 'ent-2', name: 'د. رنا الشيخلي', specialty: 'أخصائية أنف أذن حنجرة', specialtyId: 'ent', rating: 4.5, reviewCount: 89, location: 'بغداد - الكرادة', clinic: 'العيادة الاستشارية', phone: '0781 444 8888', price: '35,000 د.ع', isAvailable: true, experience: '8 سنة', gender: 'female' },
  ],
};

// ─── Time Slots ─────────────────────────────────────────────────────────

export const DEMO_TIME_SLOTS: TimeSlot[] = [
  { time: '09:00 ص', available: true },
  { time: '09:30 ص', available: false },
  { time: '10:00 ص', available: true },
  { time: '10:30 ص', available: true },
  { time: '11:00 ص', available: false },
  { time: '11:30 ص', available: true },
  { time: '12:00 م', available: false },
  { time: '01:00 م', available: true },
  { time: '02:00 م', available: true },
  { time: '04:00 م', available: true },
  { time: '04:30 م', available: false },
  { time: '05:30 م', available: true },
];

// ─── Available Dates ────────────────────────────────────────────────────

export const DEMO_AVAILABLE_DATES = [
  new Date(2026, 4, 13),
  new Date(2026, 4, 14),
  new Date(2026, 4, 15),
  new Date(2026, 4, 18),
  new Date(2026, 4, 19),
  new Date(2026, 4, 20),
  new Date(2026, 4, 21),
  new Date(2026, 4, 25),
  new Date(2026, 4, 26),
  new Date(2026, 4, 27),
];

export function isDateAvailable(day: Date): boolean {
  return DEMO_AVAILABLE_DATES.some(
    (d) => d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
  );
}

// ─── Search Pool ────────────────────────────────────────────────────────

export function buildSearchPool(): SearchResult[] {
  const results: SearchResult[] = [];

  // Add all doctors from all specializations
  Object.values(DEMO_DOCTORS).forEach((doctors) => {
    doctors.forEach((doc) => {
      results.push({
        id: doc.id,
        name: doc.name,
        subtitle: doc.specialty,
        category: 'doctors',
        rating: doc.rating,
        location: doc.location,
        href: `/doctors/${doc.specialtyId}`,
      });
    });
  });

  // Labs
  const labEntries: SearchResult[] = [
    { id: 'lab-1', name: 'مختبرات الشفاء التخصصية', subtitle: 'تحاليل شاملة · أشعة', category: 'labs', rating: 4.8, location: 'بغداد - المنصور', href: '/labs' },
    { id: 'lab-2', name: 'مختبر النور للتحاليل', subtitle: 'مفتوح 24 ساعة', category: 'labs', rating: 4.5, location: 'بغداد - الكرادة', href: '/labs' },
    { id: 'lab-3', name: 'مختبرات الحياة المتقدمة', subtitle: 'أحدث الأجهزة · دقة عالية', category: 'labs', rating: 4.9, location: 'بغداد - زيونة', href: '/labs' },
  ];

  // Pharmacies
  const pharmacyEntries: SearchResult[] = [
    { id: 'pharm-1', name: 'صيدلية الرازي الكبرى', subtitle: 'توصيل سريع · أدوية متوفرة', category: 'pharmacies', rating: 4.7, location: 'بغداد - اليرموك', href: '/pharmacies' },
    { id: 'pharm-2', name: 'صيدلية الشفاء الحديثة', subtitle: 'أسعار مناسبة', category: 'pharmacies', rating: 4.6, location: 'بغداد - الجادرية', href: '/pharmacies' },
    { id: 'pharm-3', name: 'صيدلية بغداد المركزية', subtitle: 'الأكبر في المنطقة', category: 'pharmacies', rating: 4.9, location: 'بغداد - الحارثية', href: '/pharmacies' },
  ];

  results.push(...labEntries, ...pharmacyEntries);
  return results;
}

// ─── Default Recent Searches ────────────────────────────────────────────

export const DEFAULT_RECENT_SEARCHES = [
  'طبيب أطفال',
  'مستشفى السلام',
  'تحليل دم',
  'طب العيون',
  'صيدلية',
];

// ─── Bookings Demo Data ─────────────────────────────────────────────────

export const NOTIFICATIONS = [
  {
    id: 1,
    title: 'موعد مؤكد مع د. سامي العبيدي',
    message: 'لا تنسَ موعدك الطبي اليوم الساعة 4:30 مساءً. يرجى الحضور قبل الموعد بـ 15 دقيقة.',
    time: 'منذ ساعتين',
    type: 'appointment',
    isRead: false,
  },
  {
    id: 2,
    title: 'نتائج التحاليل جاهزة',
    message: 'تم إصدار نتائج تحاليلك من مختبرات النور. يمكنك الاطلاع عليها الآن.',
    time: 'منذ 5 ساعات',
    type: 'lab',
    isRead: false,
  },
  {
    id: 3,
    title: 'عرض جديد: خصم 20% على العناية المنزلية',
    message: 'استفد من خصم حصري على خدمات العناية التمريضية المنزلية المعتمدة هذا الأسبوع.',
    time: 'أمس',
    type: 'offer',
    isRead: true,
  },
  {
    id: 4,
    title: 'تحديث المحفظة',
    message: 'تم إضافة 50,000 دينار عراقي إلى محفظة سند الخاصة بك كنقاط كاش باك.',
    time: 'منذ 3 أيام',
    type: 'wallet',
    isRead: true,
  },
];

// ─── E-Commerce Data (Pharmacies & Products) ────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  inStock: boolean;
  pharmacyId: number;
}

export const DEMO_PHARMACIES = [
  { id: 1, name: 'صيدلية النور المركزية', status: 'مفتوح الآن', time: '٢٤ ساعة', image: '/complexes/real_complex_1.png' },
  { id: 2, name: 'صيدلية الشفاء', status: 'مغلق', time: '٨ ص - ١٠ م', image: '/complexes/real_complex_2.png' },
  { id: 3, name: 'صيدلية الرازي', status: 'مفتوح الآن', time: '٢٤ ساعة', image: '/complexes/real_complex_3.png' },
];

export const DEMO_PRODUCTS: Product[] = [
  { id: 'p1', name: 'بانادول اكسترا - 24 قرص', category: 'أدوية', price: 3500, image: '/complexes/real_complex_2.png', inStock: true, pharmacyId: 1 },
  { id: 'p2', name: 'فيتامين سي 1000 ملغ', category: 'فيتامينات', price: 12000, image: '/complexes/real_complex_3.png', inStock: true, pharmacyId: 1 },
  { id: 'p3', name: 'سيروم فيتامين سي للبشرة', category: 'عناية بالبشرة', price: 25000, image: '/complexes/real_complex_1.png', inStock: true, pharmacyId: 1 },
  { id: 'p4', name: 'أوميغا 3 زيت السمك', category: 'مكملات غذائية', price: 18000, image: '/complexes/real_complex_2.png', inStock: false, pharmacyId: 1 },
  { id: 'p5', name: 'كريم مرطب سيرافي', category: 'عناية بالبشرة', price: 35000, image: '/complexes/real_complex_3.png', inStock: true, pharmacyId: 1 },
  { id: 'p6', name: 'قطرات مرطبة للعين', category: 'عناية شخصية', price: 8500, image: '/complexes/real_complex_1.png', inStock: true, pharmacyId: 1 },
];

export const DEMO_UPCOMING_BOOKINGS: Booking[] = [
  {
    id: 1,
    doctorName: 'د. سمير محمود',
    specialty: 'أخصائي أمراض القلب',
    date: 'غداً، 13 مايو 2026',
    time: '10:30 صباحاً',
    location: 'بغداد - المنصور',
    clinic: 'مستشفى السلام - العيادة الاستشارية',
    type: 'doctor',
    status: 'confirmed',
    price: '35,000 د.ع',
    bookingRef: 'BK-2026-001',
  },
  {
    id: 2,
    doctorName: 'مختبرات الشفاء التخصصية',
    specialty: 'باقة الفحص الشامل (VIP)',
    date: 'الخميس، 15 مايو 2026',
    time: '09:00 صباحاً',
    location: 'بغداد - الكرادة',
    clinic: 'المختبر الرئيسي - الطابق الثاني',
    type: 'lab',
    status: 'pending',
    price: '85,000 د.ع',
    bookingRef: 'BK-2026-002',
  },
  {
    id: 3,
    doctorName: 'د. نور الهدى',
    specialty: 'أخصائية العلاج الطبيعي',
    date: 'السبت، 17 مايو 2026',
    time: '02:00 مساءً',
    location: 'بغداد - زيونة',
    clinic: 'مركز الحياة للعلاج الطبيعي',
    type: 'physio',
    status: 'confirmed',
    price: '25,000 د.ع',
    bookingRef: 'BK-2026-003',
  },
];

export const DEMO_PAST_BOOKINGS: Booking[] = [
  {
    id: 10,
    doctorName: 'د. سمير محمود',
    specialty: 'أخصائي أمراض القلب',
    date: '10 مايو 2026',
    time: '09:00 صباحاً',
    location: 'بغداد - المنصور',
    clinic: 'مستشفى السلام',
    type: 'doctor',
    status: 'completed',
    price: '35,000 د.ع',
    bookingRef: 'BK-2026-000',
  },
  {
    id: 11,
    doctorName: 'مختبر النور للتحاليل',
    specialty: 'فحص CBC + سكر صائم',
    date: '5 مايو 2026',
    time: '08:30 صباحاً',
    location: 'بغداد - الكرادة',
    clinic: 'الفرع الرئيسي',
    type: 'lab',
    status: 'completed',
    price: '20,000 د.ع',
    bookingRef: 'BK-2026-099',
  },
];
