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
import { cookies } from 'next/headers';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { AnalyticsSettings } from '@/components/analytics/AnalyticsSettings';
import { accountAnalyticsId, analyticsEnabled } from '@/lib/analytics/service';
import { isAnalyticsAdmin } from '@/lib/auth-policy';
import Link from 'next/link';

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
  let tracking = false;
  try { tracking = session?.user?.id ? analyticsEnabled(session.user.id) : (await cookies()).get('hs_analytics_disabled')?.value !== '1'; } catch { /* Keep optional collection off on a failed preference read. */ }
  let currency = DEFAULT_CURRENCY_STATE;
  if (session?.user?.id) {
    try { currency = await getDisplayCurrencyState(session.user.id); }
    catch { currency = { ...DEFAULT_CURRENCY_STATE, rate: null, error: 'Currency settings unavailable. Retry in Settings.' }; }
  }
  return (
    <html lang="en" className={cn("font-sans", jakartaSans.variable)}>
      <body className="antialiased min-h-screen bg-background">
        <AnalyticsProvider key={session?.user?.id ?? 'anonymous'} identity={session?.user?.id ? accountAnalyticsId(session.user.id) : 'anonymous'} initialEnabled={tracking} />
        <CurrencyProvider key={session?.user?.id ?? 'signed-out'} initial={currency} enabled={Boolean(session?.user?.id)}>
          <div className="flex">
            <DesktopSidebar />
            <main className="min-w-0 flex-1 min-h-screen pb-20 lg:pb-0">
              <div className="container mx-auto p-4 lg:p-8 max-w-7xl">
                <CurrencyNotice />
                {children}
                {!session?.user?.id ? <AnalyticsSettings compact /> : null}
                {session?.user?.id && isAnalyticsAdmin(session.user.email) ? <div className="mt-8 text-xs"><Link data-analytics="layout.admin-analytics" href="/admin/analytics" className="text-muted-foreground underline">Product analytics</Link></div> : null}
              </div>
            </main>
          </div>
          <MobileNav />
        </CurrencyProvider>
      </body>
    </html>
  );
}
