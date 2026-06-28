# App Bridge Hooks

The Synthetic Full System Test needs hooks into apps without turning production systems into test toys.

## Bridge Contract

Every bridge receives:

```json
{
  "runId": "sft-YYYYMMDD-HHMMSS",
  "manifestPath": "SyntheticFullSystemTest/manifests/example-local-smoke.json",
  "checkpoint": "MATCH_12_SCOUT_SYNCED",
  "inputDir": "SyntheticFullSystemTest/artifacts/<runId>/inputs",
  "outputDir": "SyntheticFullSystemTest/artifacts/<runId>/outputs",
  "mode": "local-only"
}
```

Every bridge returns:

```json
{
  "bridge": "webApp",
  "status": "passed",
  "artifacts": [],
  "metrics": {},
  "warnings": []
}
```

## Model Core Bridge

Mode: direct CLI.

Current commands:

```sh
npm run model:demo
npm run model:train -- --manifest modeling/experiments/current-2026-archetype.json
npm run model:dashboard
npm run model:verify-dashboard
```

Future Synthetic Full System command:

```sh
npm run sft:replay -- --manifest SyntheticFullSystemTest/manifests/<event>.json
```

Required hooks:

- Load replay event records into an isolated SQLite database.
- Build walk-forward datasets at each checkpoint.
- Run active model configs.
- Write `prediction-ledger.json`.
- Write model metrics and promotion/rejection notes.

## Web App Bridge

Mode: Playwright first, browser plugin when useful.

Required hooks:

- Start local dev server or preview bundle.
- Inject fixture data through local storage, IndexedDB, route fixture endpoint, or Firebase emulator.
- Open configured routes.
- Assert critical text and controls.
- Capture screenshots.
- Fail on critical console errors.

Initial routes:

- `/adminv2`
- `/adminv2/prediction-vs-actual`
- `/adminv4`
- future synthetic event route

Critical checks:

- Winners Graph renders with nonblank chart pixels.
- Current TBA missing/invalid-key messages render correctly.
- Practice, qualifications, and alliance-selection modes are discoverable.
- Prediction ledger can be inspected.

## Firebase Bridge

Mode: emulator-first.

Default policy:

- Do not write production Firebase during a synthetic test.
- Do not require real browser login.
- Do not expose saved API keys in artifacts.

Required hooks:

- Generate emulator import JSON.
- Start emulator only when the test explicitly requests persistence checks.
- Import replay data.
- Export final state for diffing.

Production deploy or hosting verification remains a separate, secret-code-gated action.

## PowerScout Mac App Bridge

Mode: SwiftPM first.

Current commands:

```sh
cd PowerScout
./script/build_and_run.sh --verify
swift test
```

Required hooks:

- Read generated report artifacts from a local path.
- Open or verify dashboard/report surfaces.
- Confirm prediction evidence entry points exist.
- Future: capture native chart screenshot after Winners Graph is added.

Escalation tools:

- XcodeBuildMCP for simulator-style Apple workflows when exposed.
- Computer Use only for true macOS UI interactions.
- Shell build/test when UI proof is not needed.

## Agent Bridge

Agents should receive JSON task packets, not loose chat instructions.

Task packet fields:

- `taskId`
- `role`
- `allowedPaths`
- `readOnly`
- `commandsAllowed`
- `expectedOutput`
- `doneCondition`
- `secretPolicy`

Agents must not receive credentials. If a task needs credentials, the conductor handles the secret-code gate in the main chat and passes only nonsecret local fixture references.

## Hook Naming

Future executable adapters should use this shape:

- `scripts/bridges/model-core.mjs`
- `scripts/bridges/web-app.mjs`
- `scripts/bridges/firebase-emulator.mjs`
- `scripts/bridges/powerscout.mjs`
- `scripts/bridges/agent-task.mjs`

Each adapter should support:

```sh
node <adapter> --manifest <path> --checkpoint <name> --output <dir>
```

