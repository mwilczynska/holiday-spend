import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileNav } from "@/components/layout/MobileNav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Wanderledger",
  description: "Travel Budget Planner & Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geistSans.variable)}>
      <body className="antialiased min-h-screen bg-background">
        <div className="flex">
          <DesktopSidebar />
          <main className="flex-1 min-h-screen pb-20 lg:pb-0">
            <div className="container mx-auto p-4 lg:p-8 max-w-6xl">
              {children}
            </div>
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
