# Experiment 013-v6-1-resumable-delegated-canary - delegated v6.1 operational canary verdict

**Run:** 2026-08-13T03:40:52.649Z
**Result:** FAIL
**Complete cities:** 19/20 (required 19/20)
**Artifact candidates:** 0/20 (0.0%; maximum 30%)
**Call frame:** 60 registered, 60 terminal, 0 pending; 60 raw responses and 60 telemetry records present
**Calls:** 60 source-call records, 62 actual provider calls, 11 assignment attempts, 60 valid responses, 2 invalid responses, 2 retries
**Searches / direct reads:** 167 / 0
**Observed measures:** {"hotel_3star_room_2p":10,"byt_food_budget_per_person_day":18,"byt_food_mid_per_person_day":18,"byt_food_high_per_person_day":18,"byt_activities_budget_per_person_day":18,"byt_activities_mid_per_person_day":18,"byt_activities_high_per_person_day":18,"cappuccino_1":19,"domestic_draft_beer_1":19}
**Source statuses:** {"expedia_3star":{"complete":10,"not_found":10},"budgetyourtrip_daily_tiers":{"complete":18,"not_found":2},"numbeo_drinks":{"not_found":1,"complete":19}}
**Category direct/fallback:** {"accommodation":{"direct":10,"fallback":10},"food":{"direct":18,"fallback":2},"drinks":{"direct":17,"fallback":3},"activities":{"direct":18,"fallback":2}}
**Tier grades:** {"C":84,"B":118,"D":107,"definitional":20,"A":51}; all-prior cities: 0
**Orphans:** 0 raw, 0 telemetry
**Persistence/API provenance equality:** 20/20 cities
**Artifact signatures:** None.

The registered delegated canary failed. Do not proceed to migration; inspect the listed contract failures without tuning coefficients.

## Gate details

- Prague: budgetyourtrip_daily_tiers response failed schema/limit validation: telemetry promptVersion invalidated_duplicate_assignment:llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md does not match llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md
- Prague: numbeo_drinks response failed schema/limit validation: telemetry promptVersion invalidated_duplicate_assignment:llm_prompt_city_cost_v6_1_numbeo_drinks.md does not match llm_prompt_city_cost_v6_1_numbeo_drinks.md

The delegated canary is not a statistical claim about authenticated provider runtime reliability. The user-key 3–5-city smoke remains pending before cutover. Holdouts and the live CSV were untouched.
