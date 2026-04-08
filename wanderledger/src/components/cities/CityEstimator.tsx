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
  const [result, setResult] = useState<{
    message: string;
    reasoning?: string;
    confidence?: string;
    sources?: Record<string, string>;
    fallbackLog?: string[];
  } | null>(null);

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
          fallbackLog: data.data?.fallbackLog,
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
      <div>
        <p className="text-sm font-medium">Estimate costs for {cityName}</p>
        <p className="text-xs text-muted-foreground">
          Hybrid mode uses structured price anchors first, Xotelo as optional accommodation input,
          then optionally fills remaining gaps with the LLM.
        </p>
      </div>

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
        <Button size="sm" onClick={() => handleEstimate(['hybrid'])} disabled={loading}>
          {loading ? 'Estimating...' : 'Hybrid'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleEstimate(['hybrid', 'xotelo'])} disabled={loading}>
          {loading ? 'Estimating...' : 'Hybrid + Xotelo'}
        </Button>
        <Button size="sm" variant="default" onClick={() => handleEstimate(['hybrid', 'xotelo', 'llm'])} disabled={loading}>
          {loading ? 'Estimating...' : 'Hybrid + Xotelo + LLM Fill'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleEstimate(['llm'])} disabled={loading}>
          {loading ? 'Estimating...' : 'LLM Only'}
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
          {result.fallbackLog && result.fallbackLog.length > 0 && (
            <div className="space-y-1 rounded border bg-background/70 p-2">
              <p className="text-[11px] font-medium text-foreground">Fallback log</p>
              {result.fallbackLog.map((entry) => (
                <p key={entry} className="text-[11px] text-muted-foreground">
                  {entry}
                </p>
              ))}
            </div>
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
