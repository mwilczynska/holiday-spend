# Handover — City Cost Methodology v4

**As at 27 July 2026.** Read `docs/product/methodology-v4.md` first; this note covers what is done, what is blocked, and what to do next.

## Where things stand

The v4 design replaces v3's observed-first programme, which reached 156 of 684 pilot cells and zero complete cities. v4 measures price *level* cheaply and models tier *structure*, refreshing only level.

Two halves, at very different maturity:

| Half | Status |
| --- | --- |
| **Collection contract** (`docs/prompts/llm_prompt_city_anchors_v4.md`) | Tested end to end across 20+ runs on five cities with a small, fast model |
| **App integration** | Not started. No v4 calculator, no anchor schema, no ingestion route |

~~Nothing is committed.~~ **Corrected 31 July 2026:** that work landed in commits `7db267f`..`63d873a`. The
methodology, the prompt, the scoring scripts, and the dry-run artifacts are all committed. Note also that
`METHODOLOGY-new.md` was renamed to `docs/product/methodology-v4.md` in the same cleanup, and that its
§9.4.4 conflicts with `docs/dev/plans/accommodation-collection-v4.md` — see decision **D1** in `/PLAN.md`.

## What is settled

**Ratio models.** A closed 99-city sample — every city in the 121-city production dataset was attempted — settles the model forms. All four selections now agree between the full sample and a strict sample excluding thin sources, which was the condition missing at n=85.

```
midrange ~ inexpensive     R0    T = 5.7388 · A
mcmeal   ~ inexpensive     R1    k_low 1.7260  k_mid 1.0898  k_high 0.6452
cappuccino ~ beer          R1    k_low 1.1304  k_mid 1.0614  k_high 0.6629
attraction ~ inexpensive   —     no relationship exists; 242× ratio spread
```

Accuracy is 18–22% median, not the 15% originally targeted, and the recommendation is to publish a ≤25% gate rather than leave an unmet target in place.

**Direct lookups.** Eleven of fourteen measures now come from named URL templates rather than open search:

- Food and drink: the anchor source's city page, both bare and country-suffixed slugs
- Hotels: `booking.com/{onestar,twostars,threestars,fourstars}/city/<cc>/<city>.html` and `us.trip.com/hotels/star{2,3,4}/city/<cc>/<city>.html`
- Hostels: `hostelworld.com/hostels/<region>/<country>/<city>/` and its `/f/private-rooms/` path

This was the single highest-value change made. Prague went from 0, 1, 2, 2, 2 accommodation classes across five runs to 5, 5, 4 across three.

## What is blocked, and why

**Accommodation ground truth.** The ~50% hotel-class bias rests on one city. Extending it needs direct property quotes elsewhere, and an attempt returned zero usable quotes from 11 tries: hotel booking engines need date-picker interaction and are commonly bot-protected (403, empty JS responses, dead domains). This is **not** a prompt or budget problem — it needs browser automation or manual collection. See §9.4.7.

**An untested candidate rides on that.** The aggregator page carries both a headline average and a property list, and their geometric mean landed +3.9% and +14.2% from Copenhagen's ground truth where the individual bases were +54% and −15/−30%. It costs nothing extra to compute. It is recorded in §9.4.4 and deliberately **not** adopted, because one city is exactly the evidence base that produced an earlier wrong reversal.

## Next steps, in order

1. **Collect accommodation ground truth in three or four cities** by whatever mechanism works — browser automation, or by hand. This unblocks both the bias figure and the geometric-mean test, and it is the highest-value work outstanding.
2. **Calibrate the four shipped ratios** (§7.8). The fitted relationships are *proxies* — they settle whether each model needs cost bands, not the coefficient values. ~160 paired observations across 20 cities, one-off.
3. **Build the ingestion path**: an anchor schema with the validation gates of §9.2, the deterministic 19-tier calculator of §7.1, and persistence. Then build the paced 121-city batch collector.
4. **Rewrite `docs/product/archive/methodology-v2-v3.md`** at ship time. It still documents v2.1/v3 and backs `/estimates`.

## Traps worth knowing before you touch this

Each of these cost real time to discover.

**A model's stated reason for a failure is a hypothesis, not evidence.** Runs reported booking.com as *"blocking automated access"* while other runs read it fine, and reported `no_page` on a source that was returning HTTP 429. Both were believed for a revision or two. Verify independently — it is usually one command.

**Most "model unreliability" was contract defects.** A single-currency rule made the model discard usable prices; a dated-search preference asked for something the tool class cannot do; a ratio envelope derived from the dataset being replaced rejected correct observations for four cities. In each case the model obeyed correctly and the instruction was wrong.

**Do not ask a model to grade its own work.** `overallConfidence` and `ladderStep` were wrong in every run, always flatteringly, even when the rule was spelled out as arithmetic. Both were removed and are now derived server-side. Never ask for something you can observe.

**A contract that fights the shape of its sources will lose.** A single-basis rule across accommodation achieved 3/11 compliance, and all three were accidents. Hostel pages publish property lists, hotel pages publish averages; the rule now matches that rather than overriding it.

**Check the underlying record, not your own summary.** A basis ranking was built on a "5.8% from ground truth" figure that turned out to be a travel blog's "from" price. The verification took one command and was skipped.

## Rate limiting

The anchor source limits by IP: ~40 rapid fetches triggered 429, escalating to 503, cleared only by changing address. Batch builds need 10–15 cities/day with checkpointing. Steady-state household use never approaches this.

**On a rate-limited response, defer the city — never fall through to search.** That difference is exact values versus 10–19% error, and only `directLookup.outcome` distinguishes them afterwards.

## Files

| Path | What it is |
| --- | --- |
| `docs/product/methodology-v4.md` | The methodology. §9.1 is the prompt's source of truth |
| `docs/prompts/llm_prompt_city_anchors_v4.md` | Generated from §9.1 — never edit directly, regenerate |
| `scripts/fit-city-cost-ratios.mjs` | Ratio model fitting; deterministic |
| `scripts/score-anchor-prompt-test.mjs` | Scores prompt output against ground truth |
| `scripts/combine-anchor-samples.mjs` | k-sample combination and coverage analysis |
| `scripts/score-accommodation-bias.mjs` | Headline-vs-direct-quote bias; refuses to correct on under 3 cities |
| `data/reference/dry-run/` | Anchor samples, selection rules, fit results |

The scoring scripts take `TEST_DIR` pointing at a directory of prompt outputs.
