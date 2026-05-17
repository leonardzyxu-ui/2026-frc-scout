# QA Bugfix and Improvement Pitch - 2026-05-11

This report records the issues found during a local UI/code QA pass, what I patched immediately, and what I would pitch as the next cleanup or product-improvement work.

## Bugs Patched Immediately

### 1. Manual team correction could be overwritten by schedule autofill

Problem: In Match Scout V4, selecting a fixed scout station correctly auto-fills the scheduled team from TBA. However, the schedule effect also reran when the scout manually changed the team number. That meant a manual correction could be overwritten back to the scheduled team.

Why it matters: We explicitly allow manual team-number correction because schedules, substitutes, field-side confusion, and last-second robot swaps can happen. If the app fights the scout, the data becomes worse.

Fix: Added a `teamManuallyEdited` state. The app now auto-fills when the match, match type, or scout station changes, but preserves manual team-number corrections after the scout edits the team field.

### 2. Match type and alliance controls had invalid button-in-label markup

Problem: The Match Scout V4 form wrapped button groups inside `<label>` elements. That is invalid interactive HTML and produced broken accessibility names in browser QA, such as the Practice button being described together with the Qualification label.

Why it matters: Even if the UI looks fine, invalid semantics make automated QA, keyboard navigation, and screen-reader behavior unreliable.

Fix: Converted those button-group wrappers from `<label>` to regular grouped `<div>` sections while preserving the same visual design.

### 3. TBA profile status text could show raw HTML tags

Problem: TBA status strings can contain HTML fragments such as bold tags. Admin V2 was treating those strings as plain display text, which could show literal markup in the team profile/sidebar.

Why it matters: It looks broken and makes the scouting interface feel less trustworthy.

Fix: Added display-string sanitization in the pre-match/TBA profile normalization layer. Admin V2 now receives cleaned status text.

### 4. Local-mode Admin V2 ignored local scout archive rows

Problem: In `VITE_LOCAL_MODE`, Admin V2 loaded the shell but set V3/V4/defense rows to empty, even if the same browser/device had local IndexedDB scout archive records.

Why it matters: Our whole safety model is local-first scouting. If Firebase fails or we are testing offline, Admin V2 should still be able to reflect local device data where possible.

Fix: In local mode, Admin V2 now hydrates V3, V4, and defense rows from active, non-deleted IndexedDB scout archive records.

### 5. Username gate did not submit on Enter

Problem: The scout username modal required clicking the Save button. Pressing Enter in the username field did nothing.

Why it matters: This is a small UX papercut, but scouts are moving fast. Forms should behave like forms.

Fix: Added Enter-key submission for the username gate.

### 6. Prediction-vs-actual comparison disappeared from Admin V2

Problem: The old predictor had a clear visual backtest comparing predicted scoring curves against official match results, but the Admin V2 predictor/model-lab flow only showed tables and calibration bins.

Why it matters: The graph is one of the fastest ways to explain whether the model is tracking the event correctly. It also catches scale problems that raw accuracy numbers can hide.

Fix: Added a reusable `Prediction vs Actual Trend` panel. It shows official result curves as solid lines and calibrated model curves as dotted lines, using completed qualification matches from the selected best validated model.

## UI/Logic Checks Completed

- Match Scout V4 opens locally and shows the username gate, fixed scout mapping, substitutes, PowerCoins gate, locked event, and clean button labels.
- Admin V2 opens locally with the sidebar model controls, global team search, settings entry point, and main navigation.
- Raw Data Editor shows `Quals` and `Practice Matches` subtabs.
- Raw Data Editor groups qualification matches by match and clearly lists missing coverage for specific stations.
- Future Predictor switches between `Ranking Prediction`, `Quals Prediction`, and `Finals Prediction`.
- Future Predictor `Quals Prediction` shows the restored prediction-vs-actual trend panel.
- Strategy Brain `Model Lab` shows the same restored prediction-vs-actual trend panel.
- Finals Prediction renders a playoff bracket forecast when schedule/alliance structure is available.

## Pitches for the Next Cleanup Pass

### 1. Merge unsynced local archives into production Admin V2 analytics

Right now I patched local-mode Admin V2 to read local IndexedDB records. The next step should be a controlled merge layer for production mode too: Firebase rows first, local unsynced rows second, exact duplicates collapsed, conflicts labeled instead of hidden.

Why: If a scout's Firebase upload fails, the record is safe locally, but Admin V2 should still be able to include it after JSON import or same-device review without waiting for a successful sync.

### 2. Split the Admin V2 giant component

`AdminMainframeV2View.tsx` is doing too much: sidebar settings, data loading, predictors, Excel export, source cache, local archive sync, team search, and multiple table views.

Cleaner structure:

- `AdminV2Shell`
- `AdminV2Sidebar`
- `AdminV2DataLoader`
- `AdminV2PredictorPanel`
- `AdminV2ExportPanel`
- `AdminV2DataControlPanel`
- `AdminV2TeamInspector`

Why: This would make bugs easier to isolate and make future additions much faster.

### 3. Add a seeded local demo dataset

Local mode currently depends on real IndexedDB data or cached TBA data. A built-in demo dataset would let us instantly test tables, charts, highlighting, conflicts, exports, and missing-slot logic without touching Firebase.

Why: We are now building a serious scouting platform. A reproducible demo state is the difference between guessing and reliable regression testing.

### 4. Add browser smoke tests as scripts

We should add a small Playwright smoke-test script that checks:

- `/scout` loads
- username gate appears
- Admin V2 loads in local mode
- Raw Data Editor shows missing slots
- Future Predictor tabs switch
- Data Import and Excel Export panels open

Why: The app is now complex enough that manual browser checks are necessary but not sufficient.

### 5. Make time display event-local and explicit

Finals Prediction currently displays played playoff match times using local browser formatting. The snapshot showed early-morning times, which may be technically correct after timezone conversion but looks odd for event operations.

Pitch: Show both event-local date/time when known and a short source label, or hide time when it does not help decision-making.

### 6. Make model limitations louder

The PPC ranking table can project win RP but has limited bonus-RP projection if component thresholds are unavailable. The UI says the model layer, but the table could more explicitly say when Tower/Energized/Supercharged RP columns are unavailable or model-limited.

Why: Strategy users should know whether a number is a real projection, a zero, or an unavailable estimate.

### 7. Add a “data health first” header to Admin V2

Before strategy, the app should immediately say:

- how many matches are missing full six-slot coverage
- how many scout records are unsynced
- how many conflicts exist
- how fresh TBA/FIRST/Statbotics data is
- whether the active model is using live, cached, uploaded, or fallback data

Why: Bad data creates confident wrong strategy. The admin dashboard should make data health impossible to ignore.
