'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

/**
 * True while the planner must not reorder, delete or estimate legs: an edit is pending, an order write is in flight,
 * or the itinerary is loading or failed to load. It flips at the start and end of every leg edit, so it is read by
 * the few buttons it disables rather than passed to every card, which re-rendered all cards twice per edit.
 */
export const PlannerLockContext = createContext(false);

export function LockableButton({ disabled, ...props }: ComponentProps<typeof Button>) {
  const locked = useContext(PlannerLockContext);
  return <Button {...props} disabled={locked || disabled} />;
}
