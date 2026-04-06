import type { CityEstimateData } from '@/types';

export interface LLMEstimationRequest {
  cityName: string;
  country: string;
  currencyCode: string;
  audRate: number;
}

export interface LLMEstimationResponse {
  data: Partial<CityEstimateData>;
  reasoning?: string;
  confidence?: 'low' | 'medium' | 'high';
}

export interface LLMProvider {
  name: string;
  estimate(req: LLMEstimationRequest, prompt: string): Promise<LLMEstimationResponse>;
}

export async function getLLMProvider(): Promise<LLMProvider | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const { AnthropicProvider } = await import('./providers/anthropic');
    return new AnthropicProvider(anthropicKey);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const { OpenAIProvider } = await import('./providers/openai');
    return new OpenAIProvider(openaiKey);
  }

  return null;
}
