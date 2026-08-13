# Experiment 014-v6-1-final-delegated-canary - delegated v6.1 operational canary verdict

**Run:** 2026-08-13T04:57:24.010Z
**Result:** PASS
**Complete cities:** 20/20 (required 19/20)
**Artifact candidates:** 0/20 (0.0%; maximum 30%)
**Call frame:** 60 registered, 60 terminal, 0 pending; 60 raw responses and 60 telemetry records present
**Calls:** 60 source-call records, 60 actual provider calls, 1 assignment attempts, 60 valid responses, 0 invalid responses, 0 retries
**Searches / direct reads:** 167 / 0
**Observed measures:** {"hotel_3star_room_2p":10,"byt_food_budget_per_person_day":18,"byt_food_mid_per_person_day":18,"byt_food_high_per_person_day":18,"byt_activities_budget_per_person_day":18,"byt_activities_mid_per_person_day":18,"byt_activities_high_per_person_day":18,"cappuccino_1":19,"domestic_draft_beer_1":19}
**Source statuses:** {"expedia_3star":{"complete":10,"not_found":10},"budgetyourtrip_daily_tiers":{"complete":18,"not_found":2},"numbeo_drinks":{"not_found":1,"complete":19}}
**Category direct/fallback:** {"accommodation":{"direct":10,"fallback":10},"food":{"direct":18,"fallback":2},"drinks":{"direct":17,"fallback":3},"activities":{"direct":18,"fallback":2}}
**Tier grades:** {"C":84,"B":118,"D":107,"definitional":20,"A":51}; all-prior cities: 0
**Orphans:** 0 raw, 0 telemetry
**Persistence/API provenance equality:** 20/20 cities
**Artifact signatures:** None.

The delegated Stage-A source contract and deterministic Stage-B/provenance gates passed.

## Gate details

## Fatal gate failures

- None.

## Per-city diagnostics

- None.

The delegated canary is not a statistical claim about authenticated provider runtime reliability. The user-key 3–5-city smoke remains pending before cutover. Holdouts and the live CSV were untouched.
