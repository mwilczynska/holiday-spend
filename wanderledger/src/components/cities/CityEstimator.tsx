'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CityEstimatorProps {
  cityId: string;
  cityName: string;
  country: string;
  currencyCode?: string;
  onEstimated: () => void;
}

export function CityEstimator({ cityId, cityName, country, currencyCode, onEstimated }: CityEstimatorProps) {
  const [loading, setLoading] = useState(false);
  const [xoteloKey, setXoteloKey] = useState('');
  const [result, setResult] = useState<{ message: string; reasoning?: string; confidence?: string; sources?: Record<string, string> } | null>(null);

  const handleEstimate = async (sources: string[]) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cities/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          cityName,
          country,
          currencyCode: currencyCode || 'USD',
          sources,
          xoteloLocationKey: xoteloKey || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const fieldCount = Object.keys(data.data?.estimate || {}).length;
        const sourceList = sources.join(' + ');
        setResult({
          message: `Updated ${fieldCount} fields from ${sourceList}${data.data?.llmProvider ? ` (${data.data.llmProvider})` : ''}`,
          reasoning: data.data?.reasoning,
          confidence: data.data?.confidence,
          sources: data.data?.sources,
        });
        onEstimated();
      } else {
        setResult({ message: `Error: ${data.error}` });
      }
    } catch {
      setResult({ message: 'Error: estimation failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
      <p className="text-sm font-medium">Estimate costs for {cityName}</p>

      <div>
        <Label className="text-xs">Xotelo Location Key (from TripAdvisor URL)</Label>
        <Input
          className="h-8 text-xs"
          placeholder="e.g. g293924"
          value={xoteloKey}
          onChange={(e) => setXoteloKey(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => handleEstimate(['xotelo'])} disabled={loading}>
          {loading ? 'Estimating...' : 'Xotelo Only'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleEstimate(['llm'])} disabled={loading}>
          {loading ? 'Estimating...' : 'LLM Only'}
        </Button>
        <Button size="sm" variant="default" onClick={() => handleEstimate(['xotelo', 'llm'])} disabled={loading}>
          {loading ? 'Estimating...' : 'Xotelo + LLM'}
        </Button>
      </div>

      {result && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{result.message}</p>
          {result.confidence && (
            <Badge variant={result.confidence === 'high' ? 'default' : result.confidence === 'medium' ? 'secondary' : 'outline'} className="text-xs">
              Confidence: {result.confidence}
            </Badge>
          )}
          {result.reasoning && (
            <p className="text-xs text-muted-foreground border-l-2 pl-2 mt-1">{result.reasoning}</p>
          )}
          {result.sources && Object.keys(result.sources).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Array.from(new Set(Object.values(result.sources))).map(src => (
                <Badge key={src} variant="outline" className="text-xs">{src}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
