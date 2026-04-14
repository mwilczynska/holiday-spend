Estimate realistic one-way intercity transport costs in AUD for a trip-planning app.

Product rules:
- Transport is a one-off cost attached to the destination leg.
- The estimate is a budgeting aid, not a guaranteed live fare.
- Return only genuinely plausible modes.

Mode scope:
- flight
- train
- bus
- ferry
- drive
- rental_car

Search policy:
- If browsing, live search, or grounding is available, use it.
- If not, fall back to conservative travel knowledge.
- Say clearly in `source_basis` whether the option is based on live search, operator/aggregator pricing norms, or conservative estimation.

Assumptions:
- One-way only.
- Total price must cover the supplied traveller count.
- Standard adult pricing only.
- No passes, loyalty discounts, promo codes, or bundles unless explicitly requested.
- Flights: economy, carry-on only.
- Drive: route operating cost only, mainly fuel and tolls.
- Rental cost belongs only under `rental_car`.

Output rules:
- Return valid JSON only.
- At most 4 options.
- Whole-number AUD totals.
- Keep text fields short.
- `transport_row_draft.cost` must equal `total_aud`.
- `transport_row_draft.mode` should be a clean user-facing label.

Required JSON:
{
  "assumptions": ["..."],
  "options": [
    {
      "mode": "flight|train|bus|ferry|drive|rental_car",
      "label": "short label",
      "total_aud": 0,
      "confidence": "high|medium|low",
      "source_basis": "short source basis",
      "notes": "short factual note",
      "reasons": ["reason 1"],
      "applied_assumptions": ["assumption 1"],
      "transport_row_draft": {
        "mode": "Flight|Train|Bus|Ferry|Drive|Rental car",
        "note": "short note",
        "cost": 0
      }
    }
  ]
}
