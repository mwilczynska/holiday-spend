import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileNav } from "@/components/layout/MobileNav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", jakartaSans.variable)}>
      <body className="antialiased min-h-screen bg-background">
        <div className="flex">
          <DesktopSidebar />
          <main className="min-w-0 flex-1 min-h-screen pb-20 lg:pb-0">
            <div className="container mx-auto p-4 lg:p-8 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
