# 017 country-in-region calibration (zero-call replay of 014)

Country offsets shrunk towards the region offset with weight n/(n+3), leave-one-city-out. 0.2170 vs 0.2238:
improvement 0.0068, CI 0.0010 to 0.0121, 178/118 cities. Reliable but below the frozen 0.015 practical margin, so
rejected by the rule. Not refitted with other k values (no fishing on the same dev set). Candidate for a bundled
change together with other small reliable gains, to be judged as one package.
