'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { tripClimatePoints, climateSegments, type ClimateLeg, type CityClimate, type TemperatureUnit } from '@/lib/climate';
import { TemperatureToggle } from './LegClimate';
import { Button } from '@/components/ui/button';
const ClimateChart = dynamic(() => import('./ClimateChart').then(module => module.ClimateChart), { ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-sm text-muted-foreground" role="status">Loading climate chart…</div> });
export function TripClimate({ legs, climate, unit, onToggle, onRetry }: {
  legs: ClimateLeg[]; climate: Record<string, CityClimate | null | undefined>; unit: TemperatureUnit; onToggle: () => void; onRetry: () => void;
}) {
  // Start loading chart code while the database request is in flight, and retain a
  // stable point array while unrelated planner controls render.
  useEffect(() => { if (legs.length) void import('./ClimateChart'); }, [legs.length]);
  const points = useMemo(() => tripClimatePoints(legs, climate, unit), [legs, climate, unit]);
  if (!legs.length) return null;
  const undated = legs.filter(leg => !climateSegments(leg).length).length;
  const missing = new Set(legs.filter(leg => climate[leg.cityId] === null).map(leg => leg.cityId)).size;
  const loading = new Set(legs.filter(leg => climate[leg.cityId] === undefined).map(leg => leg.cityId)).size;
  return <section className="mb-6 min-w-0 border-b pb-5" aria-label="Trip historical climate">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Trip climate</h2><TemperatureToggle unit={unit} onToggle={onToggle} /></div>
    <p className="mt-1 text-xs text-muted-foreground">2021–2025 averages for every dated leg, split by month. Rainfall is the historical monthly total, not the amount predicted during your stay. Stops are spaced equally.</p>
    {loading > 0 && points.length ? <div className="flex h-64 items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground" role="status">Loading trip climate… {new Set(legs.map(leg => leg.cityId)).size - loading} of {new Set(legs.map(leg => leg.cityId)).size} cities ready</div> :
      points.length ? <ClimateChart points={points} unit={unit} /> : <p className="py-5 text-sm text-muted-foreground">Add travel dates to see the trip climate graph.</p>}
    <p className="text-xs text-muted-foreground">Gridded estimates from Open-Meteo / ECMWF · mean temperature and precipitation (including snow water equivalent).</p>
    {(undated > 0 || loading > 0 || missing > 0) && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
      {undated > 0 && <span>{undated} undated or invalid-date {undated === 1 ? 'leg omitted' : 'legs omitted'}.</span>}
      {loading > 0 && <span>Loading climate for {loading} {loading === 1 ? 'city' : 'cities'}…</span>}
      {missing > 0 && <><span>Climate unavailable for {missing} {missing === 1 ? 'city' : 'cities'}; gaps are left empty.</span><Button size="sm" variant="ghost" onClick={onRetry}>Retry climate</Button></>}
    </div>}
  </section>;
}
