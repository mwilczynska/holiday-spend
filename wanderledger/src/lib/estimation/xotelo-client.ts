import type { CityEstimateData } from '@/types';

const XOTELO_BASE = 'https://data.xotelo.com/api';

interface XoteloProperty {
  name: string;
  accommodation_type: string;
  star_rating: number | null;
  price_ranges: {
    minimum: number;
    maximum: number;
  };
}

interface XoteloResponse {
  result: XoteloProperty[];
}

export async function getAccommodationPrices(
  locationKey: string,
  audRate: number = 1
): Promise<Partial<CityEstimateData>> {
  try {
    const res = await fetch(
      `${XOTELO_BASE}/list?location_key=${encodeURIComponent(locationKey)}&limit=50`
    );
    if (!res.ok) throw new Error(`Xotelo API error: ${res.status}`);

    const data: XoteloResponse = await res.json();
    if (!data.result || data.result.length === 0) {
      return {};
    }

    // Bucket by type and star rating
    const hostels: number[] = [];
    const hotels1: number[] = [];
    const hotels2: number[] = [];
    const hotels3: number[] = [];
    const hotels4: number[] = [];

    for (const prop of data.result) {
      const avgPrice = (prop.price_ranges.minimum + prop.price_ranges.maximum) / 2;
      const priceAud = avgPrice * audRate;

      if (prop.accommodation_type === 'Hostel' || prop.accommodation_type === 'Guest house') {
        hostels.push(priceAud);
      } else if (prop.star_rating !== null) {
        if (prop.star_rating <= 1) hotels1.push(priceAud);
        else if (prop.star_rating <= 2) hotels2.push(priceAud);
        else if (prop.star_rating <= 3) hotels3.push(priceAud);
        else hotels4.push(priceAud);
      }
    }

    const median = (arr: number[]) => {
      if (arr.length === 0) return undefined;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return {
      accomHostel: median(hostels),
      accom1star: median(hotels1),
      accom2star: median(hotels2),
      accom3star: median(hotels3),
      accom4star: median(hotels4),
    };
  } catch (error) {
    console.error('Xotelo API error:', error);
    return {};
  }
}
