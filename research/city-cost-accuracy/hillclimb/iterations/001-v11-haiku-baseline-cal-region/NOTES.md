# Per-region x per-anchor calibration (replay of 001)

0.230 -> 0.207 against 006, accept, but the lower bound is 0.003 and five zero-call calibration variants were
tried on the same dev set (per-anchor, shrink 5, per-region, per-region shrink 5, hierarchical). Regions with one
or two dev cities (North America 1, Middle East 2, Oceania 2) have no leave-one-out fit and stay uncorrected for
those cities. Current incumbent; the first sealed-test milestone checks it.
