import { use } from 'react';
import { DoctorProfile } from '@/components/features/patient/doctor-profile';

/** الملف العام — بأسعار خارج سند. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DoctorProfile id={id} channel="DIRECT" />;
}
