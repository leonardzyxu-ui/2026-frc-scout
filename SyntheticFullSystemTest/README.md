# Synthetic Full System Test

This folder defines the repeatable full-event simulation harness for Powerhouse scouting.

The goal is to replay an event as if Powerhouse attended it, feed time-locked pre-scout, pit-scout, match-scout, model, web-app, and PowerScout Mac-app surfaces, then produce regression evidence every time we change core scouting logic.

## Quick Start

```sh
npm run sft:validate
npm run sft:dry-run
npm run sft:full-replay
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
- `scripts/validate-framework.mjs` checks the framework contract.
- `scripts/dry-run.mjs` produces a deterministic no-network smoke replay summary.
- `scripts/full-event-replay.mjs` produces full-event replay artifacts under `SyntheticFullSystemTest/artifacts/`.
