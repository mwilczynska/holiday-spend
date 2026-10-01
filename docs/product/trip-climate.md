# Trip climate data and methodology

This document defines the data contract for the trip-climate feature. The active implementation and
verification status are tracked in [`PLAN.md`](../../PLAN.md).

## Data period

Use the five most recent complete calendar years: **2021–2025**, pinned as of 1 October 2026. This is more current
for trip planning than the earlier 2001–2020 proposal. Keep the period fixed during routine refreshes so results
remain comparable and reproducible. Moving to a later five-year window requires an explicit methodology and cache
version update; do not roll the years forward automatically.

Five years capture recent conditions while remaining a short and variable sample. These values are recent historical
averages, not a standard 30-year climate normal, a forecast, or a prediction for particular travel dates.

## Sources and provenance

- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), using the archive
  endpoint with `models=era5_seamless`.
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), whose location records are based on
  [GeoNames](https://www.geonames.org/).
- The underlying [ECMWF/Copernicus ERA5-Land dataset](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land)
  supplies higher-resolution land temperature; [ERA5](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview)
  supplies precipitation. ERA5 and ERA5-Land are reanalysis datasets, which combine model output with observations
  to make a spatially complete historical record.

Attribute the displayed data to Open-Meteo and ECMWF/Copernicus ERA5 and ERA5-Land; location search is based on
Open-Meteo / GeoNames.

The archive request covers 2021-01-01 through 2025-12-31 and requests these daily variables: mean, maximum and
minimum 2 m temperature, and precipitation sum. It sets `timezone=auto`, `temperature_unit=celsius`, and
`precipitation_unit=mm`. Daily values must be present and valid for every date in the 1,826-day period; incomplete
or invalid responses fail closed rather than filling gaps with zero or a substitute.

City lookup uses the saved city name and its canonical ISO 3166-1 alpha-2 country code. Accept only a normalized exact
name match in that country for a populated place or island; ambiguous or missing matches remain unavailable.
Saved destination qualifiers use explicit country-checked aliases and administrative metadata. Pu Luong uses
a sourced OpenStreetMap reserve coordinate because name search resolves an unrelated mountain. Koh Lanta uses
the exact GeoNames Ko Lanta Yai island feature in Krabi. These resolved location sources are retained with the record. The response
provenance includes the resolved location and coordinates plus the exact archive request URL, which identifies the
model, date range, variables, units, and coordinates used.

ERA5-Seamless combines ERA5-Land temperature data at about 0.1° (roughly 11 km) with ERA5 precipitation at about
0.25° (roughly 25 km), according to the [Open-Meteo model and variable documentation](https://open-meteo.com/en/docs/historical-weather-api).
Open-Meteo's default land-cell selection uses a 90 m elevation model to find a suitable grid cell. The temperature
and precipitation values can therefore represent different grid scales for the same city coordinate.

## Monthly calculations

For each calendar month, average the daily values across all matching days in 2021–2025:

- Monthly mean temperature is the average of daily mean temperatures.
- Average daily high and average daily low are calculated from daily maximum and minimum temperatures in the same way.
  These values are retained in the climate response but are hidden in the current UI.
- Average monthly precipitation is calculated by summing daily precipitation totals separately for each of the five
  years, then averaging those five monthly totals. It includes snow water equivalent and is not a predicted total for
  the length of a stay.

Monthly temperature means are weighted by the number of daily values in each month across the period, including the
2024 leap day. Monthly precipitation gives each year's total equal weight. Temperature conversion to Fahrenheit is
`°F = °C × 9/5 + 32`; precipitation remains in millimetres per month.

On itinerary cards, show the historical monthly mean temperature and average monthly precipitation for each occupied
month. The annual view contains all twelve month values. The trip chart places one point per itinerary-month segment
using that segment's calendar month averages; it does not scale monthly precipitation by nights or interpolate a
weather forecast. The departure date is exclusive, matching the planner's nights convention. Undated legs can show
the annual view but have no seasonal point.

## Persistence and keys

Use no provider API keys. The geocoding and archive requests use public endpoints without credentials; no provider
secret is sent to the browser or stored by this feature.

Store the twelve monthly records, including mean/high/low temperatures, location/grid provenance, source URL,
collection time and data version in SQLite `city_climate`. Ordinary planner loads use one bulk database request for
the complete itinerary. They do not refresh saved data or expire it on a timer. A legacy city without a record is
collected once on first use; failed attempts are persisted so page loads do not repeatedly hit the provider.

City generation and regeneration explicitly collect weather and replace a successful saved record. Manual city
creation also collects weather. Weather failure does not discard a valid cost estimate. A failed weather refresh
retains a prior valid record with its original collection date and a visible failed-refresh note; a first failure
stays missing. Retry controls explicitly retry missing records. Changed city identity or a new data version invalidates
the prior record. Coalesce simultaneous requests for the same city and allow at most three upstream collections.

The chart bundle begins loading alongside the database request. During an initial collection, the trip chart holds
a fixed-height loading state until all requested cities have settled, then draws the complete result once. Individual
card values can become available during collection. Every itinerary card renders; there is no twelve-card cap or
Show all / Show next control. Partial and unavailable results leave gaps rather than joining fabricated points.

The date range stays fixed when city weather refreshes, though an upstream retrospective data revision can change a
result. Saved weather survives process restarts and production rebuilds in the application's canonical database.

## Limitations

Reanalysis combines observations with numerical models to provide a spatially complete estimate; it is not a local
weather-station record. Grid-cell averages smooth neighborhood variation and may miss microclimates, local terrain,
urban heat, and conditions at a particular hotel or trail. ERA5-Land and ERA5 use different spatial resolutions for
temperature and precipitation. Open-Meteo's elevation-aware land-cell selection helps choose a relevant cell, but it
does not make gridded data equivalent to a station observation.

The five-year window can be shifted by a small number of unusual years and should not be read as a long-term normal.
Average daily high and low are typical daily extremes for the month, not record extremes. Precipitation includes snow
water equivalent, so the interface's rainfall label is a travel-friendly shorthand for total precipitation. Missing
or ambiguous city data stays unavailable and leaves a gap in the trip chart.
