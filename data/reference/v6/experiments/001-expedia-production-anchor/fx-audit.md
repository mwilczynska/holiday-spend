# FX audit — 10 August 2026

The experiment deliberately used the frozen `data/reference/fx/city_cost_fx_aud_2026-07-22.json` snapshot.
Its USD→AUD rate is `1.6312 / 1.1408 = 1.4298737728`.

The latest ECB reference page available at collection time is dated 7 August 2026 and reports EUR/AUD
`1.6384` and EUR/USD `1.1535`, giving USD→AUD `1.6384 / 1.1535 = 1.4203727785`. The current rate is
therefore **0.66% lower**, not a material stale-rate defect. The primary experiment result remains on the
preregistered frozen rate for reproducibility; applying the checked rate as a sensitivity would move median
APE from 8.36% to 7.67% and median signed error from +7.08% to +6.37%, leaving the acceptance verdict
unchanged.

Source: ECB euro reference rates, https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
