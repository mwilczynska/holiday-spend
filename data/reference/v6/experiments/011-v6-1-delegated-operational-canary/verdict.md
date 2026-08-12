# Experiment 011 — delegated v6.1 operational canary verdict

**Run:** 2026-08-12T19:13:57.584Z
**Result:** FAIL
**Complete cities:** 17/20 (required 19/20)
**Artifact candidates:** 2/20 (10.0%; maximum 30%)

The registered delegated canary failed. Do not proceed to migration; inspect the listed contract failures without tuning coefficients.

## Gate details

- Dubai: expedia_3star response city/country changed
- Dubai: budgetyourtrip_daily_tiers response city/country changed
- Dubai: numbeo_drinks response city/country changed
- Cape Town: Stage B collection failed: [
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_budget_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_budget_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_mid_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_mid_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_high_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_food_high_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_budget_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_budget_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_mid_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_mid_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_high_per_person_day",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "byt_activities_high_per_person_day",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  }
]
- Cape Town: expected exactly 3 source-call records
- Cape Town: missing expedia_3star response record
- Cape Town: expected exactly one expedia_3star telemetry record
- Cape Town: missing budgetyourtrip_daily_tiers response record
- Cape Town: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Cape Town: missing numbeo_drinks response record
- Cape Town: expected exactly one numbeo_drinks telemetry record
- Cape Town: persistence/API provenance evidence is missing
- Lima: Stage B collection failed: [
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "hotel_3star_room_2p",
      "sourceTitle"
    ],
    "message": "Invalid input: expected string, received null"
  },
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "measures",
      "hotel_3star_room_2p",
      "evidenceText"
    ],
    "message": "Invalid input: expected string, received null"
  }
]
- Lima: expected exactly 3 source-call records
- Lima: missing expedia_3star response record
- Lima: expected exactly one expedia_3star telemetry record
- Lima: missing budgetyourtrip_daily_tiers response record
- Lima: expected exactly one budgetyourtrip_daily_tiers telemetry record
- Lima: missing numbeo_drinks response record
- Lima: expected exactly one numbeo_drinks telemetry record
- Lima: persistence/API provenance evidence is missing
- complete-city threshold failed: 17 < 19

The delegated canary is not a statistical claim about authenticated provider runtime reliability. The user-key 3–5-city smoke remains pending before cutover. Holdouts and the live CSV were untouched.
