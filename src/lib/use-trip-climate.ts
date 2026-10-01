'use client';
import { useEffect, useRef, useState } from 'react';
import type { CityClimate } from './climate';

export function useTripClimate(cityIds: string[]) {
  const [climate, setClimate] = useState<Record<string, CityClimate | null>>({});
  const [attempt, setAttempt] = useState(0);
  const handledAttempt = useRef(0);
  const key = JSON.stringify(Array.from(new Set(cityIds)));
  useEffect(() => {
    const controller = new AbortController();
    const explicitRetry = attempt !== handledAttempt.current;
    handledAttempt.current = attempt;
    const ids = JSON.parse(key) as string[];
    async function load() {
      let stored: Record<string, CityClimate | null>;
      try {
        const response = await fetch(`/api/climate?cityIds=${encodeURIComponent(key)}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Unavailable');
        stored = (await response.json()).data;
      } catch {
        if (!controller.signal.aborted) setClimate(Object.fromEntries(ids.map(id => [id, null])));
        return;
      }
      if (controller.signal.aborted) return;
      // Saved records arrive together, so the warm graph has one data update.
      const queue = ids.filter(id => stored[id] === undefined || (explicitRetry && stored[id] === null));
      setClimate(Object.fromEntries(Object.entries(stored).filter(([id, value]) => !(explicitRetry && value === null && ids.includes(id)))));
      async function worker() {
        while (queue.length && !controller.signal.aborted) {
          const id = queue.shift()!;
          try {
            const response = await fetch(`/api/climate?cityId=${encodeURIComponent(id)}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: explicitRetry }), signal: controller.signal,
            });
            if (!response.ok) throw new Error('Unavailable');
            const { data } = await response.json();
            if (!controller.signal.aborted) setClimate(current => ({ ...current, [id]: data }));
          } catch {
            if (!controller.signal.aborted) setClimate(current => ({ ...current, [id]: null }));
          }
        }
      }
      await Promise.all([worker(), worker(), worker()]);
    }
    if (ids.length) void load();
    return () => controller.abort();
  }, [key, attempt]);
  return { climate, retry: () => setAttempt(value => value + 1) };
}
