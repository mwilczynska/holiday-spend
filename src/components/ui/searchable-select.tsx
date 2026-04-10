'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export function SearchableSelect({
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder = 'Search...',
  emptyText = 'No matches found.',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label)),
    [options]
  );

  const selectedOption = sortedOptions.find((option) => option.value === value);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full justify-between font-normal',
          !selectedOption && 'text-muted-foreground',
          className
        )}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={searchPlaceholder} />
        <CommandList>
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup>
            {sortedOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.description || ''} ${option.keywords || ''}`}
                onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className="flex items-start gap-2"
              >
                <Check
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    option.value === value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="space-y-0.5">
                  <div>{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
