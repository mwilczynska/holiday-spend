# Comprehensive feature QA — 2 October 2026

Status: in progress. Baseline: main `1413f3f`. Branch: `fix/comprehensive-feature-qa`.

## Environment and evidence

Interactive testing uses the Chrome extension control surface, a production build, and an isolated SQLite backup
at `.local/feature-qa/travel.db`. The fixture login uses `feature-qa@example.test`. Workflow writes, including deletes,
must target this copy. Owner provider credentials are never read. Screenshots and temporary input files are ignored
under `.local/feature-qa/`. Automated regression evidence is recorded separately from interactive Chrome checks.

No finite run covers every possible input. This report records actual coverage and remaining gaps. Methodology
calibration is out of scope; tests check product contracts, calculation integrity and failure handling.

## Coverage ledger

| Area | Planned checks | Evidence/status |
| --- | --- | --- |
| Authentication | Signed-out redirects; required/invalid fields; login/logout; verification/reset invalid tokens; account editing | Chrome: signed-out root redirects to login; empty Sign in disabled; fixture login reaches dashboard. Remaining checks pending. |
| Dashboard | Populated and empty states; three charts; expansions/close; tooltips; country/category views; trip-window amounts | Chrome: nine information buttons; Per Day and Planned view switches; all three expansions; Close and Escape. Remaining empty/responsive/tooltip checks pending. |
| Planner | Add/edit/delete legs; picker click/keyboard; nights/date boundaries; every tier; status; overrides; notes; reorder/sort; traveller scaling | Pending |
| Climate | Monthly/annual/trip graphs; shared C/F; scroll/tooltips; missing records and retry | Pending |
| Transport | Manual multi-row CRUD; individual/bulk estimate controls; provider/model/effort; Stop; failed-only retry; apply results | Pending |
| Plan files | CSV export/import; malformed/duplicate/missing-city rows; cancel and confirm | Pending |
| Saved plans | Save/load/rename/delete/export/import; warnings; empty and multi-plan comparisons; category/country/chart controls | Pending |
| Expenses | Add/edit/delete; currency and rate; date/leg assignment; category/source/date filters; pagination; exclusion; bulk include/exclude/delete | Chrome: all Quick Add category and payer buttons; USD save; active-leg assignment; missing conversion reproduced. Remaining CRUD/filter/bulk checks pending. |
| Expense tags | Tag CRUD; assignment/removal; tagged-expense navigation; empty/duplicate names | Pending |
| Wise imports | File selection; multiple files; malformed/empty input; preview; confirmation; duplicate handling; clear imported data | Pending |
| Dataset | City/country search; pagination; city CRUD; missing costs; editor controls; history/provenance; generation/retry | Pending |
| Providers | OpenAI/Anthropic/Gemini selection; model refresh; editable model; effort; unsaved/saved/clear key behavior using fixtures | Pending |
| Settings | Traveller count; request-limit validity/save/reset; fixed-cost CRUD/paid; JSON/CSV exports | Chrome: fixed-cost negative blocked; controlled save failure keeps input; retry, paid toggle, reload persistence and delete. Zero-limit defect reproduced; remaining traveller/export checks pending. |
| Account/public screens | Profile name; password form validation; login/signup/forgot/reset/verify/check-email navigation | Pending; real email delivery and password changes need a controlled separate workflow |
| Responsive/accessibility | Desktop/mobile navigation; page/dialog/table/chart scrolling; labels; keyboard Escape/Tab/Enter; long content | Pending |
| Failure/data integrity | Rejected writes leave data unchanged; user scoping; invalid numbers/dates; network/provider errors; reload persistence | Pending |

## Findings and fixes

### F1 — Quick Add skipped AUD conversion and hid failed saves

Chrome saved `QA USD conversion reproduction` for 25 USD on 2 October; SQLite row 2226 has `amount_aud = null`.
Expenses displays `25.00 USD / No AUD conversion`, and the AUD total stays unchanged. The creation API did not call
the exchange-rate helper, although the expense update API already did. The form also ignored failed HTTP responses,
had no network-error UI, and briefly allowed another submission after success before clearing its amount.

Fix verified: creation now converts when no explicit AUD value is supplied. Unavailable rates preserve the
expense with a missing conversion and a visible warning. Rejected saves retain input and show an error. Successful
saves clear input immediately and disable resubmission. Amount and currency now have accessible labels.

Chrome retry saves `QA converted USD after fix`: 25 USD / $36.03 AUD. Persisted row 2227 contains 36.0275 AUD.
An empty-currency rejection retains 25 and the description with a visible error. Evidence:
`.local/feature-qa/quick-add-missing-conversion.png`, `quick-add-retained-error.png`, `quick-add-conversion-fixed.png`.

### F2 — Fixed-cost rejection closes and clears the form

Chrome submitted `QA rejected negative fixed cost` with -5 AUD. The server rejects it, but the dialog closes,
clears the input and leaves `No fixed costs yet` with no error.

Fix verified: add/update/delete check HTTP and response shape and display failures. Drafts stay available for retry,
nonpositive/nonfinite amounts and whitespace descriptions are blocked, and controls have accessible labels.
Chrome uses a temporary SQLite trigger on the isolated database to reject only `QA controlled rejection`; the
server error keeps description and 25 AUD visible. After removing that trigger, retry succeeds; paid status persists
after reload; fixture deletion succeeds. Trigger and fixture are removed. Three production browser regressions
plus auth setup pass, including controlled HTTP/network failures, paid/delete failures and real CRUD persistence.
TypeScript, production build and all 383 unit tests pass.
Evidence: `.local/feature-qa/fixed-cost-retained-error.png`, `fixed-cost-paid-persisted.png`.

### F3 — Zero request limits silently reset to default

Chrome entered 0 output tokens and clicked Save limits. It reports `Provider limits saved` and restores 64,000
instead of rejecting zero; the draft uses `Number(value) || null`. Reset to defaults also works. Fix pending.

### Browser connection interruption

After dashboard checks the browser command timed out and the next attachment reported
`Unable to load browser request-header policy. Retry the browser command.` One retry restored attachment and actual
page interactions, including Quick Add submission and Settings form submission. No integration files/settings changed.

## Required baseline

Initial production build passed. All 37 existing Playwright checks (including authentication setup) passed against the
isolated production server in 2.1 minutes. These include controlled provider failures, climate/retry/C/F, picker
keyboard/click, two/five-plan comparisons, saved-plan CRUD, transport cancellation and failed-only retry.

F1: TypeScript and ten focused expense route tests pass. First full Vitest run: 379 passed, four skipped after the
existing snapshot-import suite exceeded its 10-second setup deadline; rerun passes all 66 files / 383 tests. Memory mirror and v1.1 guard
pass; live CSV hash remains `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.
Production rebuild and three new expense browser regressions plus authentication setup pass. The build guard correctly
refused to clean a directory held by the QA server after Ctrl+C; stopping the verified QA process tree released it.
