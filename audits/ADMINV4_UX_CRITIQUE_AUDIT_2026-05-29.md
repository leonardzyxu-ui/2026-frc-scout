# Admin V4 UX and Code Critique Audit

Audit date: 2026-05-29  
Auditor: Codex  
Target: https://scout-rebuilt-2026.web.app/adminv4  
Repository: `2026-frc-scout`

## Executive Verdict

Admin V4 is powerful, but it is not yet intuitive.

If I were Leo using this at an event, I would feel that the app knows a lot but expects me to already understand its private language. It feels less like a calm scouting assistant and more like a research cockpit: PPA, PPC, OPR, EPA, DPR, TailGuard, RoleV3, PowerCoins, source freshness, model lab, scout dispatch, test mode, reports, backups, and raw evidence all compete for attention.

The core problem is not that the data is bad. The core problem is that the interface has not chosen what matters first. It exposes the whole nervous system instead of guiding the user through the next decision.

The blunt version: this app has the brain of a serious scouting lead, but the interface currently feels like it was built for the person who wrote the model, not for the person who has 90 seconds between matches and needs to know what to do.

## Audit Scope and Evidence

I reviewed:

- The hosted Admin V4 page at `https://scout-rebuilt-2026.web.app/adminv4`.
- Local Admin V4 behavior with the `fixture=test-mode` route.
- Desktop and mobile layouts.
- The whole visible codebase, especially Admin V4, scout workflows, QR intake, history, settings, local storage, Firebase rules, tests, and modeling.
- Current uncommitted admin/test-mode work.

Commands and checks run:

- `date '+%Y-%m-%d %H:%M:%S %Z'`
- `git status --short`
- `rg --files`
- `npm run typecheck`
- `npm test`
- Chrome/Playwright browser probes against the hosted page and local fixture.
- Code searches for routing, storage, destructive operations, admin access, test mode, reports, and domain vocabulary.

Verification results:

- `npm run typecheck` passed.
- `npm test` passed: 40 tests.
- The tests are useful but do not prove the real Admin V4 user experience. They do not meaningfully cover the multi-tab Admin V4 browser workflow, the routing context loss, the confusing test-mode fixture behavior, or the destructive/admin operations.
- Hosted Admin V4 rendered the admin guard and showed "ADMIN ACCESS REQUIRED" with only one visible action: "REFRESH ADMIN ACCESS."
- Chrome extension control could see the open tab earlier but repeatedly timed out on deep DOM/screenshot inspection. Local browser inspection was done with Google Chrome through Playwright.

Time-gate compliance:

- Earlier checks before the deadline included `2026-05-28 22:49`, `23:04`, `23:13`, `23:17`, `23:25`, `23:26`, `23:29`, and `23:30` CST, all before May 29 at 8:00 AM.
- Because those checks were before the cutoff, I kept re-auditing instead of stopping.
- Final write approval was received after the direct secret code, and the write-time check was `2026-05-29 09:48:19 CST`, after the cutoff.

## The User Feeling

The question I kept asking was: "If Leo opens this without a walkthrough, does he know what to do immediately?"

My answer is no.

I would feel:

- Impressed by the amount of thinking behind it.
- Unsure which number to trust.
- Unsure what the first action should be.
- Worried that a wrong click might change real data.
- Buried under words that sound important but are not self-explanatory.
- Forced to learn the model before I can use the tool.
- Like the app is asking me to be a data lead, scout lead, model researcher, drive-team strategist, admin, and judge presenter all at once.

The app needs to become calmer. It should say: "Here is the next decision. Here is why. Here is what to do next. Here is what not to trust yet."

## Highest Priority Problems

### 1. The default experience is too cognitively heavy

Admin V4 opens into a command view that has many useful pieces, but the first screen still asks the user to parse:

- Current workflow.
- Event key.
- Test mode state.
- Next match.
- Forecast.
- Evidence gaps.
- PPA confidence.
- Alliance PPA shape.
- Role call.
- Scout dispatch.
- Model/source context.
- Multiple navigation choices.

That is too much for an event setting.

Recommended direction:

- Make "Now" a true command screen with only three things:
  - Next match plan.
  - Trust level.
  - Required action.
- Move detailed model/source explanations behind secondary "Why?" panels.
- Do not show every workflow equally at the top.

### 2. The app uses expert vocabulary before earning trust

The Admin V4 file alone contains heavy repeated vocabulary:

- PPA
- PPC
- OPR
- DPR
- EPA
- TailGuard
- RoleV3
- PowerCoin
- Statbotics
- TBA
- FIRST
- Calibration
- Brier
- no-future

These terms are not inherently wrong. The problem is that they appear in primary UI surfaces.

For a head scout, "PPA" can eventually be learned. For immediate use, the app should first say:

- "Expected points"
- "Floor risk"
- "Needs scout confirmation"
- "Do not trust yet"
- "Good enough for match plan"

Then it can expose PPA as the technical term.

Recommended direction:

- Use plain-language labels in primary surfaces.
- Keep acronyms in tooltips, glossary, or advanced mode.
- Rename "Model Lab" and "No-Future Feature Matrix" into advanced/research views, not match-day defaults.

### 3. The top navigation makes everything feel equally urgent

Top-level workflows:

- Now
- Teams
- Matches
- Pick List
- Visualize
- Data
- Reports

This is a lot, especially on mobile. It presents the entire app map instead of the current job.

The user does not need to decide between seven workflows when the next match is coming up. The app should decide what mode matters most and let the user branch only when needed.

Recommended direction:

- Replace the top workflow strip with a task-first command bar:
  - "Match Now"
  - "Collect Missing Data"
  - "Pick List"
  - "Data Health"
- Move Reports and Visualize into secondary or advanced navigation.
- Keep one visible "More" menu for less urgent workflows.

### 4. Hosted admin onboarding is not actionable enough

The hosted page showed:

- "ADMIN ACCESS REQUIRED"
- A Firebase custom claim/admin role explanation.
- A raw signed-in device UID in the message.
- One action: "REFRESH ADMIN ACCESS."

That is not enough for the actual user.

If Leo lands here without admin rights, the page should answer:

- Am I signed in?
- Which account/device am I using?
- Who can grant access?
- What exact step should I take next?
- Is anonymous auth expected?

Current behavior exposes Firebase internals and does not provide a real fix path.

Recommended direction:

- Add a human help path: "Ask an admin to enable this device/account."
- Hide or de-emphasize raw UID unless explicitly expanded.
- Add "Copy access request" with event/team context.
- Add a clear sign-in/account explanation if anonymous auth is intentional.

### 5. Admin V4 is implemented as a giant 12,346-line component

`src/views/AdminMainframeV2View.tsx` is 12,346 lines.

That file contains:

- Routing interpretation.
- Settings.
- Test mode fixture generation.
- Data loading.
- Firebase/cache handling.
- Scout assignment planning.
- PPA calculation surfaces.
- Match prediction.
- Pick list.
- Visualizations.
- Reports/workbook export.
- PowerCoins.
- Settings modal.
- Admin actions.
- UI rendering for many workflows.

This is a maintainability risk. It makes it hard to reason about user state, route state, destructive actions, and test mode behavior.

Recommended direction:

- Split Admin V4 into route/workflow modules:
  - `AdminCommandView`
  - `AdminTeamsView`
  - `AdminMatchesView`
  - `AdminPickListView`
  - `AdminDataHealthView`
  - `AdminReportsView`
  - `AdminSettingsModal`
  - `AdminTestModeProvider`
- Move test-mode fixture data out of the main view file.
- Move route-building into one helper that preserves contextual params.

## Critical UX Findings

### 6. The app does not clearly tell the user what to do first

The Now view says it is a head-scouting brief, but it still has many competing calls:

- Open Full Plan
- Fill Evidence Gaps
- Scout Dispatch
- Open Team
- Manual Simulator
- Configure Test Mode
- Navigate workflows

There should be one obvious primary action.

Recommended direction:

- Add a "Next best action" block.
- Limit primary actions to one or two.
- Use secondary disclosure for all other actions.

### 7. The Now view contains a confusing alliance contradiction

In the local fixture, the page shows an own-alliance red context, but the copy says:

- "Win condition for Blue..."

At the same time it labels:

- "Our Alliance (Red)"

That contradiction is severe because match strategy is exactly where wrong alliance perspective matters.

Recommended direction:

- Treat alliance perspective as a high-risk invariant.
- Add tests for "own team is red" and "own team is blue" wording.
- Make every strategic sentence include perspective checks.

### 8. Net margin and projected RP looked inconsistent with the forecast

In the local fixture, the forecast showed Red as favored with Red expected around 99.2 vs Blue around 80.5, but the role/RP call showed a negative net margin and projected RP 0.0.

This may be a real calculation perspective issue, or it may be an unclear label. Either way, the user cannot tell.

Recommended direction:

- Every match plan should show "from whose perspective?"
- Add explanation for net margin and RP assumptions.
- Highlight contradictions automatically.

### 9. Confidence labels are too optimistic beside visible evidence gaps

The page can say "High confidence" while also showing multiple evidence gaps.

That feels contradictory. A human sees "6 evidence gaps" and "high confidence" and wonders which to trust.

Recommended direction:

- Split confidence into:
  - Model confidence.
  - Local scouting confidence.
  - Action confidence.
- Use a single match-day trust label:
  - "Trust"
  - "Use carefully"
  - "Do not trust yet"

### 10. The Data page primary action conflicts with visible data

In test mode, Data says:

- "Start With Sources"
- "No cached or uploaded event source is available on this device."

But the same app shows:

- 12 evidence rows.
- 10 match rows.
- 6 PPA shapes.
- 3 low trust.

To the user, that feels like the app is contradicting itself.

Recommended direction:

- Distinguish "official source data" from "scout evidence."
- Use more precise copy:
  - "Official schedule/source missing"
  - "Scout evidence present"
- Do not make "Start With Sources" the top action if the immediate problem is evidence quality or coverage.

### 11. Teams table is too dense for immediate understanding

The desktop Teams view shows columns like:

- Team
- TBA Rank
- Matches
- PPA
- PPC
- Auto
- Teleop
- Defense
- EPA
- OPR
- DPR

That is expert-friendly but not beginner-friendly. A user has to decide which model surface matters.

Recommended direction:

- Default table should show:
  - Team
  - Role
  - Expected value
  - Trust
  - Next action
- Put raw metric columns behind "Advanced stats."

### 12. Team rows have too many tiny info buttons

There are many small explanation/info buttons near model options and table headers.

The intention is good, but the result is visual noise. It suggests the screen is not self-explanatory.

Recommended direction:

- Use one "Metric guide" drawer.
- Replace per-header buttons with inline plain labels.
- Use tooltips sparingly for edge cases.

### 13. Pick List has extreme action density

In the test fixture, Pick List had 108 visible/control elements across the page.

Every row can expose actions like:

- Our Pick
- Taken
- Scout Check
- Declined
- Out
- Clear

This is too much for alliance selection, where stress is high and mistakes are expensive.

Recommended direction:

- Use one primary row action.
- Put status changes in a menu.
- Add confirmation/undo for pick status changes.
- Add a "meeting mode" with only rank, team, role, trust, and status.

### 14. Pick List decision lanes repeat teams and add noise

The lane concept is good:

- Safe Floor
- Upside Ceiling
- Role Balance

But in the fixture, the same teams repeat across lanes. Role Balance also showed defense values of 0.0, making the lane feel useless.

Recommended direction:

- Hide lanes with no differentiating data.
- Explain why a team appears in a lane.
- Avoid repeating the same shortlist unless the repeated signal is meaningful.

### 15. Visualize looks like a research dashboard, not a quick explanation tool

The Visualize workflow exposes many metrics and charts.

Issues observed:

- Many metric chips compete visually.
- Chart legends looked cramped/smashed.
- Labels are small and hard to parse.
- The visual hierarchy is not strong enough.

Recommended direction:

- Add presets:
  - "Explain next match"
  - "Compare pick-list candidates"
  - "Show trust problems"
  - "Judge demo"
- Let the user start from a question, not a metric list.

### 16. Reports leans into "one workbook, many audiences"

The Reports page says the workbook is intentionally comprehensive.

That conflicts with the user's stated goal: not wanting piles of data and buttons leading everywhere.

Recommended direction:

- Default to audience-specific exports.
- Make the huge workbook an advanced option.
- Rename it honestly: "Full raw/advanced workbook."

### 17. Mobile first viewport is mostly navigation and chrome

On mobile, useful content starts around 494px down in several views. The first screen is dominated by:

- Header
- Event/test badges
- Open/Sim buttons
- Workflow nav
- Test mode banner

This is not mobile-first. A user at an event needs the next action immediately.

Recommended direction:

- On mobile, collapse workflow nav behind a menu.
- Make the next match/action visible in the first 200px.
- Use sticky bottom actions for match-day tasks.

### 18. Horizontal nav hides later workflows

The horizontal workflow nav scrolls. On mobile, some tabs are off-screen.

This is not necessarily broken, but it makes the app feel larger and less predictable.

Recommended direction:

- Use segmented primary modes plus "More."
- Keep only current job categories visible.

## Test Mode Problems

### 19. Route navigation drops `fixture=test-mode`

I reproduced this in the local browser:

- Start at `#/adminv4?fixture=test-mode`.
- Click Teams.
- URL becomes `#/adminv4?tab=teams`.
- The fixture parameter disappears.
- The dataset collapses from the rich fixture to almost-empty state.

Code cause:

- `updateAdminRoute` builds a fresh query string from only `tab`, `panel`, `match`, `team`, etc.
- It does not preserve contextual params like `fixture=test-mode`.

Why it matters:

- The user thinks they are still in test mode.
- The visible data silently changes.
- Trust in the app drops immediately.

Recommended direction:

- Centralize route building.
- Preserve safe context params unless explicitly clearing them.
- Add browser tests that click every workflow in test mode and assert the fixture context remains active.

### 20. Other route helpers also drop context

`getAdminUseMomentRoute` returns plain routes like:

- `/adminv4?tab=now`
- `/adminv4?tab=matches`
- `/adminv4?tab=pick-list`
- `/adminv4?tab=data&panel=collection`

Scout workflow headers and setup links use those routes.

This means shortcuts can drop active context too.

Recommended direction:

- Route helpers should accept current context.
- Handoff return paths should preserve test/event context.
- Add tests for handoff return paths.

### 21. Test Mode persists in ordinary Admin settings

The current settings model persists:

- `testModeEnabled`
- `testModeEventKey`
- `testModeMatchKey`

That can surprise a real event user later.

Recommended direction:

- Add a loud "Exit Test Mode" action.
- Require explicit confirmation before leaving test mode enabled across reloads.
- Consider session-only test mode unless the user pins it.

### 22. Test Mode fixture has invalid defense metrics

The local fixture creates defense rows with values like:

- 7
- 5
- 8

But real defense metrics are normalized/clamped in `src/utils/matchDefenseScouting.ts` to 0..1.

The UI formats defense metrics as percentages, so fixture values appear as:

- 500.00%
- 700.00%
- 800.00%

That is a serious test-data bug because it makes the app demonstrate impossible values.

Recommended direction:

- Make fixture defense metrics 0.5, 0.7, 0.8 instead.
- Add a test that fixture defense metrics stay within 0..1.
- Add UI guardrails for impossible metric values.

### 23. Current test-mode tests are too narrow

`tests/adminV4TestMode.test.mjs` checks the pure scoping helper. That is valuable.

But it does not test:

- Browser route behavior.
- Fixture query preservation.
- UI banners.
- LocalStorage persistence.
- Defense metric normalization.
- Data page source/evidence copy.
- Test mode exit behavior.

Recommended direction:

- Add Playwright tests for Admin V4 fixture mode.
- Click each workflow and assert stable fixture context.
- Assert no impossible percentages render.
- Assert the selected match is treated as future/unplayed.

## Safety and Data Operation Problems

### 24. Backup import restores a lot of state without enough staged review

`handleImportFullLocalBackup` can restore:

- Scout archive records.
- Cache entries.
- PowerCoin bets.
- PowerCoin ledger.
- Scout assignment plan.
- Model snapshots.
- Feature snapshots.
- Uploaded TBA pack.
- Pre-match cache.
- Settings.

The UI shows "Import Backup" as a file input label. There is no obvious preview/diff/confirm step.

Recommended direction:

- Add a preview screen before restore.
- Show counts and affected stores.
- Let the user choose which categories to import.
- Add a final confirmation.

### 25. Backup export can contain sensitive strategic data

The full local backup includes strategy-relevant and scout-behavior data:

- Scout archive.
- Pre Scout public-profile cache and evidence.
- Source cache.
- Uploaded files.
- Model snapshots.
- Scout plans.
- PowerCoins.

The copy says FIRST tokens are not included, which is good. But the export still contains team strategy and scout performance data.

Recommended direction:

- Add warning: "This file may contain team strategy and scout names."
- Offer "safe summary export" vs "full backup."
- Add a generated export manifest.

### 26. FIRST/TBA credentials are stored locally without a strong enough user warning

`adminV2LocalStore.ts` stores FIRST credentials and TBA API key in IndexedDB.

That may be acceptable for a local admin device, but the UI should say it plainly.

Recommended direction:

- Add "stored in this browser on this device" copy.
- Add "do not use on shared devices."
- Add a clear delete/rotate path.

### 27. Clear FIRST and Clear TBA appear as ordinary buttons

Settings includes:

- Refresh FIRST Cache
- Clear FIRST
- Clear TBA

These are not styled or staged like risky actions.

Recommended direction:

- Move clear actions to a danger zone.
- Add confirmation.
- Explain exactly what is cleared.

### 28. Sync Unsynced To Firebase is a direct large operation

The Data backup/sync panel exposes "Sync Unsynced To Firebase."

This can affect remote shared data. It needs stronger staging.

Recommended direction:

- Preview unsynced rows.
- Show conflicts and target collections.
- Require confirmation for bulk sync.

### 29. PowerCoin operations are too easy to trigger

Admin V4 includes PowerCoin settlement and adjustment actions:

- Auto-settle played bets.
- Apply ledger adjustment.
- Settle individual bets as Red/Blue/Tie/Unknown.

These actions alter a gamified ledger. They should be auditable and hard to misclick.

Recommended direction:

- Add confirmation and undo where possible.
- Show before/after balance.
- Require a reason for every adjustment.
- Separate PowerCoins from core scouting operations.

### 30. Handoff URLs can carry strategic context in query strings

`scoutTaskHandoff.ts` can put task data and PPA context into route query strings.

Query strings can end up in screenshots, browser history, logs, shared links, and user copy/paste.

Recommended direction:

- Keep sensitive task context in local storage only.
- Use short opaque task IDs in URLs.
- Avoid putting strategy detail and model warnings in query params.

## Accessibility and Interaction Problems

### 31. Admin modal lacks strong dialog semantics

`AdminModal` renders a fixed overlay but does not appear to set:

- `role="dialog"`
- `aria-modal="true"`
- focus trap
- escape handling
- return focus to opener

This matters for keyboard users and also for general polish.

Recommended direction:

- Add dialog semantics.
- Trap focus while open.
- Close with Escape.
- Restore focus.

### 32. Context menu closes on any keydown

`AdminContextMenu` closes on all keydown events.

That is simple, but not a full keyboard interaction model.

Recommended direction:

- Close on Escape.
- Allow arrow-key navigation.
- Use menu/menuitem semantics if it is really a menu.

### 33. Many controls rely on text-heavy buttons instead of clear command hierarchy

The app uses many buttons with long labels. The difference between primary, secondary, risky, and informational actions is not always clear enough.

Recommended direction:

- Create strict button hierarchy:
  - Primary action.
  - Secondary action.
  - Utility.
  - Dangerous.
- Use menus for status changes and advanced actions.

### 34. Tiny controls are hard to hit and visually noisy

Browser inspection found many small 18px or 28px controls, especially metric info buttons and compact model controls.

Recommended direction:

- Make interactive targets at least 40px where possible.
- Remove repeated small info buttons.
- Use one metric-help drawer.

## Codebase and Architecture Problems

### 35. Naming drift is confusing

Admin V4 lives in:

- `src/views/AdminMainframeV2View.tsx`

Routes include:

- `/admin`
- `/adminv2`
- `/adminv4`

The component name and file name say V2 while the app says V4.

Recommended direction:

- Rename the file and component to Admin V4.
- Keep redirect compatibility separately.
- Remove obsolete mental labels from active code.

### 36. Admin V4 mixes too many state systems

State lives across:

- Route query params.
- React state.
- localStorage.
- IndexedDB.
- Firebase.
- Uploaded CSV/JSON packs.
- Test mode fixture state.
- Local archive.

This is why context loss is easy.

Recommended direction:

- Make a state ownership map.
- Centralize event/test-mode context.
- Centralize route serialization/deserialization.

### 37. Browser workflow tests are missing

The current Playwright e2e test only checks that core routes render nonblank/generic text.

It does not check:

- Admin workflow navigation.
- Settings modal.
- Test mode.
- Pick-list actions.
- Data import/export states.
- Mobile layout.
- Critical copy contradictions.

Recommended direction:

- Add Playwright route tests for every Admin V4 workflow.
- Add mobile screenshots/overflow checks.
- Add "no impossible metric display" tests.
- Add "own alliance wording" tests.

### 38. There is no strong regression test for user comprehension

Automated tests can catch some issues, but this product also needs UX-specific acceptance criteria.

Examples:

- First screen must show one primary next action.
- No more than N primary controls above the fold on mobile.
- Every match plan must state perspective.
- Every trust/confidence label must show what it means.
- No data page can say "no source" without distinguishing official source vs scout evidence.

Recommended direction:

- Add UX invariants as tests where possible.
- Add screenshot QA checklists.
- Add manual review checklist before competition use.

### 39. Generated modeling language leaks into match-day UI

The modeling README is serious and careful. It has leakage audits, claim boundaries, validation, dashboard verification, and model-card thinking.

But that research language leaks into Admin V4 too much.

Recommended direction:

- Keep modeling proof in Reports/Judge/Advanced.
- Keep match-day UI about decisions.
- Translate model findings into short operational language.

## Scout Workflow Problems

### 40. Scout headers can overload ordinary scouts

The scout workflow header can show:

- PPA Evidence Brief
- Expected
- Floor/Ceiling
- Normal Band
- Role
- Risk/Trust
- Why this is being asked
- What to prove
- Model name
- Tail risk
- Warnings

For a scout, this may be too much. It can bias observations or slow them down.

Recommended direction:

- Give scouts a short task:
  - "Watch Team 254 in QM3."
  - "Verify if defense actually reduced cycles."
  - "Record failures/fouls."
- Keep model details collapsible.

### 41. Number counter Reset is dangerous

`MatchScoutV4View` has a prominent Reset button inside counters. It sets the value to 0.

There is a "Revert Last" button, which helps, but Reset is still easy to hit under event pressure.

Recommended direction:

- Make Reset require hold-to-confirm or move it to a menu.
- Add undo toast after reset.

### 42. Scout home links into Admin V4 concepts

Setup and scout headers link to Admin V4 use moments.

That is useful for power users but can confuse normal scouts. Scouts need a simple job board.

Recommended direction:

- Keep admin links hidden unless user is admin.
- For scouts, show only their next job and evidence history.

### 43. QR intake is powerful but dense

QR intake has:

- Camera scanning.
- File upload.
- Failed images.
- Evidence staging.
- Sync staged.
- Import metadata.
- Admin task panels.

This is a lot for a stressful data-recovery workflow.

Recommended direction:

- Use a three-step flow:
  - Scan/upload.
  - Review issues.
  - Sync.
- Make destructive/remove buttons always visible enough on touch devices.

### 44. History export is powerful but needs clearer privacy framing

History can export the local evidence bundle. That is useful, but the user should know it includes scout names and match evidence.

Recommended direction:

- Add a privacy warning before export.
- Add a summary of what is included.
- Offer a compact export.

## Visual Design Problems

### 45. The visual style is too decorative for an operations tool

The dark theme, gradients, rounded "squircle" cards, colored glows, and many badges make the app feel polished but visually loud.

For operations, the screen should feel calmer and more scannable.

Recommended direction:

- Reduce gradients.
- Use flatter sections.
- Make severity colors consistent.
- Save bright colors for true alerts and primary actions.

### 46. Too many cards look equally important

Many sections use similar card treatments. This weakens hierarchy.

Recommended direction:

- Use fewer card containers.
- Make the main decision unframed and obvious.
- Use cards only for repeated items or contained tools.

### 47. Empty/unknown states blend with real states

Words like:

- Unknown
- Missing
- Fallback
- No local
- Unavailable

appear frequently. They do not always produce a clear action.

Recommended direction:

- Every unknown state should answer:
  - Is this bad?
  - Does it affect the current decision?
  - What should I do?

### 48. Color semantics are overloaded

Cyan, emerald, fuchsia, amber, rose, slate, violet, and gradients appear throughout.

The user cannot rely on color alone to know meaning.

Recommended direction:

- Define color roles:
  - Green = safe/ready.
  - Amber = needs attention.
  - Red = risky/destructive.
  - Blue/cyan = neutral navigation/info.
  - Purple/fuchsia = test/advanced only.

## Specific Code Findings Worth Fixing

### 49. `AdminMainframeV2View.tsx` contains local test fixture construction

Fixture data in the main view increases file size and makes it easier for bad test data to leak into UI assumptions.

Recommended direction:

- Move fixture to `src/utils/adminV4TestFixture.ts`.
- Normalize all fixture rows through real normalizers.

### 50. Fixture defense rows bypass normalizer

The fixture directly constructs `MatchDefenseScoutingV1` rows with invalid `defenseMetric` values.

Recommended direction:

- Use `normalizeMatchDefenseScoutingV1`.
- Add fixture validity tests.

### 51. Route update helpers rebuild query strings from scratch

`updateAdminRoute` and `updateWikiRoute` do not preserve contextual params.

Recommended direction:

- Build routes from current `location.search`.
- Explicitly preserve or clear known context keys.

### 52. Return paths for scout tasks do not preserve all context

`buildScoutTaskReturn` constructs new Admin V4 paths without context like fixture mode.

Recommended direction:

- Use the same route builder as workflow navigation.
- Include test/event context safely.

### 53. Admin V4 has unused primitives

`AdminV4Primitives.tsx` exports primitives like `WorkspaceNav`, `ActionGroup`, `DangerZone`, and `MetricBarChart`, but current searches show some are not used by Admin V4.

This suggests the design system is partly aspirational and partly bypassed.

Recommended direction:

- Either use these primitives consistently or delete/replace them.
- Put dangerous operations into the actual `DangerZone` primitive.

### 54. Admin modal close button uses text `X`

It has an aria label, which is good, but visually it should use a proper icon and support expected modal behavior.

Recommended direction:

- Use an icon.
- Add full dialog behavior.

### 55. Raw data editor has better destructive confirmation than some Admin V4 actions

`RawDataEditorView` confirms admin role before delete/save. That is a good pattern.

Admin V4 backup/import/sync/PowerCoin operations should match that level of care.

Recommended direction:

- Promote the raw editor confirmation pattern into shared admin action components.

## What I Would Change First

### Phase 1: Make it usable under pressure

1. Redesign Now as the true home screen.
2. Show one primary next action.
3. State alliance perspective loudly.
4. Replace "High confidence" with a more honest trust label.
5. Hide advanced metrics by default.
6. Fix route context loss.
7. Fix impossible defense percentages.

### Phase 2: Make data operations safe

1. Add confirmations/previews for import, sync, clear credentials, and PowerCoins.
2. Add privacy warnings for exports.
3. Separate full backup from safe summary exports.
4. Add an audit log for admin operations.

### Phase 3: Make Admin V4 maintainable

1. Split the 12k-line Admin V4 component.
2. Move test mode into a provider/helper.
3. Centralize route building.
4. Add Playwright workflow tests.
5. Add mobile screenshot regression checks.

### Phase 4: Make the language humane

1. Translate model terms into match-day language.
2. Put acronyms in glossary/advanced mode.
3. Use "what this means" and "what to do" instead of "what the model is."

## Suggested New Information Architecture

Default:

- Match Now
  - Next match plan.
  - Trust level.
  - Required scout tasks.

Second:

- Collect Data
  - Missing rows.
  - QR intake.
  - Scout assignments.
  - Sync status.

Third:

- Pick List
  - Meeting mode.
  - Candidate comparison.
  - Status board.

Fourth:

- Data Health
  - Sources.
  - Imports.
  - Backups.
  - Advanced raw audit.

Advanced:

- Model Lab.
- Visualize.
- Reports.
- Judge proof.
- Full workbook.

## Proposed Match-Day Copy Direction

Instead of:

- "PPA confidence: High confidence"

Use:

- "Use this plan, but fill 6 evidence gaps before treating pick-list ranks as final."

Instead of:

- "Start With Sources"

Use:

- "Official schedule/source missing. Scout evidence is loaded, but official source data is not."

Instead of:

- "Role Balance - Defense 0.0"

Use:

- Hide the lane or say "No useful defense data yet."

Instead of:

- "Win condition for Blue" inside a red own-alliance context

Use:

- "Our red alliance win condition..."

## Positive Notes

There is strong thinking here.

Good foundations:

- Local-first scouting is valuable.
- IndexedDB history and QR fallback are practical for events.
- Admin/scout separation is conceptually strong.
- PPA as an expected/floor/ceiling object is better than a single magic number.
- Modeling docs show unusually careful thinking about leakage and overclaiming.
- Test mode rewind is a strong idea.
- The app tries to connect raw scouting evidence to actual strategic decisions.

The critique is blunt because the product is close enough to be worth being blunt about. The issue is not lack of capability. The issue is that the capability is not shaped into a calm, obvious user path.

## Final Blunt Summary

Admin V4 is currently an expert dashboard pretending to be a command center.

For the user, the app should feel like:

"Here is what matters now. Here is what I trust. Here is what I need you to collect. Here is the safest next click."

Right now, it often feels like:

"Here is everything the system knows. Good luck deciding which part matters."

That is the main thing to fix.

