import { use } from 'react';
import { PharmacyStorefront } from '@/components/features/patient/pharmacy-storefront';

/** صفحة الصيدلية — خارج سند. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PharmacyStorefront id={id} channel="DIRECT" />;
}
