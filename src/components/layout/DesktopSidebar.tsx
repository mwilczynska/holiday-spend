'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, BookOpenText, Database, LayoutDashboard, Loader2, Map, Receipt, Plus, Settings, Tags, UserCircle } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map, excludePrefix: '/plan/compare' },
  { href: '/plan/compare', label: 'Compare Plans', icon: BarChart3 },
  { href: '/dataset', label: 'Dataset', icon: Database },
  { href: '/estimates', label: 'Methodology', icon: BookOpenText },
  { href: '/track', label: 'Expenses', icon: Receipt },
  { href: '/track/add', label: 'Quick Add', icon: Plus },
  { href: '/track/tags', label: 'Tags', icon: Tags },
  { href: '/settings', label: 'Settings', icon: Settings, excludePrefix: '/settings/account' },
  { href: '/settings/account', label: 'Account', icon: UserCircle },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const handleNavigate = (href: string) => {
    if (href === pathname) return;
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">Wanderledger</h1>
        <p className="text-xs text-muted-foreground">Travel Budget Tracker</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = (pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))) &&
            !('excludePrefix' in item && item.excludePrefix && pathname.startsWith(item.excludePrefix));
          const isNavigating = isPending && pendingHref === item.href;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavigate(item.href)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isNavigating && 'opacity-80'
              )}
            >
              {isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <item.icon className="h-4 w-4" />}
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
