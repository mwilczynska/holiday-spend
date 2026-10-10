'use client';

import { useCallback, useRef } from 'react';

/**
 * Ref callback for a controlled input that adopts a value already in the field when React takes
 * over: text typed before the page's JavaScript loaded (slow on a first `npm run dev` compile), or
 * a browser/password-manager autofill. React keeps that text on screen but its state stays empty,
 * so buttons gated on the state remained disabled until the person typed again.
 */
export function useAdoptPrefilledValue(setValue: (value: string) => void) {
  const adopted = useRef(false);
  return useCallback((node: HTMLInputElement | null) => {
    if (!node || adopted.current) return;
    adopted.current = true;
    if (node.value) setValue(node.value);
  }, [setValue]);
}
