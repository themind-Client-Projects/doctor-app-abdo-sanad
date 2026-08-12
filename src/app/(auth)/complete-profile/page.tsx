"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { STALE_TIME } from "@/lib/request-cache";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MapPin, Phone, User } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch } from "@/hooks/use-mutation";
import { useMe } from "@/hooks/use-me";
import { resolveHomePath } from "@/lib/roles";

/**
 * إكمال الملف الشخصي — the details sign-in cannot supply.
 *
 * Both paths land here, because each is missing something different: phone OTP
 * gives a number but no name or city; Google gives a name and email but no
 * phone. One screen, one completeness rule — duplicating it per provider is how
 * the two drift.
 *
 * Self-dismissing: if the profile is already complete it redirects straight on,
 * so it can be used as an unconditional post-sign-in destination without
 * anyone seeing it twice.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Governorate = { id: string; name: string; areas: string[] };

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<Shell><div className="h-72" /></Shell>}>
      <CompleteProfile />
    </Suspense>
  );
}

function CompleteProfile() {
  const router = useRouter();
  // Guarded: `?next=https://evil.com` would otherwise make this an open redirect.
  const next = resolveHomePath("PATIENT", useSearchParams().get("next"));
  const reduce = useReducedMotion();

  const { user, isLoading: loadingMe, refetch } = useMe();
  const { data: governorates } = useDashboardData<Governorate[]>({
    url: "/api/public/governorates",
    staleTime: STALE_TIME.reference,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [checked, setChecked] = useState(false);

  // Prefill once, from whatever the provider did give us, so a Google user is
  // not asked to retype the name Google already supplied.
  useEffect(() => {
    if (prefilled || !user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setGovernorateId(user.governorateId ?? "");
    setArea(user.area ?? "");
    setPrefilled(true);
  }, [user, prefilled]);

  // Self-dismiss: this is safe to use as an unconditional post-sign-in
  // destination precisely because a complete profile passes straight through.
  // Without it, a returning user would be made to re-confirm their own details
  // on every sign-in.
  useEffect(() => {
    if (checked || loadingMe || !user) return;
    setChecked(true);
    const complete = Boolean(user.name && user.phone && user.governorateId);
    if (complete) router.replace(next);
  }, [checked, loadingMe, user, router, next]);

  const selected = useMemo(
    () => (governorates ?? []).find((g) => g.id === governorateId),
    [governorates, governorateId]
  );
  // بغداد defines الكرخ / الرصافة. Any governorate with areas asks the same way.
  const areas = selected?.areas ?? [];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 3) return setError("أدخل الاسم الكامل");
    if (phone.replace(/\D/g, "").length < 10) return setError("أدخل رقم هاتف صحيح");
    if (!governorateId) return setError("اختر المحافظة");
    if (areas.length > 0 && !area) return setError(`اختر المنطقة داخل ${selected?.name}`);

    setSaving(true);
    try {
      await apiFetch("/api/v1/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          governorateId,
          area: areas.length > 0 ? area : null,
        }),
      });
      await refetch();
      router.refresh();
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Brand />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
          أكمل بياناتك
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          نحتاج اسمك ومدينتك لإتمام الحجوزات وتوصيل الخدمات إليك.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <Field label="الاسم الكامل" htmlFor="cp-name" icon={<User className="h-4 w-4" />}>
            <input
              id="cp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="أحمد محمد كاظم"
              required
              className={inputClass}
            />
          </Field>

          <Field label="رقم الهاتف" htmlFor="cp-phone" icon={<Phone className="h-4 w-4" />}>
            <input
              id="cp-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="07701234567"
              // Already known when they signed in by phone; asked for after Google.
              readOnly={Boolean(user?.phone)}
              required
              className={`${inputClass} ${user?.phone ? "bg-gray-50 text-gray-500" : ""}`}
            />
          </Field>

          <Field label="المحافظة" htmlFor="cp-gov" icon={<MapPin className="h-4 w-4" />}>
            <select
              id="cp-gov"
              value={governorateId}
              onChange={(e) => {
                setGovernorateId(e.target.value);
                // Clear the area, or "الكرخ" would survive a switch to البصرة.
                setArea("");
              }}
              required
              className={`${inputClass} ps-10`}
            >
              <option value="">— اختر المحافظة —</option>
              {(governorates ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>

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
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
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

          <button
            type="submit"
            disabled={saving || loadingMe}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "جاري الحفظ..." : "حفظ ومتابعة"}
          </button>
        </form>
      </motion.div>
    </Shell>
  );
}

/* -------------------------------- pieces -------------------------------- */

const inputClass =
  "h-12 w-full rounded-xl border border-gray-300 bg-white ps-10 pe-3.5 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10";

function Field({
  label,
  htmlFor,
  icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-gray-400">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      dir="rtl"
      className="flex min-h-screen w-full items-start justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:items-center"
    >
      <div className="w-full max-w-[400px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </section>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
        و
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold text-gray-900">وريد</span>
        <span className="block text-[11px] text-gray-500">رعايتك الصحية بين يديك</span>
      </span>
    </div>
  );
}
