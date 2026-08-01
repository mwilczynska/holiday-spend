# Expedia.com locale audit

On 1 August 2026, the official Expedia.com Help Center was inspected at
`https://www.expedia.com/helpcenter/?currency=USD&siteid=1`. The page rendered the selected display currency as
`USD` while remaining on the exact `www.expedia.com` host. This is source-configuration evidence supporting a
versioned `source_locale_proxy` guard; it is not independent ground truth for individual hotel trend values.

The guard therefore remains narrow: map a bare `$` only when the extracted source URL is the exact Expedia.com host,
no locale/currency override conflicts with USD, and all non-currency class, occupancy, tax, and reference-period
requirements pass. Preserve the raw bare-dollar response, `currency: null`, and `imputedMeasures: ["currency"]`.
