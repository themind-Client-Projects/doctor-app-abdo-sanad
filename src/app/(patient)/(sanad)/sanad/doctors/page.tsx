import { Suspense } from 'react';
import { DoctorsBrowse } from '@/components/features/patient/doctors-browse';

/**
 * أطباء سند — the same screen as /doctors against the Sanad pool.
 *
 * This route is why the channel model exists: the demo linked BOTH storefronts
 * at one /doctors page, so Sanad's providers and its discounted prices were
 * never isolated from the rest of the app.
 */
export default function SanadDoctorsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
      <DoctorsBrowse channel="SANAD" />
    </Suspense>
  );
}
