'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CostEditor } from '@/components/cities/CostEditor';
import { CityEstimator } from '@/components/cities/CityEstimator';
import { Plus } from 'lucide-react';

interface City {
  id: string;
  countryId: string;
  name: string;
  estimationSource: string | null;
  [key: string]: unknown;
}

interface Country {
  id: string;
  name: string;
  currencyCode: string;
  cities: City[];
}

export default function CitiesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCity, setNewCity] = useState({ id: '', name: '', countryId: '' });
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/countries');
    const data = await res.json();
    setCountries(
      (data.data || []).sort((a: Country, b: Country) => a.name.localeCompare(b.name))
    );
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allCities = countries
    .flatMap(c => c.cities.map(city => ({ ...city, countryName: c.name, currencyCode: c.currencyCode })))
    .sort((a, b) => a.name.localeCompare(b.name) || a.countryName.localeCompare(b.countryName));

  const handleCitySelect = (cityId: string) => {
    const city = allCities.find(c => c.id === cityId);
    setSelectedCity(city || null);
  };

  const handleCostChange = (key: string, value: number | null) => {
    if (!selectedCity) return;
    const updated = { ...selectedCity, [key]: value };
    setSelectedCity(updated);

    // Debounced save
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(async () => {
      await fetch(`/api/cities/${selectedCity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    }, 500);
    setSaveTimeout(timeout);
  };

  const handleAddCity = async () => {
    if (!newCity.id || !newCity.name || !newCity.countryId) return;
    await fetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCity),
    });
    setAddDialogOpen(false);
    setNewCity({ id: '', name: '', countryId: '' });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">City Cost Editor</h1>
          <p className="text-sm text-muted-foreground">
            View and edit cost estimates for each city. All prices in AUD for 2 people.
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add City
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add City</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Country</Label>
                <SearchableSelect
                  value={newCity.countryId}
                  onValueChange={(value) => setNewCity(p => ({ ...p, countryId: value }))}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  options={countries.map((country) => ({
                    value: country.id,
                    label: country.name,
                  }))}
                />
              </div>
              <div>
                <Label>City ID (slug)</Label>
                <Input value={newCity.id} onChange={(e) => setNewCity(p => ({ ...p, id: e.target.value }))} placeholder="e.g. ho-chi-minh" />
              </div>
              <div>
                <Label>City Name</Label>
                <Input value={newCity.name} onChange={(e) => setNewCity(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ho Chi Minh City" />
              </div>
              <Button onClick={handleAddCity} className="w-full">Add City</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* City selector */}
      <div className="space-y-2">
        <Label>Select City</Label>
        <SearchableSelect
          value={selectedCity?.id || ''}
          onValueChange={handleCitySelect}
          placeholder="Search for a city"
          searchPlaceholder="Type a city or country..."
          options={allCities.map((city) => ({
            value: city.id,
            label: `${city.name}, ${city.countryName}`,
            description: city.estimationSource ? `Source: ${city.estimationSource}` : city.countryName,
            keywords: `${city.name} ${city.countryName} ${city.estimationSource || ''}`,
          }))}
        />
      </div>

      {/* Selected city editor */}
      {selectedCity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedCity.name}
              {selectedCity.estimationSource && (
                <Badge variant="secondary">{selectedCity.estimationSource}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <CityEstimator
              cityId={selectedCity.id}
              cityName={selectedCity.name}
              country={selectedCity.countryId}
              currencyCode={(selectedCity as unknown as { currencyCode?: string }).currencyCode}
              onEstimated={() => {
                fetchData();
                // Re-select to refresh values
                setTimeout(() => handleCitySelect(selectedCity.id), 500);
              }}
            />
            <CostEditor
              values={selectedCity as unknown as Record<string, number | null>}
              onChange={handleCostChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
