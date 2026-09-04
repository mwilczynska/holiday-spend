'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, Loader2, Map, Plus, Receipt, Settings } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map, excludePrefix: '/plan/compare' },
  { href: '/plan/compare', label: 'Compare Plans', icon: BarChart3 },
  { href: '/track/add', label: 'Add', icon: Plus, highlight: true },
  { href: '/track', label: 'Track', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = (pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))) &&
            !('excludePrefix' in item && item.excludePrefix && pathname.startsWith(item.excludePrefix));
          const isNavigating = pendingHref === item.href;
          return (
            // `next/link` rather than router.push, so Next prefetches each route as
            // it enters the viewport. router.push disabled prefetching entirely.
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.href !== pathname) setPendingHref(item.href);
              }}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                item.highlight && !isActive && 'text-primary',
                isActive
                  ? 'text-primary'
                  : !item.highlight && 'text-muted-foreground',
                isNavigating && 'opacity-80'
              )}
            >
              {isNavigating ? (
                <Loader2 className={cn('h-5 w-5 animate-spin', item.highlight && 'h-6 w-6')} />
              ) : (
                <item.icon className={cn('h-5 w-5', item.highlight && 'h-6 w-6')} />
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <SignOutButton compact />
      </div>
    </nav>
  );
}
