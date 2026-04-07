'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface InfoPopoverProps {
  title: string;
  summary: string;
  items?: Array<{
    label: string;
    description: string;
  }>;
}

export function InfoPopover({ title, summary, items = [] }: InfoPopoverProps) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPinnedOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsPinnedOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isPinnedOpen]);

  const isOpen = isHovered || isPinnedOpen;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setIsPinnedOpen((current) => !current)}
        aria-label={`More information about ${title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
      {isOpen && (
        <div className="absolute right-0 top-6 z-20 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs leading-4 text-muted-foreground">{summary}</p>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-xs leading-4 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
