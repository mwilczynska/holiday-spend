import { loadCountries } from './city-library-data';
import { loadEstimates } from './estimate-data';

export async function loadDatasetData() {
  const [countries, estimates] = await Promise.all([loadCountries(true), loadEstimates(true)]);
  const provenanceByCityId = new Map(estimates.rows.map(row => [row.cityId, row.currentEstimateProvenance]));
  return {
    countries: countries.map(country => ({ ...country, cities: country.cities.map(city => ({
      ...city, currentEstimateProvenance: provenanceByCityId.get(city.id) ?? null,
    })) })).sort((a,b) => a.name.localeCompare(b.name)),
    history: estimates.history, historyCount: estimates.summary.historyCount,
  };
}
