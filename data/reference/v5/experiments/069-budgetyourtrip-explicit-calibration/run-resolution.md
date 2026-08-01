# Experiment 069 run resolution

Three delegated Luna tranches shared the worktree. During the Mumbai tranche, two telemetry filenames were written
before the final city JSON was completed. The canonical pair used by the analyzer is `mumbai.json` plus
`mumbai-telemetry.json`, both produced by the final five-search run and both protocol-compliant. The older
`mumbai.telemetry.json` is retained as supplemental telemetry but is not joined to the canonical JSON and is not used
by `results.json`.

The analyzer reads the embedded telemetry in each city JSON, so duplicate supplemental telemetry cannot change the
counts. No direct Mumbai candidate is present in the canonical JSON; the final result is therefore 0 explicit direct
candidates and 0 matched cities.
