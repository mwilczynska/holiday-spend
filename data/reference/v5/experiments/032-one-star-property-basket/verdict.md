# Experiment 032 — verdict

**Verdict: reject the direct property-basket route for the tested source cascade.**

Barcelona, Prague, and Nairobi each received one compliant single-city Luna call with exactly four searches
(Booking.com, Hotels.com, Trip.com, Agoda). Across 12 searches there were no reads, retries, fallback sources,
arithmetic, FX conversion, averaging, or cross-city evidence.

Zero named property quotes passed the strict joint contract. The failures were structurally incompatible rather
than merely sparse: some results stated two adults but not 1-star class, some stated a class but not occupancy,
and Trip.com often returned `from`/range prices. No quote can therefore enter a city-level basket, no statistic
can be computed, and no value maps to `accom_1_star`.

The 1-star route remains unresolved. Preserve these rejection reasons and pivot to a different source or a
separately curated ground-truth collection; any future basket model still needs a 30-city/10-holdout validation.
