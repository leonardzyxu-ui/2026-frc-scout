# PowerScout Swarm Board

## Goal

Build `PowerScout`, a native SwiftUI macOS app for Powerhouse scouting leadership, while stepping back to audit whether pre-scout, pit scout, and match scout are truly covered by the current system.

## Agents

- [x] Scout system auditor (`019f0b89-f922-7d50-819e-fa5eb4bc19d5`, explorer, `gpt-5.3-codex-spark`, medium reasoning): errored from output size; main thread completed the audit in `codex_agent_reports/scout-system-audit.md`.
- [x] macOS pattern scout (`019f0b8a-3248-7ee1-a8b5-4b7c78f63683`, explorer, `gpt-5.3-codex-spark`, medium reasoning): inspected nearby SwiftPM macOS apps/build scripts for reusable app packaging patterns.
- [x] Logic reviewer (`019f0b94-9310-7fc0-bad0-f2f46bab679f`, explorer, `gpt-5.4-mini`, high reasoning): inspected scouting forms and PowerScout logic for missing real-world cases and overloaded form moments.
- [x] RelayCartographer (`019f0bc2-8394-7fd3-9169-0c90ce315bec`, explorer, `gpt-5.3-codex-spark`, medium reasoning): attempted read-only search for Leo's older Cloudflare relay server, then failed from context-window exhaustion before producing a report. Closed with no file changes; main thread completed the search and wrote `codex_agent_reports/cloudflare-relay-search.md`.
- [x] KeyJanitor (`019f0bda-d245-7bf1-8dcd-70e84a2c9c60`, worker, `gpt-5.3-codex-spark`, medium reasoning): removed the stale TBA missing-key sidebar copy, added regression coverage, and confirmed a fresh Firebase deploy is required for the live site to stop serving old bundles.
- [x] Main Codex conductor: implemented and verified PowerScout, integrated useful findings, and kept Leo's queue updated.

## Integration Notes

- Keep implementation ownership in the main thread for `PowerScout/`.
- Subagents may write only their own files under `codex_agent_reports/`.
- Do not revert unrelated local changes.

## Current Run: Synthetic Full System Test

- Task id: `sft-framework-001`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: create the initial `SyntheticFullSystemTest/` framework and validation hooks.
- Status: complete
- Evidence: `npm run sft:validate`, `npm run sft:dry-run`, `node --test tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `cd PowerScout && swift test`, and `cd PowerScout && ./script/build_and_run.sh --verify`.
- Blockers: none for local framework creation.
- Safety: no credentials, no deploy, no production Firebase writes.
- Subagents: none launched for this run.

## Current Run: Full Event Replay

- Task id: `sft-full-replay-001`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: implement and run a local full-length Synthetic Full System Test event replay.
- Status: complete
- Evidence: `npm run sft:full-replay`, `node --test tests/syntheticFullEventReplay.test.mjs tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `npm run build`, `cd PowerScout && ./script/build_and_run.sh --verify`, and `npm test`.
- Artifact run: `SyntheticFullSystemTest/artifacts/sft-full-2026fullsynthetic-20260628-050606-82491`.
- Blockers: none for the local full replay. Live TBA/Statbotics refresh remains a separate secret-code-gated step.
- Safety: no credentials used, no production Firebase writes, no deploy.
- Subagents: none launched for this run.

## Current Run: Real Event Replay

- Task id: `sft-real-replay-001`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: fetch the public The Blue Alliance page for Orlando Regional 2026, parse real teams and match results, and replay the event through synthetic scouting/prediction artifacts.
- Status: complete
- Evidence: `npm run sft:real-replay`, `node --test tests/syntheticRealEventReplay.test.mjs tests/syntheticFullEventReplay.test.mjs tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `npm run build`, `npm test`, and `cd PowerScout && ./script/build_and_run.sh --verify`.
- Artifact run: `SyntheticFullSystemTest/artifacts/sft-real-2026flor-20260628-060040-32817`.
- Blockers: none for public-page real replay. Live authenticated API refresh remains separate and would need explicit authorization.
- Safety: no TBA API key used, no credentials used, no production Firebase writes, no deploy.
- Subagents: none launched for this run.

## Current Run: Silicon Valley 254 Real Event Replay

- Task id: `sft-real-replay-silicon-valley-254`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: replay the public TBA `2026casnv` event as `frc254`, The Cheesy Poofs, and persist checkpoint history for match predictions, future predictions, and team OPR/EPA/PPC/PPA timelines.
- Status: complete
- Evidence: `npm run sft:validate`, `node --test tests/syntheticRealEventReplay.test.mjs`, `npm run sft:real-replay:silicon-valley`, `node --test tests/syntheticRealEventReplay.test.mjs tests/syntheticFullEventReplay.test.mjs tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `npm run build`, `npm test`, and `cd PowerScout && ./script/build_and_run.sh --verify`.
- Artifact run: `SyntheticFullSystemTest/artifacts/sft-real-2026casnv-20260628-071936-2542026`.
- Blockers: none for local public-page replay. No authenticated TBA API key, Firebase write, push, or deploy was used.
- Safety: public TBA page only, no credentials used, no production Firebase writes, no deploy.
- Subagents: none launched for this run.

## Current Run: Agentic Silicon Valley Scout Simulation

- Task id: `sft-agentic-silicon-valley-2026`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: redo `2026casnv` as an agentic scout simulation where six scout-persona agents fabricate score-consistent match observations and the scouting model analyzes those observations through the existing replay artifacts.
- Status: complete
- Evidence: `npm run sft:agentic-replay:silicon-valley`, `npm run sft:validate`, `node --test tests/syntheticRealEventReplay.test.mjs`, `node --test tests/syntheticRealEventReplay.test.mjs tests/syntheticFullEventReplay.test.mjs tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `npm test`, `npm run build`, and `cd PowerScout && ./script/build_and_run.sh --verify`.
- Artifact run: `SyntheticFullSystemTest/artifacts/sft-real-2026casnv-20260628-090404-2542026`.
- Catalog status: Silicon Valley is the baseline agentic replay for `2026casnv` as `frc254`, The Cheesy Poofs.
- Blockers: none currently.
- Safety: public TBA page only, no credentials, no production Firebase writes, no deploy.
- Subagents:
  - `Kant` (`019f0d69-6942-7441-ab21-65fc7abe5c86`), ScoutFormCartographer, explorer, `gpt-5.3-codex-spark`, medium reasoning, read-only. Purpose: inspect current scout form/model fields so fabricated rows match our system. Stronger model not used because this is bounded codebase cartography. Status: closed complete. Files changed: none. Report: `codex_agent_reports/scout-form-cartographer.md`.
  - `Herschel` (`019f0d69-a352-7be1-947d-e1fb226e1651`), ConsistencyAuditor, explorer, `gpt-5.4-mini`, high reasoning, read-only. Purpose: audit score-consistency/no-future/artifact risks. Stronger model not used because the task is focused verification, not architecture ownership. Status: closed complete. Files changed: none. Report: `codex_agent_reports/consistency-auditor.md`.

## Current Run: Agentic Event Batch Replay

- Task id: `sft-agentic-batch-001`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: add a reusable agentic score-consistent replay batch runner and run additional completed past events through the scout-agent simulation.
- Status: complete
- Evidence: `node --check SyntheticFullSystemTest/scripts/run-agentic-event-batch.mjs`, `npm run sft:validate`, `npm run sft:agentic-replay:batch -- --event-keys 2026flor,2026mndu,2026tuis --min-matches 30`, and artifact inspection of all four agentic replay folders.
- Catalog: `SyntheticFullSystemTest/artifacts/agentic-event-replay-catalog.jsonl` and `SyntheticFullSystemTest/artifacts/agentic-event-replay-catalog-summary.json`.
- Completed events in local agentic history: `2026casnv` as `frc254`, `2026flor`, `2026mndu`, and `2026tuis`.
- Blockers: none for local batch replay. No authenticated TBA API key, Firebase write, push, or deploy was used.
- Safety: public TBA pages only, no credentials used, no production Firebase writes, no deploy.
- Subagents: none launched for this run.

## Current Run: Agentic Event Batch Replay 2

- Task id: `sft-agentic-batch-002`
- Owner: main Codex conductor
- Role: conductor and implementer
- Model: current main Codex model
- Reasoning effort: high
- Scope: continue the active long-running replay goal by discovering completed 2026 public TBA events and running six more through the agentic score-consistent scout simulation.
- Status: complete
- Evidence: `npm run sft:agentic-replay:batch -- --limit 6 --min-matches 30`, `npm run sft:agentic-replay:batch -- --limit 0 --min-matches 30`, `npm run sft:validate`, `node --test tests/syntheticRealEventReplay.test.mjs tests/syntheticFullEventReplay.test.mjs tests/syntheticFullSystemFramework.test.mjs`, `npm run typecheck`, `npm run model:typecheck`, `npm test`, and artifact-gate inspection across all 10 known agentic replay folders.
- Catalog: `SyntheticFullSystemTest/artifacts/agentic-event-replay-catalog.jsonl` now has 10 unique success records, and `SyntheticFullSystemTest/artifacts/agentic-event-replay-catalog-summary.json` reports 10 known agentic successes.
- Newly completed events: `2026mndu2`, `2026mnwi`, `2026okok`, `2026bcvi`, `2026gadal`, and `2026milak`.
- All known agentic events after this run: `2026bcvi`, `2026casnv`, `2026flor`, `2026gadal`, `2026milak`, `2026mndu`, `2026mndu2`, `2026mnwi`, `2026okok`, and `2026tuis`.
- Blockers: none for local batch replay. No authenticated TBA API key, Firebase write, push, or deploy was used.
- Safety: public TBA pages only, no credentials used, no production Firebase writes, no deploy.
- Subagents: none launched for this run.
