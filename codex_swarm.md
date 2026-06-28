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
