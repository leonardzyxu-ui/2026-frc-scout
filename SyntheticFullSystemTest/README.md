# Synthetic Full System Test

This folder defines the repeatable full-event simulation harness for Powerhouse scouting.

The goal is to replay an event as if Powerhouse attended it, feed time-locked pre-scout, pit-scout, match-scout, model, web-app, and PowerScout Mac-app surfaces, then produce regression evidence every time we change core scouting logic.

## Quick Start

```sh
npm run sft:validate
npm run sft:dry-run
npm run sft:full-replay
npm run sft:real-replay
npm run sft:real-replay:silicon-valley
node --test tests/syntheticFullSystemFramework.test.mjs
```

The first implementation is intentionally a framework and contract layer. It does not pretend that a tiny smoke run is a real competition. It gives us the exact structure that a real synthetic event runner must obey.

## What This Tests

- Model engine behavior under time-locked walk-forward replay.
- Web app admin/scouting surfaces through deterministic browser hooks.
- PowerScout Mac app readiness through SwiftPM and future UI capture hooks.
- Data contracts for pre-scout, pit-scout, match-scout, prediction ledgers, alliance selection, and reports.
- Agent orchestration discipline, including when not to use LLM agents.

## Core Rule

No future leakage. A prediction checkpoint may only use public data, pit data, scouting data, and previous match results available at that simulated time.

## Folder Map

- `docs/technical-plan.md` is the step-by-step system plan.
- `docs/agent-orchestration.md` defines the conductor and worker roles.
- `docs/app-bridge-hooks.md` defines hooks into the model CLI, web app, Firebase/emulator, and PowerScout.
- `schemas/` defines JSON contracts for manifests, event replay data, scout observations, and prediction ledgers.
- `manifests/example-local-smoke.json` is a tiny deterministic smoke manifest.
- `manifests/full-local-event.json` is the local full-event replay manifest.
- `manifests/orlando-2026-public.json` replays real Orlando Regional 2026 teams, schedule, and scores from The Blue Alliance's public event page.
- `manifests/silicon-valley-2026-public-254.json` replays the CA District Silicon Valley Event presented by Apple 2026, with Powerhouse role-played as `frc254`, The Cheesy Poofs.
- `scripts/validate-framework.mjs` checks the framework contract.
- `scripts/dry-run.mjs` produces a deterministic no-network smoke replay summary.
- `scripts/full-event-replay.mjs` produces full-event replay artifacts under `SyntheticFullSystemTest/artifacts/`.
- `scripts/real-event-replay.mjs` fetches/parses a public TBA event page and replays every parsed match without using a TBA API key.

## History Storage

Every generated real-event replay stores its history under `SyntheticFullSystemTest/artifacts/<runId>/`. The generated folders are local evidence and are kept out of Git by default; the repeatable runner, manifests, schemas, and tests are the committed source of truth.

Key replay-history files:

- `prediction-ledger.json` stores the prediction made for each match at the moment that match was posted.
- `future-prediction-snapshots.json` stores the predicted outcomes for every known future match after pit scout and after each completed match.
- `team-metric-timeline.json` stores team OPR, EPA, PPC, and PPA snapshots after pit scout and after every completed match.
- `metric-definitions.json` stores the meanings of OPR, EPA, PPC, and PPA with the run.
- `scout-observations.json` stores synthetic pre-scout, pit-scout, and six match-scout rows per match.
- `event-history-index.json` ties the run ID, event, pretend own team, storage root, and generated artifacts together.
