import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import './globals.css';

const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-kufi-arabic',
});

export const metadata: Metadata = {
  title: 'تطبيق الرعاية الصحية',
  description: 'احجز مواعيدك الطبية بسهولة وسرعة',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      {/*
        The bottom nav lives in (patient)/layout.tsx, not here — it is a
        patient-only affordance and previously rendered on /login, /dashboard,
        /admin and /operations too.
      */}
      <body className={`${notoKufiArabic.variable} font-arabic bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
