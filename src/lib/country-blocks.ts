export interface CountryBlockRef {
  countryId: string;
  blockIndex: number;
  blockId: string;
}

/**
 * Assigns each itinerary item to the uninterrupted country block it belongs to.
 * A missing country breaks a block so a later visit to the same country is kept
 * separate from the earlier visit.
 */
export function createCountryBlockRefs<T>(
  items: readonly T[],
  getCountryId: (item: T) => string | null | undefined
): Array<CountryBlockRef | null> {
  let previousCountryId: string | null = null;
  let blockIndex = -1;

  return items.map((item) => {
    const countryId = getCountryId(item) ?? null;
    if (!countryId) {
      previousCountryId = null;
      return null;
    }

    if (countryId !== previousCountryId) {
      blockIndex += 1;
      previousCountryId = countryId;
    }

    return {
      countryId,
      blockIndex,
      blockId: `${countryId}:${blockIndex}`,
    };
  });
}
