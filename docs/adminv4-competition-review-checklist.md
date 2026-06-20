# Admin V4 Competition Review Checklist

Run this checklist before using Admin V4 at an event. It is a product review checklist, not a replacement for automated tests.

## Safe Automated Checks

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `git diff --check`.
- List Playwright tests with `node ./node_modules/playwright/cli.js test --list`.

## Browser and Mobile QA

- Open Admin V4 locally with the test fixture when browser access is available.
- Confirm the first viewport shows the next decision, match-day trust, required action, and next best action without scrolling.
- Confirm mobile has no horizontal overflow and uses the compact workflow menu.
- Confirm workflow changes preserve `fixture=test-mode`, current event context, selected team, and scroll position.
- Capture desktop and mobile screenshots for Match Now, Teams, Matches, Pick List, Visualize, Data, Reports, Settings, and Stats Wiki.

## Match-Day Workflow QA

- Team search must work by number and name.
- Pressing Enter in search must open the highlighted or matched team.
- The search button must open the same team as Enter.
- Match rows must open a focused match detail view with a visible back button.
- Team rows must open a focused team detail view with a visible back button.
- Future matches must show automatic simulations before the manual simulator is needed.
- Manual simulator must read as a custom what-if tool, not the default way to inspect known future matches.

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
