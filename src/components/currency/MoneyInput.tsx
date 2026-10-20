'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { useCurrency } from './CurrencyProvider';
import { displayToAud } from '@/lib/display-currency';

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** Stored AUD amount. Changing currency alone never writes or rounds this value. */
  value: number | null;
  onValueChange: (amountAud: number | null) => void;
};

export function MoneyInput({ value, onValueChange, disabled, ...props }: Props) {
  const { currency, rate, saving } = useCurrency();
  const key = currency + ':' + rate + ':' + value;
  const [draft, setDraft] = useState<{
    key: string; text: string; source: number | null; invalid: boolean;
  } | null>(null);
  const showDraft = draft && (draft.key === key
    || (draft.invalid && (Object.is(draft.source, value) || Number.isNaN(value))));
  const displayed = value != null && rate != null ? value * rate : null;
  const text = showDraft ? draft.text : displayed != null && Number.isFinite(displayed)
    ? String(Number(displayed.toFixed(2))) : '';
  const invalid = (showDraft && draft.invalid) || (value != null && (!Number.isFinite(value) || value < 0));

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      disabled={disabled || saving || rate == null}
      value={text}
      aria-invalid={invalid ? true : props['aria-invalid']}
      onChange={event => {
        const raw = event.target.value;
        const normalized = raw.trim().replace(/,/g, '');
        const next = raw.trim() === '' ? null : /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
        let aud: number | null = null;
        if (next != null) {
          try { aud = displayToAud(next, rate); } catch { aud = NaN; }
        }
        setDraft({ key: currency + ':' + rate + ':' + aud, text: raw, source: value,
          invalid: aud != null && (!Number.isFinite(aud) || aud < 0) });
        onValueChange(aud);
      }}
    />
  );
}
