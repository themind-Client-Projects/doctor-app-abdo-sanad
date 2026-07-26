import Link from "next/link";
import { FileQuestion } from "lucide-react";

export const metadata = {
  title: "الصفحة غير موجودة | وريد",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <FileQuestion className="h-8 w-8 text-gray-500" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          الرابط الذي تحاول الوصول إليه غير متاح أو تم نقله.
        </p>

        <Link
          href="/"
          className="mt-7 block w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          العودة إلى الرئيسية
        </Link>
      </div>
    </main>
  );
}
