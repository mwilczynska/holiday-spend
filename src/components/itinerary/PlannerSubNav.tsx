'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Map } from 'lucide-react';

const tabs = [
  { label: 'Planner', href: '/plan', icon: Map },
  { label: 'Compare Plans', href: '/plan/compare', icon: BarChart3 },
] as const;

export function PlannerSubNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/plan'
            ? pathname === '/plan'
            : pathname.startsWith(tab.href);

        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative ${
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
