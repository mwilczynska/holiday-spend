# Intercity transport estimation

**Status:** active planner feature; directional accuracy calibration in progress  
**Last updated:** 26 August 2026

This document describes the separate LLM-backed intercity transport feature. It is not part of the city-cost
methodology. The result is a budgeting aid, not a guaranteed fare or a booking quote.

## Scope and unit

- The estimate is one-way and attached once to the destination itinerary leg.
- It covers the planner's configured traveller count and uses standard adult pricing.
- Amounts are returned and stored as whole-number AUD totals.
- The city-cost model does not include local or intercity transport. A user can still enter a manual transport row or
  override an estimate.
- No paid fare API or deterministic fare formula is used. The model may use live web grounding when the provider
  supports it and otherwise makes a clearly labelled conservative estimate.

## Runtime pipeline

1. `POST /api/itinerary/legs/[id]/estimate-transport` authenticates the user, resolves the origin and destination
   legs, derives the destination travel date, loads city/country metadata, obtains the planner group size, and builds
   route facts (same-country/cross-border, region relationship, and traveller count).
2. The server combines those facts with the allowed modes, optional booking/reference context, and extra context in
   the frozen [`llm_prompt_intercity_transport_1.md`](../prompts/llm_prompt_intercity_transport_1.md) contract. The
   prompt requests plausible one-way options only: flight, train, bus, ferry, drive, or rental car.
3. The selected provider adapter receives the selected model and provider-native reasoning effort:
   - OpenAI Responses API with `web_search_preview` when available.
   - Anthropic Messages API with `web_search_20250305` when available.
   - Gemini `generateContent` with Google Search grounding when available.
4. If a browse/grounding request fails, the same provider is retried through the strict JSON fallback transport. The
   response records the fallback reason and no longer claims web grounding. If no usable key/provider response is
   available, the request fails closed; it does not invent a value.
5. The server extracts a JSON object (including a fenced/object substring recovery for provider wrappers) and validates
   it with Zod. It then removes duplicate modes, keeps at most four options, trims explanatory fields, rounds each
   `total_aud` to a whole AUD amount, and forces `transport_row_draft.cost` to equal that rounded total.
6. The API returns the options plus assumptions, confidence, source basis, notes, search queries, citations, provider,
   model, prompt version, and fallback metadata. The user reviews the choices; only an explicit apply action saves a
   transport row. In the bulk flow, the selected top option is applied to its matching leg and transport rows remain
   attached to the correct destination leg.

The planner's existing allocation engine adds saved intercity transport once to the destination leg's total (rather
than once per night). Multiple transport rows on a leg are summed, so a user can represent a multi-part journey.

## What the estimate means

The model is asked to use current search/grounding evidence when it can, but search results can be incomplete, stale,
seasonal, tax-exclusive, or unavailable for a future date. `source_basis`, `notes`, `confidence`, assumptions, and
citations are therefore part of the returned review surface. A web-grounded response is still an estimate; a fallback
response is explicitly less evidenced. Users should replace it with a booking or operator quote when they have one.

## Directional accuracy smoke

The repeatable helper in `src/lib/transport-estimation-accuracy.ts` compares one returned option per route with a
same-assumption reference quote. It reports, per route:

- absolute error in AUD;
- relative error against the reference total;
- provider/model, search/fallback path, queries, citations, and assumptions; and
- missing modes and rows outside the selected tolerance.

It also reports matched and missing-route counts, median and min/max error summaries, and outliers. This is explicitly
directional and is not a statistical benchmark.

The mocked pipeline smoke in `src/lib/transport-estimation-accuracy.test.ts` covers four route classes:

| Route class | Example shape | Mode |
| --- | --- | --- |
| Domestic short | Sydney → Canberra | train |
| Domestic long | Sydney → Perth | flight |
| International short | Paris → Brussels | train |
| International long | Tokyo → London | flight |

The fixtures run through the actual OpenAI adapter response parsing, option normalization, provenance collection, and
report helper. The focused run on 26 August 2026 passed **7 tests** (four pipeline/report cases plus the existing
provider transport checks). The fixture totals are deliberately synthetic and are not observed fares.

The live calibration step remains open: capture same-day operator or aggregator quotes for the same route, date,
traveller count, direction, mode, and fare assumptions, then feed those references into the report. Only after that
comparison should an initial tolerance or need for more routes be chosen. No synthetic value in the repository is
presented as an independent accuracy observation.

## Implementation references

- Prompt contract: `docs/prompts/llm_prompt_intercity_transport_1.md`
- Provider and schema pipeline: `src/lib/transport-estimation.ts`
- Bulk bounded concurrency: `src/lib/bulk-transport-estimation.ts`
- Accuracy report: `src/lib/transport-estimation-accuracy.ts`
- Repeatable smoke: `src/lib/transport-estimation-accuracy.test.ts`
