# Offline FIRST Match Modeling Research Log

This file is the judge-facing narrative for the local modeling work. The generated `MODEL_CARD.md` files under `modeling/artifacts/runs/` are the detailed per-run evidence; this log explains how the current best models were chosen, where they still fail, and what we should try next.

## Current Status

The model is not finished, and we should not claim it is impossible to improve. The current best-known approach is an online, no-future EPA-style model with a small Monte Carlo score ensemble and an optional event residual correction. The best setting depends on the validation scope:

| Scope | Current best promoted model | Matches | Score MAE | Margin MAE | Brier | Calibration | Coverage | Worst event MAE |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2024-2026 official replay | `No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25` | 15,015 | 32.43 | 44.34 | 0.1669 | 0.0085 | 77.6% | 104.54 |
| 2026-only official replay | `No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8` | 5,091 | 60.59 | 82.81 | 0.1576 | 0.0116 | 76.8% | 104.73 |

Interpretation: the stronger event-shift correction wins on the broad multi-season replay, while a more conservative shift wins on the 2026-only replay. That means the evidence supports scope-aware model selection rather than pretending one global setting is proven.

## Latest Iteration: Gated Event Residual Shift

Problem: the previous event-shift model improved some full-history metrics but was not a clean 2026-only promotion. It might have been correcting real event score-scale drift, or it might have been reacting too aggressively to noisy early event residuals.

Change implemented:

- Added `eventResidualShiftMinSamples` and `eventResidualShiftWindow` to model configs.
- Added gated event-shift candidates:
  - `S=0.10 M=8`, using at least 8 prior alliance residuals and an 18-residual window.
  - `S=0.15 M=8`, using at least 8 prior alliance residuals and an 18-residual window.
  - `S=0.20 M=12`, using at least 12 prior alliance residuals and a 24-residual window.

Result:

- Full 2024-2026 replay still prefers `S=0.25`.
- 2026-only replay promotes `S=0.15 M=8`.
- The change is useful because it found a safer 2026-specific candidate instead of forcing the broad-history winner onto every deployment context.

Artifacts:

- `modeling/artifacts/runs/statbotics-2024-2026-event-shift-gated/MODEL_CARD.md`
- `modeling/artifacts/runs/statbotics-2026-event-shift-gated/MODEL_CARD.md`

## Follow-Up Iteration: Interval-Calibrated Event Shift

Problem: the promoted 2026 model has 76.8% coverage for nominal 10-90 score bands, so uncertainty was slightly under-covering hard events.

Change tested:

- Added interval-scaled variants:
  - `S=0.15 M=8 I=1.05`
  - `S=0.15 M=8 I=1.10`
  - `S=0.25 I=1.05`

Result on 2026-only replay:

| Rank | Model | Benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `S=0.15 M=8` | 0.676 | 60.59 | 82.81 | 0.1576 | 76.8% | 104.73 |
| 2 | `S=0.25 I=1.05` | 0.719 | 60.57 | 82.87 | 0.1579 | 78.6% | 104.41 |
| 3 | `S=0.15 M=8 I=1.05` | 0.750 | 60.60 | 82.85 | 0.1578 | 78.6% | 104.65 |
| 4 | `S=0.15 M=8 I=1.10` | 0.785 | 60.61 | 82.84 | 0.1579 | 80.2% | 104.82 |

Interpretation: interval scaling improves coverage, but not enough to beat the unscaled `S=0.15 M=8` model once interval width, Brier score, margin error, and calibration are counted together. This branch is rejected for now, but it points toward a more selective conformal method instead of a global interval multiplier.

Artifact:

- `modeling/artifacts/runs/statbotics-2026-interval-event-shift/MODEL_CARD.md`

## Follow-Up Iteration: Event Score-Scale Shift

Problem: the weakest 2026 event slices are mostly high-scoring championship-style events. The promoted model underpredicts several of these events by a positive event-level residual, especially `2026hop`, `2026cur`, `2026arc`, and `2026gal`.

Change tested:

- Added event score-scale correction parameters:
  - `eventScoreScaleWeight`
  - `eventScoreScaleMinSamples`
  - `eventScoreScaleWindow`
- The correction uses only completed alliance scores from the same event before the current match.
- Tested blunt variants `A=0.20`, `A=0.35`, `A=0.50`.
- Tested smaller/later variants `A=0.05 N=24` and `A=0.10 N=24`.

Result on 2026-only replay:

| Rank | Model | Benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `S=0.15 M=8` | 0.604 | 60.59 | 82.81 | 0.1576 | 76.8% | 104.73 |
| 5 | `S=0.15 M=8 A=0.05 N=24` | 0.730 | 60.64 | 82.86 | 0.1578 | 76.9% | 104.60 |
| 8 | `S=0.15 M=8 A=0.10 N=24` | 0.839 | 60.73 | 82.91 | 0.1579 | 76.9% | 104.44 |
| 9 | `S=0.15 M=8 A=0.20` | 0.855 | 60.81 | 83.09 | 0.1581 | 76.9% | 103.26 |

Interpretation: event score-scale correction attacks a real failure mode because worst-event MAE improves slightly, but every tested version spends too much global accuracy and calibration to be promoted. This branch is rejected as a general predictor. It remains a clue for future selective models: a smarter championship/event-archetype layer may help, but blunt event-average shifting is not enough.

Artifacts:

- `modeling/artifacts/runs/statbotics-2026-event-scale/MODEL_CARD.md`
- `modeling/artifacts/runs/statbotics-2026-event-scale-small/MODEL_CARD.md`

## Follow-Up Iteration: Selective High-Event Score-Scale Shift

Reflection from the prior event-scale run: the signal was real enough to improve worst-event MAE, but too blunt. The next natural test was to activate only after the event had already proven, through completed matches, that its alliance scores were materially above the season baseline.

Change tested:

- Added `eventScoreScaleThreshold`.
- Added `eventScoreScalePositiveOnly`.
- Tested positive-only variants:
  - `A=0.10 T=10 N=24`
  - `A=0.15 T=10 N=24`
  - `A=0.20 T=15 N=24`
  - `A=0.10 T=15 N=36`

Result on 2026-only replay:

| Rank | Model | Benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `S=0.15 M=8` | 0.601 | 60.59 | 82.81 | 0.1576 | 76.8% | 104.73 |
| 6 | `A=0.10 T=15 N=36` | 0.767 | 60.62 | 82.88 | 0.1579 | 76.8% | 104.70 |
| 7 | `A=0.10 T=10 N=24` | 0.767 | 60.68 | 82.88 | 0.1579 | 76.9% | 104.49 |
| 10 | `A=0.15 T=10 N=24` | 0.873 | 60.75 | 82.95 | 0.1580 | 76.9% | 104.23 |
| 11 | `A=0.20 T=15 N=24` | 0.890 | 60.81 | 82.94 | 0.1577 | 76.9% | 104.46 |

Interpretation: the selective high-event versions reduced worst-event MAE more safely than blunt event shifting, but none beat the current promoted 2026 model. This rejects additive event-scale correction as a global model component. The next defensible direction is scope-aware or archetype-aware promotion: high-score championship events may need their own model path rather than a universal correction.

Artifact:

- `modeling/artifacts/runs/statbotics-2026-high-event-scale/MODEL_CARD.md`

## Research System Update: Progress Logging

Long Monte Carlo replay runs used to be silent after dataset loading, which made them hard to audit. The training CLI now prints one progress line per evaluated model with score MAE, margin MAE, Brier score, and worst-event MAE. This does not change model performance, but it makes future judge-facing experiments easier to reproduce and monitor.

## What The Current Best Model Does

The current model family is deliberately leakage-safe:

- Before each match, it predicts from only prior matches and prior observations.
- After the match, it updates team ratings using the observed score error.
- `K=1.10` controls how fast team ratings adapt.
- `W=0.20` blends 20% Monte Carlo expected score into the online EPA point prediction.
- `P=0.00` keeps win probability analytic instead of blindly replacing it with Monte Carlo win rate.
- `S` controls how much recent event-level score residual should shift expected scores.
- `M` is the minimum number of prior event residuals required before applying that shift.

This is closer to EPA than OPR. OPR solves a batch linear alliance matrix over prior matches and assumes additive team contributions. EPA-style online ratings have memory: each team has a rating before the match, then the rating updates after the match based on the error between expected and actual score.

## Benchmark Philosophy

The leaderboard intentionally is not just MAE or RMSE. A model can be rejected even if one headline score improves.

The benchmark combines:

- Exact score error: MAE and RMSE.
- Alliance margin error.
- Season-normalized score and margin error.
- Win-probability Brier score.
- Calibration error.
- Score interval coverage and interval width.
- Worst-event and worst-season behavior.
- Event/season instability.
- Leakage and non-promotable input penalties.
- Nonlinear overfit penalties from diagnostics such as VIF excess, correlation excess, slice instability, and coverage miss.

Published Statbotics match predictions currently beat our models on raw score error, but they are deliberately non-promotable until we prove the archived prediction values were available before each predicted match. They are a comparator, not a valid promoted model yet.

## Current Data Caveats

- Current official-data benchmarks contain 0 scout-enriched rows. They use official match results and cached Statbotics/TBA-derived records, not broad Firebase scout coverage.
- Role-defense rows exist where the feature builder can infer role context, but true defense modeling remains weak without reliable scouted defense labels.
- Championship-style 2026 events are the hardest current slices. Examples from the latest runs include `2026hop`, `2026gal`, `2026cur`, and `2026cmptx`.
- The training CLI now logs per-model progress, but run manifests still use substring filters; exact filter manifests are a future reproducibility improvement.

## Rejected Or Not-Yet-Promoted Ideas

- Published Statbotics predictions: strong raw scores, not promotable because pre-match provenance/leakage safety has not been audited.
- Plain season-reset EPA: still a strong baseline, but the event-shift ensembles now beat it in the latest focused tests.
- Ungated event shift: good broad-history winner, but too aggressive for the 2026-only scope compared with `S=0.15 M=8`.
- Global interval scaling: improved score-band coverage, but did not beat the unscaled 2026 event-shift model after width and calibration were counted.
- Event score-scale shifting: improved worst-event MAE slightly, but hurt overall score MAE, margin MAE, and Brier enough to lose the benchmark.
- Selective high-event score-scale shifting: reduced worst-event MAE more safely than blunt event scaling, but still lost too much global accuracy to promote.
- Relative EPA variants: tested earlier and did not improve the defended leaderboard.
- Monte Carlo-only variants: useful for uncertainty exploration, but did not beat the EPA-MC ensemble as a promoted point predictor.

## Next Defensible Iterations

These are the next model branches worth trying. They are not guaranteed improvements; each one should be promoted only if it improves the leaderboard without adding leakage or overfit risk.

1. Add scope-aware promotion: choose the best model separately for broad historical replay, current-season replay, and event archetypes instead of treating one global winner as universal.
2. Add exact experiment manifests/checkpoints so long simulations are auditable without substring filter ambiguity.
3. Add conformal calibration by season and event phase to improve interval coverage without widening every prediction equally.
4. Add explicit event archetype features for championship/division/regional/district/district championship events.
5. Audit published Statbotics prediction provenance. If predictions can be proven pre-match, use them as an input; otherwise keep them as a comparator.
6. Pull real Firebase scout rows into the cache and rerun the same leaderboard with PPC/defense observations.
7. Build FIRST/TBA season-specific component adapters before promoting component/foul models.
8. Try boosted-tree and stacked residual models after we have scope-aware validation and stronger leakage guards.
9. Improve defense modeling by estimating opponent suppression and foul-risk separately, then simulate role assignments as net point swing.
10. Build hidden holdout manifests so we stop tuning against every event at once.

## Commands Used For Latest Evidence

```sh
npm run model:typecheck
npm run test
npm run model:train -- --model-filter "Published Statbotics Match Prediction,No-Future Season-Reset EPA K=1.10,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.10 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.20 M=12" --output-dir modeling/artifacts/runs/statbotics-2024-2026-event-shift-gated
npm run model:train -- --year 2026 --model-filter "Published Statbotics Match Prediction,No-Future Season-Reset EPA K=1.10,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.10 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.20 M=12" --output-dir modeling/artifacts/runs/statbotics-2026-event-shift-gated
npm run model:train -- --year 2026 --model-filter "No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.05,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.10,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25 I=1.05,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-interval-event-shift
npm run model:train -- --year 2026 --model-filter "No-Future Event-Scale Ensemble,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-event-scale
npm run model:train -- --year 2026 --model-filter "A=0.05 N=24,A=0.10 N=24,A=0.20,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-event-scale-small
npm run model:train -- --year 2026 --model-filter "High-Event-Scale,A=0.05 N=24,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-high-event-scale
```
