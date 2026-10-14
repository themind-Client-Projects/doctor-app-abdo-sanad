'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, MapPin, UserCog } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { apiFetch, useMutation } from '@/hooks/use-mutation';
import { STALE_TIME } from '@/lib/request-cache';

/**
 * تعديل المعلومات — the one account edit a patient can make.
 *
 * `PATCH /api/v1/me/profile` has been complete and correct since it was
 * written, and its only caller was the one-time onboarding screen — which
 * self-dismisses the moment the profile is complete. So a patient who moved
 * house, or who mis-tapped الكرخ at sign-up, had no path in the product to fix
 * it: the account screen offered a disabled "تعديل الحساب — قريباً" button.
 *
 * That is not cosmetic. A home booking falls back to the stored location
 * (`governorateId: input.governorateId ?? patient.governorateId` in
 * `api/v1/me/bookings`), so the wrong governorate silently routes every future
 * home visit to the wrong city.
 *
 * Three things this screen deliberately does NOT do:
 *
 *  - **It does not send the phone.** The endpoint accepts the key but refuses
 *    any value different from the stored one with a 409: changing a number
 *    requires verifying the new one by code, and no such flow exists yet.
 *    Omitting the key skips that branch entirely, so the field is read-only
 *    here rather than an input whose every save would fail.
 *  - **It does not read `useLocationStore`.** That store holds a bare city
 *    NAME from a hardcoded list of ten, and it is one hook away on this very
 *    page. Passing it as `governorateId` typechecks — both are `string` — and
 *    fails at runtime with "المحافظة غير صالحة". The options come from
 *    `/api/public/governorates`, whose `id` is the only valid source.
 *  - **It does not re-issue the session.** `session.user.name` is read only by
 *    the staff shells, never under `(patient)`, so there is nothing here to go
 *    stale.
 */

type Governorate = { id: string; name: string; areas: string[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string | null; phone: string | null; governorateId: string | null; area: string | null };
  /** Refetches `/api/v1/me`, which prefix-invalidates every `/api/v1/me/*` key. */
  onSaved: () => void;
};

const inputClass =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-shadow placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/20';

export function ProfileEditDrawer({ open, onOpenChange, user, onSaved }: Props) {
  const { data: governorates, isLoading: loadingGovs } = useDashboardData<Governorate[]>({
    url: '/api/public/governorates',
    staleTime: STALE_TIME.reference,
  });

  const [name, setName] = useState('');
  const [governorateId, setGovernorateId] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');

  // Re-seed every time the drawer opens, so reopening after a cancel shows the
  // saved values rather than the abandoned edit.
  useEffect(() => {
    if (!open) return;
    setName(user.name ?? '');
    setGovernorateId(user.governorateId ?? '');
    setArea(user.area ?? '');
    setError('');
  }, [open, user.name, user.governorateId, user.area]);

  const selected = useMemo(
    () => (governorates ?? []).find((g) => g.id === governorateId) ?? null,
    [governorates, governorateId]
  );
  const areas = useMemo(
    () => (Array.isArray(selected?.areas) ? selected.areas : []),
    [selected]
  );

  const { mutate: save, isPending } = useMutation(
    async () =>
      apiFetch('/api/v1/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          // ALWAYS sent, even when unchanged. The endpoint only writes `area`
          // inside `...(input.governorateId ? { area: … } : {})`, so an
          // area-only edit without it returns 200 and changes nothing — a
          // silent no-op success, which is the exact failure this work exists
          // to remove.
          governorateId,
          area: areas.length > 0 ? area : null,
        }),
      }),
    {
      successMessage: 'تم تحديث معلوماتك',
      onSuccess: () => {
        onSaved();
        onOpenChange(false);
      },
    }
  );

  const submit = () => {
    setError('');
    if (name.trim().length < 3) return setError('أدخل الاسم الكامل');
    if (!governorateId) return setError('اختر المحافظة');
    // The server makes an area that is not in the chosen governorate's list a
    // 400, so refusing here is kinder than a round trip that can only fail.
    if (areas.length > 0 && !area) return setError(`اختر المنطقة داخل ${selected?.name}`);
    void save();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] rounded-t-[2rem]">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <DrawerHeader className="rounded-t-[2rem] border-b border-gray-100 bg-white px-5 pb-4 pt-6 text-right">
            <DrawerTitle className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <UserCog className="h-6 w-6 text-primary" />
              تعديل المعلومات
            </DrawerTitle>
          </DrawerHeader>

          <form
            className="space-y-5 overflow-y-auto px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <label htmlFor="pe-name" className="mb-1.5 block text-sm font-bold text-gray-700">
                الاسم الكامل
              </label>
              <input
                id="pe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                className={inputClass}
                placeholder="الاسم كما تريده على حجوزاتك"
              />
            </div>

            {/* Read-only on purpose — see the file comment. */}
            <div>
              <label htmlFor="pe-phone" className="mb-1.5 block text-sm font-bold text-gray-700">
                رقم الهاتف
              </label>
              <input
                id="pe-phone"
                value={user.phone ?? 'غير مسجّل'}
                readOnly
                dir="ltr"
                className={`${inputClass} bg-gray-50 text-gray-500`}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                لتغيير رقم الهاتف يلزم التحقق منه برمز جديد — تواصل مع خدمة العملاء.
              </p>
            </div>

            <div>
              <label htmlFor="pe-gov" className="mb-1.5 block text-sm font-bold text-gray-700">
                المحافظة
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4">
                  <MapPin className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  id="pe-gov"
                  value={governorateId}
                  onChange={(e) => {
                    setGovernorateId(e.target.value);
                    // Clear it, or "الكرخ" would survive a switch to البصرة and
                    // the save would be refused.
                    setArea('');
                  }}
                  disabled={loadingGovs}
                  className={`${inputClass} ps-10`}
                >
                  <option value="">{loadingGovs ? 'جارِ التحميل...' : '— اختر المحافظة —'}</option>
                  {(governorates ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                تُستخدم كعنوان افتراضي لأي خدمة منزلية تحجزها.
              </p>
            </div>

            {areas.length > 0 ? (
              <fieldset>
                <legend className="mb-1.5 block text-sm font-bold text-gray-700">
                  المنطقة داخل {selected?.name}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {areas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setArea(a)}
                      aria-pressed={area === a}
                      className={`h-12 rounded-xl border text-sm font-bold transition-colors ${
                        area === a
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            ) : null}

            <div className="flex gap-2 pb-safe">
              <button
                type="submit"
                disabled={isPending}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-12 rounded-xl border border-gray-200 px-6 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
