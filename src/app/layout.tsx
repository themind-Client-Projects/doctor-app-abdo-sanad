import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { BottomNavbar } from '@/components/shared/bottom-navbar';
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
      <body className={`${notoKufiArabic.variable} font-arabic bg-background text-foreground antialiased pb-16`}>
        <div className="flex-1">
          {children}
        </div>
        <BottomNavbar />
        {/* <InstallPrompt /> */}
      </body>
    </html>
  );
}
