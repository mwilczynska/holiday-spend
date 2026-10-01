'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { climateSegments, MONTH_NAMES, temperature, type CityClimate, type ClimateLeg, type TemperatureUnit } from '@/lib/climate';
const ClimateChart = dynamic(() => import('./ClimateChart').then(module => module.ClimateChart), { ssr: false });

export function TemperatureToggle({ unit, onToggle }: { unit: TemperatureUnit; onToggle: () => void }) {
  return <Button type="button" variant="outline" size="sm" onClick={onToggle} aria-label={`Switch to ${unit === 'C' ? 'Fahrenheit' : 'Celsius'}`}>°{unit} → °{unit === 'C' ? 'F' : 'C'}</Button>;
}
export function LegClimate({ leg, climate, unit, onToggle, onRetry }: {
  leg: ClimateLeg; climate: CityClimate | null | undefined; unit: TemperatureUnit; onToggle: () => void; onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const segments = climateSegments(leg);
  return <section className="mt-3 border-t pt-3" aria-label={`${leg.cityName} historical climate`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">Historical averages · 2021–2025</span>
      <div className="flex gap-2">
        <TemperatureToggle unit={unit} onToggle={onToggle} />
        <Button type="button" variant="ghost" size="sm" disabled={!climate} onClick={() => setOpen(true)}>View year</Button>
      </div>
    </div>
    {climate === undefined ? <p className="text-xs text-muted-foreground" role="status">Loading historical climate…</p> : climate === null ?
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Historical climate unavailable.</span><Button variant="ghost" size="sm" onClick={onRetry}>Retry climate</Button></div> :
      segments.length ? <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map(segment => { const month = climate.months[segment.month - 1]; return <span key={segment.start}>
          <span className="text-muted-foreground">{segment.label}</span>{' · '}<span className="font-medium">{temperature(month.temperatureC, unit).toFixed(1)}°{unit}</span>{' mean · '}{month.rainfallMm.toFixed(0)} mm/month rain
        </span>; })}
      </div> : <p className="text-xs text-muted-foreground">Set valid travel dates to see seasonal averages. The annual view is available.</p>}
    {open && climate && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{leg.cityName} · historical climate</DialogTitle>
          <DialogDescription>Monthly mean temperature and average monthly precipitation, {climate.period}. Gridded historical estimates, not a forecast. Rainfall includes snow water equivalent.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end"><TemperatureToggle unit={unit} onToggle={onToggle} /></div>
        <ClimateChart unit={unit} points={climate.months.map(month => ({ key: String(month.month), label: MONTH_NAMES[month.month - 1], temperature: temperature(month.temperatureC, unit), rainfall: month.rainfallMm }))} />
        <table className="w-full text-sm"><caption className="sr-only">Monthly averages for {leg.cityName}</caption>
          <thead><tr className="border-b text-left"><th className="py-2">Month</th><th>Mean (°{unit})</th><th>Rainfall (mm/month)</th></tr></thead>
          <tbody>{climate.months.map(month => <tr key={month.month} className="border-b last:border-0"><th className="py-2 text-left font-normal">{MONTH_NAMES[month.month - 1]}</th><td>{temperature(month.temperatureC, unit).toFixed(1)}</td><td>{month.rainfallMm.toFixed(0)}</td></tr>)}</tbody>
        </table>
        <p className="text-xs text-muted-foreground">Location: {climate.location.name}, {climate.location.countryCode} ({climate.location.latitude.toFixed(2)}, {climate.location.longitude.toFixed(2)}). <a href={climate.sourceUrl} target="_blank" rel="noreferrer" className="underline">Open-Meteo / {climate.sourceModel === 'ecmwf_ifs' ? 'ECMWF IFS' : 'ERA5'} data</a> · <a href={climate.location.sourceUrl ?? 'https://open-meteo.com/en/docs/geocoding-api'} target="_blank" rel="noreferrer" className="underline">Location source</a>{climate.collectedAt ? ` · Collected ${climate.collectedAt.slice(0, 10)}` : ''}</p>
        {climate.refreshFailedAt && <p className="text-xs text-muted-foreground">The latest refresh failed; showing the saved averages collected {climate.collectedAt?.slice(0, 10)}.</p>}
      </DialogContent>
    </Dialog>}
  </section>;
}
