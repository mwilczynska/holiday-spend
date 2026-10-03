# Comprehensive feature QA — 2–3 October 2026

Status: in progress. Baseline: main `1413f3f`. Branch: `fix/comprehensive-feature-qa`.

Checkpoint: twenty separate fixes are committed and pushed. All 398 unit tests and 81 production Playwright checks pass, along with
TypeScript, build, memory mirror and the v1.1 guard. Chrome evidence is recorded separately below.

## Environment and evidence

Interactive testing uses the Chrome extension control surface, a production build, and an isolated SQLite backup
at `.local/feature-qa/travel.db`. The fixture login uses `feature-qa@example.test`. Workflow writes, including deletes,
must target this copy. Owner provider credentials are never read. Screenshots and temporary input files are ignored
under `.local/feature-qa/`. Automated regression evidence is recorded separately from interactive Chrome checks.

No finite run covers every possible input. This report records actual coverage and remaining gaps. Methodology
calibration is out of scope; tests check product contracts, calculation integrity and failure handling.

## Fix commits

| Finding | Change | Commit |
| --- | --- | --- |
| F1 | Quick Add conversion, retained errors and duplicate prevention | `1eab5ed` |
| F2 | Fixed-cost failures retain drafts and rows | `78967e3` |
| F3 | Zero request limits are rejected | `5f3e1f4` |
| F4 | Wise preview categories survive confirmation | `a3ed1ce` |
| F5 | Zero planner overrides stay visible | `86ccea1` |
| F6 | Expense mutations/reads expose errors and retain input | `656a24b` |
| F7 | Tag CRUD/read failures and duplicate conflicts | `617c06a` |
| F8 | Tag totals omit deleted/excluded/unconverted spend | `9c9ade6` |
| F9 | Planner/comparison/mobile navigation containment | `461a943` |
| F10 | Negative city costs rejected with retained drafts | `7d6103e` |
| F11 | Initial expense read failures show unavailable state/Retry | `5d9d31d` |
| F12 | Reachable, atomic expense tag assignment/removal | `1c9fe62` |
| F13 | Methodology describes the active v1.1 workflow | `a4c4352` |
| F14 | Ordering failures reported; writes atomic | `6a001de` |
| F15 | Leg additions retain rejected drafts and lock pending submits | `f16d78a` |
| F16 | Planner/saved-plan read failures retain prior data with Retry | `d0dec59` |
| F17 | Inline leg edits retain drafts and serialize saves | `bc2d491` |
| F18 | Dashboard read failures retain figures or show unavailable totals | `b40b150` |
| F19 | Dataset/library/history/provenance reads expose failures and Retry | `e37bda0` |
| F20 | Settings reads retain values, costs and unsaved limit drafts | `527db84` |

## Remaining coverage

- Settings save failures/concurrent submissions and Compare Plans failure states need a further local pass. Main read/empty-state fixes are verified under F15–F20.
- Chrome file attachment requires the extension's file-URL permission. CSV/category and snapshot API regressions
  pass separately; interactive CSV/JSON import is not claimed complete.
- Live provider actions remain pending approval for fictional QA data and a test credential. Owner keys are never used.
- Chrome native confirm acceptance and Settings downloads remain limited by the control surface; production
  Playwright separately verifies deletion and complete export artifacts.
- Password changes require user entry. Account creation, external email delivery and OAuth were not exercised.

## Coverage ledger

| Area | Planned checks | Evidence/status |
| --- | --- | --- |
| Authentication | Signed-out redirects; required/invalid fields; login/logout; verification/reset invalid tokens; account editing | Chrome: signed-out redirect; empty Sign in disabled; fixture login; logout; wrong password feedback; forgot/signup/check-email navigation; missing reset link and invalid verification token guidance. New-password entry, account creation, email delivery and OAuth remain controlled-workflow exclusions. |
| Dashboard | Populated/empty states; charts; expansions; tooltips; country/category views; trip-window amounts | Chrome: nine information buttons; Per Day/Planned switches; three expansions; Close/Escape; country/category/cumulative tooltips; mobile containment and country table horizontal scroll to its last column. F18 verifies initial/refresh read failure and Retry in Chrome; production regressions cover valid empty, partial/malformed/network/HTTP responses and first-navigation freshness. |
| Planner | Legs; picker; dates/nights; tiers; status; overrides; notes; order; traveller scaling | Chrome: disposable Agra add/delete; no-match picker; all accommodation/food/drink/activity tiers; three statuses; five overrides; saved zero; zero nights normalizes to one; keyboard dates update nights; move/reload persistence; sort rejection/error/retry; all five traveller counts and scaling. F15–F17 verify add/inline edit rejection, retained drafts/retry, failed-read preservation, saved-plan read recovery and valid empty data. Production tests cover rapid edits and transport draft retention. |
| Climate | Monthly/annual/trip graphs; shared C/F; scroll/tooltips; missing/retry | Chrome: 12-month annual chart/table, Close/Escape, shared C/F from trip chart to legs, trip tooltip with separate temperature/rainfall, annual dialog scroll to bottom on mobile. Playwright: missing/retry, monthly segmentation and shared units pass. |
| Transport | Manual multi-row CRUD; individual/bulk estimate controls; provider/model/effort; Stop; failed-only retry; apply results | Chrome: manual rows/modes/notes/costs/removal; individual modes/empty disable; bulk All/Missing/Clear; controlled mixed success/failure; retry sends exactly one failed leg; apply persists 40 AUD QA fixture; ten-leg Stop starts five requests, retains one result, labels nine cancelled, starts no queued calls. Live provider action remains blocked pending approval. |
| Plan files | JSON export/import; malformed/duplicate/missing-city rows; cancel/confirm | Chrome current-plan export artifact exists. Interactive JSON attachment remains blocked. Snapshot API atomicity/scoping regressions pass; these are separate from Chrome import coverage. |
| Saved plans | Save/load/delete/export/import; comparisons and charts | Chrome: whitespace Save disabled; Cancel; snapshot save/load with identical totals; JSON export exists; disposable saved-plan deletion verified; saved list scroll reaches bottom; two/five comparisons; sixth selection rejected; Change Plans; country Totals/Per Day; chart expansions/Close; five-card mobile strip reaches last card. Attachment remains blocked. |
| Expenses | CRUD; conversions; assignment; filters; pagination; exclusion/bulk operations | Chrome: categories/payers; USD conversion; edit fields/unassignment; details; failure/retry; exclude/include individually/in bulk; all category/source filters; pagination; correct filtered CSV; inclusive date bounds/keyboard clear. Reversed dates show zero results without a validation message. Native delete confirmation is limited by Chrome control; Playwright verifies deletion/retry/persistence. |
| Expense tags | CRUD; assignment/removal; expense navigation; empty/duplicate names | Chrome: create/color/empty; duplicate retention/error; rename/title; deleted fixture absent from totals; assignment persists after reload and removal works. Playwright: CRUD failures, network/draft retention, read retry, assignment/removal/retry and deleted/excluded/missing-conversion totals. |
| Wise imports | File selection; multiple files; malformed/empty input; preview; confirmation; duplicate handling; clear imported data | Chrome: Parse with no files shows an error; chooser opens. Attaching fixture CSV is blocked by extension file-URL permission; user input requested. Existing mocked multi-file browser regression passes. |
| Dataset | Search; pagination; city costs; history/provenance; generation/retry | Chrome: city/country/no-match searches, both tables' pagination, source/no-match history search, Agra editor/negative rejection, controlled new/existing generation failures/retry; mobile city/history tables reach rightmost columns. F19 verifies failed library/history/provenance reads, initial unavailable counts and Retry; production checks cover draft preservation and save-then-refresh failure. Cost checks verify zero/missing/decimal costs and coffee coupling. Live generation and Chrome native delete confirmation remain limited. |
| Providers | OpenAI/Anthropic/Gemini selection; model refresh; editable model; effort; unsaved/saved/clear key behavior using fixtures | Chrome controlled responses: three providers; editable/default model; six OpenAI efforts; refresh HTTP 503; new/existing generation HTTP 502; retained forms and retry. Playwright fixture-only profile checks saved/unsaved keys and cross-window clear/sync. Owner keys remain untouched. |
| Settings | Travellers; request limits; fixed costs; JSON/CSV exports | Chrome: fixed-cost CRUD/paid/errors; limits validation/save/reset; all five traveller counts; five persists and propagates to planner (245,059 AUD), then restored two. F20 verifies failed reads, retained costs/settings, draft-preserving Retry and initial unavailable values/recovery. Export clicks yield no observable artifact through the Chrome extension. Production Playwright downloads and validates complete JSON/CSV artifacts. Save failure/concurrency auditing continues. |
| Account/public screens | Profile name; password form validation; login/signup/forgot/reset/verify/check-email navigation | Chrome: profile save/reload/clear/restore; password required fields and Google disabled; public screens and back links inspected. Password changes, email delivery and OAuth remain excluded. |
| Responsive/accessibility | Navigation; scroll areas; labels; keyboard controls | Chrome: Compare/Planner overflow fixed; all seven mobile navigation actions fit; comparison cards, dataset/history and country tables reach far edge; annual climate dialog and methodology page reach bottom; methodology Enter toggling; overrides/expenses/costs/tag/order controls labelled. Exact 390 px production regression checks Compare/Planner/Dataset/Expenses/Settings. |
| Methodology | Current contract; sections; navigation; responsive layout | Chrome: stale v2/v3 claims reproduced and corrected; seven v1.1 sections expanded; Enter toggling; View Dataset/Open Planner links; bottom scroll; narrow page fits. Historical research remains archived. |
| Failure/data integrity | Rejected writes; user scoping; invalid values; conversion; network/provider errors; reload | Chrome and production regressions cover rejected expenses, fixed costs, tags, sorting, city costs, initial reads and controlled provider failures. Unit tests cover ownership and atomic import/tag/order writes. Missing conversions remain unavailable. No owner DB/provider key writes or methodology calibration. |

## Findings and fixes

### F20 — Settings read failures report a false zero fixed-cost total

Chrome rejects GET `/api/fixed-costs` and sees “No fixed costs yet” and zero totals despite a $25 QA row. The fix
validates all four required HTTP/JSON/schema responses before replacing costs, country options, traveller count or
provider limits. Failures retain prior data with a stale warning and Retry; initial failures label settings/totals
unavailable. Obsolete reads are ignored. Provider-limit drafts survive refreshes, and dependent actions wait for valid
reads. Chrome verifies the retained $25 row, Retry preserving unsaved 33,333 tokens / 420 seconds, initial unavailable
values and successful recovery to saved 64,000 tokens / 600 seconds / two travellers. The QA table is restored and the
disposable $25 row is removed. The production reproduction fails before the fix. Ten relevant browser checks pass,
including four new regressions for HTTP/network/unreadable/invalid data, retention, valid empty results, initial
recovery and draft preservation, plus fixed-cost/provider-limit workflows and auth setup. TypeScript, build, all 398
unit tests, memory mirror and v1.1 guard pass. Evidence: `settings-read-false-empty.png`,
`settings-read-retained-retry.png`, `settings-initial-unavailable.png`.
The complete 81-check production browser suite passes in 4.1 minutes after F18–F20.

### F19 — Dataset read failures report a false empty library and hide provenance failure

Chrome rejects GET `/api/countries` and sees zero cities/countries with “No city rows match” and no error. A rejected
selected-city provenance read is also silent. The fix validates library/history HTTP/JSON/schema/cost responses and
their consistency before replacing either view. Failures retain prior data with a stale label and Retry; initial
failures show unavailable counts/rows. Provenance failures expose a separate Retry. City drafts survive retries and
successful saves remain saved when the following refresh fails. Chrome verifies retained 210 cities / 71 countries /
67 history records, initial unavailable state, provenance error and all Retry recoveries. Copy-only table suspension
is restored. The production reproduction fails against the prior build. Ten relevant browser checks pass, including
five new regressions for HTTP/network/unreadable/invalid responses, atomic retention, initial recovery, valid empty
data, provenance/draft preservation and save-then-refresh failure, plus city editor and SSR/navigation checks.
TypeScript, build, all 398 unit tests, memory mirror and v1.1 guard pass. Evidence: `dataset-read-false-empty.png`,
`dataset-read-retained-retry.png`, `dataset-provenance-retry.png`, `dataset-initial-unavailable.png`.

### F18 — Dashboard read failures leave unlabelled stale figures or an empty shell

Chrome returns GET `/api/dashboard` 503 on client navigation and sees old figures without a warning or Retry.
A temporary expenses-table suspension in the QA copy makes an initial load show only the header and navigation
links. Both failures now have an error and Retry: prior totals/charts remain explicitly stale, and initial failures
show unavailable totals/charts. Complete validated responses replace the view together. The first client navigation
refreshes even when the dashboard was not previously mounted in that document; successful full loads skip duplicate
reads. All four new production regressions fail on the prior build and pass after the fix, plus auth setup. They cover
HTTP/network/unreadable/partial responses, atomic retention, valid empty data, initial failure/recovery and freshness.
Chrome verifies retained $112,690 planned / $51,850 actual with the warning, initial unavailable state and both Retry
recoveries. The QA table is restored. TypeScript, build, all 398 unit tests, memory mirror and v1.1 guard pass.
Evidence: `dashboard-read-silent-stale.png`, `dashboard-initial-read-empty.png`,
`dashboard-read-retained-retry.png`, `dashboard-initial-read-unavailable.png`.

### F17 — Rejected inline leg edits discard input without feedback

Chrome changes disposable Mui Ne leg 1094 from fourteen to fifteen nights, returns PUT 503, and sees fourteen restored
without an error. The new production regression fails against the prior build because the card has no rejection alert.
The fix keeps card drafts separate from saved trip data, reports failures with Retry/Discard, and serializes/coalesces
each leg's writes so older responses cannot overwrite newer input. Card previews are labelled; aggregate totals use
confirmed data, and plan save/export/replacement/order/estimates wait for edits to settle. Transport drafts use the
same queue; status writes distinguish a saved leg from a failed automatic reorder. Three new production tests plus
auth setup pass for HTTP/network/unreadable errors, retry/discard, preservation across an unrelated leg refresh,
automatic-order failure, rapid 2 → 20 → 200 input with only two serialized writes, and transport draft persistence.
Chrome verifies fifteen nights retained with the error, unchanged aggregate totals, disabled plan saves, Retry and
reload persistence; the disposable leg is restored to fourteen. The focused-number input's HTML value attribute
stays at fourteen while its displayed/property value is fifteen; screenshot and reload use the current value.
Evidence: `leg-edit-rejected-lost.png`, `leg-edit-rejected-retained.png`. Four queue unit checks pass for serialization,
merged failure/retry, discard and changing back to a confirmed value without a second request. All 69 unit files /
398 tests, TypeScript, build, memory and v1.1 guard pass. All 68 production browser checks pass in 3.7 minutes.

### F16 — Failed planner reads report an empty itinerary and zero totals

Chrome returns a controlled GET `/api/itinerary` 503 during client navigation. The existing 65-leg itinerary disappears,
and the planner reports zero legs, zero nights, zero total and “No legs yet”, without an error or Retry. The production
regression fails on the prior build because the read error is absent. The fix validates HTTP/JSON/list responses and
traveller settings before replacing any loaded state, retains prior data with an explicit stale label and Retry, and
ignores obsolete reads. Saved-plan reads expose failure/retry while retaining the list. Saving a snapshot or ordering
from failed/still-loading data is disabled. Successful empty results remain distinct. Nine relevant production tests
including auth setup pass for HTTP/network/malformed/list/setting failures, retry, valid empty data, initial SSR,
Add Leg and ordering. Chrome retains 65 legs / $112,690 with the stale warning, then clears it after Retry.
TypeScript, build, all 394 unit tests, memory and v1.1 guard pass.
Evidence: `planner-read-false-empty.png`, `planner-read-retained-retry.png`.

### F15 — Rejected leg additions close and clear the form

Chrome selects Amsterdam and enters nine nights. A controlled POST 503 closes Add Itinerary Leg, clears the city
and resets nights to seven, with no error. A production regression against the prior build confirms that no alert
appears. The fix retains the form and selected values on HTTP/network/unreadable responses, reports the failure,
and locks a pending submission. Nights use strict positive-integer validation rather than parseInt truncation.
TypeScript, production build, all 68 unit files / 394 tests, memory mirror and v1.1 guard pass. Two new production tests
plus auth setup pass for HTTP/network/unreadable failure retention, successful retry/reload, invalid nights and pending
submission locking. Chrome verifies fractional-night rejection, disabled pending controls and the retained Amsterdam /
nine-night draft with the server error. Evidence: `add-leg-rejected-before.png`, `add-leg-rejected-retained.png`.

### F14 — Rejected sorting reports success and move errors are hidden

Chrome moves the last disposable leg up and verifies persistence after reload. A controlled 503 on Sort by Date
leaves that order unchanged but displays “Legs sorted by date”, with no server error. Interception is cleared and
the original order restored. Fix: shared HTTP/JSON/network checks, explicit errors, no success on failure, one active
order request and labelled/disabled move controls. Server order writes use a transaction. The production regression
fails before the fix because the rejected move has no error; the first draft of that regression used the wrong API
shape and was corrected before this reproduction. Evidence: `rejected-sort-false-success.png`.
The regression passes after the fix through HTTP failure, successful move/reload, rejected sort, network failure,
successful retry and restored order. Two unit checks verify scoped writes and full rollback on a later rejected
update; all 68 files / 394 tests pass. Chrome verifies the error/no false success and successful restored order.
TypeScript, production build, memory and v1.1 guard pass. Evidence: `rejected-sort-error-fixed.png`.
First full F14 run: 60/61 pass. The ordering test's initial click sends no mocked request; its trace has only the
200 cleanup request. It passes alone. Added a network-idle readiness wait before interaction/reload assertions,
as used by the existing initial-data tests, and reran the complete suite. This test preparation change does not
alter production behavior.
The complete rerun passes all 61 browser checks in 3.1 minutes. Production code remains at `6a001de`.

### F13 — Methodology presents a retired research program as current

Chrome opens `/estimates` and sees “Version 2.1 baseline + Version 3 redesign”, with claims that source panels,
holdouts, intervals and observation collection are the current workflow. The archived v2/v3 document already labels
that text superseded. Replaced the page with the active v1.1 ten-anchor contract, current RBA validation/conversion,
exact preserved formulas, traveller scaling, provenance and limitations. Historical research stays in the archive;
its banner now records the page replacement date. No collection or calibration work is reopened.
Evidence: `methodology-stale-v3.png` in the ignored QA folder.
Chrome verifies all seven collapsible sections, Enter toggling and bottom scrolling. At the narrow override,
page width remains within the viewport. TypeScript, production build, 392 unit tests, memory and guard pass.
Evidence: `methodology-v1-1-mobile.png`. A body-targeted Control+End call times out; ordinary wheel scrolling works.

### F12 — Tags cannot be assigned or removed through expense controls

Chrome's expense edit dialog and row actions offer no tag selection; the tag page only creates/edits/views tags.
Fix: a labelled tag action opens a selection picker on desktop and mobile. GET returns owned options/assignments;
PUT validates active-expense ownership and all selected tags before atomic replacement. Empty selection removes
assignments. Rejected saves retain selections; failed reads disable Save and offer Retry. Chrome assigns a
disposable tag, verifies its checked state after reload, and removes it. The production regression passes failed
save retention/retry, read retry, persistence, removal, tag totals and invalid ID retention. Four unit checks verify
foreign/deleted expense rejection, foreign/invalid tags, deduplication and rollback on insertion failure.
All 67 unit files / 392 tests pass. Evidence: `expense-edit-no-tag-control.png`, `expense-tag-assignment-fixed.png`.

Settings exports: a separate production browser check downloads JSON and CSV, validates all seven JSON arrays
against the authenticated API and matches every CSV expense ID. Both pass. Chrome extension clicks on either
button/link produce no observable download and no console error; this remains a separate control-surface limitation.

### F11 — Failed initial expense reads look like a successful empty tracker

Temporarily renaming the isolated copy's expense table causes the initial read to fail. Chrome still presents
0 expenses / $0 AUD / No expenses yet and no Retry after hydration. The table is restored. Fix: pass the server
failure into the client, retry after mount, label unavailable totals and prevent stale exports. Chrome verifies
the error and Retry, then recovery to 1,301 expenses after restoration. The production regression fails before
and passes after, along with three expense mutation checks plus auth setup. The regression requires the isolated
QA path/account and restores its schema fixture in finally. TypeScript, build, 388 unit tests, memory and guard pass.
Evidence: `initial-expenses-false-empty.png`, `initial-expenses-failure-fixed.png` under the QA folder.

### F10 — City editing accepts negative prices

Chrome saves -5 as Shared Hostel Dorm on the isolated Agra row and shows City saved. The table displays -5.00.
The original 6 is restored. Fix: reject negative/nonfinite costs in create/edit APIs and before editor serialization;
retain invalid drafts, including coffee/basket inputs; label all fields and allow decimal steps. Chrome verifies
retained -5 with a field-specific error and valid retry. Production regression fails before and passes after the
fix, including unchanged stored values on rejection, zero/blank reload and 3.25 coffee → 6.50 drinks-none.
TypeScript, production build, 388 unit tests, memory and v1.1 guard pass. Evidence: `city-negative-saved.png` and
`city-negative-rejected.png` under the ignored QA folder.

### F9 — Narrow screens widen the whole page and hide navigation

Chrome's narrow Compare page grows to 1,152 px, clipping paragraphs and charts. Planner/mobile navigation also
overflow. A production regression at 390 px fails with page width 1,152. Fix: allow the main flex item to shrink,
wrap planner controls/leg summaries, and reduce narrow navigation spacing. The same regression passes on Compare,
Planner, Dataset, Expenses and Settings, with Home and Sign out in view. Chrome verifies corrected widths and
planner controls. TypeScript, build, 387 unit tests, memory and v1.1 guard pass. Evidence: `compare-mobile-overflow.png`,
`compare-mobile-fixed.png`, `planner-mobile-fixed.png` under the ignored QA folder. Browser zoom means the 390 px
override reports a 355 CSS px Chrome viewport; the automated regression uses exactly 390 CSS px. Override reset.

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

After F12, all 60 production Playwright checks pass in 3.1 minutes, including complete Settings export artifacts
and tag assignment/removal/failure recovery. All 67 unit files / 392 tests, TypeScript, build, memory and v1.1 guard pass.

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
