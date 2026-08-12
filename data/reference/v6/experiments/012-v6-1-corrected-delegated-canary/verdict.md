# Experiment 012-v6-1-corrected-delegated-canary - delegated v6.1 operational canary verdict

**Run:** 2026-08-12T21:50:44.517Z
**Result:** FAIL
**Complete cities:** 10/20 (required 19/20)
**Artifact candidates:** 10/20 (50.0%; maximum 30%)
**Calls:** 30 attempted, 30 valid responses, 0 invalid responses, 0 retries
**Searches / direct reads:** 72 / 0
**Observed measures:** {"hotel_3star_room_2p":4,"byt_food_budget_per_person_day":10,"byt_food_mid_per_person_day":10,"byt_food_high_per_person_day":10,"byt_activities_budget_per_person_day":10,"byt_activities_mid_per_person_day":10,"byt_activities_high_per_person_day":10,"cappuccino_1":9,"domestic_draft_beer_1":9}
**Source statuses:** {"expedia_3star":{"complete":4,"not_found":6,"missing":10},"budgetyourtrip_daily_tiers":{"complete":10,"missing":10},"numbeo_drinks":{"not_found":1,"complete":9,"missing":10}}
**Artifact signatures:** None.

The registered delegated canary failed. Do not proceed to migration; inspect the listed contract failures without tuning coefficients.

## Gate details

- Colombo: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\colombo\numbeo_drinks.json'
- Colombo: expected exactly 3 source-call records
- Colombo: missing expedia_3star response record
- Colombo: expected exactly one expedia_3star telemetry record
- Colombo: missing budgetyourtrip_daily_tiers response record
- Colombo: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Colombo: missing numbeo_drinks response record
- Colombo: expected exactly one numbeo_drinks telemetry record
- Colombo: persistence/API provenance evidence is missing
- Dubai: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\dubai\budgetyourtrip_daily_tiers.json'
- Dubai: expected exactly 3 source-call records
- Dubai: missing expedia_3star response record
- Dubai: expected exactly one expedia_3star telemetry record
- Dubai: missing budgetyourtrip_daily_tiers response record
- Dubai: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Dubai: missing numbeo_drinks response record
- Dubai: expected exactly one numbeo_drinks telemetry record
- Dubai: persistence/API provenance evidence is missing
- Cape Town: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\cape-town\expedia_3star.json'
- Cape Town: expected exactly 3 source-call records
- Cape Town: missing expedia_3star response record
- Cape Town: expected exactly one expedia_3star telemetry record
- Cape Town: missing budgetyourtrip_daily_tiers response record
- Cape Town: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Cape Town: missing numbeo_drinks response record
- Cape Town: expected exactly one numbeo_drinks telemetry record
- Cape Town: persistence/API provenance evidence is missing
- Cairo: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\cairo\expedia_3star.json'
- Cairo: expected exactly 3 source-call records
- Cairo: missing expedia_3star response record
- Cairo: expected exactly one expedia_3star telemetry record
- Cairo: missing budgetyourtrip_daily_tiers response record
- Cairo: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Cairo: missing numbeo_drinks response record
- Cairo: expected exactly one numbeo_drinks telemetry record
- Cairo: persistence/API provenance evidence is missing
- Lisbon: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\lisbon\budgetyourtrip_daily_tiers.json'
- Lisbon: expected exactly 3 source-call records
- Lisbon: missing expedia_3star response record
- Lisbon: expected exactly one expedia_3star telemetry record
- Lisbon: missing budgetyourtrip_daily_tiers response record
- Lisbon: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Lisbon: missing numbeo_drinks response record
- Lisbon: expected exactly one numbeo_drinks telemetry record
- Lisbon: persistence/API provenance evidence is missing
- Prague: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\prague\budgetyourtrip_daily_tiers.json'
- Prague: expected exactly 3 source-call records
- Prague: missing expedia_3star response record
- Prague: expected exactly one expedia_3star telemetry record
- Prague: missing budgetyourtrip_daily_tiers response record
- Prague: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Prague: missing numbeo_drinks response record
- Prague: expected exactly one numbeo_drinks telemetry record
- Prague: persistence/API provenance evidence is missing
- Mexico City: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\mexico-city\expedia_3star.json'
- Mexico City: expected exactly 3 source-call records
- Mexico City: missing expedia_3star response record
- Mexico City: expected exactly one expedia_3star telemetry record
- Mexico City: missing budgetyourtrip_daily_tiers response record
- Mexico City: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Mexico City: missing numbeo_drinks response record
- Mexico City: expected exactly one numbeo_drinks telemetry record
- Mexico City: persistence/API provenance evidence is missing
- Lima: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\lima\expedia_3star.json'
- Lima: expected exactly 3 source-call records
- Lima: missing expedia_3star response record
- Lima: expected exactly one expedia_3star telemetry record
- Lima: missing budgetyourtrip_daily_tiers response record
- Lima: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Lima: missing numbeo_drinks response record
- Lima: expected exactly one numbeo_drinks telemetry record
- Lima: persistence/API provenance evidence is missing
- San Francisco: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\san-francisco\expedia_3star.json'
- San Francisco: expected exactly 3 source-call records
- San Francisco: missing expedia_3star response record
- San Francisco: expected exactly one expedia_3star telemetry record
- San Francisco: missing budgetyourtrip_daily_tiers response record
- San Francisco: expected exactly one budgetyourtrip_daily_tiers telemetry record
- San Francisco: missing numbeo_drinks response record
- San Francisco: expected exactly one numbeo_drinks telemetry record
- San Francisco: persistence/API provenance evidence is missing
- Melbourne: Stage B collection failed: ENOENT: no such file or directory, open 'C:\Users\chawi\OneDrive\Datascience\projects\holiday-spend\data\reference\v6\experiments\012-v6-1-corrected-delegated-canary\raw\melbourne\expedia_3star.json'
- Melbourne: expected exactly 3 source-call records
- Melbourne: missing expedia_3star response record
- Melbourne: expected exactly one expedia_3star telemetry record
- Melbourne: missing budgetyourtrip_daily_tiers response record
- Melbourne: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Melbourne: missing numbeo_drinks response record
- Melbourne: expected exactly one numbeo_drinks telemetry record
- Melbourne: persistence/API provenance evidence is missing
- complete-city threshold failed: 10 < 19
- artifact-candidate threshold failed: 10/20 > 0.3

The delegated canary is not a statistical claim about authenticated provider runtime reliability. The user-key 3–5-city smoke remains pending before cutover. Holdouts and the live CSV were untouched.
