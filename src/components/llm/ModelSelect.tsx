'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ModelSelectOption {
  value: string;
  label: string;
}

/**
 * Options for the model dropdown: the discovered models, with the default marked. A saved model
 * that the current list does not contain stays selectable and labelled, rather than being silently
 * replaced, so a stale or custom choice is visible until the user picks another.
 */
export function buildModelSelectOptions(models: string[], value: string, defaultModel: string) {
  const options: ModelSelectOption[] = models.map(model => ({
    value: model,
    label: model === defaultModel ? `${model} (default)` : model,
  }));
  const selected = models.find(model => model.toLowerCase() === value.toLowerCase());
  if (!selected && value) {
    options.unshift({
      value,
      label: value === defaultModel ? `${value} (default, not in current list)` : `${value} (saved, not in current list)`,
    });
  }
  return { options, selectedValue: selected ?? value };
}

export function ModelSelect({
  id,
  models,
  value,
  defaultModel,
  onChange,
  disabled,
  analyticsId,
}: {
  id: string;
  models: string[];
  value: string;
  defaultModel: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  analyticsId: string;
}) {
  const { options, selectedValue } = buildModelSelectOptions(models, value, defaultModel);

  return (
    <Select data-analytics={analyticsId} value={selectedValue} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-9 text-sm">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
