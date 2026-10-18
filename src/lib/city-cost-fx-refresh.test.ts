import { describe, expect, it } from 'vitest';
import { materializeCityCostV11WithFx } from '@/lib/city-cost-methodology-v1-1';
import { planCityFxRefresh } from '@/lib/city-cost-fx-refresh';
import { ecbObservationToFxProvenance, parseEcbDailyRates } from '@/lib/usd-aud-reference-rate';

const anchors = {
  beer: 2, coffee: 3, inexp_meal_1p: 10, midrange_meal_2p: 40, cocktail: 8, wine_glass: 6,
  hostel_dorm_1p: 12, hostel_private_2p: 30, hotel_1star_2p: 50, hotel_3star_2p: 100,
};
const ecbXml = `<gesmes:Envelope><Cube><Cube time='2026-10-16'>
  <Cube currency='USD' rate='1.1253'/><Cube currency='JPY' rate='170.1'/><Cube currency='AUD' rate='1.6171'/>
</Cube></Cube></gesmes:Envelope>`;

describe('exchange-rate refresh', () => {
  it('derives the USD to AUD cross rate from the ECB daily file', () => {
    const fx = ecbObservationToFxProvenance(parseEcbDailyRates(ecbXml));
    expect(fx.asOfDate).toBe('2026-10-16');
    expect(fx.audPerUsd).toBe(1.437039);
    expect(fx.snapshotId).toBe('ecb-fx-2026-10-16');
    expect(() => parseEcbDailyRates('<Cube/>')).toThrow(/dated USD and AUD/);
  });

  it('reconverts stored USD anchors and leaves hand-edited fields alone', () => {
    const oldFx = ecbObservationToFxProvenance({ asOfDate: '2026-08-25', usdPerEur: 1, audPerEur: 1.4 });
    const newFx = ecbObservationToFxProvenance(parseEcbDailyRates(ecbXml));
    const produced = materializeCityCostV11WithFx(anchors, oldFx).mappedEstimate as Record<string, number>;
    const cityValues = { ...produced, accom3star: 999 };

    const plan = planCityFxRefresh({ anchorsUsd: anchors, fx: newFx, estimateData: produced, cityValues });
    const expected = materializeCityCostV11WithFx(anchors, newFx).mappedEstimate as Record<string, number>;

    expect(plan.manualFields).toEqual(['accom3star']);
    expect(plan.cityUpdates.accom3star).toBeUndefined();
    expect(plan.cityUpdates.accom4star).toBe(expected.accom4star);
    expect(plan.cityUpdates.drinkCoffee).toBe(expected.drinkCoffee);
    expect(plan.estimateData).toEqual(expected);
  });
});
