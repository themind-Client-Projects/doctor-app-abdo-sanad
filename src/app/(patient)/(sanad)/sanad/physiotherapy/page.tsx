import { ProviderBrowse } from '@/components/features/patient/provider-browse';

/** العلاج الطبيعي داخل سند — the same screen against the Sanad pool and its prices. */
export default function Page() {
  return (
    <ProviderBrowse
      serviceType="PHYSIOTHERAPY"
      channel="SANAD"
      title="العلاج الطبيعي — سند"
      subtitle="أفضل المراكز لاستعادة حركتك ونشاطك"
      searchPlaceholder="ابحث عن مركز علاج طبيعي..."
      emptyTitle="لا توجد مراكز علاج طبيعي"
    />
  );
}
