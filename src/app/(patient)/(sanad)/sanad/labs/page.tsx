import { ProviderBrowse } from '@/components/features/patient/provider-browse';

/** المختبرات والأشعة داخل سند — the same screen against the Sanad pool and its prices. */
export default function Page() {
  return (
    <ProviderBrowse
      serviceType="LAB_TEST"
      channel="SANAD"
      title="المختبرات والأشعة — سند"
      subtitle="احجز فحوصاتك الطبية بدقة وسهولة"
      searchPlaceholder="ابحث عن مختبر أو تحليل..."
      emptyTitle="لا توجد مختبرات"
    />
  );
}
