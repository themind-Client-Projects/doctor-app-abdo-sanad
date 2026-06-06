import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { arSA } from '@clerk/localizations';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { BottomNavbar } from '@/components/shared/bottom-navbar';
import { TopNavbar } from '@/components/shared/top-navbar';
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
    <ClerkProvider localization={arSA}>
      <html lang="ar" dir="rtl">
        <body className={`${notoKufiArabic.variable} font-arabic bg-background text-foreground antialiased pb-16`}>
          <TopNavbar />
          <div className="pt-[116px]">
            {children}
          </div>
          <BottomNavbar />
          {/* <InstallPrompt /> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
