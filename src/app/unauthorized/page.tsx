import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { USER_ROLE_LABELS, labelOf } from "@/lib/labels";
import { SwitchAccountButton } from "./switch-account";

export const metadata = {
  title: "غير مصرح | وريد",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; home?: string }>;
}) {
  const { from, home } = await searchParams;
  // Only accept an internal path, so `?home=` can't be used as an open redirect.
  // Backslashes too: browsers normalise `\` to `/`, so `/\evil.example` is
  // fetched as `//evil.example`.
  const safeHome =
    home && home.startsWith("/") && !home.startsWith("//") && !home.includes("\\")
      ? home
      : "/";

  // Naming the signed-in account is the whole point of this page.
  //
  // Landing here ALWAYS means a session exists — the proxy sends signed-OUT
  // visitors to /login instead. Saying only "your account lacks permission"
  // reads as "I'm not registered", when the actual state is "you are signed in,
  // as someone who cannot open this".
  const session = await auth();
  const user = session?.user;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-500" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">ليس لديك صلاحية</h1>

        {user ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            أنت مُسجَّل الدخول باسم{" "}
            <span className="font-semibold text-gray-900">
              {user.name || user.email || "مستخدم"}
            </span>{" "}
            بصلاحية{" "}
            <span className="font-semibold text-gray-900">
              {labelOf(USER_ROLE_LABELS, user.role)}
            </span>
            ، وهذه الصلاحية لا تفتح هذه الصفحة.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            حسابك لا يملك صلاحية الوصول إلى هذه الصفحة.
          </p>
        )}

        {from ? (
          <p className="mt-2 text-xs text-gray-400" dir="ltr">
            {from}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href={safeHome}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            الذهاب إلى صفحتي الرئيسية
          </Link>
          <SwitchAccountButton />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-gray-500">
          لوحة الإدارة على <span dir="ltr">/admin</span> ولوحة العمليات على{" "}
          <span dir="ltr">/operations</span>، ولوحة الشركاء على{" "}
          <span dir="ltr">/dashboard</span> — يدخل الموظفون إليها بالبريد وكلمة
          المرور.
        </p>
      </div>
    </main>
  );
}
