'use client';

import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';

interface SettledInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> {
  /** The saved value. While the field is being edited, changes to it do not overwrite the draft. */
  value: string;
  /** Called once a valid value has settled and differs from `value`. */
  onCommit: (value: string) => void;
  isValid: (value: string) => boolean;
  /** Pause after the last keystroke before a valid draft is committed. */
  delayMs?: number;
}

/**
 * An input that saves when its value settles rather than on every keystroke: on blur, on Enter, or after a pause,
 * and only when the draft is valid. A date input reports a complete date at each keystroke, so typing a year passes
 * through years such as 0002 and 0202; saving each of those made the planner recalculate and redraw legs spanning
 * thousands of years. An invalid draft is kept while focused (marked invalid) and reverts to the saved value on blur.
 */
export function SettledInput({ value, onCommit, isValid, delayMs = 700, onBlur, onKeyDown, ...props }: SettledInputProps) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, onCommit, isValid });
  useLayoutEffect(() => {
    latest.current = { value, onCommit, isValid };
  });

  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { value: saved, onCommit: save, isValid: valid } = latest.current;
    if (next !== saved && valid(next)) save(next);
  };

  return (
    <Input
      {...props}
      value={draft}
      aria-invalid={draft !== '' && !isValid(draft) ? true : props['aria-invalid']}
      onChange={(event) => {
        const next = event.target.value;
        editing.current = true;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = isValid(next) ? setTimeout(() => commit(next), delayMs) : null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit(draft);
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        editing.current = false;
        commit(draft);
        if (!isValid(draft)) setDraft(latest.current.value);
        onBlur?.(event);
      }}
    />
  );
}
