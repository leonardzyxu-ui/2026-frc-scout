# Admin V4 Competition Review Checklist

Run this checklist before using Admin V4 at an event. It is a product review checklist, not a replacement for automated tests.

## Safe Automated Checks

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run check:competition` with the proxy environment when verifying the official deployed site and relay readiness.
- Run `npm run check:head-scout` for a one-screen morning status summary that includes live readiness, relay status, and latest CI.
- Run `npm run report:morning` to turn the live head-scout status into the short business-style overnight report.
- Run `git diff --check`.
- List Playwright tests with `node ./node_modules/playwright/cli.js test --list`.

## Browser and Mobile QA

- Open Admin V4 locally with the test fixture when browser access is available.
- Confirm the first viewport shows the next decision, match-day trust, required action, and next best action without scrolling.
- Confirm mobile has no horizontal overflow and uses the compact workflow menu.
- Confirm workflow changes preserve `fixture=test-mode`, current event context, selected team, and scroll position.
- Capture desktop and mobile screenshots for Match Now, Teams, Matches, Pick List, Visualize, Data, Reports, Settings, and Stats Wiki.

## Match-Day Workflow QA

- Use the Competition Phase selector before each operating block:
  - Practice Matches: open scout collection, collect coverage, and start early prediction review even if the model is still weak.
  - Qualifications: open the next known match and keep future qual forecasts, source freshness, and scout coverage in one loop.
  - Alliance Selection Prep: open the pick list, keep unavailable/picked teams updated, and review role fit plus trust before every pick.
- Team search must work by number and name.
- Use the Now-screen Prediction checkpoint shortcut before/after each match block to open Model Trust and save a forecast snapshot.
- Pressing Enter in search must open the highlighted or matched team.
- The search button must open the same team as Enter.
- Match rows must open a focused match detail view with a visible back button.
- Team rows must open a focused team detail view with a visible back button.
- Future matches must show automatic simulations before the manual simulator is needed.
- Manual simulator must read as a custom what-if tool, not the default way to inspect known future matches.

## Prediction Ledger QA

- Open Data, then Model Trust, and confirm the Forecast Ledger panel is visible.
- Confirm the latest feature snapshot status shows feature teams, match snapshots, and forecast snapshots.
- Open Reports and confirm `Prediction Ledger Closeout` appears as a model-lead report pack.
- Export the full evidence workbook and confirm it includes a `Forecast Ledger` sheet.
- In the `Forecast Ledger` sheet, confirm future forecast rows include snapshot time, model, match, red teams, blue teams, predicted winner, predicted scores, low-confidence status, actual winner, and actual score.
- During practice and qualifications, export the full evidence workbook at the end of each block so prediction history is preserved outside the browser.
- When reviewing model accuracy, compare Forecast Ledger rows against Model Validation and Trust Calibration instead of relying on memory.

## Relay Readiness QA

- Open Settings and run Relay Readiness before the event, before lunch, and before alliance-selection prep.
- Treat The Button as the primary head-scout alert relay when its `/health` endpoint responds quickly.
- Treat DirectChat as the backup relay when The Button is slow or unreachable.
- Do not put relay passwords, device tokens, or account secrets into Admin V4 settings. Admin V4 should only ping public health endpoints unless a separate authenticated relay plan is built.
- If both relays are down, fall back to Firebase/local backup workflow and record that relay dispatch is unavailable in the morning or end-of-day report.

## Alliance Selection Prep QA

- Before the final qualification block, export a full evidence workbook and a safe device summary.
- Open Pick List and mark known unavailable teams as soon as information arrives.
- Check role fit, expected range, uncertainty, tail risk, coverage, and defense impact before moving a team up the list.
- Keep our team number and alliance seed current before trusting alliance recommendations.
- During live alliance selection, update picked/unavailable team statuses immediately after each selection, then recheck the next best available team.
- Use the Live Pick Call Sheet first; it should show the primary choice, backup choice, swing choice, why-now reason, and status controls after every live status change.
- If a model recommendation conflicts with a clear drive-team observation, record the reason in strategy notes rather than silently overriding the model.

## Data and Safety QA

- Backup import must show a preview before restore.
- Full backup export must warn that it may contain strategy, scout names, and local device evidence.
- Safe summary export must avoid scout names and secrets.
- Firebase sync must preview unsynced rows before writing.
- Credential UI must say credentials are stored only in this browser on this device.
- Credential clear actions must live in a danger zone and require confirmation.
- Admin operation log must show sensitive local operations after they happen.

## Scout-Facing QA

- Ordinary scout screens must not expose Admin V4 navigation unless the user is an admin.
- Scout task context must be plain-language first; model details stay collapsible.
- Number counters must require a second confirmation before reset.
- Reset must advertise the short confirm window and mention undo.
- QR intake must use Scan / Upload, Review Issues, Sync Trusted Rows.
- Staged QR rows must have visible remove controls on touch-sized screens.
- History export must warn that it includes scout names and match evidence.

## Comprehension QA

- Primary match-day screens should say expected range, trust, role, risk, scout check, and next action before acronyms.
- `PPA`, `PPC`, `OPR`, `EPA`, and `DPR` should appear in stat help, model toggles, advanced reports, or the wiki, not as unexplained primary commands.
- Empty states must answer what is missing, why it matters, and what action to take next.
- Pick List meeting mode must show rank, team, role, trust, status, and actions without unrelated maintenance controls.
- Visualize must render vertical bar charts with x-axis team labels and y-axis values, and long team lists must split into stacked/wrapped chart panels instead of crushing labels.

## Accessibility QA

- Settings modal must use dialog semantics, trap focus, close on Escape, and restore focus.
- Stat context menu must support right-click, `i` icon, Escape, and arrow-key navigation.
- Interactive targets should be at least 40px where practical.
- Mobile text must not overlap, clip, or push the page wider than the viewport.
