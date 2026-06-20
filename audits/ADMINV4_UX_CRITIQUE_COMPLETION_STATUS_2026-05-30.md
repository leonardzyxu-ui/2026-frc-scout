# Admin V4 UX Critique Completion Status

Status date: 2026-05-31

This file tracks current evidence against `audits/ADMINV4_UX_CRITIQUE_AUDIT_2026-05-29.md`. It is intentionally conservative: source structure and passing tests are not treated as proof of browser UX until browser QA or user-confirmed live visual review actually runs.

## Locally Improved In This Pass

- Visualize charts now split long team lists into wrapped chart panels instead of compressing every team into one x-axis.
- Admin V4 team search now uses a shared resolver that can open teams by number, exact name, display label, prefix, or token match.
- Pre Scout copy no longer uses "public fallback" language in user-facing surfaces; it says public context/starting read instead.
- Admin stat context menus are clamped inside the viewport so right-click Get Info does not open off-screen.
- The top team-search submit control and QR failed-image removal controls now meet the 40px target-size intent from the touch-target audit.
- Admin V4 route parsing, return-tab handling, data-panel parsing, and metric-surface mapping now live in `src/utils/adminV4Routes.ts` instead of the main view coordinator.
- Cached-first payload guards and latest-cache loading helpers now live in `src/utils/adminV4Cache.ts` instead of the main view coordinator.
- Pick-list localStorage state now lives in `src/utils/adminV4PickListState.ts`, with seed clamping, event scoping, team-number normalization, and invalid status filtering.
- Admin V4 formatting, freshness labels, workbook-cell stringifying, JSON download, and manual/simulator team parsing now live in `src/utils/adminV4Format.ts` instead of the main view coordinator.
- Match/result helper logic now lives in `src/utils/adminV4MatchUtils.ts`, including played-match detection, winner labels, scout-row sorting/merging, comp-level labels, and workflow view descriptions.
- Generic Admin V4 "Pending" labels in the Now/match/model surfaces were replaced with action-oriented labels such as "Load Schedule First," "Load Team Data First," and "Awaiting forecast."
- Scout Reward manual adjustments now preview before balance, adjustment delta, after balance, and reason-readiness before the Apply button is enabled; the game-like podium label was renamed to the quieter "Top Reward Balances."
- Scout Reward admin copy now avoids betting-style "stake/staked" labels in the visible panel and settlement modal; open reward points are described as pending points.
- Pick List now shows an explicit active "Meeting Mode" badge when the full board is hidden, so alliance-selection state is visible instead of only implied by the "Show Full Board" toggle.
- Playwright e2e now runs against a built preview server and launches the installed Google Chrome binary, matching the browser path used by Admin V4 visual QA instead of depending on a missing Playwright-managed Chromium download.
- Cached-first background refresh now has a browser regression proving the refresh button is the visible sync signal and the scrolled Teams list stays anchored after refresh completes.
- Workflow switches that happen while Admin V4 is still loading now queue one background refresh instead of dropping it, and the sync icon keeps a short minimum spin window so the reload signal is visible.
- The mobile command bar now keeps the Manual Simulator text button desktop-only, leaving the mobile first viewport to show icon actions, search, and the Match Now decision instead of a crowded simulator label.
- Admin V4 visual QA serve now builds its own local-mode fixture bundle before previewing, so the screenshot pass no longer depends on stale `dist/` contents.
- Admin modal titles now use unique React-generated ids, so nested Settings/action confirmations expose the correct dialog names to assistive tech and browser tests.
- Admin V4 action-confirmation state now lives in a dedicated hook instead of inline state in the giant view coordinator, and the hook resolves confirmation promises outside React state updaters.
- Admin V4 scroll-memory and refresh scroll-restoration logic now live in `useAdminV4ScrollMemory.ts`, shrinking the main coordinator and isolating the "do not jump back to top" behavior.
- Manual Match Simulator UI now lives in `AdminV4ManualSimulatorPanel.tsx`, leaving the main Admin V4 coordinator to pass state/callbacks instead of owning another full screen body.
- Playwright now proves sensitive Admin V4 data operations are staged: full backup export opens a warning confirmation, credential clearing lives in a local credential danger zone and opens a confirmation, and History evidence export opens a privacy review with compact/full export choices.
- Admin V4-owned local settings and uploaded source packs now write V4-named storage keys while still reading the old V2 keys as compatibility fallbacks for existing devices.
- The Now warning copy no longer says the vague "No Cache Yet"; it now distinguishes missing official schedule/source data from scout evidence that may already exist on the device.
- The match scout form no longer exposes scout reward predictions, stakes, or Red/Blue reward picks; reward operations stay in Data/Scouts so evidence capture is not interrupted by side incentives.
- Scout identity is now device-locked after first attachment: direct username changes are rejected in the scout archive store, Match Scout V4 exposes a passphrase-gated rename path, Pit Scout submits the locked device identity instead of a free-typed scout name, Admin V4 Settings can store/copy the admin-side plaintext passphrase, the admin backend has an admin-only secret document for that reminder, and scout-facing checks use only a SHA-256 hash.
- Remaining reward/export copy now avoids betting-style language in Admin V4 PPA decision reads and workbook reward sheets: "Verify before betting on it," "Stake," and "Total Staked" were replaced with planning/allocation language.
- Scout reward state, balance rows, settlement staging, manual reward adjustments, scout assignment optimization, and assignment/gap CSV exports now live in `useAdminV4ScoutRewards.ts` instead of the main Admin V4 coordinator; `AdminV4View.tsx` is down to 8,312 lines after this extraction.
- Scout identity settings state, admin-backend reminder loading/saving, hash refresh, and copy-to-clipboard handling now live in `useAdminV4ScoutIdentitySettings.ts` instead of the main Admin V4 coordinator; `AdminV4View.tsx` is down to 8,250 lines after this extraction.
- Workbook sheet styling plus qualification/qual-prediction/finals projection sheet helpers now live in `adminV4WorkbookSheets.ts` instead of the main Admin V4 coordinator; `AdminV4View.tsx` is down to 8,035 lines after this extraction.
- Manual Match Simulator state, quick-entry parsing, row enrichment, expected-range summaries, and winner math now live in `useAdminV4ManualSimulator.ts` instead of the main Admin V4 coordinator; `AdminV4View.tsx` is down to 7,933 lines after this extraction.

## Current Local Evidence

- `npm run typecheck` passed.
- `npm test` passed: 62/62.
- `npm run test:e2e` passed: 13 passed / 5 viewport-intentional skipped.
- `npm run test:adminv4-visual:serve` passed against `http://127.0.0.1:4180/adminv4?fixture=test-mode`, producing desktop/mobile screenshots in `/private/tmp/adminv4-final-*.png`; chart probe reported 41 positive bars, 8 axes, and mobile width 390/390 with the compact workflow menu present.
- In-app Browser local preview pass confirmed Match Now renders, Visualize reports 8 axes / 41 visible bars, Stats Wiki opens for PPA, and Teams background refresh preserved scrollTop 399 before/during/after while the refresh icon spun.
- `npm run format` passed.
- `git diff --check` passed.
- `npm run build` passed with the existing large-chunk warnings.
- Focused Admin V4 structure/test-mode/rules tests passed after the simulator, reward, and scout identity-lock cleanup: `PATH=/usr/local/bin:$PATH node --test tests/adminV4TestMode.test.mjs tests/adminV4UxStructure.test.mjs tests/firebase-rules.test.mjs` passed 25/25.
- `npm run typecheck` passed again after the simulator, reward, and scout identity-lock cleanup.
- Focused structure regression passed after the reward-language and scout-reward hook extraction: `PATH=/usr/local/bin:$PATH node --test tests/adminV4UxStructure.test.mjs` passed 7/7, and `PATH=/usr/local/bin:$PATH npm run typecheck` passed.
- Source search found no remaining production hits for the cleaned betting/stake phrases: `rg -n "\bbetting\b|Total Staked|header: ['\"]Stake['\"]|\bstaked\b|Prediction stakes|Open Stake|currently staked" src` returned no matches.
- Full local regression passed again after the reward-language and scout-reward hook extraction: `PATH=/usr/local/bin:$PATH npm test` passed 62/62, `PATH=/usr/local/bin:$PATH npm run build` passed with the existing large-chunk warnings, and `rg -n "leoscout|Total Staked|header: ['\"]Stake['\"]|\bbetting\b" dist src` returned no matches.
- Focused Admin V4 structure/test-mode regression passed after moving scout assignment optimization and assignment/gap CSV exports into `useAdminV4ScoutRewards.ts`: `PATH=/usr/local/bin:$PATH node --test tests/adminV4UxStructure.test.mjs tests/adminV4TestMode.test.mjs` passed 22/22, and `PATH=/usr/local/bin:$PATH npm run typecheck` passed.
- Full local regression passed again after the scout assignment/export hook extraction: `PATH=/usr/local/bin:$PATH npm test` passed 62/62, `PATH=/usr/local/bin:$PATH npm run build` passed with the existing large-chunk warnings, `git diff --check` passed, and `rg -n "leoscout|Total Staked|header: ['\"]Stake['\"]|\bbetting\b" dist src` returned no matches.
- Focused Admin V4 structure/test-mode regression passed after moving scout identity settings into `useAdminV4ScoutIdentitySettings.ts`: `PATH=/usr/local/bin:$PATH node --test tests/adminV4UxStructure.test.mjs tests/adminV4TestMode.test.mjs` passed 22/22, and `PATH=/usr/local/bin:$PATH npm run typecheck` passed.
- Full local regression passed again after the scout identity settings hook extraction: `PATH=/usr/local/bin:$PATH npm test` passed 62/62, `PATH=/usr/local/bin:$PATH npm run build` passed with the existing large-chunk warnings, `git diff --check` passed, and `rg -n "leoscout|Total Staked|header: ['\"]Stake['\"]|\bbetting\b" dist src` returned no matches.
- Focused Admin V4 structure/test-mode regression passed after moving workbook sheet helpers into `adminV4WorkbookSheets.ts`: `PATH=/usr/local/bin:$PATH node --test tests/adminV4UxStructure.test.mjs tests/adminV4TestMode.test.mjs` passed 22/22, and `PATH=/usr/local/bin:$PATH npm run typecheck` passed.
- Full local regression passed again after the workbook sheet helper extraction: `PATH=/usr/local/bin:$PATH npm test` passed 62/62, `PATH=/usr/local/bin:$PATH npm run build` passed with the existing large-chunk warnings, `git diff --check` passed, and `rg -n "leoscout|Total Staked|header: ['\"]Stake['\"]|\bbetting\b" dist src` returned no matches.
- Focused Admin V4 structure/test-mode regression passed after moving manual simulator state/math into `useAdminV4ManualSimulator.ts`: `PATH=/usr/local/bin:$PATH node --test tests/adminV4UxStructure.test.mjs tests/adminV4TestMode.test.mjs` passed 22/22, and `PATH=/usr/local/bin:$PATH npm run typecheck` passed.
- Full local regression passed again after the manual simulator hook extraction: `PATH=/usr/local/bin:$PATH npm test` passed 62/62, `PATH=/usr/local/bin:$PATH npm run test:e2e` passed 13/13 executed checks with 5 viewport-intentional skips, `PATH=/usr/local/bin:$PATH npm run build` passed with the existing large-chunk warnings, `git diff --check` passed, and `rg -n "leoscout|Total Staked|header: ['\"]Stake['\"]|\bbetting\b" dist src` returned no matches.
- Local in-app browser smoke check confirmed Admin V4 Settings shows Scout Identity Lock, Copy Passphrase, Scout-facing hash, plaintext reminder, and admin-only backend reminder; it also confirmed Manual Simulator table wrappers had no horizontal overflow.
- Local in-app browser smoke check confirmed the Admin V4 Manual Match Simulator renders with no console errors on `http://127.0.0.1:4180/#/adminv4?fixture=test-mode&tab=matches&mode=simulator`; input automation for that browser surface was unavailable because the Browser virtual clipboard is not installed, so the actual search/input/button regressions are covered by Playwright e2e instead.
- Firebase Hosting and Firestore rules deploy completed for project `scout-rebuilt-2026` on 2026-05-31; Firebase reported 43 files in `dist`, uploaded 34 new files, compiled and released `firestore.rules`, finalized the version, and released to `https://scout-rebuilt-2026.web.app`.
- Hosted `index.html` returned `200` for the earlier deployed build and points to `/assets/index-CzgPHiTc.js` and `/assets/index-DI3uuy13.css`.
- Hosted Admin V4 chunks returned `200`: `/assets/index-CzgPHiTc.js`, `/assets/AdminV4View-cjuTNCmW.js`, and `/assets/AdminV4VisualizeWorkflow-DReZ9fT_.js`, all with `last-modified: Sun, 31 May 2026 09:21:31 GMT`.
- Hosted `index.html` now points to `/assets/index-Cer2c9oj.js` and `/assets/index-Lvpz6L7x.css`.
- Hosted current-build chunks returned `200`: `/assets/index-Cer2c9oj.js`, `/assets/AdminV4View-bVe5IbZx.js`, `/assets/AdminV4VisualizeWorkflow-XQ96sNUK.js`, `/assets/MatchScoutV4View-DwqL21Hv.js`, and `/assets/scoutIdentityLock-DUTeZVTe.js`, all with `last-modified: Sun, 31 May 2026 11:24:41 GMT`.
- Chrome/Firebase admin visual verification is user-confirmed after the current deploy: Leo opened the live signed-in Admin V4 page in Chrome and said it looks good. Chrome extension deep DOM/screenshot automation still timed out while inspecting the live signed-in tab, so the final signed-in visual proof comes from the user's direct confirmation rather than an automated screenshot.
- Native Node module gates pass when commands run with `/usr/local/bin` before the Codex-bundled Node in `PATH`; the Codex-bundled Node still rejects some native `.node` modules because of hardened-runtime Team ID validation.

## Requirement Evidence Map

| Audit Theme | Current Evidence | Status |
| --- | --- | --- |
| Task-first Admin V4 shell | `AdminV4View.tsx`, `AdminV4CommandBar.tsx`, and workflow components replace the old V2 mainframe/sidebar-era structure; Playwright, visual QA, and in-app Browser checks cover the task-focused workflow loop, compact mobile icon actions/workflow menu, and first-screen next action. Hosted chunks for the deployed Admin V4 build returned `200` after the current deploy. | Browser-proven locally; hosted assets proven |
| Now is pressure-focused | `AdminV4NowWorkflow.tsx` shows next decision, trust, required action, and one primary next action; visual QA screenshot `/private/tmp/adminv4-final-now.png` checked these labels. | Browser-proven locally |
| Search by team name and number | `src/utils/adminV4TeamSearch.ts`, `tests/adminV4TestMode.test.mjs`, and Playwright cover names, numbers, display labels, partial names, Enter submit, and the top-bar open button. | Browser-proven locally |
| Cached-first tab switching | `AdminV4View.tsx` uses cached payload hydration, queued background refresh, spinner state, a short minimum visible sync signal, and scroll restoration; Playwright proves the refresh spinner is visible and the scrolled Teams list remains anchored after background refresh. | Browser-proven locally |
| Automatic future simulations | `AdminV4MatchesWorkflow.tsx`, fixture tests, visual QA script assertions, and Playwright e2e cover future match simulation wording and QM3 cutoff behavior. | Browser-proven locally |
| Visualize vertical charts | `AdminV4Charts.tsx` uses Recharts vertical bars with x/y axes and chart chunking for long team lists; visual QA found 41 positive bars and 8 axes. | Browser-proven locally |
| Stats Wiki/Get Info | `AdminV4StatWiki.tsx`, `AdminV4StatDefinitions.ts`, context menu wiring, visual QA, and Playwright e2e cover wiki entries and focused stat navigation; deployed Visualize/wiki chunk returned `200` after the current deploy. | Browser-proven locally; hosted assets proven |
| Data operations safety | Backup import preview, Firebase sync preview, credential danger zone, export warnings, and admin audit log are wired; Playwright proves backup export and credential clear actions open staged review/confirmation surfaces. | Browser-proven locally for staged safety surfaces |
| Scout Reward safety | Manual reward adjustment previews before/change/after balances, requires a reason before Apply is enabled, settlement uses a preview modal, visible reward copy uses "pending points" instead of stake language, and Scout Rewards stay under Data/Scouts rather than core match-day or scout-facing capture surfaces. | Locally structure-tested |
| Scout-facing simplification | Scout headers, reset confirmation, QR three-step intake, touch-sized failed-image controls, history privacy review, admin-link gating, removal of the scout-facing reward prediction widget, and device-locked scout identity with passphrase-gated rename are structurally tested; Playwright proves History export opens a privacy review before evidence sharing. | Locally tested, history privacy browser-proven |
| Visual system cleanup | G2 admin primitives, flatter shadows, no active `bg-gradient` / large shadow hits in audited surfaces. | Locally searched/tested |
| Code architecture | Old `AdminMainframeV2View.tsx` is deleted; Admin V4 is split into workflow and panel components; route interpretation helpers are centralized in `adminV4Routes.ts`; cached-first guard/loading helpers are centralized in `adminV4Cache.ts`; pick-list local state is centralized in `adminV4PickListState.ts`; formatting/parsing helpers are centralized in `adminV4Format.ts`; match/result helpers are centralized in `adminV4MatchUtils.ts`; workbook sheet helpers are centralized in `adminV4WorkbookSheets.ts`; action-confirmation state is centralized in `useAdminV4ActionConfirmation.ts`; scroll memory is centralized in `useAdminV4ScrollMemory.ts`; scout reward state/settlement/adjustments plus scout assignment optimization/export actions are centralized in `useAdminV4ScoutRewards.ts`; scout identity settings/admin reminder state is centralized in `useAdminV4ScoutIdentitySettings.ts`; Manual Match Simulator UI is centralized in `AdminV4ManualSimulatorPanel.tsx`; Manual Match Simulator state/math is centralized in `useAdminV4ManualSimulator.ts`; Admin V4 settings/source-pack storage now uses V4 keys with V2 fallback. | Audit target satisfied; further line-count reduction is optional cleanup |

## Final Completion Evidence

- Current local code is typechecked, unit-tested, e2e-tested, built, and format/whitespace checked.
- Current Firebase Hosting assets and Firestore rules are deployed and hosted chunks return `200`.
- The live signed-in Admin V4 page on `https://scout-rebuilt-2026.web.app/adminv4` was visually checked by Leo in Chrome after the deploy and reported as looking good.

Hosted deployment verification is complete for the current Firebase Hosting/static asset build and Firestore rules release. Chrome extension deep DOM/screenshot automation still timed out on the live signed-in tab, but authenticated visual proof is no longer missing because the user directly confirmed the live signed-in page after deployment.
