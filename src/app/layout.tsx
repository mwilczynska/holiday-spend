import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { CurrencyNotice } from '@/components/currency/CurrencyNotice';
import { CurrencyProvider } from '@/components/currency/CurrencyProvider';
import { DEFAULT_CURRENCY_STATE } from '@/lib/display-currency';
import { getDisplayCurrencyState } from '@/lib/display-currency-service';
import { getAuthSession } from '@/lib/auth';

// Bundled with npm dependencies: builds and pages need no Google Fonts request.
const jakartaSans = localFont({
  src: '../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Holiday Spend",
  description: "Travel Budget Planner & Tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();
  let currency = DEFAULT_CURRENCY_STATE;
  if (session?.user?.id) {
    try { currency = await getDisplayCurrencyState(session.user.id); }
    catch { currency = { ...DEFAULT_CURRENCY_STATE, rate: null, error: 'Currency settings unavailable. Retry in Settings.' }; }
  }
  return (
    <html lang="en" className={cn("font-sans", jakartaSans.variable)}>
      <body className="antialiased min-h-screen bg-background">
        <CurrencyProvider key={session?.user?.id ?? 'signed-out'} initial={currency} enabled={Boolean(session?.user?.id)}>
          <div className="flex">
            <DesktopSidebar />
            <main className="min-w-0 flex-1 min-h-screen pb-20 lg:pb-0">
              <div className="container mx-auto p-4 lg:p-8 max-w-7xl">
                <CurrencyNotice />
                {children}
              </div>
            </main>
          </div>
          <MobileNav />
        </CurrencyProvider>
      </body>
    </html>
  );
}
