import Link from "next/link";
import { ShieldAlert } from "lucide-react";

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
  const safeHome = home && home.startsWith("/") && !home.startsWith("//") ? home : "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-500" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">ليس لديك صلاحية</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          حسابك لا يملك صلاحية الوصول إلى هذه الصفحة.
          {from ? (
            <>
              {" "}
              <span className="text-gray-400">({from})</span>
            </>
          ) : null}
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href={safeHome}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            الذهاب إلى صفحتي الرئيسية
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            تسجيل الدخول بحساب آخر
          </Link>
        </div>
      </div>
    </main>
  );
}
