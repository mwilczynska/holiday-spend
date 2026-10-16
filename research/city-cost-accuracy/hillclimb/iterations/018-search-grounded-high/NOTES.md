# 018 search grounding at Haiku high (R1, 54 cities, 1 run)

009 frozen prompts (up to six price searches) at effort high. Median 18k output tokens and 7 searches per city.
Raw 0.2323 vs 012 0.2861 (-0.054, CI 0.024 to 0.084) but rejected by the anchor guard (basic hotel +0.053).
Calibrated per region 0.2164 vs 0.2249 (-0.009, CI -0.015 to 0.032): too few cities to decide.
After calibration food/drink improve strongly (inexpensive meal -0.08, beer -0.08, coffee -0.09 mean |log|) while
accommodation worsens (private hostel +0.05, 3-star +0.03). Source-reproduction risk: food/drink references are
Numbeo, which searches may find. Follow-up 019: search for food/drink only, accommodation from knowledge, on R2.
