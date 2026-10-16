# 012 effort high vs max (cost test)

Same frozen v1.1 prompts as 001, Haiku reasoning effort high, one run per R1 dev city. Fair comparator 013 = 001's
first run per city (max effort, no new calls).
- Tokens: about 6-9k output per task at high vs about 70k at max; about 40 s vs 270 s.
- Raw: 0.2861 vs 0.2897 (improvement 0.004, CI -0.020 to 0.027).
- Calibrated per region: 0.2249 vs 0.2108 (-0.014, CI -0.032 to 0.003). Per anchor: 0.2367 vs 0.2306 (-0.006,
  CI -0.027 to 0.014).
- Equivalent within noise at n=54, with at most a small calibrated penalty. Program decision: screen candidates at
  high effort on panel R2, confirm finalists at max and on Luna. Production cost implication goes in the report.
