# Experiment 086 verdict

**Promote to a guarded source-locale proxy validation panel; do not map to production.** All 12/12 independent
one-city Luna contexts were protocol-compliant. The panel retained 27 exact class-trend rows: 24 bare-dollar
`found_proxy` rows with `currency: null` and three explicitly named-USD rows. The deterministic exact-host guard
mapped only `www.expedia.com` rows to a labelled USD `source_locale_proxy` basis with imputed currency.

All 27 rows joined a prior named-USD row for the same city/class. The source/date audit had median APE 0% and p90
APE 1.72%, so the pre-registered screen passed. This is not independent ground truth: the comparison rows come
from the same Expedia source family and may share locale, index, and page-generation behaviour. The result
supports a guarded proxy as a candidate input contract for a broader, independently audited panel, not an observed
currency claim or product mapping. Preserve `currency: null` in extraction artifacts; perform the mapping only in
deterministic code and carry `imputedMeasures: ["currency"]`.

The accompanying `source-locale-audit.json` records an official Expedia.com Help Center inspection whose selected
display currency is explicitly USD at the exact guarded host. That supports the versioned host/locale rule but does
not replace independent row-level validation.
