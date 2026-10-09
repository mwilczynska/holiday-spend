'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { CloudSun } from 'lucide-react';
import { tripClimateSeries, climateSegments, type ClimateLeg, type CityClimate, type TemperatureUnit } from '@/lib/climate';
import { TemperatureToggle } from './LegClimate';
import { Button } from '@/components/ui/button';
const TripClimateChart = dynamic(() => import('./TripClimateChart').then(module => module.TripClimateChart), { ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-sm text-muted-foreground" role="status">Loading climate chart…</div> });
export function TripClimate({ legs, climate, unit, onToggle, onRetry }: {
  legs: ClimateLeg[]; climate: Record<string, CityClimate | null | undefined>; unit: TemperatureUnit; onToggle: () => void; onRetry: () => void;
}) {
  // Start loading chart code while the database request is in flight, and retain a
  // stable series while unrelated planner controls render.
  useEffect(() => { if (legs.length) void import('./TripClimateChart'); }, [legs.length]);
  const series = useMemo(() => tripClimateSeries(legs, climate, unit), [legs, climate, unit]);
  if (!legs.length) return null;
  const undated = legs.filter(leg => !climateSegments(leg).length).length;
  const missing = new Set(legs.filter(leg => climate[leg.cityId] === null).map(leg => leg.cityId)).size;
  const loading = new Set(legs.filter(leg => climate[leg.cityId] === undefined).map(leg => leg.cityId)).size;
  return <section className="min-w-0 rounded-2xl border bg-card p-5" aria-label="Trip historical climate">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-bold"><CloudSun className="h-5 w-5 text-brand-teal" aria-hidden="true" />Trip climate</h2>
      <TemperatureToggle unit={unit} onToggle={onToggle} />
    </div>
    <p className="mb-3 mt-1 text-xs text-muted-foreground">2021–2025 monthly averages for each day of every dated stay. Rainfall is the historical monthly total, not the amount predicted during your stay.</p>
    {loading > 0 && series.points.length ? <div className="flex h-72 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground" role="status">Loading trip climate… {new Set(legs.map(leg => leg.cityId)).size - loading} of {new Set(legs.map(leg => leg.cityId)).size} cities ready</div> :
      series.points.length ? <TripClimateChart points={series.points} stays={series.stays} unit={unit} /> : <p className="py-5 text-sm text-muted-foreground">Add travel dates to see the trip climate graph.</p>}
    <p className="mt-2 text-xs text-muted-foreground">Gridded estimates from Open-Meteo / ECMWF · mean temperature and precipitation (including snow water equivalent).</p>
    {(undated > 0 || loading > 0 || missing > 0) && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
      {undated > 0 && <span>{undated} undated or invalid-date {undated === 1 ? 'leg omitted' : 'legs omitted'}.</span>}
      {loading > 0 && <span>Loading climate for {loading} {loading === 1 ? 'city' : 'cities'}…</span>}
      {missing > 0 && <><span>Climate unavailable for {missing} {missing === 1 ? 'city' : 'cities'}; gaps are left empty.</span><Button size="sm" variant="ghost" onClick={onRetry}>Retry climate</Button></>}
    </div>}
  </section>;
}
