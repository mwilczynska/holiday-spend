# v6.1 staged migration impact report

**Generated:** 2026-08-13
**Status:** complete operational comparison; not ground-truth validation

## Inputs and integrity

- Cities: 121 x 19 tiers
- v1 CSV SHA-256: 0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8
- staged CSV SHA-256: f118264ed1527756cfb2433ba2884dcdbaa8ab1447277920c15867dc486167e5
- provenance sidecar SHA-256: ca9c3a19b9f86cfae2a737cfc32e2886e3e576e83bd65a2fbeafa415a85bb4b2
- import plan SHA-256: 145b2029fcab9d6e30d533d09f2055c50600988759b3d4beaa70858ccf33c44c
- Holdout: untouched
- Live CSV: untouched

## Representative baskets

| Profile | v1 median | v6.1 median | median ratio | median signed difference | p10 to p90 | flags |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| budget | A$96.27 | A$131.97 | 1.2601x | +26.0% | -10.4% to +68.1% | 7 |
| mid_range | A$243.74 | A$279.54 | 1.0787x | +7.9% | -20.2% to +43.0% | 2 |
| high_end | A$477.40 | A$575.05 | 1.1437x | +14.4% | -16.7% to +62.7% | 5 |

## Per-tier impact

| Tier | v1 median | v6.1 median | ratio | signed difference | p10 to p90 | >2x | <0.5x |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| accom_shared_hostel_dorm | A$31.00 | A$56.16 | 1.677x | +67.7% | -1.6% to +133.3% | 33 | 2 |
| accom_hostel_private_room | A$43.40 | A$56.25 | 1.2267x | +22.7% | -23.3% to +74.6% | 5 | 5 |
| accom_1_star | A$38.75 | A$63.32 | 1.4672x | +46.7% | -12.1% to +111.7% | 19 | 2 |
| accom_2_star | A$58.12 | A$71.27 | 1.088x | +8.8% | -29.8% to +63.0% | 2 | 6 |
| accom_3_star | A$77.50 | A$95.03 | 1.1053x | +10.5% | -27.5% to +64.8% | 2 | 6 |
| accom_4_star | A$139.50 | A$127.07 | 0.8211x | -17.9% | -46.1% to +22.4% | 0 | 10 |
| food_street_food | A$27.90 | A$19.82 | 0.7808x | -21.9% | -56.3% to +36.6% | 3 | 23 |
| food_budget | A$34.10 | A$37.18 | 1.1982x | +19.8% | -32.9% to +109.7% | 19 | 2 |
| food_mid_range | A$68.20 | A$100.10 | 1.444x | +44.4% | -12.1% to +130.7% | 18 | 1 |
| food_high_end | A$102.30 | A$257.38 | 2.2601x | +126.0% | +33.5% to +269.0% | 69 | 1 |
| drink_coffee | A$3.13 | A$4.24 | 1.2581x | +25.8% | -22.9% to +102.9% | 14 | 1 |
| drinks_none | A$6.26 | A$8.48 | 1.2581x | +25.8% | -22.9% to +102.9% | 14 | 1 |
| drinks_light | A$17.05 | A$15.71 | 0.9736x | -2.6% | -41.4% to +53.9% | 1 | 8 |
| drinks_moderate | A$48.05 | A$44.13 | 0.8749x | -12.5% | -39.6% to +21.1% | 0 | 10 |
| drinks_heavy | A$94.55 | A$73.18 | 0.709x | -29.1% | -50.9% to +0.3% | 0 | 14 |
| activities_free | - | - | -x | - | - to - | 0 | 0 |
| activities_budget | A$23.25 | A$20.02 | 0.8944x | -10.6% | -56.6% to +78.4% | 10 | 19 |
| activities_mid_range | A$63.94 | A$51.48 | 0.7515x | -24.9% | -60.9% to +67.7% | 9 | 24 |
| activities_high_end | A$139.50 | A$137.26 | 0.7972x | -20.3% | -61.6% to +64.6% | 10 | 17 |

## Evidence and fallback distribution

The JSON artifact contains category and region distributions of evidence grades and direct/fallback values. Batch artifact candidates are retained below.

- phase9-batch-001: Pu Luong - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-002: Don Det - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-003: Santa Fe (Bantayan) - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-003: Siargao - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-005: Aomori - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-006: Hong Kong - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-007: Porto - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-008: Berlin - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-008: Vienna - all non-definitional tiers are fallback/imputed or grade D
- phase9-batch-009: Reykjavik - all non-definitional tiers are fallback/imputed or grade D

## Ranking diagnostics

| Basket | Spearman rank correlation | Cities changing rank |
| --- | ---: | ---: |
| budget | 0.8839 | 114 |
| mid_range | 0.896 | 118 |
| high_end | 0.8683 | 119 |

## Explicit extreme flags

| City | Scope | Name | v1 | v6.1 | Ratio | Difference |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Amman | tier | food_budget | A$34.10 | A$68.64 | 2.0129x | +101.3% |
| Amman | tier | food_mid_range | A$71.30 | A$165.86 | 2.3262x | +132.6% |
| Amman | tier | food_high_end | A$106.95 | A$394.64 | 3.6899x | +269.0% |
| Amsterdam | tier | food_high_end | A$270.17 | A$646.30 | 2.3922x | +139.2% |
| Athens | tier | accom_shared_hostel_dorm | A$43.40 | A$101.26 | 2.3332x | +133.3% |
| Athens | tier | food_high_end | A$179.02 | A$517.62 | 2.8914x | +189.1% |
| Auckland | tier | accom_4_star | A$334.80 | A$148.56 | 0.4437x | -55.6% |
| Auckland | tier | food_street_food | A$78.12 | A$36.59 | 0.4684x | -53.2% |
| Bagan | tier | food_budget | A$13.64 | A$28.60 | 2.0968x | +109.7% |
| Bagan | tier | activities_budget | A$18.60 | A$163.00 | 8.7634x | +776.3% |
| Bagan | tier | activities_mid_range | A$51.15 | A$163.00 | 3.1867x | +218.7% |
| Bagan | basket | budget | A$58.12 | A$223.81 | 3.8508x | +285.1% |
| Bali (Canggu) | tier | food_budget | A$20.46 | A$45.76 | 2.2366x | +123.7% |
| Bali (Canggu) | tier | food_mid_range | A$48.98 | A$117.25 | 2.3938x | +139.4% |
| Bali (Canggu) | tier | food_high_end | A$73.47 | A$308.85 | 4.2038x | +320.4% |
| Bali (Canggu) | tier | activities_budget | A$20.15 | A$51.48 | 2.5548x | +155.5% |
| Bali (Canggu) | tier | activities_mid_range | A$55.41 | A$134.41 | 2.4257x | +142.6% |
| Bali (Canggu) | tier | activities_high_end | A$120.90 | A$357.47 | 2.9567x | +195.7% |
| Bali (Canggu) | basket | budget | A$69.97 | A$142.59 | 2.0379x | +103.8% |
| Bali (Canggu) | basket | high_end | A$388.12 | A$819.51 | 2.1115x | +111.2% |
| Bali (Kuta) | tier | accom_4_star | A$83.70 | A$34.00 | 0.4062x | -59.4% |
| Bali (Kuta) | tier | food_high_end | A$65.10 | A$165.87 | 2.5479x | +154.8% |
| Bali (Kuta) | tier | drinks_heavy | A$86.80 | A$40.37 | 0.4651x | -53.5% |
| Bali (Ubud) | tier | food_high_end | A$60.45 | A$122.96 | 2.0341x | +103.4% |
| Bali (Ubud) | tier | drinks_heavy | A$82.15 | A$40.37 | 0.4914x | -50.9% |
| Bali (Ubud) | tier | activities_mid_range | A$53.29 | A$25.74 | 0.483x | -51.7% |
| Bangkok | tier | food_budget | A$19.78 | A$40.04 | 2.0243x | +102.4% |
| Bangkok | tier | food_high_end | A$89.00 | A$265.96 | 2.9883x | +198.8% |
| Barcelona | tier | accom_shared_hostel_dorm | A$68.20 | A$155.05 | 2.2735x | +127.3% |
| Barcelona | tier | accom_1_star | A$85.25 | A$174.80 | 2.0504x | +105.0% |
| Beijing | tier | accom_shared_hostel_dorm | A$31.00 | A$68.82 | 2.22x | +122.0% |
| Beijing | tier | accom_1_star | A$38.75 | A$77.59 | 2.0023x | +100.2% |
| Beijing | tier | food_high_end | A$94.86 | A$257.38 | 2.7133x | +171.3% |
| Belgrade | tier | food_high_end | A$126.48 | A$354.61 | 2.8037x | +180.4% |
| Belgrade | tier | drink_coffee | A$2.20 | A$4.88 | 2.2182x | +121.8% |
| Belgrade | tier | drinks_none | A$4.40 | A$9.76 | 2.2182x | +121.8% |
| Berlin | tier | food_high_end | A$205.53 | A$507.61 | 2.4698x | +147.0% |
| Bogota | tier | food_high_end | A$87.88 | A$177.30 | 2.0175x | +101.8% |
| Bogota | tier | drink_coffee | A$1.80 | A$5.02 | 2.7889x | +178.9% |
| Bogota | tier | drinks_none | A$3.60 | A$10.03 | 2.7861x | +178.6% |
| Bucharest | tier | accom_shared_hostel_dorm | A$37.20 | A$112.73 | 3.0304x | +203.0% |
| Bucharest | tier | accom_hostel_private_room | A$46.50 | A$112.90 | 2.428x | +142.8% |
| Bucharest | tier | accom_1_star | A$43.40 | A$127.09 | 2.9283x | +192.8% |
| Bucharest | tier | accom_2_star | A$60.45 | A$143.06 | 2.3666x | +136.7% |
| Bucharest | tier | accom_3_star | A$77.50 | A$190.74 | 2.4612x | +146.1% |
| Bucharest | tier | food_budget | A$47.74 | A$117.24 | 2.4558x | +145.6% |
| Bucharest | tier | food_mid_range | A$88.97 | A$303.14 | 3.4072x | +240.7% |
| Bucharest | tier | food_high_end | A$133.45 | A$806.44 | 6.043x | +504.3% |
| Bucharest | basket | budget | A$116.25 | A$258.47 | 2.2234x | +122.3% |
| Bucharest | basket | mid_range | A$263.73 | A$541.49 | 2.0532x | +105.3% |
| Bucharest | basket | high_end | A$511.65 | A$1229.31 | 2.4026x | +140.3% |
| Budapest | tier | accom_shared_hostel_dorm | A$37.20 | A$102.05 | 2.7433x | +174.3% |
| Budapest | tier | accom_1_star | A$54.25 | A$115.05 | 2.1207x | +112.1% |
| Budapest | tier | food_high_end | A$152.52 | A$383.20 | 2.5125x | +151.3% |
| Buenos Aires | tier | food_street_food | A$33.48 | A$4.57 | 0.1365x | -86.3% |
| Buenos Aires | tier | food_budget | A$40.92 | A$8.58 | 0.2097x | -79.0% |
| Buenos Aires | tier | food_mid_range | A$76.26 | A$22.88 | 0.3x | -70.0% |
| Buenos Aires | tier | food_high_end | A$114.39 | A$42.90 | 0.375x | -62.5% |
| Buenos Aires | tier | drink_coffee | A$2.50 | A$5.02 | 2.008x | +100.8% |
| Buenos Aires | tier | drinks_none | A$5.00 | A$10.03 | 2.006x | +100.6% |
| Cairns | tier | food_street_food | A$78.12 | A$35.07 | 0.4489x | -55.1% |
| Cairo | tier | accom_shared_hostel_dorm | A$18.60 | A$56.16 | 3.0194x | +201.9% |
| Cairo | tier | accom_hostel_private_room | A$24.80 | A$56.25 | 2.2681x | +126.8% |
| Cairo | tier | accom_1_star | A$24.80 | A$63.32 | 2.5532x | +155.3% |
| Cairo | tier | activities_mid_range | A$55.41 | A$25.74 | 0.4645x | -53.5% |
| Cairo | tier | activities_high_end | A$120.90 | A$48.62 | 0.4022x | -59.8% |
| Can Tho | tier | food_street_food | A$8.37 | A$16.77 | 2.0036x | +100.4% |
| Can Tho | tier | food_budget | A$10.23 | A$31.46 | 3.0753x | +207.5% |
| Can Tho | tier | food_mid_range | A$30.69 | A$80.08 | 2.6093x | +160.9% |
| Can Tho | tier | food_high_end | A$46.04 | A$191.60 | 4.1616x | +316.2% |
| Cape Town | tier | food_street_food | A$39.06 | A$96.05 | 2.459x | +145.9% |
| Cape Town | tier | food_budget | A$47.74 | A$180.16 | 3.7738x | +277.4% |
| Cape Town | tier | food_mid_range | A$88.97 | A$234.50 | 2.6357x | +163.6% |
| Cape Town | tier | food_high_end | A$133.45 | A$331.74 | 2.4859x | +148.6% |
| Cape Town | basket | budget | A$123.07 | A$285.70 | 2.3214x | +132.1% |
| Cartagena | tier | food_street_food | A$27.90 | A$12.20 | 0.4373x | -56.3% |
| Cat Ba | tier | activities_budget | A$18.60 | A$8.58 | 0.4613x | -53.9% |
| Cat Ba | tier | activities_mid_range | A$51.15 | A$22.88 | 0.4473x | -55.3% |
| Cat Ba | tier | activities_high_end | A$111.60 | A$42.90 | 0.3844x | -61.6% |
| Cebu | tier | food_budget | A$20.46 | A$42.90 | 2.0968x | +109.7% |
| Cebu | tier | food_mid_range | A$45.88 | A$97.24 | 2.1194x | +111.9% |
| Cebu | tier | food_high_end | A$68.82 | A$191.60 | 2.7841x | +178.4% |
| Chiang Mai | tier | food_high_end | A$70.59 | A$165.87 | 2.3498x | +135.0% |
| Chiang Rai | tier | food_high_end | A$61.38 | A$165.87 | 2.7023x | +170.2% |
| Colombo | tier | food_budget | A$17.05 | A$34.32 | 2.0129x | +101.3% |
| Colombo | tier | food_mid_range | A$37.20 | A$108.67 | 2.9212x | +192.1% |
| Colombo | tier | food_high_end | A$55.80 | A$386.07 | 6.9188x | +591.9% |
| Colombo | tier | activities_budget | A$19.38 | A$2.86 | 0.1476x | -85.2% |
| Colombo | tier | activities_mid_range | A$53.29 | A$5.72 | 0.1073x | -89.3% |
| Colombo | tier | activities_high_end | A$116.25 | A$17.16 | 0.1476x | -85.2% |
| Copenhagen | tier | accom_shared_hostel_dorm | A$77.50 | A$162.96 | 2.1027x | +110.3% |
| Copenhagen | tier | food_street_food | A$128.34 | A$47.26 | 0.3682x | -63.2% |
| Copenhagen | tier | drinks_light | A$43.40 | A$19.90 | 0.4585x | -54.1% |
| Copenhagen | tier | drinks_moderate | A$119.35 | A$52.39 | 0.439x | -56.1% |
| Copenhagen | tier | drinks_heavy | A$223.20 | A$84.87 | 0.3802x | -62.0% |
| Cusco | tier | accom_shared_hostel_dorm | A$18.60 | A$56.16 | 3.0194x | +201.9% |
| Cusco | tier | accom_hostel_private_room | A$27.90 | A$56.25 | 2.0161x | +101.6% |
| Cusco | tier | accom_1_star | A$27.90 | A$63.32 | 2.2695x | +127.0% |
| Cusco | tier | food_high_end | A$72.54 | A$165.86 | 2.2865x | +128.7% |
| Cusco | tier | drink_coffee | A$2.00 | A$5.02 | 2.51x | +151.0% |
| Cusco | tier | drinks_none | A$4.00 | A$10.03 | 2.5075x | +150.8% |
| Da Lat | tier | activities_budget | A$18.29 | A$8.58 | 0.4691x | -53.1% |
| Da Lat | tier | activities_mid_range | A$50.30 | A$22.88 | 0.4549x | -54.5% |
| Da Nang | tier | food_budget | A$13.64 | A$31.46 | 2.3065x | +130.7% |
| Da Nang | tier | food_mid_range | A$37.82 | A$77.22 | 2.0418x | +104.2% |
| Da Nang | tier | food_high_end | A$56.73 | A$183.02 | 3.2262x | +222.6% |
| Delhi | tier | accom_shared_hostel_dorm | A$15.50 | A$38.22 | 2.4658x | +146.6% |
| Delhi | tier | accom_1_star | A$18.60 | A$43.09 | 2.3167x | +131.7% |
| Delhi | tier | food_high_end | A$53.48 | A$131.54 | 2.4596x | +146.0% |
| Don Det | tier | accom_shared_hostel_dorm | A$12.40 | A$26.90 | 2.1694x | +116.9% |
| Don Det | tier | accom_1_star | A$12.40 | A$30.32 | 2.4452x | +144.5% |
| Don Det | tier | food_mid_range | A$28.52 | A$65.77 | 2.3061x | +130.6% |
| Don Det | tier | food_high_end | A$42.78 | A$165.87 | 3.8773x | +287.7% |
| Don Det | tier | drink_coffee | A$1.20 | A$2.66 | 2.2167x | +121.7% |
| Don Det | tier | drinks_none | A$2.40 | A$5.31 | 2.2125x | +121.3% |
| Dubai | tier | accom_hostel_private_room | A$85.25 | A$38.03 | 0.4461x | -55.4% |
| Dubai | tier | accom_2_star | A$120.12 | A$48.19 | 0.4012x | -59.9% |
| Dubai | tier | accom_3_star | A$155.00 | A$64.25 | 0.4145x | -58.5% |
| Dubai | tier | accom_4_star | A$279.00 | A$85.92 | 0.308x | -69.2% |
| Dubai | tier | food_high_end | A$228.78 | A$672.04 | 2.9375x | +193.8% |
| Dubrovnik | tier | food_high_end | A$251.10 | A$600.54 | 2.3916x | +139.2% |
| Dubrovnik | tier | activities_mid_range | A$106.56 | A$48.62 | 0.4563x | -54.4% |
| Edinburgh | tier | accom_shared_hostel_dorm | A$68.20 | A$181.15 | 2.6562x | +165.6% |
| Edinburgh | tier | accom_1_star | A$100.75 | A$204.23 | 2.0271x | +102.7% |
| Edinburgh | tier | food_high_end | A$251.10 | A$723.52 | 2.8814x | +188.1% |
| Florence | tier | accom_shared_hostel_dorm | A$74.40 | A$175.62 | 2.3605x | +136.1% |
| Florence | tier | accom_1_star | A$93.00 | A$197.99 | 2.1289x | +112.9% |
| Goa | tier | accom_shared_hostel_dorm | A$18.60 | A$38.22 | 2.0548x | +105.5% |
| Goa | tier | accom_1_star | A$18.60 | A$43.09 | 2.3167x | +131.7% |
| Goa | tier | food_budget | A$17.05 | A$34.32 | 2.0129x | +101.3% |
| Goa | tier | food_mid_range | A$35.65 | A$108.67 | 3.0482x | +204.8% |
| Goa | tier | food_high_end | A$53.48 | A$386.07 | 7.219x | +621.9% |
| Goa | tier | drinks_heavy | A$67.58 | A$33.72 | 0.499x | -50.1% |
| Goa | tier | activities_budget | A$19.38 | A$2.86 | 0.1476x | -85.2% |
| Goa | tier | activities_mid_range | A$53.29 | A$5.72 | 0.1073x | -89.3% |
| Goa | tier | activities_high_end | A$116.25 | A$17.16 | 0.1476x | -85.2% |
| Hanoi | tier | food_high_end | A$61.38 | A$165.86 | 2.7022x | +170.2% |
| Hanoi | tier | activities_budget | A$18.60 | A$8.58 | 0.4613x | -53.9% |
| Hanoi | tier | activities_mid_range | A$51.15 | A$22.88 | 0.4473x | -55.3% |
| Havana | tier | accom_shared_hostel_dorm | A$24.80 | A$57.35 | 2.3125x | +131.3% |
| Havana | tier | food_street_food | A$27.90 | A$10.67 | 0.3824x | -61.8% |
| Havana | tier | drink_coffee | A$1.75 | A$5.02 | 2.8686x | +186.9% |
| Havana | tier | drinks_none | A$3.50 | A$10.03 | 2.8657x | +186.6% |
| Havana | tier | activities_mid_range | A$63.94 | A$31.46 | 0.492x | -50.8% |
| Havana | tier | activities_high_end | A$139.50 | A$62.92 | 0.451x | -54.9% |
| Helsinki | tier | drinks_light | A$40.30 | A$19.90 | 0.4938x | -50.6% |
| Helsinki | tier | drinks_moderate | A$108.50 | A$52.39 | 0.4829x | -51.7% |
| Helsinki | tier | drinks_heavy | A$201.50 | A$84.87 | 0.4212x | -57.9% |
| Hiroshima | tier | activities_budget | A$25.58 | A$5.72 | 0.2236x | -77.6% |
| Hiroshima | tier | activities_mid_range | A$70.34 | A$14.30 | 0.2033x | -79.7% |
| Hiroshima | tier | activities_high_end | A$153.45 | A$31.46 | 0.205x | -79.5% |
| Ho Chi Minh City | tier | food_high_end | A$69.75 | A$165.86 | 2.3779x | +137.8% |
| Hong Kong | tier | food_street_food | A$44.64 | A$19.06 | 0.427x | -57.3% |
| Hong Kong | tier | drinks_light | A$34.10 | A$15.08 | 0.4422x | -55.8% |
| Hong Kong | tier | drinks_moderate | A$89.90 | A$44.13 | 0.4909x | -50.9% |
| Hong Kong | tier | drinks_heavy | A$170.50 | A$73.18 | 0.4292x | -57.1% |
| Istanbul | tier | food_budget | A$34.10 | A$68.64 | 2.0129x | +101.3% |
| Istanbul | tier | food_mid_range | A$71.30 | A$168.72 | 2.3663x | +136.6% |
| Istanbul | tier | food_high_end | A$106.95 | A$380.34 | 3.5562x | +255.6% |
| Jakarta | tier | food_budget | A$13.64 | A$31.46 | 2.3065x | +130.7% |
| Jakarta | tier | food_high_end | A$56.73 | A$137.26 | 2.4195x | +141.9% |
| Jakarta | tier | drinks_light | A$20.15 | A$8.63 | 0.4283x | -57.2% |
| Jakarta | tier | drinks_moderate | A$54.25 | A$24.41 | 0.45x | -55.0% |
| Jakarta | tier | drinks_heavy | A$103.85 | A$40.37 | 0.3887x | -61.1% |
| Kampot | tier | accom_shared_hostel_dorm | A$12.40 | A$26.90 | 2.1694x | +116.9% |
| Kampot | tier | food_high_end | A$49.76 | A$165.87 | 3.3334x | +233.3% |
| Kanazawa | tier | activities_budget | A$26.35 | A$11.44 | 0.4342x | -56.6% |
| Kanazawa | tier | activities_mid_range | A$72.46 | A$25.74 | 0.3552x | -64.5% |
| Kanazawa | tier | activities_high_end | A$158.10 | A$51.48 | 0.3256x | -67.4% |
| Kathmandu | tier | food_high_end | A$42.78 | A$94.38 | 2.2062x | +120.6% |
| Kathmandu | tier | activities_budget | A$18.60 | A$8.58 | 0.4613x | -53.9% |
| Kathmandu | tier | activities_mid_range | A$51.15 | A$20.02 | 0.3914x | -60.9% |
| Koh Samui | tier | food_high_end | A$95.79 | A$257.38 | 2.6869x | +168.7% |
| Krakow | tier | accom_shared_hostel_dorm | A$37.20 | A$84.64 | 2.2753x | +127.5% |
| Krakow | tier | accom_1_star | A$46.50 | A$95.43 | 2.0523x | +105.2% |
| Krakow | tier | food_street_food | A$39.06 | A$15.25 | 0.3904x | -61.0% |
| Kuala Lumpur | tier | food_high_end | A$68.82 | A$251.66 | 3.6568x | +265.7% |
| Kuala Lumpur | tier | drinks_light | A$23.25 | A$8.63 | 0.3712x | -62.9% |
| Kuala Lumpur | tier | drinks_moderate | A$63.55 | A$24.41 | 0.3841x | -61.6% |
| Kuala Lumpur | tier | drinks_heavy | A$122.45 | A$40.37 | 0.3297x | -67.0% |
| Kyoto | tier | activities_mid_range | A$72.46 | A$34.32 | 0.4736x | -52.6% |
| Langkawi | tier | food_budget | A$20.46 | A$45.76 | 2.2366x | +123.7% |
| Langkawi | tier | food_mid_range | A$42.78 | A$117.25 | 2.7408x | +174.1% |
| Langkawi | tier | food_high_end | A$64.17 | A$308.85 | 4.813x | +381.3% |
| Langkawi | tier | activities_budget | A$20.15 | A$51.48 | 2.5548x | +155.5% |
| Langkawi | tier | activities_mid_range | A$55.41 | A$134.41 | 2.4257x | +142.6% |
| Langkawi | tier | activities_high_end | A$120.90 | A$357.47 | 2.9567x | +195.7% |
| Langkawi | basket | budget | A$68.57 | A$138.64 | 2.0219x | +102.2% |
| Langkawi | basket | high_end | A$363.32 | A$810.57 | 2.231x | +123.1% |
| Lima | tier | accom_shared_hostel_dorm | A$24.80 | A$51.42 | 2.0734x | +107.3% |
| Lima | tier | food_high_end | A$87.88 | A$245.94 | 2.7986x | +179.9% |
| Lima | tier | activities_budget | A$21.70 | A$8.58 | 0.3954x | -60.5% |
| Lima | tier | activities_mid_range | A$59.68 | A$25.74 | 0.4313x | -56.9% |
| Lisbon | tier | accom_shared_hostel_dorm | A$55.80 | A$123.41 | 2.2116x | +121.2% |
| Lisbon | tier | food_high_end | A$198.09 | A$507.61 | 2.5625x | +156.3% |
| Lombok | tier | accom_shared_hostel_dorm | A$18.60 | A$53.00 | 2.8495x | +184.9% |
| Lombok | tier | accom_hostel_private_room | A$23.25 | A$53.08 | 2.283x | +128.3% |
| Lombok | tier | accom_1_star | A$21.70 | A$59.75 | 2.7535x | +175.3% |
| Lombok | tier | accom_2_star | A$32.55 | A$67.26 | 2.0664x | +106.6% |
| Lombok | tier | accom_3_star | A$43.40 | A$89.68 | 2.0664x | +106.6% |
| Lombok | tier | activities_high_end | A$111.60 | A$48.62 | 0.4357x | -56.4% |
| London | tier | food_street_food | A$100.44 | A$47.26 | 0.4705x | -53.0% |
| London | tier | drinks_heavy | A$195.30 | A$84.87 | 0.4346x | -56.5% |
| Los Angeles | tier | accom_hostel_private_room | A$139.50 | A$58.63 | 0.4203x | -58.0% |
| Los Angeles | tier | accom_2_star | A$189.88 | A$74.29 | 0.3912x | -60.9% |
| Los Angeles | tier | accom_3_star | A$248.00 | A$99.05 | 0.3994x | -60.1% |
| Los Angeles | tier | accom_4_star | A$446.40 | A$132.45 | 0.2967x | -70.3% |
| Los Angeles | tier | food_high_end | A$346.42 | A$809.30 | 2.3362x | +133.6% |
| Los Angeles | tier | activities_high_end | A$279.00 | A$780.72 | 2.7983x | +179.8% |
| Luang Prabang | tier | accom_shared_hostel_dorm | A$12.40 | A$25.31 | 2.0411x | +104.1% |
| Luang Prabang | tier | food_high_end | A$60.45 | A$165.87 | 2.7439x | +174.4% |
| Madrid | tier | accom_shared_hostel_dorm | A$62.00 | A$145.55 | 2.3476x | +134.8% |
| Madrid | tier | accom_1_star | A$77.50 | A$164.10 | 2.1174x | +111.7% |
| Madrid | tier | food_high_end | A$212.97 | A$520.48 | 2.4439x | +144.4% |
| Manila | tier | food_high_end | A$77.19 | A$203.04 | 2.6304x | +163.0% |
| Marrakech | tier | accom_shared_hostel_dorm | A$15.50 | A$66.26 | 4.2748x | +327.5% |
| Marrakech | tier | accom_hostel_private_room | A$31.00 | A$66.36 | 2.1406x | +114.1% |
| Marrakech | tier | accom_1_star | A$27.90 | A$74.71 | 2.6778x | +167.8% |
| Marrakech | tier | food_high_end | A$84.16 | A$188.74 | 2.2426x | +124.3% |
| Medellin | tier | accom_shared_hostel_dorm | A$24.80 | A$55.38 | 2.2331x | +123.3% |
| Medellin | tier | accom_1_star | A$31.00 | A$62.43 | 2.0139x | +101.4% |
| Medellin | tier | food_street_food | A$22.32 | A$10.67 | 0.478x | -52.2% |
| Medellin | tier | drink_coffee | A$1.65 | A$5.02 | 3.0424x | +204.2% |
| Medellin | tier | drinks_none | A$3.30 | A$10.03 | 3.0394x | +203.9% |
| Melbourne | tier | accom_2_star | A$155.00 | A$74.29 | 0.4793x | -52.1% |
| Melbourne | tier | accom_3_star | A$201.50 | A$99.05 | 0.4916x | -50.8% |
| Melbourne | tier | accom_4_star | A$362.70 | A$132.45 | 0.3652x | -63.5% |
| Melbourne | tier | food_street_food | A$89.28 | A$35.07 | 0.3928x | -60.7% |
| Mexico City | tier | accom_shared_hostel_dorm | A$31.00 | A$63.28 | 2.0413x | +104.1% |
| Mexico City | tier | food_high_end | A$122.30 | A$386.06 | 3.1567x | +215.7% |
| Montreal | tier | accom_4_star | A$306.90 | A$132.45 | 0.4316x | -56.8% |
| Montreal | tier | food_street_food | A$83.70 | A$36.59 | 0.4372x | -56.3% |
| Mumbai | tier | food_mid_range | A$42.78 | A$111.54 | 2.6073x | +160.7% |
| Mumbai | tier | food_high_end | A$64.17 | A$388.92 | 6.0608x | +506.1% |
| Mumbai | tier | activities_budget | A$20.15 | A$2.86 | 0.1419x | -85.8% |
| Mumbai | tier | activities_mid_range | A$55.41 | A$5.72 | 0.1032x | -89.7% |
| Mumbai | tier | activities_high_end | A$120.90 | A$17.16 | 0.1419x | -85.8% |
| Munich | tier | food_street_food | A$78.12 | A$36.59 | 0.4684x | -53.2% |
| Nairobi | tier | activities_budget | A$21.70 | A$51.48 | 2.3724x | +137.2% |
| Nairobi | tier | activities_mid_range | A$59.68 | A$131.54 | 2.2041x | +120.4% |
| Nairobi | tier | activities_high_end | A$130.20 | A$368.90 | 2.8333x | +183.3% |
| Nara | tier | activities_budget | A$25.58 | A$8.58 | 0.3354x | -66.5% |
| Nara | tier | activities_mid_range | A$70.34 | A$22.88 | 0.3253x | -67.5% |
| Nara | tier | activities_high_end | A$153.45 | A$40.04 | 0.2609x | -73.9% |
| New York City | tier | food_street_food | A$122.76 | A$54.89 | 0.4471x | -55.3% |
| New York City | tier | activities_budget | A$49.60 | A$125.82 | 2.5367x | +153.7% |
| New York City | tier | activities_mid_range | A$136.40 | A$514.76 | 3.7739x | +277.4% |
| New York City | tier | activities_high_end | A$297.60 | A$2419.34 | 8.1295x | +713.0% |
| New York City | basket | high_end | A$1495.13 | A$3766.97 | 2.5195x | +151.9% |
| Nha Trang | tier | food_high_end | A$56.73 | A$165.87 | 2.9238x | +192.4% |
| Ninh Binh | tier | food_budget | A$10.23 | A$25.74 | 2.5161x | +151.6% |
| Ninh Binh | tier | food_mid_range | A$29.14 | A$65.77 | 2.257x | +125.7% |
| Ninh Binh | tier | food_high_end | A$43.71 | A$165.87 | 3.7948x | +279.5% |
| Pai | tier | food_high_end | A$56.73 | A$165.87 | 2.9238x | +192.4% |
| Palawan (El Nido) | tier | activities_budget | A$20.92 | A$5.72 | 0.2734x | -72.7% |
| Palawan (El Nido) | tier | activities_mid_range | A$57.54 | A$14.30 | 0.2485x | -75.2% |
| Palawan (El Nido) | tier | activities_high_end | A$125.55 | A$31.46 | 0.2506x | -74.9% |
| Paris | tier | food_high_end | A$289.23 | A$626.28 | 2.1653x | +116.5% |
| Paris | tier | drinks_moderate | A$106.95 | A$52.39 | 0.4899x | -51.0% |
| Paris | tier | drinks_heavy | A$196.85 | A$84.87 | 0.4311x | -56.9% |
| Paris | tier | activities_budget | A$41.85 | A$88.66 | 2.1185x | +111.8% |
| Paris | tier | activities_mid_range | A$115.09 | A$251.66 | 2.1866x | +118.7% |
| Paris | tier | activities_high_end | A$251.10 | A$803.58 | 3.2002x | +220.0% |
| Penang | tier | food_street_food | A$13.95 | A$38.12 | 2.7326x | +173.3% |
| Penang | tier | food_budget | A$17.05 | A$71.50 | 4.1935x | +319.4% |
| Penang | tier | food_mid_range | A$37.20 | A$188.74 | 5.0737x | +407.4% |
| Penang | tier | food_high_end | A$55.80 | A$526.20 | 9.4301x | +843.0% |
| Penang | tier | drinks_light | A$20.15 | A$8.63 | 0.4283x | -57.2% |
| Penang | tier | drinks_moderate | A$55.80 | A$24.41 | 0.4375x | -56.3% |
| Penang | tier | drinks_heavy | A$106.95 | A$40.37 | 0.3775x | -62.3% |
| Penang | tier | activities_budget | A$19.38 | A$65.78 | 3.3942x | +239.4% |
| Penang | tier | activities_mid_range | A$53.29 | A$160.14 | 3.0051x | +200.5% |
| Penang | tier | activities_high_end | A$116.25 | A$386.06 | 3.3209x | +232.1% |
| Penang | basket | budget | A$64.07 | A$169.49 | 2.6454x | +164.5% |
| Penang | basket | mid_range | A$181.17 | A$407.42 | 2.2488x | +124.9% |
| Penang | basket | high_end | A$362.70 | A$1013.49 | 2.7943x | +179.4% |
| Phnom Penh | tier | food_high_end | A$65.10 | A$154.42 | 2.372x | +137.2% |
| Phnom Penh | tier | drink_coffee | A$2.00 | A$4.13 | 2.065x | +106.5% |
| Phnom Penh | tier | drinks_none | A$4.00 | A$8.26 | 2.065x | +106.5% |
| Phnom Penh | tier | activities_budget | A$19.38 | A$8.58 | 0.4427x | -55.7% |
| Phnom Penh | tier | activities_mid_range | A$53.29 | A$22.88 | 0.4293x | -57.1% |
| Phnom Penh | tier | activities_high_end | A$116.25 | A$54.34 | 0.4674x | -53.3% |
| Phu Quoc | tier | activities_budget | A$19.38 | A$8.58 | 0.4427x | -55.7% |
| Phu Quoc | tier | activities_mid_range | A$53.29 | A$20.02 | 0.3757x | -62.4% |
| Phu Quoc | tier | activities_high_end | A$116.25 | A$40.04 | 0.3444x | -65.6% |
| Phuket | tier | accom_4_star | A$125.55 | A$53.70 | 0.4277x | -57.2% |
| Phuket | tier | food_high_end | A$100.44 | A$311.72 | 3.1035x | +210.3% |
| Phuket | tier | activities_budget | A$20.92 | A$51.48 | 2.4608x | +146.1% |
| Phuket | tier | activities_mid_range | A$57.54 | A$134.40 | 2.3358x | +133.6% |
| Phuket | tier | activities_high_end | A$125.55 | A$360.32 | 2.8699x | +187.0% |
| Porto | tier | accom_shared_hostel_dorm | A$49.60 | A$112.73 | 2.2728x | +127.3% |
| Porto | tier | food_high_end | A$179.02 | A$507.61 | 2.8355x | +183.6% |
| Porto | tier | drink_coffee | A$2.09 | A$4.24 | 2.0287x | +102.9% |
| Porto | tier | drinks_none | A$4.18 | A$8.48 | 2.0287x | +102.9% |
| Prague | tier | accom_shared_hostel_dorm | A$43.40 | A$112.73 | 2.5975x | +159.8% |
| Prague | tier | accom_1_star | A$62.00 | A$127.09 | 2.0498x | +105.0% |
| Pu Luong | tier | food_budget | A$10.23 | A$25.74 | 2.5161x | +151.6% |
| Pu Luong | tier | food_mid_range | A$29.14 | A$65.77 | 2.257x | +125.7% |
| Pu Luong | tier | food_high_end | A$43.71 | A$165.87 | 3.7948x | +279.5% |
| Queenstown | tier | food_street_food | A$89.28 | A$39.64 | 0.444x | -55.6% |
| Reykjavik | tier | food_street_food | A$122.76 | A$47.26 | 0.385x | -61.5% |
| Reykjavik | tier | drink_coffee | A$9.08 | A$4.24 | 0.467x | -53.3% |
| Reykjavik | tier | drinks_none | A$18.16 | A$8.48 | 0.467x | -53.3% |
| Reykjavik | tier | drinks_light | A$51.15 | A$19.90 | 0.3891x | -61.1% |
| Reykjavik | tier | drinks_moderate | A$141.05 | A$52.39 | 0.3714x | -62.9% |
| Reykjavik | tier | drinks_heavy | A$261.95 | A$84.87 | 0.324x | -67.6% |
| Rio de Janeiro | tier | accom_shared_hostel_dorm | A$31.00 | A$81.48 | 2.6284x | +162.8% |
| Rio de Janeiro | tier | accom_1_star | A$38.75 | A$91.86 | 2.3706x | +137.1% |
| Rio de Janeiro | tier | food_high_end | A$114.39 | A$260.24 | 2.275x | +127.5% |
| Rio de Janeiro | tier | drink_coffee | A$2.25 | A$5.02 | 2.2311x | +123.1% |
| Rio de Janeiro | tier | drinks_none | A$4.50 | A$10.03 | 2.2289x | +122.9% |
| Rome | tier | food_high_end | A$251.10 | A$686.34 | 2.7333x | +173.3% |
| Sa Pa | tier | food_budget | A$13.64 | A$31.46 | 2.3065x | +130.7% |
| Sa Pa | tier | food_mid_range | A$33.17 | A$77.22 | 2.328x | +132.8% |
| Sa Pa | tier | food_high_end | A$49.76 | A$194.46 | 3.908x | +290.8% |
| Sa Pa | tier | drink_coffee | A$1.25 | A$2.66 | 2.128x | +112.8% |
| Sa Pa | tier | drinks_none | A$2.50 | A$5.31 | 2.124x | +112.4% |
| Sa Pa | tier | activities_budget | A$18.60 | A$5.72 | 0.3075x | -69.3% |
| Sa Pa | tier | activities_mid_range | A$51.15 | A$17.16 | 0.3355x | -66.5% |
| Sa Pa | tier | activities_high_end | A$111.60 | A$40.04 | 0.3588x | -64.1% |
| San Francisco | tier | accom_shared_hostel_dorm | A$124.00 | A$58.54 | 0.4721x | -52.8% |
| San Francisco | tier | accom_hostel_private_room | A$170.50 | A$58.63 | 0.3439x | -65.6% |
| San Francisco | tier | accom_1_star | A$147.25 | A$66.00 | 0.4482x | -55.2% |
| San Francisco | tier | accom_2_star | A$220.88 | A$74.29 | 0.3363x | -66.4% |
| San Francisco | tier | accom_3_star | A$294.50 | A$99.05 | 0.3363x | -66.4% |
| San Francisco | tier | accom_4_star | A$530.10 | A$132.45 | 0.2499x | -75.0% |
| San Francisco | tier | food_street_food | A$122.76 | A$48.79 | 0.3974x | -60.3% |
| Santa Fe (Bantayan) | tier | food_high_end | A$53.48 | A$165.87 | 3.1015x | +210.2% |
| Santiago | tier | food_street_food | A$39.06 | A$13.72 | 0.3513x | -64.9% |
| Santiago | tier | activities_budget | A$26.35 | A$62.92 | 2.3879x | +138.8% |
| Sendai | tier | food_high_end | A$141.36 | A$291.70 | 2.0635x | +106.3% |
| Seoul | tier | food_high_end | A$159.03 | A$354.60 | 2.2298x | +123.0% |
| Shanghai | tier | food_high_end | A$103.23 | A$265.96 | 2.5764x | +157.6% |
| Shanghai | tier | activities_budget | A$22.48 | A$8.58 | 0.3817x | -61.8% |
| Shanghai | tier | activities_mid_range | A$61.81 | A$25.74 | 0.4164x | -58.4% |
| Siargao | tier | food_high_end | A$64.17 | A$165.87 | 2.5849x | +158.5% |
| Siem Reap | tier | accom_shared_hostel_dorm | A$12.40 | A$26.90 | 2.1694x | +116.9% |
| Siem Reap | tier | food_budget | A$13.64 | A$31.46 | 2.3065x | +130.7% |
| Siem Reap | tier | food_mid_range | A$34.72 | A$80.08 | 2.3065x | +130.7% |
| Siem Reap | tier | food_high_end | A$52.08 | A$183.02 | 3.5142x | +251.4% |
| Siem Reap | tier | activities_high_end | A$111.60 | A$225.92 | 2.0244x | +102.4% |
| Siem Reap | basket | budget | A$48.24 | A$97.46 | 2.0203x | +102.0% |
| Singapore | tier | accom_shared_hostel_dorm | A$77.50 | A$26.90 | 0.3471x | -65.3% |
| Singapore | tier | accom_hostel_private_room | A$100.75 | A$26.94 | 0.2674x | -73.3% |
| Singapore | tier | accom_1_star | A$100.75 | A$30.32 | 0.3009x | -69.9% |
| Singapore | tier | accom_2_star | A$143.38 | A$34.13 | 0.238x | -76.2% |
| Singapore | tier | accom_3_star | A$186.00 | A$45.51 | 0.2447x | -75.5% |
| Singapore | tier | accom_4_star | A$334.80 | A$60.86 | 0.1818x | -81.8% |
| Sofia | tier | accom_shared_hostel_dorm | A$31.00 | A$64.08 | 2.0671x | +106.7% |
| Sofia | tier | drink_coffee | A$2.20 | A$5.04 | 2.2909x | +129.1% |
| Sofia | tier | drinks_none | A$4.40 | A$10.08 | 2.2909x | +129.1% |
| Sofia | tier | activities_budget | A$26.35 | A$8.58 | 0.3256x | -67.4% |
| Sofia | tier | activities_mid_range | A$72.46 | A$20.02 | 0.2763x | -72.4% |
| Sofia | tier | activities_high_end | A$158.10 | A$37.18 | 0.2352x | -76.5% |
| Split | tier | accom_shared_hostel_dorm | A$49.60 | A$106.00 | 2.1371x | +113.7% |
| Split | tier | food_high_end | A$205.53 | A$507.61 | 2.4698x | +147.0% |
| Stockholm | tier | drinks_moderate | A$105.40 | A$52.39 | 0.4971x | -50.3% |
| Stockholm | tier | drinks_heavy | A$196.85 | A$84.87 | 0.4311x | -56.9% |
| Sydney | tier | food_street_food | A$94.86 | A$36.59 | 0.3857x | -61.4% |
| Taipei | tier | food_high_end | A$99.51 | A$214.48 | 2.1554x | +115.5% |
| Tbilisi | tier | food_street_food | A$27.90 | A$9.15 | 0.328x | -67.2% |
| Tbilisi | tier | drink_coffee | A$1.93 | A$4.88 | 2.5285x | +152.8% |
| Tbilisi | tier | drinks_none | A$3.86 | A$9.76 | 2.5285x | +152.8% |
| Tel Aviv | tier | accom_hostel_private_room | A$108.50 | A$50.70 | 0.4673x | -53.3% |
| Tel Aviv | tier | accom_2_star | A$155.00 | A$64.25 | 0.4145x | -58.5% |
| Tel Aviv | tier | accom_3_star | A$201.50 | A$85.66 | 0.4251x | -57.5% |
| Tel Aviv | tier | accom_4_star | A$362.70 | A$114.54 | 0.3158x | -68.4% |
| Tel Aviv | tier | food_street_food | A$89.28 | A$41.17 | 0.4611x | -53.9% |
| Tel Aviv | tier | drinks_light | A$38.75 | A$17.55 | 0.4529x | -54.7% |
| Tel Aviv | tier | drinks_moderate | A$106.95 | A$48.90 | 0.4572x | -54.3% |
| Tel Aviv | tier | drinks_heavy | A$199.95 | A$79.59 | 0.398x | -60.2% |
| Tokyo | tier | food_high_end | A$172.05 | A$489.02 | 2.8423x | +184.2% |
| Tokyo | tier | activities_budget | A$27.12 | A$62.92 | 2.3201x | +132.0% |
| Tokyo | tier | activities_mid_range | A$74.59 | A$185.88 | 2.492x | +149.2% |
| Tokyo | tier | activities_high_end | A$162.75 | A$614.84 | 3.7778x | +277.8% |
| Vancouver | tier | accom_shared_hostel_dorm | A$86.80 | A$184.32 | 2.1235x | +112.3% |
| Vancouver | tier | food_street_food | A$94.86 | A$28.97 | 0.3054x | -69.5% |
| Vancouver | tier | food_budget | A$115.94 | A$54.34 | 0.4687x | -53.1% |
| Vang Vieng | tier | accom_shared_hostel_dorm | A$15.50 | A$34.02 | 2.1948x | +119.5% |
| Vang Vieng | tier | accom_1_star | A$15.50 | A$38.35 | 2.4742x | +147.4% |
| Vang Vieng | tier | food_street_food | A$13.95 | A$6.10 | 0.4373x | -56.3% |
| Vang Vieng | tier | drink_coffee | A$1.50 | A$4.09 | 2.7267x | +172.7% |
| Vang Vieng | tier | drinks_none | A$3.00 | A$8.17 | 2.7233x | +172.3% |
| Vang Vieng | tier | drinks_light | A$7.44 | A$14.94 | 2.0081x | +100.8% |
| Vang Vieng | tier | activities_budget | A$19.38 | A$5.72 | 0.2951x | -70.5% |
| Vang Vieng | tier | activities_mid_range | A$53.29 | A$14.30 | 0.2683x | -73.2% |
| Vang Vieng | tier | activities_high_end | A$116.25 | A$37.18 | 0.3198x | -68.0% |
| Vienna | tier | food_high_end | A$224.60 | A$507.61 | 2.2601x | +126.0% |
| Vientiane | tier | activities_budget | A$19.38 | A$2.86 | 0.1476x | -85.2% |
| Vientiane | tier | activities_mid_range | A$53.29 | A$11.44 | 0.2147x | -78.5% |
| Vientiane | tier | activities_high_end | A$116.25 | A$28.60 | 0.246x | -75.4% |
| Yogyakarta | tier | food_high_end | A$39.06 | A$131.54 | 3.3676x | +236.8% |
| Zanzibar | tier | accom_shared_hostel_dorm | A$27.90 | A$56.16 | 2.0129x | +101.3% |
| Zanzibar | tier | food_high_end | A$80.91 | A$185.88 | 2.2974x | +129.7% |

## Cutover boundary

This report is an operational impact comparison, not a validation score. Review the staged CSV, provenance sidecar, fallback concentration, extreme flags and ranking changes before Phase 11. Cutover must move the CSV, provenance import and new-city default together; rollback must restore the v1 CSV and v1 default together.

