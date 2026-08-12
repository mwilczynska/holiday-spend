# v6.1 operational rollout preview

**Generated:** 2026-08-12  
**Status:** read-only operational comparison; not ground-truth validation

## Recommendation

**recommend staged 121-city migration after collection repair, delegated canary and owner review** — The owner has approved migration in principle. Use this preview as operational context, then require collection-boundary repair, the delegated operational canary, a complete staged 121-city artifact and a small user-key provider smoke before cutover. Keep the live CSV on v1 until owner approval and retain the coordinated v1 rollback.

Runtime >=95% complete-generation coverage remains an unmeasured post-release SLO, and food/activity source dependence plus drink preset
assumptions remain disclosed evidence limitations. This preview must not be used to tune v6.1 to
the incumbent CSV or to justify migrating existing cities.

## Inputs and invariants

- Development fixtures: 25 cities × 19 tiers
- Shipping CSV rows: 121
- Shipping CSV SHA-256: 0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8
- Holdout: untouched
- Shipping CSV: read-only; unchanged

## Representative baskets

| Profile | v1 total | v6.1 total | median ratio | median signed difference | p10 → p90 difference | flagged cities |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Representative budget | A$101.25 | A$144.31 | 1.37x | +36.6% | -4.2% → +65.4% | 1 |
| Representative mid-range | A$255.31 | A$323.78 | 1.12x | +11.5% | -10.6% → +40.5% | 0 |
| Representative high-end | A$503.60 | A$724.30 | 1.32x | +31.9% | -1.8% → +70.5% | 0 |

Category subtotals are included for every city and basket in the JSON artifact.

## Per-tier comparison

| Tier | v1 median | v6.1 median | median ratio | median signed difference | p10 → p90 difference | >2x | <0.5x |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| accom_shared_hostel_dorm | A$37.20 | A$58.54 | 1.68x | +67.7% | -5.1% → +138.9% | 8 | 1 |
| accom_hostel_private_room | A$46.50 | A$58.63 | 1.34x | +34.4% | -37.2% → +74.5% | 1 | 2 |
| accom_1_star | A$38.75 | A$66.00 | 1.55x | +55.4% | -32.1% → +109.3% | 4 | 1 |
| accom_2_star | A$58.12 | A$74.29 | 1.18x | +17.6% | -48.0% → +57.9% | 0 | 3 |
| accom_3_star | A$77.50 | A$99.05 | 1.14x | +13.6% | -47.5% → +62.2% | 0 | 3 |
| accom_4_star | A$139.50 | A$132.45 | 0.84x | -15.6% | -61.0% → +20.5% | 0 | 4 |
| food_street_food | A$27.90 | A$25.92 | 0.84x | -15.5% | -43.8% → +31.2% | 1 | 2 |
| food_budget | A$34.10 | A$48.62 | 1.30x | +29.6% | -13.7% → +101.3% | 4 | 0 |
| food_mid_range | A$71.30 | A$131.54 | 1.52x | +52.1% | -1.8% → +147.1% | 5 | 0 |
| food_high_end | A$106.95 | A$340.30 | 2.57x | +156.9% | +44.1% → +242.4% | 18 | 0 |
| drink_coffee | A$3.00 | A$4.24 | 1.33x | +33.0% | -2.7% → +65.9% | 0 | 0 |
| drinks_none | A$6.00 | A$8.48 | 1.33x | +33.0% | -2.7% → +65.9% | 0 | 0 |
| drinks_light | A$17.98 | A$17.55 | 1.01x | +1.3% | -25.1% → +27.7% | 0 | 1 |
| drinks_moderate | A$51.15 | A$48.90 | 0.90x | -9.9% | -23.8% → +10.4% | 0 | 1 |
| drinks_heavy | A$99.20 | A$79.59 | 0.74x | -26.4% | -35.7% → -7.7% | 0 | 1 |
| activities_free | — | — | — | — | — → — | 0 | 0 |
| activities_budget | A$23.25 | A$25.74 | 0.92x | -7.7% | -57.8% → +108.2% | 3 | 4 |
| activities_mid_range | A$63.94 | A$68.64 | 0.89x | -10.5% | -56.2% → +102.0% | 3 | 5 |
| activities_high_end | A$139.50 | A$200.18 | 1.08x | +7.6% | -52.3% → +147.9% | 3 | 3 |

## Explicit >2x / <0.5x flags

| City | Scope | Name | v1 | v6.1 | Ratio | Difference |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Barcelona | tier | accom_shared_hostel_dorm | A$68.20 | A$155.05 | 2.27x | +127.3% |
| Barcelona | tier | accom_1_star | A$85.25 | A$174.80 | 2.05x | +105.0% |
| Beijing | tier | accom_shared_hostel_dorm | A$31.00 | A$66.45 | 2.14x | +114.3% |
| Beijing | tier | food_high_end | A$94.86 | A$257.38 | 2.71x | +171.3% |
| Budapest | tier | accom_shared_hostel_dorm | A$37.20 | A$102.05 | 2.74x | +174.3% |
| Budapest | tier | accom_1_star | A$54.25 | A$115.05 | 2.12x | +112.1% |
| Budapest | tier | food_high_end | A$152.52 | A$391.78 | 2.57x | +156.9% |
| Cairo | tier | accom_shared_hostel_dorm | A$18.60 | A$56.16 | 3.02x | +201.9% |
| Cairo | tier | accom_hostel_private_room | A$24.80 | A$56.25 | 2.27x | +126.8% |
| Cairo | tier | accom_1_star | A$24.80 | A$63.32 | 2.55x | +155.3% |
| Cairo | tier | activities_mid_range | A$55.41 | A$25.74 | 0.46x | -53.5% |
| Cairo | tier | activities_high_end | A$120.90 | A$48.62 | 0.40x | -59.8% |
| Cape Town | tier | food_street_food | A$39.06 | A$96.05 | 2.46x | +145.9% |
| Cape Town | tier | food_budget | A$47.74 | A$180.16 | 3.77x | +277.4% |
| Cape Town | tier | food_mid_range | A$88.97 | A$234.50 | 2.64x | +163.6% |
| Cape Town | tier | food_high_end | A$133.45 | A$331.74 | 2.49x | +148.6% |
| Cape Town | basket | budget | A$123.07 | A$285.70 | 2.32x | +132.1% |
| Colombo | tier | food_budget | A$17.05 | A$34.32 | 2.01x | +101.3% |
| Colombo | tier | food_mid_range | A$37.20 | A$108.67 | 2.92x | +192.1% |
| Colombo | tier | food_high_end | A$55.80 | A$386.07 | 6.92x | +591.9% |
| Colombo | tier | activities_budget | A$19.38 | A$2.86 | 0.15x | -85.2% |
| Colombo | tier | activities_mid_range | A$53.29 | A$5.72 | 0.11x | -89.3% |
| Colombo | tier | activities_high_end | A$116.25 | A$17.16 | 0.15x | -85.2% |
| Da Nang | tier | food_budget | A$13.64 | A$31.46 | 2.31x | +130.7% |
| Da Nang | tier | food_mid_range | A$37.82 | A$77.22 | 2.04x | +104.2% |
| Da Nang | tier | food_high_end | A$56.73 | A$183.02 | 3.23x | +222.6% |
| Delhi | tier | accom_shared_hostel_dorm | A$15.50 | A$38.22 | 2.47x | +146.6% |
| Delhi | tier | accom_1_star | A$18.60 | A$43.09 | 2.32x | +131.7% |
| Delhi | tier | food_high_end | A$53.48 | A$131.54 | 2.46x | +146.0% |
| Dubai | tier | accom_hostel_private_room | A$85.25 | A$38.82 | 0.46x | -54.5% |
| Dubai | tier | accom_2_star | A$120.12 | A$49.19 | 0.41x | -59.0% |
| Dubai | tier | accom_3_star | A$155.00 | A$65.59 | 0.42x | -57.7% |
| Dubai | tier | accom_4_star | A$279.00 | A$87.71 | 0.31x | -68.6% |
| Dubai | tier | food_high_end | A$228.78 | A$672.04 | 2.94x | +193.8% |
| Dubai | tier | drinks_light | A$46.50 | A$17.55 | 0.38x | -62.3% |
| Dubai | tier | drinks_moderate | A$127.10 | A$48.90 | 0.38x | -61.5% |
| Dubai | tier | drinks_heavy | A$238.70 | A$79.59 | 0.33x | -66.7% |
| Hanoi | tier | food_high_end | A$61.38 | A$165.86 | 2.70x | +170.2% |
| Hanoi | tier | activities_budget | A$18.60 | A$8.58 | 0.46x | -53.9% |
| Hanoi | tier | activities_mid_range | A$51.15 | A$22.88 | 0.45x | -55.3% |
| Ho Chi Minh City | tier | food_high_end | A$69.75 | A$165.86 | 2.38x | +137.8% |
| Istanbul | tier | food_budget | A$34.10 | A$68.64 | 2.01x | +101.3% |
| Istanbul | tier | food_mid_range | A$71.30 | A$168.72 | 2.37x | +136.6% |
| Istanbul | tier | food_high_end | A$106.95 | A$380.34 | 3.56x | +255.6% |
| Lima | tier | accom_shared_hostel_dorm | A$24.80 | A$51.42 | 2.07x | +107.3% |
| Lima | tier | food_high_end | A$87.88 | A$245.94 | 2.80x | +179.9% |
| Lima | tier | activities_budget | A$21.70 | A$8.58 | 0.40x | -60.5% |
| Lima | tier | activities_mid_range | A$59.68 | A$25.74 | 0.43x | -56.9% |
| Lisbon | tier | accom_shared_hostel_dorm | A$55.80 | A$123.41 | 2.21x | +121.2% |
| Lisbon | tier | food_high_end | A$198.09 | A$569.08 | 2.87x | +187.3% |
| Melbourne | tier | accom_2_star | A$155.00 | A$74.29 | 0.48x | -52.1% |
| Melbourne | tier | accom_3_star | A$201.50 | A$99.05 | 0.49x | -50.8% |
| Melbourne | tier | accom_4_star | A$362.70 | A$132.45 | 0.37x | -63.5% |
| Melbourne | tier | food_street_food | A$89.28 | A$36.59 | 0.41x | -59.0% |
| Mexico City | tier | accom_shared_hostel_dorm | A$31.00 | A$63.28 | 2.04x | +104.1% |
| Mexico City | tier | food_high_end | A$122.30 | A$386.06 | 3.16x | +215.7% |
| Mumbai | tier | food_mid_range | A$42.78 | A$108.68 | 2.54x | +154.0% |
| Mumbai | tier | food_high_end | A$64.17 | A$386.06 | 6.02x | +501.6% |
| Mumbai | tier | activities_budget | A$20.15 | A$2.86 | 0.14x | -85.8% |
| Mumbai | tier | activities_mid_range | A$55.41 | A$5.72 | 0.10x | -89.7% |
| Mumbai | tier | activities_high_end | A$120.90 | A$17.16 | 0.14x | -85.8% |
| Nairobi | tier | activities_budget | A$21.70 | A$48.62 | 2.24x | +124.1% |
| Nairobi | tier | activities_mid_range | A$59.68 | A$131.54 | 2.20x | +120.4% |
| Nairobi | tier | activities_high_end | A$130.20 | A$368.90 | 2.83x | +183.3% |
| Phuket | tier | accom_4_star | A$125.55 | A$53.70 | 0.43x | -57.2% |
| Phuket | tier | food_high_end | A$100.44 | A$308.86 | 3.08x | +207.5% |
| Phuket | tier | activities_budget | A$20.92 | A$51.48 | 2.46x | +146.1% |
| Phuket | tier | activities_mid_range | A$57.54 | A$134.40 | 2.34x | +133.6% |
| Phuket | tier | activities_high_end | A$125.55 | A$357.46 | 2.85x | +184.7% |
| San Francisco | tier | accom_shared_hostel_dorm | A$124.00 | A$58.54 | 0.47x | -52.8% |
| San Francisco | tier | accom_hostel_private_room | A$170.50 | A$58.63 | 0.34x | -65.6% |
| San Francisco | tier | accom_1_star | A$147.25 | A$66.00 | 0.45x | -55.2% |
| San Francisco | tier | accom_2_star | A$220.88 | A$74.29 | 0.34x | -66.4% |
| San Francisco | tier | accom_3_star | A$294.50 | A$99.05 | 0.34x | -66.4% |
| San Francisco | tier | accom_4_star | A$530.10 | A$132.45 | 0.25x | -75.0% |
| San Francisco | tier | food_street_food | A$122.76 | A$48.79 | 0.40x | -60.3% |
| Seoul | tier | food_high_end | A$159.03 | A$354.60 | 2.23x | +123.0% |
| Taipei | tier | food_high_end | A$99.51 | A$214.48 | 2.16x | +115.5% |
| Tokyo | tier | food_high_end | A$172.05 | A$489.02 | 2.84x | +184.2% |
| Tokyo | tier | activities_budget | A$27.12 | A$62.92 | 2.32x | +132.0% |
| Tokyo | tier | activities_mid_range | A$74.59 | A$185.88 | 2.49x | +149.2% |
| Tokyo | tier | activities_high_end | A$162.75 | A$614.84 | 3.78x | +277.8% |

## Per-city detail

The JSON artifact contains every city × tier v1/v6.1 pair, all basket category subtotals, flags and provenance inputs:

data/reference/v6/v6-1-rollout-preview.json

## Decision boundary

This artifact is an operational A/B preview. It is not a holdout score and it does not establish absolute accuracy. A staged 121-city migration is approved in principle, but collection-boundary repair, the delegated operational canary, a complete staged artifact, a small user-key provider smoke and owner review are still required. The existing v1 path remains the rollback when CITY_COST_METHODOLOGY_V6 is unset.

