import { ProviderBrowse } from '@/components/features/patient/provider-browse';

/** الصيدليات داخل سند — the same screen against the Sanad pool and its prices. */
export default function Page() {
  return (
    <ProviderBrowse
      serviceType="PHARMACY_DISPENSE"
      channel="SANAD"
      title="الصيدليات — سند"
      subtitle="اطلب أدويتك من أفضل الصيدليات المعتمدة"
      searchPlaceholder="ابحث عن صيدلية..."
      emptyTitle="لا توجد صيدليات"
    />
  );
}
