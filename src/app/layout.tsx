import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
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
    // suppressHydrationWarning is required by next-themes: it sets the theme
    // class on <html> before hydration, which would otherwise mismatch.
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/*
        The bottom nav lives in (patient)/layout.tsx, not here — it is a
        patient-only affordance and previously rendered on /login, /dashboard,
        /admin and /operations too.
      */}
      <body className={`${notoKufiArabic.variable} font-arabic bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* RTL-aware toasts. The app had no toast system at all, so every
              action succeeded or failed silently. */}
          <Toaster position="top-center" dir="rtl" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
