'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Calculator, LayoutDashboard, Loader2, Map, Plus, Receipt, Settings } from 'lucide-react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map, excludePrefix: '/plan/compare' },
  { href: '/plan/compare', label: 'Compare', icon: BarChart3 },
  { href: '/track/add', label: 'Add', icon: Plus, highlight: true },
  { href: '/track', label: 'Track', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
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
            </button>
          );
        })}
        <SignOutButton compact />
      </div>
    </nav>
  );
}
