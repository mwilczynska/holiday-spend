import { db } from '@/db';
import { cities, cityEstimates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { estimateCity } from '@/lib/estimation/orchestrator';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const estimateSchema = z.object({
  cityId: z.string().min(1),
  cityName: z.string().min(1),
  country: z.string().min(1),
  currencyCode: z.string().default('USD'),
  sources: z.array(z.string()).default(['xotelo']),
  xoteloLocationKey: z.string().optional(),
  audRate: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = estimateSchema.parse(body);

    const result = await estimateCity({
      cityName: data.cityName,
      country: data.country,
      currencyCode: data.currencyCode,
      sources: data.sources,
      xoteloLocationKey: data.xoteloLocationKey,
      audRate: data.audRate,
    });

    // Mark previous estimates as inactive
    await db
      .update(cityEstimates)
      .set({ isActive: 0 })
      .where(eq(cityEstimates.cityId, data.cityId));

    // Store new estimate
    const estimate = await db.insert(cityEstimates).values({
      cityId: data.cityId,
      estimatedAt: new Date().toISOString(),
      source: data.sources.join('+'),
      llmProvider: result.llmProvider || null,
      dataJson: JSON.stringify(result.data),
      reasoning: result.reasoning || null,
      confidence: result.confidence || null,
      xoteloData: result.xoteloRaw ? JSON.stringify(result.xoteloRaw) : null,
      isActive: 1,
    }).returning();

    // Update city with estimated values
    if (Object.keys(result.data).length > 0) {
      await db.update(cities).set({
        ...result.data,
        estimationSource: data.sources.join('+'),
        estimatedAt: new Date().toISOString(),
        estimationId: estimate[0]?.id,
      }).where(eq(cities.id, data.cityId));
    }

    return success({
      estimate: result.data,
      sources: result.sources,
      reasoning: result.reasoning,
      confidence: result.confidence,
      llmProvider: result.llmProvider,
    });
  } catch (err) {
    return handleError(err);
  }
}
