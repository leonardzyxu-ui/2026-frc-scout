# PowerScout Swarm Board

## Goal

Build `PowerScout`, a native SwiftUI macOS app for Powerhouse scouting leadership, while stepping back to audit whether pre-scout, pit scout, and match scout are truly covered by the current system.

## Agents

- [x] Scout system auditor (`019f0b89-f922-7d50-819e-fa5eb4bc19d5`, explorer, `gpt-5.3-codex-spark`, medium reasoning): errored from output size; main thread completed the audit in `codex_agent_reports/scout-system-audit.md`.
- [x] macOS pattern scout (`019f0b8a-3248-7ee1-a8b5-4b7c78f63683`, explorer, `gpt-5.3-codex-spark`, medium reasoning): inspected nearby SwiftPM macOS apps/build scripts for reusable app packaging patterns.
- [x] Logic reviewer (`019f0b94-9310-7fc0-bad0-f2f46bab679f`, explorer, `gpt-5.4-mini`, high reasoning): inspected scouting forms and PowerScout logic for missing real-world cases and overloaded form moments.
- [x] RelayCartographer (`019f0bc2-8394-7fd3-9169-0c90ce315bec`, explorer, `gpt-5.3-codex-spark`, medium reasoning): attempted read-only search for Leo's older Cloudflare relay server, then failed from context-window exhaustion before producing a report. Closed with no file changes; main thread completed the search and wrote `codex_agent_reports/cloudflare-relay-search.md`.
- [x] KeyJanitor (`019f0bda-d245-7bf1-8dcd-70e84a2c9c60`, worker, `gpt-5.3-codex-spark`, medium reasoning): removed the stale TBA missing-key sidebar copy, added regression coverage, and confirmed a fresh Firebase deploy is required for the live site to stop serving old bundles.
- [ ] Main Codex conductor: implement and verify PowerScout, integrate useful findings, and keep Leo's queue updated.

## Integration Notes

- Keep implementation ownership in the main thread for `PowerScout/`.
- Subagents may write only their own files under `codex_agent_reports/`.
- Do not revert unrelated local changes.
