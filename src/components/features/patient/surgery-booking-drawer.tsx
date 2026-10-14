'use client';

import { useState } from 'react';
import { Check, Syringe, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { invalidate } from '@/lib/request-cache';
import { formatNumber } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// حجز العمليات — a request, not a fictional booking wizard.
//
// This was a five-step wizard over three arrays written into this file:
//
//   SURGERIES  — four procedures with emoji icons
//   HOSPITALS  — «مستشفى النور التخصصي» at ١,٢٠٠,٠٠٠ د.ع rated ٤.٨, and two
//                more, with invented addresses, prices and ratings
//   DATES      — «اليوم ٠٤:٣٠ م», «غداً ١٠:٠٠ ص», «الأربعاء ١٥ أكتوبر»
//
// and it ended on «#SURG-9842» — the SAME booking number printed to every
// patient — after writing nothing anywhere.
//
// None of those steps can be made real: there is no surgery catalogue, and
// `Partner.type` has no HOSPITAL member, so the hospitals a patient would pick
// from do not exist as records. What IS real is the price — `PriceConfig` has
// a SURGERY row (500,000, or 400,000 in سند) — and `Order` can carry a SURGERY
// request for the team to arrange.
//
// So the drawer now states the real indicative price and records a real
// request. When no provider is configured for SURGERY it says so, rather than
// offering three hospitals that are not there.
// ─────────────────────────────────────────────────────────────────────────

interface SurgeryBookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurgeryBookingDrawer({ open, onOpenChange }: SurgeryBookingDrawerProps) {
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const { ensureSignedIn } = useAuthGuard();

  const { data: priceRow } = useDashboardData<{ price: number | null }>({
    url: '/api/public/prices',
    params: { service: 'SURGERY', channel: 'DIRECT' },
    enabled: open,
  });
  const { data: providers, isLoading: providersLoading } = useDashboardData<{ id: string; name: string }[]>({
    url: '/api/public/partners',
    params: { service: 'SURGERY', channel: 'DIRECT', limit: '1' },
    enabled: open,
  });

  const price = priceRow?.price ?? null;
  const provider = providers?.[0] ?? null;

  const { mutate: submitRequest, isPending } = useMutation<{ orderNumber: string }>(
    async () => {
      if (!provider) throw new Error('خدمة العمليات غير متاحة حالياً');
      return apiFetch('/api/v1/me/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: 'SURGERY',
          providerId: provider.id,
          source: 'DIRECT',
          payFromWallet: false,
          notes: notes.trim() || undefined,
        }),
      });
    },
    {
      successMessage: null,
      // The reference shown is the order's own number, not a literal.
      onSuccess: (r) => {
        setReference(r.orderNumber);
        invalidate('/api/v1/me');
      },
      onError: (e) => toast.error(e.message),
    }
  );

  const close = () => {
    onOpenChange(false);
    setNotes('');
    setReference(null);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DrawerContent className="max-h-[88vh]">
        <div className="mx-auto w-full max-w-md flex flex-col pb-safe">
          <DrawerHeader className="text-right px-5">
            <DrawerTitle className="text-xl font-extrabold">طلب عملية جراحية</DrawerTitle>
          </DrawerHeader>

          <div className="px-5 py-2 space-y-5 overflow-y-auto">
            {reference ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-10 h-10 text-emerald-500" aria-hidden />
                </div>
                <h3 className="text-xl font-extrabold text-gray-800 mb-2">تم تسجيل طلبك</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  سيتواصل معك فريق وريد لتحديد المستشفى والموعد والتكلفة النهائية.
                </p>
                <p className="text-[10px] text-gray-400 mt-3 font-mono" dir="ltr">{reference}</p>
              </div>
            ) : (
              <>
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
                  <Syringe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm mb-1">كيف تتم العملية؟</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      تُرسل طلبك، ويتواصل معك الفريق لترتيب المستشفى والطبيب والموعد
                      حسب حالتك. لا يتم خصم أي مبلغ الآن.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 font-medium">السعر التقديري يبدأ من</span>
                    {/* «—» while unknown. 0 would read as free surgery. */}
                    <span className="font-extrabold text-gray-900">
                      {price === null ? '—' : `${formatNumber(price)} د.ع`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    التكلفة النهائية تعتمد على نوع العملية والمستشفى، ويحددها الفريق معك.
                  </p>
                </div>

                <div>
                  <label htmlFor="surgery-notes" className="block text-xs font-black text-gray-800 mb-2">
                    صف حالتك أو العملية المطلوبة
                  </label>
                  <textarea
                    id="surgery-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="مثال: أحتاج استشارة لعملية في الركبة..."
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {!providersLoading && !provider ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
                    <p className="text-xs font-bold text-amber-700 leading-relaxed">
                      خدمة العمليات غير مفعّلة حالياً لدى أي جهة على المنصة. تواصل مع
                      الدعم أو حاول لاحقاً.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DrawerFooter className="px-5 pb-6">
            {reference ? (
              <Button className="w-full rounded-xl py-5 font-bold" onClick={close}>
                تم
              </Button>
            ) : (
              <>
                <Button
                  className="w-full rounded-xl py-5 font-bold"
                  disabled={isPending || providersLoading || !provider}
                  onClick={() => ensureSignedIn(() => void submitRequest())}
                >
                  {isPending ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full rounded-xl py-5 font-bold text-gray-600">
                    إلغاء
                  </Button>
                </DrawerClose>
              </>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
