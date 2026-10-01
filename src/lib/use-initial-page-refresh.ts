'use client';
import { useEffect, useRef } from 'react';
const visitedRoutes = new Set<string>();

export function isInitialDocumentLoad(route: string) {
  const navigation = performance.getEntriesByType('navigation')[0];
  return Boolean(navigation && new URL(navigation.name).pathname === route && !visitedRoutes.has(route));
}

/** A full load already has current data. Client navigation still refreshes cached route props. */
export function useInitialPageRefresh(route: string, refresh: () => void | Promise<unknown>, hasInitialData: boolean) {
  const decision = useRef<boolean | null>(null);
  const didRefresh = useRef(false);
  useEffect(() => {
    if (decision.current === null) {
      decision.current = !hasInitialData || !isInitialDocumentLoad(route);
      visitedRoutes.add(route);
    }
    if (decision.current && !didRefresh.current) {
      didRefresh.current = true;
      void refresh();
    }
  }, [route, refresh, hasInitialData]);
}
