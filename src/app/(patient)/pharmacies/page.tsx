import { ProviderBrowse } from '@/components/features/patient/provider-browse';

/**
 * الصيدليات — خارج سند.
 *
 * Replaces a hand-written list of three hardcoded providers whose search box
 * filtered nothing. Shares one component with /sanad/pharmacies; only the channel
 * differs, which decides both the pool and the price.
 */
export default function Page() {
  return (
    <ProviderBrowse
      serviceType="PHARMACY_DISPENSE"
      channel="DIRECT"
      title="الصيدليات"
      subtitle="اطلب أدويتك من أفضل الصيدليات المعتمدة"
      searchPlaceholder="ابحث عن صيدلية..."
      emptyTitle="لا توجد صيدليات"
      detailBasePath="/pharmacies"
    />
  );
}
