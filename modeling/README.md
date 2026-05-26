# Offline FIRST Match Modeling

This folder is a local research system. It is intentionally separate from the React scouting app and is not deployed to Firebase Hosting.

## Design

- Raw API responses are cached in SQLite under `modeling/artifacts/cache/research.sqlite`.
- Model runs read from that cache, so we can download once and train many times.
- Feature generation is walk-forward: every prediction row is emitted before the current match updates team state.
- Models are evaluated by replaying historical matches in order.
- Statbotics context EPA models are useful diagnostics but are not promotable until we can prove the EPA snapshot would have existed before the predicted match.
- Firebase scout data is ingested from nested event collections with collection-group reads, then matched against official match/team rows before any modeling claim uses it.
- The final judge dashboard includes generated leakage and failure-mode audits so no-future rules, timestamp limits, sparse scout/PPC coverage, worst-event misses, phase bias, and calibration gaps are visible during presentation.

## Commands

```sh
npm run model:init
npm run model:demo
npm run model:ingest:tba -- --year 2026 --event 2026mnum
npm run model:ingest:tba -- --start-year 2024 --end-year 2026
npm run model:ingest:first -- --year 2026 --event-code MNUM
npm run model:ingest:statbotics-events -- --start-year 2024 --end-year 2026
npm run model:ingest:statbotics-matches -- --year 2025 --limit-matches 1000
npm run model:ingest:statbotics -- --event 2026mnum
npm run model:ingest:firebase
npm run model:audit:statbotics-predictions
npm run model:audit:scout-coverage
npm run model:audit:event-metadata
npm run model:audit:local-backups -- --paths .playwright-cli
npm run model:import -- --file path/to/admin-backup.json
npm run model:train -- --event 2026mnum
npm run model:train -- --manifest modeling/experiments/current-2026-archetype.json
npm run model:report
npm run model:report -- --run-dirs modeling/artifacts/runs/run-a,modeling/artifacts/runs/run-b
npm run model:diagnose -- --run-dirs modeling/artifacts/runs/run-a,modeling/artifacts/runs/run-b
npm run model:dashboard
npm run model:verify-dashboard
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
- `reports/<report-id>/CROSS_RUN_SUMMARY.md`: generated comparison across saved runs.
- `reports/<report-id>/leaderboard-metrics.svg`: generated judge-facing metric comparison chart.
- `reports/<report-id>/RESIDUAL_DIAGNOSTICS.md`: generated residual analysis by event, phase, championship-like phase, and win-probability bucket.
- `reports/final-judge-dashboard/index.html`: generated judge-facing HTML dashboard with the model story, charts, latest leaderboard, cross-report research atlas, diagnostics, and surprise findings.
- `reports/final-judge-dashboard/OPEN_THIS_FIRST.md`: cover sheet for cold handoff, first files, first claims, and fallback route.
- `reports/final-judge-dashboard/JUDGE_WALKTHROUGH.md`: fast route through the final package for a live judge conversation.
- `reports/final-judge-dashboard/JUDGE_STORY_SPINE.md`: shortest clean argument through the project for skeptical judges: problem, rule, search, winner, proof, strategy use, and integrity.
- `reports/final-judge-dashboard/FIRST_90_SECONDS.md`: timed opening script with exact evidence pointers and boundaries for a short judge conversation.
- `reports/final-judge-dashboard/FINAL_FREEZE_AUDIT.md`: pre-presentation guardrail sheet for frozen claims, evidence links, and overclaim failure modes.
- `reports/final-judge-dashboard/PRESENTATION_WORDING_AUDIT.md`: stale-wording and overclaim sweep with safer phrasing tied to evidence files.
- `reports/final-judge-dashboard/COLD_READER_ROUTE.md`: first-five-minutes route for someone opening the package with no context.
- `reports/final-judge-dashboard/HOSTILE_JUDGE_CROSS_EXAM.md`: pressure-tested answers to skeptical judge questions, with evidence files and phrases to avoid.
- `reports/final-judge-dashboard/FINAL_COHERENCE_AUDIT.md`: single-source consistency check for model name, headline metrics, limitations, claim boundaries, and package integrity wording.
- `reports/final-judge-dashboard/FINAL_PRESENTATION_LOCK.md`: handoff lock for the current safe-to-present claim, artifact set, verification gate, screenshots, and regeneration triggers.
- `reports/final-judge-dashboard/REFERENCE_INTEGRITY_AUDIT.md`: local-file reference audit for source code, evidence summaries, browser QA, screenshots, manifests, and fingerprints.
- `reports/final-judge-dashboard/DEADLINE_DELIVERABLES_CHECKLIST.md`: maps the requested final deliverables to the exact local files and dashboard sections that satisfy them.
- `reports/final-judge-dashboard/CLAIM_BOUNDARIES.md`: safe claims, unsafe overclaims, and evidence files for judge pressure.
- `reports/final-judge-dashboard/LEAKAGE_AUDIT.md`: no-future guardrails, what each blocks, and where to audit the evidence.
- `reports/final-judge-dashboard/JUDGE_RUBRIC_ALIGNMENT.md`: maps the work to process, rigor, validation, usefulness, integrity, honesty, and communication.
- `reports/final-judge-dashboard/PRINTABLE_HANDOUT.md`: one-page summary for quick presentation prep.
- `reports/final-judge-dashboard/PRESENTATION_SCRIPT.md`: 30-second, 90-second, and 3-minute spoken presentation scripts.
- `reports/final-judge-dashboard/LIVE_DEMO_RUNBOOK.md`: exact dashboard presentation path, evidence order, timing, and fallback plan.
- `reports/final-judge-dashboard/JUDGE_DRY_RUN_SCORECARD.md`: rehearsal gate for the opening claim, no-future rule, model-selection defense, strategy example, hard questions, package integrity, and fallback route.
- `reports/final-judge-dashboard/MOCK_JUDGE_PANEL_BRIEF.md`: judge-personality pressure sheet for technical, strategy, skeptical, reproducibility, impact, and data-source questions.
- `reports/final-judge-dashboard/MODEL_JOURNEY_TIMELINE.md`: short narrative arc from baselines to the final model and rejected branches.
- `reports/final-judge-dashboard/FINALIST_COMPARISON.md`: side-by-side explanation of why the promoted model beats, keeps, or rejects the nearest finalists.
- `reports/final-judge-dashboard/MODEL_ANATOMY.md`: plain-English map of the promoted model architecture and data flow.
- `reports/final-judge-dashboard/MODEL_SOURCE_MAP.md`: audit route from model claims back to the source files that implement features, training, diagnostics, scoring, dashboard generation, and verification.
- `reports/final-judge-dashboard/DEFENSE_ROLE_GUIDE.md`: defense net-swing formula, opportunity cost, foul-risk penalty, and saved role examples.
- `reports/final-judge-dashboard/MODEL_LEADERBOARD_APPENDIX.md`: deployment-review rows across saved report families, grouped by practical role and score.
- `reports/final-judge-dashboard/STRATEGY_EXAMPLE.md`: one concrete saved pre-match prediction with role/defense interpretation.
- `reports/final-judge-dashboard/PREDICTION_CASE_STUDIES.md`: representative saved predictions showing a good strategic read, a close uncertainty case, an uncomfortable miss, and a high-tail stress case.
- `reports/final-judge-dashboard/FAILURE_MODE_ATLAS.md`: current TailGuard residual failure analysis: worst events, phase bias, calibration gaps, and presentation boundaries.
- `reports/final-judge-dashboard/FINAL_MODEL_CARD.md`: concise judge-facing model card.
- `reports/final-judge-dashboard/JUDGE_BRIEF.md`: one-minute story, rejected-idea summary, and overfit-control answer.
- `reports/final-judge-dashboard/JUDGE_QA.md`: hard judge questions and concise answers about small gains, neural alternatives, leakage, defense, Statbotics provenance, and next data needs.
- `reports/final-judge-dashboard/METHODOLOGY_APPENDIX.md`: data provenance, OPR/EPA explanation, validation design, and benchmark rules.
- `reports/final-judge-dashboard/OPR_EPA_EXPLAINER.md`: plain-English distinction between retrospective OPR and online EPA-style replay.
- `reports/final-judge-dashboard/METRIC_GLOSSARY.md`: plain-English explanation of scoring metrics and benchmark terms.
- `reports/final-judge-dashboard/DEPLOYMENT_SCORING_RUBRIC.md`: weights, fixed targets, nonlinear overfit penalties, and near-tie rules.
- `reports/final-judge-dashboard/EVIDENCE_MATRIX.md`: claim-by-claim audit map for judges and teachers.
- `reports/final-judge-dashboard/LIMITATIONS_AND_RISK_REGISTER.md`: known limitations, mitigations, and presentation boundaries.
- `reports/final-judge-dashboard/REPRODUCIBILITY_RUNBOOK.md`: exact rerun, audit, and presentation-verification procedure.
- `reports/final-judge-dashboard/FINAL_READINESS_CHECK.md`: go/no-go checklist for presenting the final model package.
- `reports/final-judge-dashboard/QA_CHECKLIST.md`: repeatable verification commands and browser checks.
- `reports/final-judge-dashboard/VERIFICATION_SUMMARY.md`: generated pass/fail summary from `npm run model:verify-dashboard`.
- `reports/final-judge-dashboard/ARTIFACT_FINGERPRINTS.md` and `artifact-fingerprints.json`: SHA-256 hashes for the generated package and core evidence files.
- `reports/final-judge-dashboard/browser-qa-summary.json`: machine-readable Chrome QA result for required text, overflow, console/page errors, screenshot paths, and screenshot freshness.
- `reports/final-judge-dashboard/DELIVERABLES.md` and `deliverables.json`: final package map for judges/teachers.
- `audits/statbotics-prediction-provenance/AUDIT.md`: leakage audit for published Statbotics match predictions.
- `audits/scout-coverage/SCOUT_COVERAGE.md`: coverage audit for Firebase/local-backup scout rows against official matches.
- `audits/event-metadata-coverage/EVENT_METADATA_COVERAGE.md`: coverage audit for cached event metadata against official matches.
- `audits/local-backup-inventory/LOCAL_BACKUP_INVENTORY.md`: privacy-safe structure count for local admin/scout backups.
- `reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md`: latest scoped check showing that 356 matched Firebase scout observations are real, TailGuarded RoleV3 survives all five 2026 bucket holdouts by relative score, and the scout-heavy ridge/elastic challengers remain too weak to promote as a new global point model.
- `reports/scoutgate-check/CROSS_RUN_SUMMARY.md`: coverage-aware scout-gate follow-up showing ScoutGate greatly improves scout-heavy ridge on dense `2026mnum`, but the full 2026 plus five-bucket review is fragmented and not strong enough to replace Conservative TailGuard.
- `reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md`: stricter RoleGate follow-up showing raw scout defense no longer sneaks into gated role features, but the full-2026 RoleGate winner is not confirmed by the first three 2026 holdout buckets.
- `demo/latest-run/`: deterministic synthetic demo run.

The cross-run judge narrative is tracked in `modeling/MODELING_RESEARCH_LOG.md`.
Tracked exact experiment manifests live under `modeling/experiments/`; when a manifest is used for training, a copy is written to that run's artifact directory as `experiment-manifest.json`.

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
- event-archetype score-shift experiments,
- public Statbotics event metadata caching,
- TBA event-summary metadata import with safe merge behavior,
- FIRST Events metadata import with safe merge behavior,
- season-score-scaled event-archetype experiments,
- season-scoped event-type residual experiments,
- robust online EPA update clipping experiments,
- prior component scoring features and component-prior ensemble experiments,
- no-future residual-ridge correction experiments,
- role-scaled archetype injection experiments,
- official foul-risk features for role/defense experiments,
- role-feature residual-ridge correction experiments,
- conservative RoleV2 suppression/foul-risk residual experiments,
- separated RoleV3 suppression/confidence/foul/offense-cost residual experiments,
- tail-guarded RoleV3 mean-correction experiments,
- coverage-aware scout-gated feature experiments,
- nonlinear residual-tree correction experiments,
- championship-scoped high-score tail correction experiments,
- residual-gated and low-amplitude high-score tail selector experiments,
- no-future championship phase-tail correction experiments,
- no-future championship phase plus residual-boost tail experiments,
- split score-tail and win-probability calibration experiments,
- no-future learned win-probability calibration experiments,
- no-future learned championship-tail residual correction experiments,
- exact experiment manifests,
- checkpointed event-key holdout manifests,
- cross-run summary reports,
- residual diagnostic reports,
- cross-run stability review for full replay versus holdout confirmation,
- candidate-set-independent fixed benchmark scoring,
- near-tie promotion confidence,
- no-future conformal interval calibration,
- widening conformal interval calibration,
- season/event-phase scoped conformal interval calibration,
- no-future ridge models,
- context-EPA ridge as a non-promotable comparison,
- VIF diagnostics,
- correlation diagnostics,
- feature importance for ridge models,
- score MAE/RMSE, margin MAE, win-probability Brier score, and calibration error,
- asymmetric score bands derived from walk-forward residual spread,
- role/defense assignment features.

Latest checkpoint: the broad RoleV3 bucket sweep, the full TailGuard bucket sweep, the SelectiveTailGuard follow-up checks, the TailGuard+TailRiskWinProb combo check, and the TailGuard+SmoothTailRiskWinProb probability-smoothing check are complete. Strong RoleV3 remains the simplest defended baseline: it wins full 2026 by relative score at 60.27 score MAE, 82.64 margin MAE, and 0.1572 Brier; wins broad 2024-2026 by both relative and fixed score at 32.26/44.15/0.1660; and wins four of five broad RoleV3 buckets by relative score, while moderate RoleV3 wins the fifth. Conservative TailGuard `TW=0.20` wins the full 2026 plus broad 2024-2026 replays as a near-tie and now has the best stability-adjusted point deployment score in `modeling/artifacts/reports/role-v3-tailguard-check/CROSS_RUN_SUMMARY.md`: 0.145 versus 0.161 for stronger TailGuard and 0.202 for plain Strong RoleV3. Stronger TailGuard `TW=0.35` wins buckets 0-3 by relative score, including bucket 1 by both relative and fixed score, but bucket 4 rejects a universal stronger-tail story. SelectiveTailGuard improved the full-2026 smoke to 60.26 score MAE, 82.64 margin MAE, 0.1572 Brier, and 103.79 worst-event MAE, but broad confirmation rejected it: bucket 4 promotes plain Strong RoleV3 while SelectiveTailGuard ranks fourth at 21.81/29.93/0.1629/54.76, and bucket 1 promotes stronger TailGuard while SelectiveTailGuard again ranks fourth at 24.73/34.58/0.1769/98.93. TailGuard+TailRiskWinProb tested whether the current TailGuard score means could inherit TailRisk probability softening; the combo slightly improves fixed-score/Brier diagnostics, but loses the relative benchmark to the existing Conservative TailGuard on both full 2026 and broad 2024-2026 replay, so it is not promoted. TailGuard+SmoothTailRiskWinProb then tested margin/confidence-smoothed probability softening (`MR=35 PR=0.25 SF=0.50`) on full 2026 and broad 2024-2026; unsmoothed `TP=0.75` still wins the exact relative benchmark in both full runs and the bucket-0 holdout, while smooth `TP=1.25` only wins fixed-score diagnostics by tiny amounts, so it remains diagnostic-only without enough holdout evidence to promote. Current stance: conservative TailGuard is the deployment-rule point candidate because it has completed broad confirmation; Strong RoleV3 is the simple baseline and strongest holdout relative leader; stronger TailGuard is a high-tail specialist; SelectiveTailGuard, TailGuard+TailRiskWinProb, and TailGuard+SmoothTailRiskWinProb are rejected or diagnostic-only challengers. The judge dashboard generator is now available via `npm run model:dashboard`, with a companion `npm run model:verify-dashboard` package verifier; the current generated dashboard lives at `modeling/artifacts/reports/final-judge-dashboard/index.html` with desktop/mobile screenshots in that same folder. The verifier now checks required files, dashboard text, markdown copy quality, manifest paths, reference targets, `browser-qa-summary.json`, browser-QA/screenshot freshness, fingerprints, screenshot files, and PNG screenshot dimensions, and the final package includes `CLAIM_BOUNDARIES.md` to distinguish safe claims from tempting overclaims, `JUDGE_RUBRIC_ALIGNMENT.md` to map the work to process, rigor, validation, usefulness, integrity, honesty, and communication, plus `DEFENSE_ROLE_GUIDE.md` to explain the net-swing role logic. The dashboard now includes a research atlas built from every saved cross-run summary under `modeling/artifacts/reports`, plus generated `JUDGE_WALKTHROUGH.md`, `JUDGE_STORY_SPINE.md`, `FIRST_90_SECONDS.md`, `FINAL_FREEZE_AUDIT.md`, `PRESENTATION_WORDING_AUDIT.md`, `COLD_READER_ROUTE.md`, `HOSTILE_JUDGE_CROSS_EXAM.md`, `FINAL_COHERENCE_AUDIT.md`, `FINAL_PRESENTATION_LOCK.md`, `REFERENCE_INTEGRITY_AUDIT.md`, `DEADLINE_DELIVERABLES_CHECKLIST.md`, `CLAIM_BOUNDARIES.md`, `JUDGE_RUBRIC_ALIGNMENT.md`, `PRINTABLE_HANDOUT.md`, `PRESENTATION_SCRIPT.md`, `LIVE_DEMO_RUNBOOK.md`, `JUDGE_DRY_RUN_SCORECARD.md`, `MOCK_JUDGE_PANEL_BRIEF.md`, `MODEL_JOURNEY_TIMELINE.md`, `FINALIST_COMPARISON.md`, `MODEL_ANATOMY.md`, `MODEL_SOURCE_MAP.md`, `DEFENSE_ROLE_GUIDE.md`, `MODEL_LEADERBOARD_APPENDIX.md`, `STRATEGY_EXAMPLE.md`, `PREDICTION_CASE_STUDIES.md`, `FINAL_MODEL_CARD.md`, `JUDGE_BRIEF.md`, `JUDGE_QA.md`, `METHODOLOGY_APPENDIX.md`, `OPR_EPA_EXPLAINER.md`, `METRIC_GLOSSARY.md`, `DEPLOYMENT_SCORING_RUBRIC.md`, `EVIDENCE_MATRIX.md`, `LIMITATIONS_AND_RISK_REGISTER.md`, `REPRODUCIBILITY_RUNBOOK.md`, `FINAL_READINESS_CHECK.md`, `QA_CHECKLIST.md`, `VERIFICATION_SUMMARY.md`, `ARTIFACT_FINGERPRINTS.md`, `artifact-fingerprints.json`, `browser-qa-summary.json`, `DELIVERABLES.md`, and `deliverables.json`, so the final report shows both the current best model, a fast live-presentation route, a dry-run scorecard, a mock judge panel brief, a concise judge story spine, a timed 90-second opening, a final freeze audit for overclaim prevention, a wording audit for safer live phrasing, a cold-reader route through the first five minutes, hostile judge cross-exam answers, a final coherence audit for metrics and claim drift, a final presentation lock for the safe handoff state, a reference-integrity audit for local files, fresh browser visual proof, the short model journey from baselines to TailGuard, a side-by-side finalist decision table, a visual/plain-English model anatomy map, a source-code audit route, a defense role guide with examples, a grouped leaderboard of other saved model scores, a hard-question Q&A, claim boundaries, judge rubric alignment, a concrete strategy-use example, representative prediction case studies, the rejected model journey, the data/methodology defense, a clear OPR-vs-EPA explanation, plain-English metric explanations, the exact scoring rubric with nonlinear overfit penalties, claim-by-claim evidence, known risks/mitigations, SHA-256 fingerprints for the package, an automated package-verification summary, browser-QA summary, the exact rerun/audit path, and a final go/no-go checklist. Next: regenerate the dashboard to include the smooth TailRisk check report, verify it, and then return to modeling only if a genuinely different feature source appears.

Current evidence favors event-archetype EPA-Monte Carlo ensembles plus small no-future residual corrections, now with RoleV3 as the leading family and conservative TailGuard as the best deployment-rule point candidate. TailRiskWinProb `TP=0.75` remains an uncertainty/reporting overlay because it improves Brier on many checked slices while leaving mean scores unchanged. Firebase scout/PPC enrichment now has 356 matched observations, but coverage is sparse and concentrated; ScoutGate is a promising coverage-aware follow-up, yet its five-bucket review is fragmented, so broad role/defense conclusions still lean on official-match residual evidence plus scoped scout evidence rather than pretending we scouted the whole world.

Long training runs now print per-model progress, exact manifest runs are supported, model cards include both a relative within-run benchmark and a fixed benchmark for cross-run comparison, near-tie candidates are annotated instead of overclaimed, manifests can restrict evaluation to deterministic event-key hash buckets, conformal intervals are available without future leakage, and cross-run reports can regenerate the bucket-sweep tables plus SVG metric charts from saved artifacts. Cross-run reports also include a stability review that counts holdout winners separately from full replays and flags full-replay winners that fail bucket confirmation. Run artifacts now include comparison-safe slice diagnostics computed before compaction, so non-promoted model variants can be compared without retaining every prediction row in compact `run.json`. The training CLI now continues writing artifacts if the optional SQLite research-run cache write fails after a long replay. The residual-ridge refit path now uses a no-future sufficient-stat accumulator instead of rebuilding the full prior residual design matrix at every step; the focused 2026 smoke replay reproduced the defended score MAE 60.36, margin MAE 82.81, Brier 0.1576, and worst-event MAE 103.73. The broad direct residual-vs-event-type holdout suite is now complete: residual-ridge won all five direct relative holdouts against event-type residual and earlier baselines. Plain residual-ridge won buckets 0 and 2; stronger residual-ridge won buckets 1, 3, and 4. All five promotions are near-ties, fixed-score diagnostics split five ways, and the generated cross-run report at `modeling/artifacts/reports/residual-vs-event-type-direct-buckets-2024-2026/CROSS_RUN_SUMMARY.md` marks the suite `mixed`. A second generated report at `modeling/artifacts/reports/residual-ridge-mixed-scope-deployment-2024-2026/CROSS_RUN_SUMMARY.md` includes full broad, full 2026, broad residual buckets, and 2026 residual buckets; its deployment review restores plain residual as the point-default and robustness-monitor candidate. The full-2026 residual evidence is now backed by an exact manifest at `modeling/experiments/current-2026-residual-ridge-scaled-archetype.json`, the role-feature residual rejection is summarized at `modeling/artifacts/reports/role-feature-residual-ridge-check/CROSS_RUN_SUMMARY.md`, the RoleV2 residual check is summarized at `modeling/artifacts/reports/role-v2-residual-ridge-check/CROSS_RUN_SUMMARY.md`, the nonlinear residual-tree rejection is summarized at `modeling/artifacts/reports/residual-tree-check/CROSS_RUN_SUMMARY.md`, the championship-scoped tail tradeoff is summarized at `modeling/artifacts/reports/high-score-tail-check/CROSS_RUN_SUMMARY.md` plus `modeling/artifacts/reports/high-score-tail-check/TAIL_DELTA_AUDIT.md`, the residual-gated/low-amplitude selector rejection is summarized at `modeling/artifacts/reports/tail-selector-2026-check/CROSS_RUN_SUMMARY.md`, the phase-tail check is summarized at `modeling/artifacts/reports/championship-phase-tail-check/CROSS_RUN_SUMMARY.md`, the completed phase+residual-boost bucket check is summarized at `modeling/artifacts/reports/championship-residual-boost-tail-check/CROSS_RUN_SUMMARY.md`, the rejected residual-mean gate check is summarized at `modeling/artifacts/reports/gated-championship-tail-check/CROSS_RUN_SUMMARY.md`, the rejected WinCal score/probability split is summarized at `modeling/artifacts/reports/win-calibrated-championship-tail-check/CROSS_RUN_SUMMARY.md`, the learned championship-tail full-replay check is summarized at `modeling/artifacts/reports/learned-championship-tail-check/CROSS_RUN_SUMMARY.md`, the first learned-tail bucket confirmation is summarized at `modeling/artifacts/reports/learned-championship-tail-bucket2-check/CROSS_RUN_SUMMARY.md`, the buckets 0-2 learned-tail confirmation report is summarized at `modeling/artifacts/reports/learned-championship-tail-buckets012-check/CROSS_RUN_SUMMARY.md`, the conditional learned-tail check is summarized at `modeling/artifacts/reports/conditional-learned-tail-check/CROSS_RUN_SUMMARY.md`, the completed TailRisk interval sweep is summarized at `modeling/artifacts/reports/tail-risk-interval-check/CROSS_RUN_SUMMARY.md`, the first TailRiskWinProb check is summarized at `modeling/artifacts/reports/tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`, the conditional TailRiskWinProb check is summarized at `modeling/artifacts/reports/conditional-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`, the full TailRiskWinProb bucket confirmation is summarized at `modeling/artifacts/reports/tail-risk-winprob-full-bucket-confirmation/CROSS_RUN_SUMMARY.md`, the rejected margin/confidence TailRiskWinProb check is summarized at `modeling/artifacts/reports/margin-confidence-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`, the rejected smooth TailRiskWinProb shrinkage check is summarized at `modeling/artifacts/reports/smooth-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`, and the rejected learned WinCal probability calibration check is summarized at `modeling/artifacts/reports/learned-win-calibration-check/CROSS_RUN_SUMMARY.md`. Residual diagnostics for the current best live at `modeling/artifacts/reports/current-best-residual-diagnostics/RESIDUAL_DIAGNOSTICS.md`. The local Statbotics prediction audit currently finds 15,500 cached prediction rows and 0 prediction-specific timestamps, so published predictions remain non-promotable comparators. The scout-coverage audit currently finds 0 cached scouting observations against 90,090 official team slots; local backup import now supports nested scout archive records, but the current `.playwright-cli` backup inventory found only 4 admin cache entries, 0 archive records, 0 importable match/defense records, and 0 pit records. Firebase scout ingest is also blocked until a local Firebase project id and modeling access token are supplied. Event metadata coverage is now 165/165 official cached events, with TBA/FIRST summaries able to merge without erasing richer non-null fields. Next serious candidates are completing RoleV2 bucket confirmation, real Firebase scout enrichment, a rebuilt scout-backed role simulator with separate suppression/foul-risk labels, and only richer probability calibration if it adds new pre-match information instead of reusing the same probability-residual features.
