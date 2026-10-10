# Intercity transport estimation

How the planner estimates the cost of getting from one city to the next. This is separate from the city cost
methodology (`city-cost-methodology.md`), which does not include transport.

An estimate is a budgeting aid, not a fare quote. When you have a real booking, enter it instead.

## 1. What an estimate is

- A one-way cost from the previous leg's city to this leg's city.
- In whole AUD, for the planner's traveller count, at standard adult fares.
- Attached once to the destination leg. It is not multiplied by nights.
- For one of six modes: flight, train, bus, ferry, drive or rental car.

The price asked for is the **typical fare a traveller would actually book**: a standard, reasonably timed service
from a reputable operator. It is not the cheapest fare on the market, and not a premium or flexible ticket. Where
fares vary widely, the model picks a mid-range figure and says so.

The price covers the named mode between the two cities. A connecting transfer is included only when the route cannot
be travelled without it, such as a ferry to an island. Optional extras (hotel pickup, seat selection, checked bags,
insurance) are excluded. Flights are economy with carry-on only. Drive covers fuel and tolls. Rental cost appears only
under rental car.

## 2. How an estimate is made

1. The server works out the route: the two cities, their countries and regions, whether the route crosses a border,
   the travel date and the traveller count.
2. It sends this to the selected model (OpenAI, Anthropic or Gemini) with the prompt in
   `docs/prompts/llm_prompt_intercity_transport_v1_1.md`. The model may use web search where the provider supports
   it.
3. The model returns up to four options, one per mode. Each has a total in AUD, a confidence label (high, medium or
   low), the basis for the price (live search, typical operator pricing, or a conservative estimate), assumptions and
   notes. Search queries and cited pages are kept when the provider returns them.
4. The server checks the response against a fixed schema, removes duplicate modes, keeps at most four options and
   rounds each total to whole dollars.
5. The options are shown for review. Nothing is saved until the user applies one. In the bulk flow, the top option
   for each leg is applied to that leg.

If the search request fails, the same provider is asked again without web search. That result is marked as not
web-grounded. If a model runs out of output space while reasoning, the search request is retried at a lower reasoning
effort before giving up on search. If no provider responds with a valid answer, the estimate fails and no value is
saved.

A leg can hold several transport rows, which are added together, so a journey with several parts can be entered as
separate rows. Any row can be edited or entered by hand.

## 3. What is recorded

Each estimate returns its options with assumptions, confidence, price basis, notes, search queries, citations,
provider, model, prompt version and whether the no-search fallback was used. Applying an option saves a transport
row with its mode, note and cost.

## 4. Limitations

- The price is a model estimate. Even with web search, search results can be stale, seasonal, missing taxes, or
  unavailable for a future date. Results from the no-search fallback have less evidence behind them.
- The confidence label is the model's judgement, not a measured error.
- Accuracy has been checked on three routes only (section 6). No tolerance is set, and the method is accepted as
  reasonable for budgeting without further calibration.

## 5. Code and files

| Path | Role |
| --- | --- |
| `docs/prompts/llm_prompt_intercity_transport_v1_1.md` | Current prompt |
| `docs/prompts/llm_prompt_intercity_transport_1.md` | v1 prompt, kept as rollback (`TRANSPORT_PROMPT_VERSION=v1`) |
| `src/lib/transport-estimation.ts` | Provider calls, fallback, schema and option clean-up |
| `src/lib/bulk-transport-estimation.ts` | Estimating many legs at once |
| `src/lib/transport-estimation-accuracy.ts` | Report comparing estimates with reference fares |

## 6. Accuracy checks and history

### Prompt versions

v1 did not say which fare to quote. On 5 September 2026, three routes were compared against fares captured the same
day. The v1 estimates were all high, and the median error was 36% against the cheapest listed fare and 25% against a
typical fare. The size of the error depended on which fare was used as the reference, which showed the prompt was not
asking a precise question.

v1.1 states the fare to quote (section 1). Everything else in the prompt is unchanged. Re-run on the same routes
against the typical fare:

| Route | Reference | v1 | v1.1 | v1 error | v1.1 error |
| --- | --- | --- | --- | --- | --- |
| Koh Lanta to Bangkok | A$118 | A$160 | A$115 | 35.6% | 2.5% |
| Bangkok to Phuket | A$96 | A$120 | A$80 | 25.0% | 16.7% |
| Colombo to Chennai | A$400 | A$450 | A$400 | 12.5% | 0.0% |

Median error fell from 25.0% to 2.5%, and the estimates were no longer consistently high. Caveats: three routes, one
run each, one provider (OpenAI `gpt-5.6-luna`, maximum reasoning). The Koh Lanta v1 run had used the no-search
fallback, so part of its improvement comes from regaining search. Two of the four route classes (domestic short and
international long) have no coverage.

The reference fares and runs are in `data/reference/transport_accuracy_references_2026-09-05.json`,
`transport_accuracy_run_2026-09-05.json` and `transport_accuracy_run_v1_1_2026-09-05.json`. The aggregator quoted
fares per adult; the reference file doubles them for two travellers.

An earlier single-route check on 26 August 2026 (Ho Chi Minh City to Can Tho by coach) came in 21% above a public bus
fare.

### Decision, 5 September 2026

The method is accepted as reasonably accurate without further calibration. No tolerance is set and the route set will
not be widened. A tolerance would only matter as a regression check for future prompt or model changes, and earning
one would need fares from several aggregators, normalised to the same basis, plus repeat runs.

### How to re-measure

Re-measure when the prompt, provider or model changes, not on a schedule. Reference fares must be captured on the same
day as the estimates. The owner runs this, because it needs a provider key entered in the app.

1. Start the app with `npm run serve` and open `/plan`.
2. Capture reference fares for the routes being compared, recording each source's fare basis (per adult or per
   booking, cheapest or typical).
3. For each route, run an estimate at the recorded travel date with two travellers. Record the provider, model,
   reasoning effort, whether search or the fallback was used, and the returned options.
4. Pair each result with its reference as a `TransportAccuracyObservation` and pass the set to
   `buildTransportAccuracyReport` in `src/lib/transport-estimation-accuracy.ts`.

Compare against `data/reference/transport_accuracy_run_v1_1_2026-09-05.json`. The question is whether the change moved
the numbers.
