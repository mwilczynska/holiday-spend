# 022 bundle: Luna + food/drink search + country correction (accepted)

Registered before any 102 answer existed. 0.1649 vs Luna + per-region correction 0.2077: improvement 0.043, CI 0.032
to 0.054, 235/98 cities, no anchor regression. Food/drink -0.08 to -0.11 mean |log| each; accommodation unchanged.
Components: Luna + food/drink search with per-region correction alone is 0.1677 (-0.040); country correction adds
about 0.003. Raw Luna + search is 0.2026. New R2 best and production candidate: v1.1 + food/drink search on Luna,
with fixed country-in-region correction factors. Typical error about 33% (raw v1.1 Luna) -> about 18%.
Caveats: food/drink references are Numbeo, which searches may read (source reproduction); serving cost rises from
one search to up to six per city; finalist confirmation on the sealed test split is still to do.
