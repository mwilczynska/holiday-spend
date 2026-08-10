# Expatistan independent drink cross-check

- Hypothesis: Expatistan's standard cocktail and neighbourhood-pub beer labels can provide independent observations against Numbeo drink anchors.
- Sample: all 25 development cities; accepted cocktail rows from v5 experiment 091 are reused with provenance, and beer is attempted without substituting wine or Numbeo.
- Selection rule: `expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1`; retain the exact city label, unit, source currency, source URL and evidence text.
- Wine policy: no wine-glass collection after experiment 092 rejected bottle calibration.
- Rejection rule: absent or unsupported rows are explicit `not_found`; no proxy or arithmetic substitute.
