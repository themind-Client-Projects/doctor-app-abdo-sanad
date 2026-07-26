"use client";

import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { resolveHomePath } from "@/lib/roles";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <CardSkeleton />
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const callbackUrl = useSearchParams().get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("email-password", {
        email: email.trim(),
        password,
        redirect: false,
      });

      // `result.error` alone is not a reliable failure signal in next-auth v5 —
      // a rejected credential resolves with ok:false and url:null.
      if (!result?.ok || result.error) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        return;
      }

      // Send the user to their own portal rather than a hardcoded /dashboard,
      // which 404'd for SUPER_ADMIN and OPERATIONS.
      const session = await getSession();
      router.push(resolveHomePath(session?.user?.role, callbackUrl));
      router.refresh();
    } catch {
      setError("تعذّر تسجيل الدخول، حاول مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border border-border/70 bg-card/80 p-7 shadow-[0_1px_2px_rgba(16,24,40,.04),0_12px_32px_-8px_rgba(16,24,40,.12)] backdrop-blur-sm sm:p-8">
        <header className="mb-7">
          <h2 className="text-[1.35rem] font-bold tracking-tight text-foreground">
            تسجيل الدخول
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            لوحة التحكم — للموظفين والإدارة فقط
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] font-semibold text-foreground"
            >
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Mail size={17} aria-hidden="true" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                dir="ltr"
                placeholder="name@warid.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                className={`${inputClass} pl-4`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-semibold text-foreground"
            >
              كلمة المرور
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock size={17} aria-hidden="true" />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
                className={`${inputClass} pl-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* aria-live so failures are announced to screen readers */}
          <div role="alert" aria-live="polite">
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="leading-relaxed">{error}</span>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              "تسجيل الدخول"
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck size={13} aria-hidden="true" />
        بياناتك الصحية محمية ومشفّرة
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground/70">
        © 2026 وريد — جميع الحقوق محفوظة
      </p>
    </AuthShell>
  );
}

/* ---------------------------------- parts --------------------------------- */

// No left padding here on purpose: fields append their own (pl-4 or pl-11).
// Having pl-4 in the base and pl-11 appended left both classes in play, and the
// eye button ended up sitting on top of the password text.
const inputClass =
  "h-12 w-full rounded-xl border border-input bg-background pr-11 text-sm text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10"
    >
      {/* Ambient depth — decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative w-full max-w-[26rem]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-inset ring-white/20">
            و
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">وريد</h1>
          <p className="mt-1 text-sm text-muted-foreground">منصة الرعاية الصحية</p>
        </div>
        {children}
      </div>
    </main>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-sm">
      <div className="h-6 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="mt-7 h-12 animate-pulse rounded-xl bg-muted" />
      <div className="mt-4 h-12 animate-pulse rounded-xl bg-muted" />
      <div className="mt-5 h-12 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
