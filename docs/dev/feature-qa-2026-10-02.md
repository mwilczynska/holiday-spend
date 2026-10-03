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
| Planner | Add/edit/delete legs; picker click/keyboard; nights/date boundaries; every tier; status; overrides; notes; reorder/sort; traveller scaling | Chrome: disposable Agra add/delete; no-match search; all 6 accommodation and all 4 food/drink/activity tiers; three statuses; five overrides; zero-display fix/reload; zero nights normalizes to one; keyboard date editing updates dates/nights; move up/down exercised. Traveller scaling and sort persistence pending. |
| Climate | Monthly/annual/trip graphs; shared C/F; scroll/tooltips; missing records and retry | Chrome: Agra annual chart/table, 12 months, close, C/F propagates to leg. Playwright: missing/retry, monthly segmentation and shared units pass. Remaining interactive trip/tooltips/scroll pending. |
| Transport | Manual multi-row CRUD; individual/bulk estimate controls; provider/model/effort; Stop; failed-only retry; apply results | Chrome: two rows with modes/notes, 65 and 35.50 costs, total includes both once; row removal; individual dialog open/close; six mode controls; no-mode estimate disabled; advanced settings and provider list opened. Controlled Playwright: Stop, failed-only retry, model discovery and apply paths pass. Live action rejected by automatic approval; user question pending. |
| Plan files | JSON snapshot export/import; malformed/duplicate/missing-city rows; cancel and confirm | Pending; interactive file attachment blocked, snapshot API atomicity/scoping regressions pass. |
| Saved plans | Save/load/delete/export/import; warnings; empty and multi-plan comparisons; category/country/chart controls | Existing production Playwright save/persist/delete and two/five-plan comparison tests pass. Interactive Chrome coverage pending. |
| Expenses | Add/edit/delete; currency and rate; date/leg assignment; category/source/date filters; pagination; exclusion; bulk include/exclude/delete | Chrome: Quick Add categories/payers; USD conversion; edit category/merchant/subcategory/unassignment; details expand; controlled error/retry; individual and two-row bulk exclude/include; all 10 category filters and 3 source filters; Next/Previous; filtered CSV contains exactly two manual QA records. Date bounds/delete confirmation still pending. Playwright mutation tests verify delete/retry/persistence. |
| Expense tags | Tag CRUD; assignment/removal; tagged-expense navigation; empty/duplicate names | Chrome: empty list/create-disabled, fixture creation/color input, duplicate draft-loss reproduction and retained-error fix, view empty expenses, rename updates selected title. Playwright: duplicate create/edit, network retention, rename/color persistence, delete failure/retry, list/expense read failure/retry. Assignment/removal and deleted-record totals pending. |
| Wise imports | File selection; multiple files; malformed/empty input; preview; confirmation; duplicate handling; clear imported data | Chrome: Parse with no files shows an error; chooser opens. Attaching fixture CSV is blocked by extension file-URL permission; user input requested. Existing mocked multi-file browser regression passes. |
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
instead of rejecting zero; the draft uses `Number(value) || null`. Reset to defaults also works.

Fix verified: only an empty string becomes null; zero reaches the existing server validator and is rejected.
Chrome displays `Too small: expected number to be >=1000` while retaining 0. Saving 32,000 tokens / 90 seconds
persists after reload; Reset restores defaults. Two production browser regressions plus auth setup pass, covering
zero/negative/bounds/fractional-token failures without changing saved overrides, valid persistence and reset/blank
behavior. TypeScript, production build and 383 unit tests pass. Evidence: `.local/feature-qa/provider-zero-rejected.png`.

### Browser connection interruption

After dashboard checks the browser command timed out and the next attachment reported
`Unable to load browser request-header policy. Retry the browser command.` One retry restored attachment and actual
page interactions, including Quick Add submission and Settings form submission. No integration files/settings changed.

### F4 — Wise preview category changes were discarded

A new production Playwright reproduction uploads a disposable AUD CSV, changes Food to Shopping in the preview,
and confirms the import. The saved expense remains Food; the regression fails with `Expected shopping / Received food`.
The UI kept editable categories only in local state and the API reparsed the original files on confirmation.
Fix verified in production Playwright: send transaction/category overrides, validate allowed categories and file membership, and apply
only the category to parsed rows. Duplicate/unknown/extra-field overrides reject atomically. Replacing selected files
clears the old preview; file selection/parsing is disabled during confirmation. TypeScript and all 387 unit tests pass.
Production build and two new browser regressions plus auth setup pass: Shopping persists, duplicate reparse detects
the transaction, and replacing files invalidates the earlier preview.
Interactive Chrome file attachment remains separately blocked on the requested extension permission.

### F5 — Zero planner overrides display as Auto

Chrome sets Agra overrides to 100 accommodation, 20 food, 0 drinks, 30 activities and 5 daily transport, plus a
65 AUD one-off bus. The persisted total is correctly 155/day and 375 for two nights, but the drinks field is blank
with the Auto placeholder, including after reload. A new production regression fails with expected `0`, received
empty string. Fix verified: preserve zero with nullish fallback and associate override labels with their fields.
Chrome after reload shows `100, 20, 0, 30, 5`; production regression plus auth setup pass for all five zero fields,
reload, clearing to automatic costs and an independent 65 AUD one-off transport. TypeScript, build, 387 unit tests,
memory mirror and v1.1 guard pass. Evidence: `planner-zero-hidden.png`, `planner-zero-fixed.png` under the QA folder.

### F6 — Failed expense operations hide errors and discard edit/selection state

Chrome edits fixture 2227 to `QA rejected expense edit`; a temporary copy-only SQLite trigger rejects the update.
The form closes with no error. Fix verified: mutations check HTTP/JSON/network responses before closing drafts or
clearing selection, and controls are labelled. Failed reads preserve prior rows with an explicit warning and Retry;
older in-flight reads cannot replace newer results. Expanded details now span all eight columns.
Chrome displays `Internal server error` with the edit retained; after removing the trigger, retry changes description,
merchant, subcategory, category and assignment. Three production browser regressions plus auth setup pass for
HTTP/network/validation retention, exclusion/include/bulk/delete retry, and read-failure preservation/retry.
TypeScript, production build and 387 unit tests pass. Evidence: `expense-edit-retained-error.png`. Trigger removed.

### F7 — Duplicate and failed tag writes discard input without feedback

Chrome creates `QA tag duplicate`, then submits the same name. The duplicate is rejected by SQLite, but the form
closes and clears with no error. Fix verified: trimmed names, clear 409 conflict guidance, HTTP/JSON/network checks,
retained drafts/selections, labelled fields/actions and keyboard-accessible tag selection. Renaming updates the
selected title. Read failures show error and Retry rather than false empty states; obsolete tag reads are ignored.
Chrome verifies a visible conflict with retained draft and `QA tag renamed` in both list and selected heading.
Three production browser regressions plus auth setup pass for duplicate/edit/retry, rename/color persistence,
network retention, delete failure/retry and list/expense read recovery. TypeScript, build and 387 unit tests pass.
An overlapping unit/browser run exceeded two existing 10-second setup hooks; isolated rerun passes 66/387.
Evidence: `.local/feature-qa/tag-duplicate-retained-error.png`.

### F8 — Deleted and excluded expenses remain in tag totals

A copy-only association fixture links QA expense 2227 to `QA tag renamed`. Chrome's native confirm control fails;
the expense is verified unchanged, then the disposable fixture is explicitly marked deleted through the copy-only
setup script. Chrome still displays the deleted expense and 45 AUD total. A production regression separately fails
when excluding a 30 AUD tagged expense: expected total 19.25, received 49.25.
Fix verified: deleted rows are absent from counts and lists; totals reuse the tracker's AUD helper and omit excluded
spend. Excluded and missing-conversion rows are labelled, and loading/failed totals do not claim zero.
Chrome now shows 0 expenses / $0 / No expenses with this tag. The production regression passes through exclusion,
include, deletion, sidebar/detail totals and empty state; the three F7 regressions still pass. TypeScript, build,
387 unit tests, memory mirror and v1.1 guard pass. Evidence: `deleted-expense-in-tag.png`, `deleted-expense-tag-fixed.png`.

### Chrome native confirmation control

The fixture expense Delete opens a native confirm and the click reports an Input.dispatchMouseEvent timeout.
The documented dialog API and later tab operations report Emulation.setFocusEmulationEnabled timeouts. SQLite
confirms the expense remains unchanged. A fresh tab in the same Chrome connection works; old-tab repair stops.
Interactive native confirmation acceptance is a control-surface limitation. Actual deletion/persistence is verified
separately by production Playwright; the copy-only deletion fixture above prepares the tag-display reproduction.

### Browser download latency

The filtered expense Export link produces the correct two-row manual CSV. Chrome's download tool call takes
about 34 minutes despite 10-second requested waits before returning the Downloads path. File contents are copied
to the ignored QA folder and checked. This control-surface delay is separate from measured application response.

### Live provider action approval

Automatic approval rejected a batch containing model refresh and Estimate Options because route cities, dates
and notes could be sent to external providers. No live estimate was submitted. An async choice asks whether to
keep provider checks local or allow disposable live provider checks. The QA launcher now explicitly clears OpenAI,
Anthropic, Gemini and Resend environment keys; owner keys are never inspected. Local and controlled regressions continue.

## Required baseline

After F4, all 47 production Playwright checks pass in 2.2 minutes. These are separate from Chrome extension checks.

Planner coverage is recorded in the ledger above. The disposable Agra leg and its transport rows are deleted.

Interactive Chrome file attachment is blocked: the extension reports that `Allow access to file URLs` is required.
The chooser call waits about twenty minutes before reporting this error. No setting was changed by Codex; the user
has been asked to enable it or leave interactive file-upload coverage blocked. Fixture CSVs are ready under
`.local/feature-qa/`. The category-confirmation defect is reproduced and fixed under F4 in production Playwright.

Initial production build passed. All 37 existing Playwright checks (including authentication setup) passed against the
isolated production server in 2.1 minutes. These include controlled provider failures, climate/retry/C/F, picker
keyboard/click, two/five-plan comparisons, saved-plan CRUD, transport cancellation and failed-only retry.

F1: TypeScript and ten focused expense route tests pass. First full Vitest run: 379 passed, four skipped after the
existing snapshot-import suite exceeded its 10-second setup deadline; rerun passes all 66 files / 383 tests. Memory mirror and v1.1 guard
pass; live CSV hash remains `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.
Production rebuild and three new expense browser regressions plus authentication setup pass. The build guard correctly
refused to clean a directory held by the QA server after Ctrl+C; stopping the verified QA process tree released it.
