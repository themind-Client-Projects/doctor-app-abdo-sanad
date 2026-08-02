import { ProviderBrowse } from '@/components/features/patient/provider-browse';

/** خدمات التمريض داخل سند — the same screen against the Sanad pool and its prices. */
export default function Page() {
  return (
    <ProviderBrowse
      serviceType="NURSING"
      channel="SANAD"
      title="خدمات التمريض — سند"
      subtitle="ممرضون محترفون لرعايتك في منزلك"
      searchPlaceholder="ابحث عن مركز تمريض..."
      emptyTitle="لا توجد مراكز تمريض"
    />
  );
}
