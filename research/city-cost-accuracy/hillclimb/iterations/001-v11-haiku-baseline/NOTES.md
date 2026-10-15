# 001 v1.1 baseline, Haiku lane

Unchanged production prompt, reference date July 2026, 54 dev cities x 3 runs, 162/162 valid.

- Dev loss 0.292 on panel R1 (legacy v1 CSV: 0.390). Pooled-repeat loss 0.286: repeats barely disagree, so
  ensembling has little headroom.
- Median log bias by anchor: mid-range meal for two +0.38, private hostel room +0.37, dorm +0.26, 3-star +0.14,
  beer +0.07, coffee +0.06, 1-star +0.05, inexpensive meal -0.10. Mid-range meals and hostels carry most error.
- 21 earlier Agent-tool answers (Claude Code system context, not the app's) are kept as response.subagent.json and
  are not scored.
