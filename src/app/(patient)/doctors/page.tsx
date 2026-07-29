import { Suspense } from 'react';
import { DoctorsBrowse } from '@/components/features/patient/doctors-browse';

/** الأطباء خارج سند — the whole network at the base price. */
export default function DoctorsDiscoveryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <DoctorsBrowse channel="DIRECT" />
    </Suspense>
  );
}
