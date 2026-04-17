'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CostField {
  key: string;
  label: string;
  group: string;
}

export const COST_FIELDS: CostField[] = [
  // Accommodation
  { key: 'accomHostel', label: 'Shared Hostel Dorm', group: 'Accommodation (per night, 2 ppl)' },
  { key: 'accomPrivateRoom', label: 'Private Room', group: 'Accommodation (per night, 2 ppl)' },
  { key: 'accom1star', label: '1-Star', group: 'Accommodation (per night, 2 ppl)' },
  { key: 'accom2star', label: '2-Star', group: 'Accommodation (per night, 2 ppl)' },
  { key: 'accom3star', label: '3-Star', group: 'Accommodation (per night, 2 ppl)' },
  { key: 'accom4star', label: '4-Star', group: 'Accommodation (per night, 2 ppl)' },
  // Food
  { key: 'foodStreet', label: 'Street Food', group: 'Food (per day, 2 ppl)' },
  { key: 'foodBudget', label: 'Budget', group: 'Food (per day, 2 ppl)' },
  { key: 'foodMid', label: 'Mid-Range', group: 'Food (per day, 2 ppl)' },
  { key: 'foodHigh', label: 'High-End', group: 'Food (per day, 2 ppl)' },
  // Drink unit prices
  { key: 'drinkLocalBeer', label: 'Local Beer', group: 'Drink Prices (per unit)' },
  { key: 'drinkImportBeer', label: 'Import Beer', group: 'Drink Prices (per unit)' },
  { key: 'drinkWineGlass', label: 'Wine (glass)', group: 'Drink Prices (per unit)' },
  { key: 'drinkCocktail', label: 'Cocktail', group: 'Drink Prices (per unit)' },
  { key: 'drinkCoffee', label: 'Coffee', group: 'Drink Prices (per unit)' },
  // Drink tiers
  { key: 'drinksNone', label: 'None', group: 'Drinks (per day, 2 ppl)' },
  { key: 'drinksLight', label: 'Light', group: 'Drinks (per day, 2 ppl)' },
  { key: 'drinksModerate', label: 'Moderate', group: 'Drinks (per day, 2 ppl)' },
  { key: 'drinksHeavy', label: 'Heavy', group: 'Drinks (per day, 2 ppl)' },
  // Activities
  { key: 'activitiesFree', label: 'Free', group: 'Activities (per day, 2 ppl)' },
  { key: 'activitiesBudget', label: 'Budget', group: 'Activities (per day, 2 ppl)' },
  { key: 'activitiesMid', label: 'Mid-Range', group: 'Activities (per day, 2 ppl)' },
  { key: 'activitiesHigh', label: 'High-End', group: 'Activities (per day, 2 ppl)' },
];

export const COST_FIELD_KEYS = COST_FIELDS.map((field) => field.key);

interface CostEditorProps {
  values: Record<string, number | null>;
  onChange: (key: string, value: number | null) => void;
  sources?: Record<string, string>;
}

export function CostEditor({ values, onChange, sources }: CostEditorProps) {
  const groups = COST_FIELDS.reduce<Record<string, CostField[]>>((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {});

  const SOURCE_BADGES: Record<string, string> = {
    manual: 'bg-gray-100 text-gray-700',
    llm: 'bg-blue-100 text-blue-700',
    numbeo: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([group, fields]) => (
        <div key={group}>
          <h3 className="text-sm font-medium mb-2">{group}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {fields.map((field) => (
              <div key={field.key}>
                <div className="flex items-center gap-1">
                  <Label className="text-xs">{field.label}</Label>
                  {sources?.[field.key] && (
                    <span className={`text-[10px] px-1 rounded ${SOURCE_BADGES[sources[field.key]] || 'bg-gray-100'}`}>
                      {sources[field.key]}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="$"
                  value={values[field.key] ?? ''}
                  onChange={(e) =>
                    onChange(field.key, e.target.value ? parseFloat(e.target.value) : null)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
