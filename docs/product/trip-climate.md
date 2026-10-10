# Trip climate

How the planner shows typical weather for each stay. The values are recent historical averages. They are not a
forecast, and not a 30-year climate normal.

## 1. What is shown

For each city and calendar month, averaged over **2021 to 2025**:

| Value | Calculation |
| --- | --- |
| Mean temperature | Average of the daily mean temperatures for every day in that month across the five years |
| Average daily high and low | The same, using daily maximum and minimum temperatures |
| Monthly precipitation | Total precipitation in that month for each year, averaged over the five years. Includes snow as water equivalent. Labelled rainfall in the app |

Temperatures are in Celsius by default. A shared C/F switch converts all views (°F = °C × 9/5 + 32). Precipitation is
in millimetres per month.

Where they appear:

- **Itinerary cards** show the mean temperature and precipitation for each month the stay covers.
- **The annual view** shows all twelve months and names the source model.
- **The trip chart** has one point per day. Each day of a stay shows that month's mean temperature, with the average
  daily low to high as a band and precipitation as a shaded area on its own axis. Gaps between stays, and cities with
  no data, break the line. Hovering a date shows its values. A Today line appears when today is within the chart.

Monthly precipitation is not scaled to the length of a stay. Undated legs show the annual view only. The departure
date is not counted as a day of the stay.

## 2. Where the data comes from

- **Weather:** the Open-Meteo historical archive, model `era5_seamless`. This combines ERA5-Land temperature (a grid
  of about 11 km) with ERA5 precipitation (about 25 km). Both are ECMWF/Copernicus reanalysis datasets: model output
  combined with observations to give complete coverage. No API key is needed.
- **Location:** the Open-Meteo geocoder (based on GeoNames), searched with the city name and its country code.

The request covers 1 January 2021 to 31 December 2025 and asks for daily mean, maximum and minimum temperature and
daily precipitation. Every one of the 1,826 days must be present and within range. If any day is missing or invalid,
the city has no climate data rather than partial data.

### Choosing the location

The geocoder result must be in the city's country, be a populated place or an island, and match the name exactly
(ignoring accents and case). If several places match, the largest is used only if it has at least ten times the
population of the next; otherwise the city has no climate data.

Some cities need help. These are listed in `src/lib/climate-provider.ts`:

- **Search hints** where the travel name differs from the geocoder's name, or where several places share it. For
  example, Tromso is searched as Tromsø, San Sebastian as Donostia / San Sebastian in the Basque Country, and Suzhou is
  limited to Jiangsu.
- **Fixed points** where the geocoder's only match is the wrong place, or there is none. For example, the only
  "Querétaro" it knows is a village in Chiapas, and the only populated "Cotopaxi" is 150 km from the national park.
  Each fixed point records its source (the geocoder or OpenStreetMap). A saved record that disagrees with a fixed point
  is collected again.

### One model exception: Salento, Colombia

Salento uses Open-Meteo's `ecmwf_ifs` model (9 km grid) instead of ERA5. ERA5 gave about 14,200 mm of rain a year,
with July the wettest month. Station records published by regional authorities show about 2,550 mm a year, with July
and August the driest months. ECMWF IFS gave 3,127 mm a year with a seasonal pattern that matches the stations. The
model is chosen only for this city; there is no automatic switching between models and no adjustment of values.

## 3. When data is collected

- Generating, regenerating or manually adding a city collects its climate.
- A city without a saved record is collected once, the first time the planner needs it. A failed attempt is saved so
  page loads do not keep retrying; retry controls are available.
- Ordinary planner loads read saved records only. Records do not expire.
- If a refresh fails, the previous record is kept and labelled with its original date and the failed refresh. A city
  that has never been collected successfully stays without data.
- Renaming a city, changing its country, or changing the data version (`era5_seamless_2021_2025_v1`) invalidates the
  saved record.
- A climate failure never blocks saving a city's cost estimate.

At most three collections run at once, and simultaneous requests for the same city are combined. Saved records hold
the twelve months, the resolved location and its source, the grid, the exact request URL, the collection time and the
data version, in the SQLite table `city_climate`.

The 2021 to 2025 period is fixed. Moving to a later period requires a new data version.

## 4. Limitations

- Reanalysis is a grid-cell estimate, not a weather station. It smooths out local terrain, coastal effects, urban heat
  and conditions at a particular hotel or trail.
- Temperature and precipitation come from grids of different sizes.
- Five years is a short sample, and one unusual year can move an average.
- Highs and lows are typical daily values for the month, not records.
- Open-Meteo can revise its archive, so a refresh can change a city's values even though the period is fixed.

## 5. Code

| Path | Role |
| --- | --- |
| `src/lib/climate.ts` | Period constants |
| `src/lib/climate-provider.ts` | Geocoding, search hints, fixed points, model choice, monthly calculation |
| `src/lib/city-climate-service.ts` | Storage, data version, refresh and retry rules |
| `src/components/itinerary/TripClimateChart.tsx` | Trip chart |
