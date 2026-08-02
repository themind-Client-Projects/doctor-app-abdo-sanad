"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FocusEvent, FormEvent, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, ArrowRight, Loader2, Phone } from "lucide-react";
import { resolveHomePath } from "@/lib/roles";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * تسجيل دخول المريض — phone OTP, with Google as an alternative.
 *
 * Separate from /login, which is the STAFF portal (email + password). That
 * separation is enforced in `auth.ts`, not just here: the `phone-otp` provider
 * refuses any account whose role is not PATIENT, because staff phone numbers
 * are seeded and one correct OTP would otherwise hand over a SUPER_ADMIN
 * session.
 *
 * Light-only, like the rest of the patient app — those screens use literal
 * white/gray classes rather than theme tokens, so a `dark:` variant here would
 * be the one dark surface in an otherwise light flow.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function SignInPage() {
  return (
    <Suspense fallback={<Shell><div className="h-[420px]" /></Shell>}>
      <SignInFlow />
    </Suspense>
  );
}

function SignInFlow() {
  const router = useRouter();
  // NEVER pushed straight from the query string: `?callbackUrl=https://evil.com`
  // would turn the sign-in page into an open redirect that borrows this app's
  // credibility. `resolveHomePath` rejects absolute and protocol-relative URLs
  // and falls back to the role's home.
  const rawCallback = useSearchParams().get("callbackUrl");
  const callbackUrl = resolveHomePath("PATIENT", rawCallback);
  const reduce = useReducedMotion();

  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const isComplete = code.every(Boolean);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const focusInput = (i: number) => inputsRef.current[i]?.focus();

  /** Ask the server for a code. Never reveals whether the number is known. */
  const sendCode = useCallback(
    async (isResend = false) => {
      setError("");
      setIsSending(true);
      try {
        const res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (res.status === 429) {
          setError("عدد محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.");
          return;
        }
        if (!res.ok) {
          setError("تعذّر إرسال رمز التحقق. تأكد من رقم الهاتف.");
          return;
        }
        setCooldown(RESEND_SECONDS);
        if (!isResend) setStep("code");
        setCode(Array(CODE_LENGTH).fill(""));
        // The field only exists after the swap renders.
        setTimeout(() => focusInput(0), 50);
      } catch {
        setError("تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.");
      } finally {
        setIsSending(false);
      }
    },
    [phone]
  );

  const handlePhoneSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Iraqi mobile numbers are 11 digits (07XXXXXXXXX); the server normalises
    // to +964, so anything shorter is a typo rather than a format we accept.
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("أدخل رقم هاتف صحيح، مثال: 07701234567");
      return;
    }
    void sendCode();
  };

  const verify = useCallback(
    async (value: string) => {
      setError("");
      setIsVerifying(true);
      try {
        const result = await signIn("phone-otp", {
          phone,
          code: value,
          redirect: false,
        });
        if (result?.error || !result?.ok) {
          setError("الرمز غير صحيح أو منتهي الصلاحية.");
          setCode(Array(CODE_LENGTH).fill(""));
          focusInput(0);
          return;
        }
        // `refresh` first: the server components above this route read the
        // session, and pushing without it lands on a page still rendered as a
        // signed-out visitor.
        router.refresh();
        router.push(callbackUrl);
      } catch {
        setError("تعذّر التحقق. حاول مجدداً.");
      } finally {
        setIsVerifying(false);
      }
    },
    [phone, callbackUrl, router]
  );

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = value;
    setCode(next);
    if (value && i < CODE_LENGTH - 1) focusInput(i + 1);
    // Submit on the last digit rather than making the user reach for a button.
    if (value && i === CODE_LENGTH - 1 && next.every(Boolean)) void verify(next.join(""));
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) focusInput(i - 1);
    // The digit row is dir="ltr", so the arrows map to visual order.
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusInput(i - 1);
    }
    if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      e.preventDefault();
      focusInput(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH)
      .fill("")
      .map((_, i) => pasted[i] ?? "");
    setCode(next);
    focusInput(Math.min(pasted.length, CODE_LENGTH - 1));
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const swap = {
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
    exit: { opacity: 0, y: reduce ? 0 : -10, transition: { duration: 0.25, ease: EASE } },
  };

  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        {step === "phone" ? (
          <motion.div key="phone" variants={swap} initial="initial" animate="animate" exit="exit">
            <Brand />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
              تسجيل الدخول
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              أدخل رقم هاتفك وسنرسل لك رمز تحقق عبر واتساب.
            </p>

            <form onSubmit={handlePhoneSubmit} className="mt-7">
              <label htmlFor="phone" className="mb-1.5 block text-sm font-bold text-gray-700">
                رقم الهاتف
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-gray-400">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07701234567"
                  required
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white ps-10 pe-3.5 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <ErrorNote message={error} />

              <button
                type="submit"
                disabled={isSending}
                className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                إرسال رمز التحقق
              </button>
            </form>

            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold tracking-[0.14em] text-gray-400">أو</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => void signIn("google", { callbackUrl })}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50"
            >
              <GoogleMark />
              المتابعة عبر Google
            </button>
          </motion.div>
        ) : (
          <motion.div key="code" variants={swap} initial="initial" animate="animate" exit="exit">
            <Brand />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
              أدخل رمز التحقق
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              أرسلنا رمزاً من {CODE_LENGTH} أرقام إلى{" "}
              <span className="font-bold text-gray-900" dir="ltr">
                {phone}
              </span>
              . تنتهي صلاحيته خلال 10 دقائق.
            </p>

            <fieldset className="mt-7" disabled={isVerifying}>
              <legend className="sr-only">رمز التحقق المكوّن من {CODE_LENGTH} أرقام</legend>
              {/* dir="ltr": a numeric code reads left-to-right even in an RTL
                  page, and it keeps the arrow keys matching visual order. */}
              <div className="flex items-center justify-center gap-2" dir="ltr">
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    id={`digit-${i + 1}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    // Lets iOS and Android offer the SMS code from the keyboard.
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    value={code[i]}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.select()}
                    aria-label={`الرقم ${i + 1} من ${CODE_LENGTH}`}
                    className={`h-14 w-11 rounded-xl border bg-white text-center text-xl font-bold tabular-nums text-gray-900 outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 sm:w-12 ${
                      code[i] ? "border-primary" : "border-gray-300 hover:border-gray-400"
                    }`}
                  />
                ))}
              </div>
            </fieldset>

            <ErrorNote message={error} />

            <button
              type="button"
              onClick={() => void verify(code.join(""))}
              disabled={!isComplete || isVerifying}
              className="mt-7 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isVerifying ? "جاري التحقق..." : isComplete ? "تأكيد" : `أدخل ${CODE_LENGTH} أرقام`}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600" aria-live="polite">
              لم يصلك الرمز؟{" "}
              {cooldown > 0 ? (
                <span className="tabular-nums text-gray-500">إعادة الإرسال خلال {cooldown} ثانية</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendCode(true)}
                  disabled={isSending}
                  className="cursor-pointer font-bold text-primary transition-colors hover:text-primary/80 disabled:opacity-60"
                >
                  إعادة إرسال الرمز
                </button>
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError("");
                setCode(Array(CODE_LENGTH).fill(""));
              }}
              className="mt-8 inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-gray-500 transition-colors hover:text-gray-900"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              تغيير رقم الهاتف
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

/* ------------------------------- pieces --------------------------------- */

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
        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية الخاصة بوريد.
        </p>
      </div>
    </section>
  );
}

/** The same mark the admin shell uses, so the brand is one thing everywhere. */
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

/** `role="alert"` so a screen reader announces it — the old login rendered the
 *  failure as plain text nobody using assistive tech would hear. */
function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

const GoogleMark = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
