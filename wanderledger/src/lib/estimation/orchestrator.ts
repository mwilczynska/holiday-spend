import type { CityEstimateData } from '@/types';
import * as xoteloClient from './xotelo-client';
import { getLLMProvider } from './llm-provider';
import { buildEstimationPrompt } from './prompt';

interface EstimationRequest {
  cityName: string;
  country: string;
  currencyCode?: string;
  sources: string[];
  xoteloLocationKey?: string;
  audRate?: number;
}

interface EstimationResult {
  data: Partial<CityEstimateData>;
  sources: Record<string, string>;
  reasoning?: string;
  confidence?: string;
  xoteloRaw?: unknown;
  llmProvider?: string;
}

export async function estimateCity(req: EstimationRequest): Promise<EstimationResult> {
  const results: { source: string; data: Partial<CityEstimateData> }[] = [];
  let xoteloRaw: unknown;
  let reasoning: string | undefined;
  let confidence: string | undefined;
  let llmProvider: string | undefined;

  // Xotelo for accommodation prices
  if (req.sources.includes('xotelo') && req.xoteloLocationKey) {
    const xoteloData = await xoteloClient.getAccommodationPrices(
      req.xoteloLocationKey,
      req.audRate ?? 1
    );
    results.push({ source: 'xotelo', data: xoteloData });
    xoteloRaw = xoteloData;
  }

  // LLM estimation
  if (req.sources.includes('llm')) {
    const provider = await getLLMProvider();
    if (provider) {
      try {
        const prompt = buildEstimationPrompt({
          cityName: req.cityName,
          country: req.country,
          currencyCode: req.currencyCode || 'USD',
          audRate: req.audRate ?? 1,
        });
        const llmResult = await provider.estimate(
          { cityName: req.cityName, country: req.country, currencyCode: req.currencyCode || 'USD', audRate: req.audRate ?? 1 },
          prompt
        );
        results.push({ source: 'llm', data: llmResult.data });
        reasoning = llmResult.reasoning;
        confidence = llmResult.confidence;
        llmProvider = provider.name;
      } catch (err) {
        console.error('LLM estimation failed:', err);
      }
    }
  }

  // Merge results with priority: xotelo > llm (xotelo is most reliable for accommodation)
  const merged: Partial<CityEstimateData> = {};
  const sources: Record<string, string> = {};

  // Apply in reverse priority order so higher-priority sources overwrite
  const priorityOrder = ['llm', 'numbeo', 'xotelo'];
  const sortedResults = [...results].sort(
    (a, b) => priorityOrder.indexOf(a.source) - priorityOrder.indexOf(b.source)
  );

  for (const result of sortedResults) {
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== undefined && value !== null) {
        (merged as Record<string, unknown>)[key] = value;
        sources[key] = result.source;
      }
    }
  }

  return { data: merged, sources, reasoning, confidence, xoteloRaw, llmProvider };
}
