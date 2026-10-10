'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpenText, Database, LayoutDashboard, Loader2, Map, Receipt, Settings, UserCircle } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';
import { getActiveNavHref, isAuthRoute } from './nav-match';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map, excludePrefix: '/plan/compare' },
  { href: '/plan/compare', label: 'Compare Plans', icon: BarChart3 },
  { href: '/dataset', label: 'Dataset', icon: Database },
  { href: '/estimates', label: 'Methodology', icon: BookOpenText },
  // Quick Add and Tags live inside Expenses (its header), so /track/* highlights Expenses.
  { href: '/track', label: 'Expenses', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings, excludePrefix: '/settings/account' },
  { href: '/settings/account', label: 'Account', icon: UserCircle },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const activeHref = getActiveNavHref(pathname, navItems.map((item) => item.href));

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  if (isAuthRoute(pathname)) return null;

  return (
    <aside className="hidden lg:flex flex-col w-60 border-r bg-card h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <BrandMark />
        <div>
          <h1 className="text-[15px] font-extrabold leading-tight">Holiday Spend</h1>
          <p className="text-[11px] text-muted-foreground">Travel budget tracker</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          // Only the most specific match is active, so /track/tags highlights Tags but not Expenses.
          const isActive = item.href === activeHref;
          const isNavigating = pendingHref === item.href;
          return (
            // `next/link` rather than router.push, so Next prefetches each route
            // as it enters the viewport. router.push disabled prefetching entirely,
            // making every navigation a cold request.
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.href !== pathname) setPendingHref(item.href);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'font-medium text-slate-600 hover:bg-accent hover:text-accent-foreground',
                isNavigating && 'opacity-80'
              )}
            >
              {isNavigating ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <item.icon className="h-[18px] w-[18px]" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
