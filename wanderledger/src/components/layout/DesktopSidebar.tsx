'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Map, Receipt, Plus, Settings, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/track', label: 'Expenses', icon: Receipt },
  { href: '/track/add', label: 'Quick Add', icon: Plus },
  { href: '/track/tags', label: 'Tags', icon: Tags },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">Wanderledger</h1>
        <p className="text-xs text-muted-foreground">Travel Budget Tracker</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
