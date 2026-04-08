'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, LayoutDashboard, Map, Plus, Receipt, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/estimates', label: 'Logic', icon: Calculator },
  { href: '/track/add', label: 'Add', icon: Plus, highlight: true },
  { href: '/track', label: 'Track', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                item.highlight && !isActive && 'text-primary',
                isActive
                  ? 'text-primary'
                  : !item.highlight && 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', item.highlight && 'h-6 w-6')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
