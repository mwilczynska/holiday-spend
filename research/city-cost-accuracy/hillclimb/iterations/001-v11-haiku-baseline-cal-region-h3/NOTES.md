# Hierarchical region calibration (replay of 001)

Region offsets shrunk towards the global anchor offset with weight n/(n+3); global fallback for empty regions.
0.2058 vs 0.2074, reject (CI -0.009 to 0.012). More principled for production fallback, but no measurable gain.
