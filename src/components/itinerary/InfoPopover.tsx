'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface InfoPopoverProps {
  title: string;
  summary: string;
  items?: Array<{
    label: string;
    detail?: string;
    description: string;
  }>;
}

export function InfoPopover({ title, summary, items = [] }: InfoPopoverProps) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 8,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const isOpen = isTriggerHovered || isPanelHovered || isPinnedOpen;

  useEffect(() => {
    if (!isOpen || !triggerRef.current || !panelRef.current) return;

    const gap = 8;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!rect || !panelRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cardWidth = Math.min(panelRect.width || 288, viewportWidth - 16);
      const cardHeight = Math.min(panelRect.height || 0, viewportHeight - 16);
      const nextLeft = Math.max(8, Math.min(rect.right - cardWidth, viewportWidth - cardWidth - 8));
      const preferredBelowTop = rect.bottom + gap;
      const preferredAboveTop = rect.top - gap - cardHeight;
      const unclampedTop =
        preferredBelowTop + cardHeight <= viewportHeight - 8
          ? preferredBelowTop
          : preferredAboveTop;
      const nextTop = Math.max(8, Math.min(unclampedTop, viewportHeight - cardHeight - 8));

      setPosition({
        left: nextLeft,
        top: nextTop,
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsTriggerHovered(true)}
      onMouseLeave={() => setIsTriggerHovered(false)}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setIsPinnedOpen((current) => !current)}
        aria-label={`More information about ${title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
      {isOpen && portalReady
        ? createPortal(
            <div
              ref={panelRef}
              data-testid="info-popover-content"
              className="fixed z-[70] max-h-[calc(100vh-1rem)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
              style={{ top: position.top, left: position.left }}
              onMouseEnter={() => setIsPanelHovered(true)}
              onMouseLeave={() => setIsPanelHovered(false)}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-4 text-muted-foreground">{summary}</p>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.label} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium">{item.label}</p>
                          {item.detail ? (
                            <p className="text-[11px] font-medium text-foreground">{item.detail}</p>
                          ) : null}
                        </div>
                        <p className="text-xs leading-4 text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
