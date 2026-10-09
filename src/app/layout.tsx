import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileNav } from "@/components/layout/MobileNav";

// Downloaded at build time and self-hosted by Next, so pages make no request to Google.
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
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
