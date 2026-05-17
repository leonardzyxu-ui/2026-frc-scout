# Offline FIRST Match Modeling

This folder is a local research system. It is intentionally separate from the React scouting app and is not deployed to Firebase Hosting.

## Design

- Raw API responses are cached in SQLite under `modeling/artifacts/cache/research.sqlite`.
- Model runs read from that cache, so we can download once and train many times.
- Feature generation is walk-forward: every prediction row is emitted before the current match updates team state.
- Models are evaluated by replaying historical matches in order.
- Statbotics context EPA models are useful diagnostics but are not promotable until we can prove the EPA snapshot would have existed before the predicted match.

## Commands

```sh
npm run model:init
npm run model:demo
npm run model:ingest:tba -- --year 2026 --event 2026mnum
npm run model:ingest:tba -- --start-year 2024 --end-year 2026
npm run model:ingest:first -- --year 2026 --event-code MNUM
npm run model:ingest:statbotics-matches -- --year 2025 --limit-matches 1000
npm run model:ingest:statbotics -- --event 2026mnum
npm run model:ingest:firebase
npm run model:import -- --file path/to/admin-backup.json
npm run model:train -- --event 2026mnum
npm run model:report
```

Use `--limit-events` and `--limit-teams` while testing API credentials. For full-history runs, use a year range and let the cache fill gradually.

## Credentials

Add these to `.env.local` or your shell environment:

```sh
MODEL_TBA_API_KEY="..."
FIRST_EVENTS_USERNAME="..."
FIRST_EVENTS_AUTH_TOKEN="..."
MODEL_FIREBASE_PROJECT_ID="..."
MODEL_FIREBASE_ACCESS_TOKEN="..."
```

The Firebase token is a local script credential for Firestore REST reads. The pipeline does not upload trained models to Firebase.

## Artifacts

Generated outputs live under `modeling/artifacts/` and are gitignored:

- `cache/research.sqlite`: raw payloads and normalized training records.
- `runs/<run-id>/run.json`: full metrics and predictions.
- `runs/<run-id>/MODEL_CARD.md`: judge-readable model card.
- `runs/<run-id>/best-model-summary.json`: compact best-known model summary.
- `demo/latest-run/`: deterministic synthetic demo run.

The cross-run judge narrative is tracked in `modeling/MODELING_RESEARCH_LOG.md`.

## Current Modeling Scope

The implemented research pipeline includes:

- prior-score baselines,
- role-aware baselines,
- batch OPR-style models,
- online EPA-style models,
- Monte Carlo score simulation,
- EPA-Monte Carlo ensembles,
- gated event residual shift experiments,
- event score-scale experiments,
- selective high-score event-scale experiments,
- no-future ridge models,
- context-EPA ridge as a non-promotable comparison,
- VIF diagnostics,
- correlation diagnostics,
- feature importance for ridge models,
- score MAE/RMSE, margin MAE, win-probability Brier score, and calibration error,
- asymmetric score bands derived from walk-forward residual spread,
- role/defense assignment features.

Current evidence favors an event-shift EPA-Monte Carlo ensemble, but the preferred shift strength differs between the broad 2024-2026 replay and the 2026-only replay. Treat this as a scope-aware research result, not a final universal answer.

Long training runs now print per-model progress. Next serious candidates are exact experiment manifests/checkpoints, scope-aware promotion, conformal score intervals, season/event archetype adapters, real Firebase scout enrichment, boosted trees, and hidden holdout event manifests.
