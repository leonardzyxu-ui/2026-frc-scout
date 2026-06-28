# Synthetic Full System Test Technical Plan

## Objective

Build a repeatable event-scale test that answers one blunt question after every important scouting change:

Can Powerhouse run pre-scout, pit-scout, match-scout, model prediction, web operations, PowerScout desktop operations, and alliance-selection prep without data leakage, broken UI flows, or worse model performance?

## System Boundary

The system under test includes:

- Existing modeling CLI in `modeling/src/cli.ts`.
- Existing synthetic data builder in `modeling/src/data/synthetic.ts`.
- Web app routes, especially admin and prediction evidence surfaces.
- Firebase-like persistence through an emulator-first bridge.
- PowerScout native macOS app under `PowerScout/`.
- Agent orchestration rules and audit reports.

The system excludes:

- Real credential upload.
- Production Firebase writes.
- Browser account login.
- Per-match LLM reasoning as the source of truth.

## Step 0: Change Trigger

Run the Synthetic Full System Test when any of these change:

- `modeling/src/**`
- `src/components/admin/**`
- `src/**/scout*`
- `src/**/prediction*`
- `PowerScout/Sources/**`
- Firebase persistence rules or sync code
- Any scouting form schema
- Any alliance-selection logic

Required command shape:

```sh
npm run sft:validate
npm run sft:dry-run
npm run model:typecheck
npm run typecheck
node --test tests/syntheticFullSystemFramework.test.mjs
```

Once the full runner exists, add:

```sh
npm run sft:replay -- --manifest SyntheticFullSystemTest/manifests/<event>.json
```

## Step 1: Fixture Selection

The fixture selector chooses one event that Powerhouse did not attend.

Inputs:

- `season`
- `excludeTeamKeys`
- `eventSelectionRule`
- optional fixed `eventKey`
- optional random seed

Rules:

- Prefer a real completed event with full TBA match results.
- Prefer enough teams and matches to stress predictions.
- Never use an event where the pretend own team is actually Powerhouse.
- If no real event cache is available, fall back to deterministic synthetic smoke data.

Output:

- `ReplayEvent` JSON containing teams, schedule, final results, public priors, and data-source provenance.

## Step 2: Data Acquisition And Caching

Fetch or load event data in this order:

1. Local cache under `modeling/artifacts/` or a future `SyntheticFullSystemTest/cache/`.
2. TBA match schedule, match results, event teams, and event status.
3. Statbotics event/team signals and published prediction snapshots when available.
4. FIRST event metadata when configured.
5. Optional team-history public records for pre-scout.

Every external response must be written to a cache artifact before normalization.

No test runner should require a live key for normal CI. Real API calls are an explicit refresh mode, not the default mode.

## Step 3: Event Snapshot Normalization

Normalize all data into these lanes:

- `publicPrior`: team history, EPA, OPR, awards, old match record, and public notes.
- `pitClaim`: subjective claims from teams.
- `pitObservation`: objective robot facts observed by Powerhouse.
- `matchObservation`: what scouts saw during simulated match action.
- `officialResult`: final match result and score breakdown.
- `predictionCheckpoint`: what the model predicted at a time boundary.

All records carry:

- `availableAt`
- `source`
- `confidence`
- `trustClass`
- `simulatedBy`
- `noFutureAfterMatchIndex`

## Step 4: Time-Locked Event Clock

The replay clock advances through fixed checkpoints:

1. `T_MINUS_7_DAYS`: pre-scout package created.
2. `T_MINUS_1_DAY`: pit priorities generated.
3. `PRACTICE_START`: practice mode enabled.
4. `PIT_SCOUT_WINDOW`: pit forms generated and partially filled.
5. `MATCH_N_POSTED`: schedule known for upcoming match.
6. `MATCH_N_FINAL`: official score available.
7. `MATCH_N_SCOUT_SYNCED`: scout observations available.
8. `LUNCH_BREAK`: model report generated.
9. `DAY_END`: nightly improvement report generated.
10. `ALLIANCE_SELECTION_PREP`: picklist and what-if engine generated.

At each checkpoint, the runner asserts that no data with a later `availableAt` enters the model or UI.

## Step 5: Pre-Scout Simulation

Pre-scout should carry slow research so match scouts are not overloaded.

Generated records:

- Team identity and public history.
- EPA and OPR trend snapshots.
- Role priors: scorer, defender, hybrid, support, unknown.
- Mechanism guesses from public sources when available.
- Reliability priors.
- Watchlist questions for pit and match scouts.
- Confidence per claim.

Expected outputs:

- Team prior table.
- Missing information list.
- Pit-scout priority order.
- Match-scout verification prompts.

## Step 6: Pit-Scout Simulation

Pit scout separates objective facts from claims.

Objective observations:

- drivetrain
- robot size/configuration
- mechanism count and type
- intake/shooting/climb/endgame mechanism presence
- visible damage or inspection risk
- drive team contact notes

Subjective claims:

- expected scoring
- expected defense value
- expected cycle time
- preferred role
- reliability claims

Trust policy:

- Objective observations default to high trust if entered by our scout.
- Subjective claims default to medium or low trust until match evidence confirms them.
- Suspicious claims become match-scout verification prompts.

## Step 7: Match-Scout Simulation

Each match creates six alliance-station observations.

The deterministic simulator produces:

- role played
- actual scoring contribution estimate
- defense pressure applied
- defense pressure received
- reliability failures
- fouls and card risk
- missed or blocked cycles
- notable autonomous/endgame behavior
- confidence and scout quality noise

The form must stay feasible. If a field cannot be reliably observed by one scout live, move it to pre-scout, pit scout, derived model logic, or post-match video review.

## Step 8: App Ingestion

The runner ingests each checkpoint into these targets:

- Model store through direct CLI or future test-only adapter.
- Web app through local fixture injection and browser checks.
- Firebase emulator through importable fixture documents.
- PowerScout through local JSON artifacts and command bridge.

Production Firebase is not part of the default Synthetic Full System Test.

## Step 9: Model Replay

At every match boundary:

1. Build the dataset from only available records.
2. Run the active model engine.
3. Write prediction ledger entries.
4. After the official result becomes available, score prediction accuracy.
5. Update online state for future matches.

Metrics:

- winner accuracy
- Brier score
- score MAE
- margin MAE
- calibration by confidence bucket
- error by phase
- error by missing-data condition
- error after pit-claim contradiction

## Step 10: Web App Bridge Checks

Browser checks should cover:

- Admin prediction evidence route renders.
- TBA missing/invalid key messages are current and actionable.
- Synthetic replay event can be selected.
- Prediction ledger is visible.
- Winners Graph or equivalent prediction-vs-actual evidence renders nonblank.
- Practice, qualification, and alliance-selection modes are visible.

Use Playwright or the browser plugin. Use screenshots and DOM assertions.

## Step 11: PowerScout Bridge Checks

Mac app checks should cover:

- Swift package builds.
- `PowerScout.app` launches or `swift test` passes in CI mode.
- Reports surface lists generated artifacts.
- Dashboard includes prediction evidence entry points.
- Relay and command surfaces do not require production secrets for local test mode.
- Future UI capture verifies the native Winners Graph renders.

Use SwiftPM first. Use XcodeBuildMCP or Computer Use only when a UI check truly needs a running app.

## Step 12: Alliance-Selection Replay

After qualifications:

1. Build a picklist from current data.
2. Simulate alliance captains and already-picked teams.
3. Ask the what-if engine for the best remaining pick.
4. Record the reason.
5. Compare against final event outcomes and model confidence.

The live version must let Leo enter picked teams on the spot and get the next best recommendation instantly.

## Step 13: Scoring Gates

Minimum gates:

- No future leakage.
- No schema validation failures.
- Model winner accuracy does not regress beyond configured tolerance.
- Brier score does not regress beyond configured tolerance.
- Critical UI routes render without console errors.
- PowerScout builds and core tests pass.
- Prediction report artifacts are created.
- Agent reports are present when agents are used.

Default policy:

- Smoke test gates run on every core change.
- Full replay gates run before major deploys or competition-night model changes.

## Step 14: Report Artifacts

Each full run should produce:

- `run-summary.json`
- `prediction-ledger.json`
- `model-metrics.json`
- `no-future-leakage-audit.json`
- `scout-coverage-audit.json`
- `web-screenshots/`
- `powerscout-screenshots/`
- `alliance-selection-replay.json`
- `morning-report.html`
- `agent-reports/`

The report should read like a product readiness brief, not just a pile of logs.

