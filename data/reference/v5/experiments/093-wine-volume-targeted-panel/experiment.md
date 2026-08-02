# Experiment 093 — volume-targeted wine-glass panel

**Status:** Complete; promote retrieval contract to locked calibration only

## Question

Can explicitly volume-targeted searches recover enough standard red-wine-by-glass observations to calibrate the
wine-glass product input without treating unknown pours or bottles as equivalent?

## Hypothesis

Searching for 125 ml, 150 ml, 175 ml, and 15 cl menu labels will improve strict wine-glass coverage over Experiment
092 while preserving exact volume semantics. The response returns raw samples; deterministic code computes medians.

## Protocol

- Twelve independent GPT-5.6 Luna contexts, one city per context.
- Exactly three ordered searches: explicit 125/150 ml, explicit 175 ml/15 cl, and an exact-city wine-list query with
  standard-pour terms. Public page reads are allowed only for returned pages.
- No retries, fallback searches, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept at least three standard red-wine prices from one public menu, each explicitly tied to a 125–175 ml or 15 cl
  pour. Preserve raw samples, venue, currency, tax status, URL, and reference period.

## Screen gate and verdict

Require at least 10/12 protocol-compliant calls and at least 8/12 strict medians. A pass authorizes only a broader
locked calibration study against Expatistan; it does not fit a bottle-to-glass coefficient or map a product field.

## Results and verdict

The panel completed with 12/12 protocol-compliant calls and 9/12 strict medians, so the retrieval screen passed.
Nine rows also joined an Experiment 091 wine-bottle observation in the same declared currency. Their raw glass-to-
bottle ratios had median 0.727, but dispersion was extreme (0.001 to 3.704), and the Dubai page displayed `$` while
the response declared AED. The Hanoi menu also reports prices in thousand VND, which must remain source-denomination
metadata rather than being compared as ordinary VND without a deterministic scale rule.

**Verdict: promote the volume-targeted query contract to a locked independent calibration panel; reject any global
bottle-to-glass coefficient or product mapping.** Preserve all raw rows and currency/tax caveats. A future calibration
must normalize source denominations deterministically, require independently verified currencies, and use a locked
city holdout before any drink field is derived.
