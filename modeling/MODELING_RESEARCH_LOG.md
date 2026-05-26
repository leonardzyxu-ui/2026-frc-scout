# Offline FIRST Match Modeling Research Log

This file is the judge-facing narrative for the local modeling work. The generated `MODEL_CARD.md` files under `modeling/artifacts/runs/` are the detailed per-run evidence; this log explains how the current best models were chosen, where they still fail, and what we should try next.

## Deadline Correction Note

Active deadline: Saturday May 23 2026 18:00 CST (Asia/Shanghai). Historical entries before May 22 2026 22:15 CST may mention the earlier Friday May 22 2026 18:00 CST target; keep those as audit history, not current delivery instructions. The generated dashboard, deliverables manifest, final-check summary, browser QA, verifier, and current short-route handoff files all use the corrected May 23 deadline.

## Current Metric Note

Current promoted headline metrics: weighted score MAE 36.32, weighted margin MAE 49.73, weighted Brier 0.1648, and deployment score 0.126. Historical checkpoints before the May 23 2026 15:12 CST one-page number-key refresh may mention older TailGuard-family headline metrics such as 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, or 0.130 deployment score; keep those as audit history, not the current promoted claim.

## Current Status

Latest checkpoint, May 23 2026 17:25 CST: ran a final copy-integrity sweep for unfinished placeholders, stale deadline text, unsafe overclaims, and front-door drift. The generated package had no unfinished TODO/TBD-style language, and the remaining old-deadline mentions are confined to the research log/source verifier history. The useful issue was that `OPEN_THIS_FIRST.md` still summarized older quality work without naming the newest story aids, so I updated the generated Latest Quality Receipt to include `If You Remember Nothing Else`, `Judge Answer Finder`, and `Model Family Cheat Sheet`, plus the direct proof-file mapping. The verifier and browser QA now require that receipt wording. Reflection: the first-open file should be a current receipt, not just a historically true one. Final packaging action: rerun the full final gate so the generated cover sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the refreshed quality receipt.

Latest checkpoint, May 23 2026 17:20 CST: added an `If You Remember Nothing Else` bottom-line section to the start-here story and dashboard story route. It gives a non-technical judge the four essentials: the question, the cautious answer, the proof idea, and the boundary that this is a disciplined strategy starting point rather than a replacement for scouts or human judgment. The verifier and browser QA now require those phrases. Reflection: the fastest story should work even when a judge never reaches the model-family details or leaderboard. Final packaging action: rerun the full final gate so the generated story files, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the bottom-line section.

Latest checkpoint, May 23 2026 17:16 CST: added a `Model Family Cheat Sheet` to the start-here story and dashboard story route. It translates the model-family names before a reader opens the full leaderboard: Baseline, Residual correction, RoleV3, TailGuard, SelectiveTailGuard, and ScoutGate/RoleGate now each have a plain-English meaning and final status. The verifier and browser QA now require the cheat-sheet title, translation line, and the key status phrases. Reflection: the leaderboard is honest but dense; a judge should understand what each family was trying to do before comparing scores. Final packaging action: rerun the full final gate so the generated story files, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the model-family decoder.

Latest checkpoint, May 23 2026 16:56 CST: added a `Judge Answer Finder` to the start-here story and dashboard story route. It maps the six fastest judge questions directly to evidence files: what won, why the validation is trustworthy, why this model beat alternatives, how it helps strategy, what not to claim, and whether the package is verified. The verifier and browser QA now require those labels and evidence routes. Reflection: the report should not ask a busy judge to search; it should behave like an index from question to proof. Final packaging action: rerun the full final gate so the generated story files, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the answer finder.

Latest checkpoint, May 23 2026 16:52 CST: added a `Final 20-Second Close` to the first-90-seconds spoken route and dashboard First 90 Seconds section. It gives three safe closing beats: we are not selling an oracle, the package proves both why Conservative TailGuard Strong RoleV3 won and what it cannot claim, and the project matters because it gives strategists a checked starting point while humans stay in charge. The verifier and browser QA now require those closing lines. Reflection: a strong presentation should land on the bounded value proposition, not trail off inside the evidence vault. Final packaging action: rerun the full final gate so the generated first-90 sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the closing card.

Latest checkpoint, May 23 2026 16:48 CST: added a `So What For Strategy?` layer to the start-here story and dashboard story route. It explains that the model turns match history into a pre-match briefing, not a command, and gives five practical uses: before-match expectation, strategy risk comparison, scouting focus, after-miss learning, and the human final call. The verifier and browser QA now require the strategy-impact section and its labels. Reflection: the story should not only prove the model is defensible; it should make clear why a drive team would care in the few minutes before a match. Final packaging action: rerun the full final gate so the generated start-here story, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the strategy-impact layer.

Latest checkpoint, May 23 2026 16:28 CST: added a `What To Ignore Under Time Pressure` guard to the start-here story and dashboard story route. It tells a rushed judge not to chase older 41.x metric rows, report-local point-default labels, rejected SelectiveTailGuard rows, or useful-but-non-promoted ScoutGate/RoleGate branches before understanding the current claim. The verifier and browser QA now require this distraction guard and its key labels. Reflection: an honest proof vault contains historical evidence, but the fastest judge path needs signposts for what not to treat as the current answer. Final packaging action: rerun the full final gate so the generated start-here story, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the ignore-under-pressure guard.

Latest checkpoint, May 23 2026 16:22 CST: expanded the plain-English decoder in the start-here story and dashboard story route. The package now translates MAE, margin MAE, Brier, calibration, holdouts, residual correction, TailGuard, TW=0.22, and deployment score in fast judge-friendly language. The verifier and browser QA now require the new decoder wording, including the average-miss explanation, the 70% probability-honesty explanation, and the TailGuard strength-knob explanation. Reflection: a polished report still fails if a busy judge gets stuck on one term; the safest story path explains the math words before they become a barrier. Final packaging action: rerun the full final gate so the generated story files, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the expanded decoder.

Latest checkpoint, May 23 2026 16:19 CST: added a `Four-File Opening Card` to the first-90-seconds route and dashboard First 90 Seconds section. This is the presenter anti-panic path: open `ONE_PAGE_JUDGE_STORY.html`, `FINAL_CHECK_SUMMARY.md`, `FINAL_MODEL_CARD.md`, and `CLAIM_BOUNDARIES.md` in that order, then stop when the judge has enough. The verifier and browser QA now require the card, the no-hunting-live wording, and the timed-script handoff. Reflection: the final package should not assume a presenter has time to choose among dozens of excellent files; the safest handoff is a fixed opening path with proof, model claim, and caveat already sequenced. Final packaging action: rerun the full final gate so the generated first-90 sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the four-file card.

Latest checkpoint, May 23 2026 16:14 CST: added an `Emergency 60-Second Fallback` to the live demo runbook and dashboard Live Demo section. This is the no-debug path if the browser, Wi-Fi, or projector setup fails: open the one-page Markdown story, show the refreshed one-page/start-here screenshots, show `FINAL_CHECK_SUMMARY.md` plus the final-gate screenshot, then answer the caveat from claim boundaries and the risk register. The verifier and browser QA now require this fallback wording and its key artifacts. Reflection: a judge should never watch us troubleshoot local serving; the package should fail over instantly to verified static evidence. Final packaging action: rerun the full final gate so the regenerated runbook, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the emergency fallback.

Latest checkpoint, May 23 2026 16:11 CST: added an `If Interrupted` pivot table to the first-90-seconds route and the dashboard First 90 Seconds section. The new prompts cover four likely judge interruptions: show proof, state the finding, explain strategy value, and name the caveat. Each pivot points to the right file and keeps the spoken answer bounded: no-future proof plus final gate, current model card metrics, strategy example outputs, and claim boundaries. The verifier and browser QA now require these interruption prompts, so the fastest spoken route remains usable even when a judge does not let the presenter finish the timed script. Reflection: a polished story is not enough; a resilient presentation needs safe branch points. Final packaging action: rerun the full final gate so the generated first-90 sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the interruption pivots.

Latest checkpoint, May 23 2026 16:07 CST: moved the two newest cold-reader safeguards into the formal presentation lock and QA checklist. `FINAL_PRESENTATION_LOCK.md` now has a `Story and metric safeguards locked` row requiring the Judge Decision Trail and Current Metric Note, and `QA_CHECKLIST.md` now has a current story/metric safeguard section so the final pre-presentation check includes those readability and stale-metric protections. The verifier now requires these strings in both files, and browser QA requires the lock row in the dashboard body. Reflection: the package should not only contain good story aids; the final lock should say they are part of the safe-to-present state. Final packaging action: rerun the full final gate so the generated lock file, QA checklist, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the safeguard lock.

Latest checkpoint, May 23 2026 16:00 CST: promoted the newest safeguards into the folder entrance. `OPEN_THIS_FIRST.md` and the dashboard Open This First section now say that the one-page story includes the Judge Decision Trail and that the research log opens with a Current Metric Note, so the latest readability and stale-metric protections are visible before a reader enters the proof wall. The verifier now requires those cover-sheet phrases, and browser QA requires the dashboard receipt phrase. Reflection: if a judge is busy, the first file should not only route them; it should summarize exactly what the last quality passes protected. Final packaging action: rerun the full final gate so the regenerated cover sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, verifier, and final summary include the entrance receipt update.

Latest checkpoint, May 23 2026 15:58 CST: added a top-level `Current Metric Note` to prevent stale historical research-log numbers from being mistaken for the current promoted headline claim. The note explicitly says the current metrics are 36.32 weighted score MAE, 49.73 weighted margin MAE, 0.1648 weighted Brier, and 0.126 deployment score, while older 41.48/57.05/0.1634/0.130 entries are audit history. Reflection: the generated report already protects the current claim, but the research log is long enough that it needs the same cold-reader guard. Final packaging action: rerun the full final gate so source/text fingerprints, verifier, browser QA, screenshots, tests, and the final summary include the metric-note guard.

Latest checkpoint, May 23 2026 15:54 CST: added a protected `Judge Decision Trail` to the one-page story, standalone start-here story, and full dashboard start-here section. This trail turns the model journey into a fast because/revealed/next-move sequence: baseline because it was the honest starting line, no-future replay because prediction had to happen before each match, RoleV3 because defense needed separate tradeoffs, and TailGuard because risky high-score environments needed caution. Browser QA and the verifier now require the Decision Trail language so the package stays readable for a busy judge instead of drifting back into a proof wall. Reflection: this directly addresses the time-pressure problem; the story now explains not only what won, but why each pivot was rational. Final packaging action: rerun the full final gate so the regenerated Markdown, dashboard HTML, screenshots, fingerprints, browser QA, tests, and verifier include the Decision Trail.

Latest checkpoint, May 23 2026 15:46 CST: hardened the presentation wording audit after the stale cross-exam metric fix. `PRESENTATION_WORDING_AUDIT.md` now has a safer-phrasing row for the old 41.x metric risk: use 36.32 as the current promoted weighted score MAE, and treat older 41.x rows as labeled historical leaderboard evidence. Browser QA and the verifier require this safer wording in the generated dashboard. Reflection: fixing a stale phrase is good; teaching future slide/edit work how not to reintroduce it is better. Final packaging action: rerun the full final gate so the wording audit, dashboard HTML, screenshots, fingerprints, browser QA, tests, and verifier include the stale-metric guidance.

Latest checkpoint, May 23 2026 15:42 CST: found and fixed a stale hostile-Q&A metric. The cross-exam row still asked whether a "41-point score MAE" was useful, which belonged to the older TailGuard handoff family; the promoted current headline score MAE is 36.32. I updated the generated question to `Is a 36.32 score MAE actually useful?`, added a copy-quality guard against the stale `41-point score MAE` phrase, and made the verifier require the corrected question in `HOSTILE_JUDGE_CROSS_EXAM.md`. Historical 41.48 rows remain only in the leaderboard appendix as labeled audit history. Reflection: this is exactly the kind of late stale-number sweep that protects the judge story from contradicting itself. Final packaging action: rerun the full final gate so the cross-exam Markdown, dashboard HTML, screenshots, fingerprints, browser QA, tests, and verifier include the corrected metric.

Latest checkpoint, May 23 2026 15:38 CST: added a hard-question answer for the obvious late-change objection: "If the package changed this late, why should judges trust it?" The cross-exam answer now says the late changes were audited, not hidden; they tightened routes, stale diagnostics, wording guards, and screenshots; and every final edit reran dashboard generation, browser QA, typecheck, tests, and verifier passes. The verifier and browser QA now require this question and answer in the generated Markdown and HTML. Reflection: this is a useful honesty layer because the presentation should not pretend the last-hour work never happened; it should show that the last-hour work was controlled and checked. Final packaging action: rerun the full final gate so the cross-exam sheet, dashboard HTML, screenshots, fingerprints, browser QA, tests, and verifier include the late-change answer.

Latest checkpoint, May 23 2026 15:34 CST: converted the generic-dashboard route cleanup into a regression guard. The verifier now fails generated Markdown or HTML copy that says to "then open index.html for the proof dashboard" instead of the exact `index.html#start-here-story` route, and browser QA forbids the same generic body text. Reflection: it is not enough to fix the current files; the final package should reject the stale route if a future generator edit accidentally reintroduces it. Final packaging action: rerun the full final gate so the new forbidden-route rule is exercised against regenerated HTML, Markdown, screenshots, browser QA, tests, and verifier output.

Latest checkpoint, May 23 2026 15:32 CST: ran a route-consistency sweep on the remaining fastest handoff wording. I found two real leftovers that still pointed to generic `index.html` for dashboard proof: the in-dashboard Open This First handoff note and the printable handout opening line. Both now point directly to `index.html#start-here-story`, matching the one-page story, start-here route, README, cover sheet, script, and verifier route. The verifier now requires the anchor-specific printable handout text and the browser/body QA requires the dashboard handoff phrase. Reflection: a generic dashboard link is not wrong, but under judge time pressure the exact anchor is better because it lands on the story proof instead of asking the reader to navigate. Final packaging action: rerun the full final gate so the regenerated handout, dashboard HTML, screenshots, fingerprints, browser QA, tests, and verifier include the route fix.

Latest checkpoint, May 23 2026 15:29 CST: added a `Latest Quality Receipt` to the generated cover sheet and dashboard Open This First section. The receipt summarizes what the newest work protected without making Leo or a judge hunt through the log: the one-page story has a 30-second script, three-takeaway memory aid, and plain-English number key; the final TailGuard micro-sensitivity pass kept TW=0.22 after TW=0.21/TW=0.23 pressure; and the failure atlas plus leaderboard labels now point at the current claim instead of stale history. Browser QA and the verifier require the dashboard wording, and the verifier requires the Markdown cover-sheet wording. Reflection: this turns the repeated final-hour checks into a readable audit receipt at the folder entrance. Final packaging action: rerun the full final gate so the regenerated cover sheet, HTML dashboard, screenshots, fingerprints, browser QA, tests, and verifier include this receipt.

Latest checkpoint, May 23 2026 15:27 CST: added a protected `Three Takeaways` layer to `ONE_PAGE_JUDGE_STORY.md` and `ONE_PAGE_JUDGE_STORY.html` so a busy judge can retain the model in one scan: winner, reason it won, and safe use. The reason now says the model stayed strongest after no-future replay, holdout pressure, calibration checks, and TailGuard sanity sweeps; the safe-use line frames it as a pre-match score, win-chance, uncertainty, and role-risk briefing, not an automatic decision-maker. Browser QA and the verifier require these phrases. Reflection: the fastest artifact now works both as a story and as memory support for someone who will not read the larger report. Final packaging action: rerun the full final gate so screenshots, fingerprints, browser QA, tests, and verifier include the three-takeaway route.

Latest checkpoint, May 23 2026 15:24 CST: added a final "why the extra time mattered" note to the fastest one-page judge story instead of making the package longer. The new Markdown and HTML wording tells a cold reader exactly what the last-mile work accomplished: TW=0.21/TW=0.23 sanity checks tried and failed to dislodge TW=0.22, the failure-mode atlas was refreshed from the current TW=0.22 diagnostics instead of the older TW=0.20 run, and historical leaderboard rows now say report-local so older defaults cannot impersonate the final claim. Browser QA and the verifier now require this note. Reflection: this is the right kind of late polish because it explains the value of the extra checks without asking Leo or the judges to read the whole evidence wall. Final packaging action: rerun the full final gate so the one-page story, screenshots, fingerprints, browser QA, tests, and verifier all agree after the note.

Latest checkpoint, May 23 2026 15:19 CST: finished another coherence sweep focused on stale metric risk. The remaining `41.48 / 0.130` and TW=0.20 values in the final dashboard package are historical leaderboard rows, not the current finalist claim, but the `MODEL_LEADERBOARD_APPENDIX.md` role label `point default candidate` could still be misread by a cold judge as global. I added a `Report-local role note` to the Markdown appendix and HTML Model Leaderboard section explaining that older point-default rows were defaults only inside their historical report families, while the current final promoted model is Conservative TailGuard Strong RoleV3 from `role-v3-tailguard-micro-sensitivity-check`. The verifier and browser QA now require this note. Reflection: old evidence should remain visible, but it must wear a label that prevents it from impersonating the current answer. Final packaging action: rerun the full final gate so the note is generated, screenshot-checked, fingerprinted, and verifier-locked.

Latest checkpoint, May 23 2026 15:16 CST: found and fixed a stale failure-mode handoff risk. The package headline had already moved to Conservative TailGuard Strong RoleV3 at TW=0.22, but `FAILURE_MODE_ATLAS.md` was still being generated from the older `current-*-role-v3-tail-guarded` diagnostics, which labeled the failure analysis as TW=0.20. I regenerated `modeling/artifacts/reports/current-tailguard-residual-diagnostics` from the current micro-sensitivity run directories, where the saved best model is TW=0.22, updated the dashboard fallback command to the same sources, and made the verifier require the TW=0.22 failure-atlas source and model name. Reflection: this is exactly why repeated stale-wording sweeps matter; a judge should never have to guess whether a diagnostic is historical or current. Final packaging action: rerun the full final gate so the dashboard, failure atlas, screenshots, fingerprints, and verifier all agree after the diagnostic refresh.

Latest checkpoint, May 23 2026 15:12 CST: added a plain-English number key to the one-page judge story because the fastest route still asked a cold reader to understand MAE, Brier, and deployment score too quickly. The new `Plain-English Number Key` translates the four headline metrics directly: score miss, red-blue gap miss, win-probability honesty, and stability-adjusted selection score. Browser QA and the verifier now require those phrases in the one-page route. Reflection: this is small, but it addresses the exact judge-time problem: the first-open file should teach the numbers at the moment it shows them. Final packaging action: rerun the full final gate so screenshots, fingerprints, and verifier strings include the metric-translation checkpoint.

Latest checkpoint, May 23 2026 15:08 CST: added a verbatim 30-second script to the one-page judge story after reviewing the already-polished short route. The goal is not to add more material; it is to prevent a busy presenter or judge from having to synthesize the report live. `ONE_PAGE_JUDGE_STORY.md` now includes a `30-Second Script`, and `ONE_PAGE_JUDGE_STORY.html` shows the same script near the top of the story route. Browser QA and the verifier now require the phrase so the fastest spoken handoff cannot silently disappear. Reflection: the project already has enough proof; the last mile is making the proof usable under time pressure. Final packaging action: rerun the full final gate so screenshots, source fingerprints, verifier strings, and tests include this speaking-script checkpoint.

Latest checkpoint, May 23 2026 15:00 CST: completed a short-route polish pass after the ultra-micro TailGuard sweep. The typo sweep found no obvious misspellings in the generated judge package, and stale-deadline strings were confined to explicitly marked research-log history and verifier guardrails. I fixed the one stale story comparison so the generated TailGuard sweep now says TW=0.22 deployment score 0.126 versus TW=0.20 at 0.186 and TW=0.25 at 0.195, matching the refreshed cross-run report. I also added a one-page `Stop rule` so a rushed judge can stop after `ONE_PAGE_JUDGE_STORY.html` and treat all links as backup proof rather than required reading. Reflection: this does not change the model; it makes the fastest handoff more respectful of judge time. Final packaging action: rerun the full final gate so browser QA, screenshots, verifier strings, source fingerprints, and tests include the stop-rule checkpoint.

Latest checkpoint, May 23 2026 14:52 CST: used the extra runway for an ultra-micro TailGuard sanity sweep instead of only polishing the report. I added exact TW=0.21 and TW=0.23 candidates beside the existing TW=0.18, TW=0.20, TW=0.22, TW=0.25, and TW=0.35 RoleV3 TailGuard settings, refreshed the full 2026 replay, refreshed the full 2024-2026 replay, and regenerated the `role-v3-tailguard-micro-sensitivity-check` cross-run report. TW=0.22 still ranked first in both full replays: 2026 relative benchmark 0.485, ahead of TW=0.21 at 0.561, TW=0.25 at 0.583, TW=0.20 at 0.647, and TW=0.23 at 0.655; broad 2024-2026 relative benchmark 4.111, ahead of TW=0.23 at 4.130, TW=0.20 at 4.171, TW=0.25 at 4.174, and TW=0.21 at 4.193. The refreshed deployment review still selected TW=0.22 as the point model: weighted score MAE 36.32, weighted margin MAE 49.73, weighted Brier 0.1648, deployment score 0.126. Reflection: this was a useful "no change" because the nearest unused decimals did not earn a promotion or a new holdout campaign. Final packaging action: update the story/dashboard wording so it names the last decimal sanity sweep and then rerun the final gate.

Latest checkpoint, May 23 2026 13:18 CST: completed a true micro-sensitivity confirmation around the promoted TailGuard weight instead of freezing the earlier TW=0.20 result. I added exact TW=0.18, TW=0.22, and TW=0.25 RoleV3 TailGuard candidates plus seven manifests: two full replays (`current-2026-role-v3-tailguard-micro-sensitivity.json`, `current-2024-2026-role-v3-tailguard-micro-sensitivity.json`) and five event-key holdout buckets (`holdout-2024-2026-bucket0..4-role-v3-tailguard-micro-sensitivity.json`). The full 2026 replay and full 2024-2026 replay both promoted TW=0.22. The five holdouts were more honest and more mixed: TW=0.25 led three relative holdout ranks and two fixed-score holdout ranks, TW=0.35 won one held-out bucket, and bucket 4 still preferred plain Strong RoleV3. The combined cross-run report selected TW=0.22 as the stability-adjusted point model: weighted score MAE 36.32, weighted margin MAE 49.73, weighted Brier 0.1648, deployment score 0.126. This checkpoint was later superseded by the 14:52 ultra-micro refresh, which added TW=0.21/TW=0.23 and updated the comparison scores while keeping TW=0.22 promoted. Reflection: this is the best kind of late improvement because it changed the model only after a full replay and holdout check, while preserving the caveat that the holdout picture is mixed. Final packaging action: regenerate the dashboard from `role-v3-tailguard-micro-sensitivity-check`, refresh screenshots, rerun typecheck/tests/verifier, and make the story explicitly explain TW=0.22 versus TW=0.25.

Latest checkpoint, May 23 2026 10:32 CST: completed the broad confirmation companion for the last-mile conservative TailGuard sweep. I added `modeling/experiments/current-2024-2026-role-v3-conservative-tailguard-sweep.json` and ran `npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-v3-conservative-tailguard-sweep.json` over 15,015 matches and 30,030 alliance rows. The defended TW=0.20 model still ranked first on the broad replay: relative benchmark 3.901, ahead of TW=0.15 at 3.960, no-TailGuard Strong RoleV3 at 3.976, and TW=0.10 at 3.978. Reflection: this turns the last-mile sweep from a one-season sanity check into a broader confirmation that shrinking TailGuard is not a better final answer. The story route, dashboard route, verifier, and reference-integrity map now require this broad-confirmation wording and both sweep artifacts. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints, browser screenshots, and verifier guards include the broad sweep.

Latest checkpoint, May 23 2026 10:04 CST: ran a last-mile conservative TailGuard sweep instead of only polishing prose. I added exact `TW=0.10` and `TW=0.15` RoleV3 TailGuard candidates, ran `npm run model:train -- --manifest modeling/experiments/current-2026-role-v3-conservative-tailguard-sweep.json`, and the defended `TW=0.20` model still ranked first in the 2026 replay. The narrowed result was near-tie but not a promotion change: relative benchmark 0.429 for TW=0.20, 0.519 for TW=0.15, and 0.592 for TW=0.10, with fixed benchmarks tied at 0.860. Reflection: this is a useful "no" because it checks whether the final TailGuard setting was too strong; it was not obviously too strong under the exact current replay. The story route, dashboard route, verifier, and reference-integrity map now require a `Last-Mile TailGuard Sweep` note. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints, browser screenshots, and verifier guards include the new candidate configs and sweep artifact.

Latest checkpoint, May 23 2026 09:48 CST: added a restrained `Stop after Proof Receipt` rule to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now explicitly tell a busy judge that they can stop after the fast answer, loop, trust, use, and proof receipt; everything below is backup proof and script material. Browser QA and the verifier now require this stop-rule wording. Reflection: after adding many clarity layers, the highest-value improvement is reader control, so the report respects scarce judge time without hiding evidence. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the stop-rule checkpoint.

Latest checkpoint, May 23 2026 09:44 CST: added a `Fast Reading Route` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now tell a busy reader exactly what to scan first: answer, loop, trust, use, then proof. Browser QA and the verifier now require this shortcut wording, including `Read One Match Loop` and `where the evidence lives`. Reflection: after several clarity layers, the best next improvement was not another explanation but a route through the explanations. This keeps the page useful for judges with very little time. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the fast-reading-route checkpoint.

Latest checkpoint, May 23 2026 09:39 CST: added a `Proof Receipt` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now map the main judge-facing claims to exact proof files: `LEAKAGE_AUDIT.md` for no-future validation, `FINALIST_COMPARISON.md` for model choice, `FINAL_CHECK_SUMMARY.md` for tests/browser QA/verifier/screenshots/deadline proof, and `index.html#start-here-story` plus screenshots for visual proof. Browser QA and the verifier now require these proof-receipt strings. Reflection: this keeps the story short without making proof feel hidden; a judge can ask "prove it" and immediately know where to look. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the proof-receipt checkpoint.

Latest checkpoint, May 23 2026 09:34 CST: added a `When To Trust It` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now tell a drive-team reader when to trust the model more, when to slow down, and when humans should override it because robot condition, alliance plans, driver intent, or last-minute mechanical changes matter more than the prediction. Browser QA and the verifier now require these practical trust-boundary strings. Reflection: this turns the model from an impressive report into a safer strategy tool by pairing output with judgment rules. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the trust-boundary checkpoint.

Latest checkpoint, May 23 2026 09:30 CST: added a `Final Selection Filter` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now show the four practical gates a candidate had to pass before becoming the defended model: accuracy first, probability honesty, tail discipline, and stability over sparkle. Browser QA and the verifier now require these selection-filter strings. Reflection: this keeps the final model choice from feeling like a leaderboard magic trick; a busy judge can see the selection logic before opening the full score tables. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the selection-filter checkpoint.

Latest checkpoint, May 23 2026 09:27 CST: added a `Trust Ladder` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now explain in one scan why the model deserves cautious trust: no-future replay blocks hindsight, holdouts punish memorization, calibration checks probability honesty, and tail-risk review checks uncomfortable matches instead of hiding behind average accuracy. Browser QA and the verifier now require these trust-ladder strings. Reflection: this closes the gap between "the model passed tests" and "a busy judge understands what those tests protect against." The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the trust-ladder checkpoint.

Latest checkpoint, May 23 2026 09:23 CST: added a `One Match Loop` explanation to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` route now show the model's cycle in three plain steps: before the match it only sees known history and context, before the match it predicts score, win chance, uncertainty, and role clue, and only after the match does the result update memory for future matches. Browser QA and the verifier now require those loop strings, so the final package has a protected intuitive explanation of how no-future replay works in one match. Reflection: this is a small communication change with high judge value because it turns the validation rule from an abstract phrase into a concrete mental picture. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the one-match-loop checkpoint.

Latest checkpoint, May 23 2026 09:20 CST: added a `What Surprised Us` layer to the story-first handoff instead of chasing risky last-minute model churn. The standalone story, story Markdown, and dashboard `#start-here-story` route now explicitly say that the winner was not the flashiest model, that defense became useful only after RoleV3 split it into tradeoffs, and that a documented no on SelectiveTailGuard made the final yes stronger. Browser QA and the verifier now require these surprise strings, so the opening route cannot drift back into a generic proof summary. Reflection: the model story is stronger when it names the counterintuitive results a judge will remember. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the surprise checkpoint.

Latest checkpoint, May 23 2026 01:46 CST: performed a cold-reader restraint audit and intentionally did not add another judge-facing section. The generated package already opens with the story-first route, busy judge card, adventure map, plain-English decoder, and drive-team-use layer. Independent readback showed the final check summary still passing, the generated package had no stale deadline strings, overclaim keywords only appeared in caveat or "do not say" contexts, the generated README still opens `START_HERE_STORY.html` first, all 13 screenshots exist, port 4177 was clean, and the deliverables manifest had 76 absolute referenced paths with no missing files. Reflection: polish is not only adding content; it is also stopping before the opening route becomes heavy again. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include this restraint checkpoint.

Latest checkpoint, May 23 2026 01:39 CST: added a `What A Drive Team Gets` layer to the story-first handoff. The standalone story, story Markdown, and dashboard `#start-here-story` section now translate the model into practical pre-match use: expected score, win chance, uncertainty, role clue, and human boundary. Browser QA and the verifier now require those practical-use strings, so the handoff cannot drift back into pure model-report language without explaining what a drive team actually receives. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 245 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: the earlier story layers explained what the model is and how we got there; this layer explains why a drive team would care. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the practical-use checkpoint.

Latest checkpoint, May 23 2026 01:32 CST: added a `Plain-English Decoder` to the story-first handoff because the opening story should not assume a busy judge already understands modeling shorthand. `START_HERE_STORY.html`, `START_HERE_STORY.md`, and the dashboard `#start-here-story` section now define no-future replay, RoleV3, TailGuard, Brier, and deployment score in one-sentence terms near the top. Browser QA and the verifier now require these decoder strings, including the key ideas that old matches are replayed as if standing before each match and that Brier checks whether win probabilities are honest. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 236 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: this closes a real comprehension gap without changing the model claim. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so source/text fingerprints include the decoder checkpoint.

Latest checkpoint, May 23 2026 01:21 CST: added an `Adventure Map` to the top of the story-first handoff. The standalone story page, story Markdown, and in-dashboard `#start-here-story` section now show the six-step path before the long explanation: Baseline, No-future replay, Distributions, RoleV3, TailGuard, and Final model. This gives a busy judge a visual story spine before they read paragraphs. Browser QA and the verifier now require the map strings in both HTML and Markdown. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 228 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: the previous cue card answered "what is the model?"; the map answers "how did we get here?" without forcing the reader into the full report. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so the source/text fingerprints include the map checkpoint.

Latest checkpoint, May 23 2026 01:15 CST: added a `Busy Judge Card` to the generated story-first handoff because the final package should not ask Leo or a judge to decode the whole proof wall before understanding the model. `START_HERE_STORY.html`, `START_HERE_STORY.md`, and the in-dashboard `#start-here-story` section now give a four-part scan: model, model in one sentence, why to believe it, and honest caveat. The browser QA and dashboard verifier now require the cue-card strings, so this cannot quietly regress during regeneration. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 219 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: this is not extra decoration; it is a communication safety layer. The model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Final packaging action: rerun the full final gate after this log entry so the source/text fingerprints include the communication update itself.

Latest checkpoint, May 23 2026 00:56 CST: added a stale-deadline regression guard to the generated package verifier. Browser QA and Markdown copy-quality checks now forbid the superseded `Friday May 22 2026 18:00 CST`, `May 22 2026 18:00 CST`, and `2026-05-22T18:00:00+08:00` deadline forms in generated handoff artifacts. Historical mentions remain allowed in this research log because the Deadline Correction Note explains them as audit history. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 210 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: the corrected May 23 deadline is now not just written into the package; the generated presentation artifacts actively reject the old deadline if it reappears. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: preserve this guardrail and keep any old-deadline references confined to explicitly marked history.

Latest checkpoint, May 23 2026 00:50 CST: removed a timestamp ambiguity from the generated judge package. Generated Markdown files now write both `Generated (UTC)` and `Generated (CST / Asia-Shanghai)` instead of UTC-only `Generated` lines, and the standalone story, dashboard footer, and `VERIFICATION_SUMMARY.md` now show local CST time beside UTC. Browser QA and the verifier now require the local generated-time phrase and fail if a generated Markdown file slips back to UTC-only wording. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 210 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: UTC was technically correct but visually confusing because it still reads as May 22; the final handoff should speak in the same CST timezone as the deadline. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: preserve this timestamp clarity unless a new artifact type needs the same treatment.

Latest checkpoint, May 23 2026 00:35 CST: fixed the final cold-folder README route so it no longer begins by telling a busy reader to open `index.html` first. The generated `README.md` now says to open `START_HERE_STORY.html` first for the quick story, then use `index.html#start-here-story` for full checked dashboard proof, while preserving the exact deadline, promoted model, short story, and one-command final gate lines. The verifier now guards those README story-first strings. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 208 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: a README is often the first thing a cold judge or teammate opens, so it must not contradict the story-first handoff. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: keep the cold-folder entry points aligned and avoid adding new surface area unless it solves a real presentation risk.

Latest checkpoint, May 23 2026 00:28 CST: added explicit corrected-deadline visibility to the standalone story route, then reran the full final gate. `START_HERE_STORY.html`, `START_HERE_STORY.md`, and the in-dashboard `#start-here-story` section now say `Delivery target: Saturday May 23 2026 18:00 CST` near the opening story, and both browser QA and the dashboard verifier require that line. Verification: `npm run model:final-check` passed with browser QA clean, 38/38 tests passing, verifier passing twice, 205 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: the repeated reminder prompt still contains the old May 22 wording, so the first artifact a judge opens should state the corrected May 23 deadline without making them hunt through the dashboard hero or research-log correction note. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: preserve this state unless a new pass finds a real presentation or validation weakness.

Latest checkpoint, May 23 2026 00:24 CST: tightened the story-first route for busy judges and teachers, then reran the full final gate. The start-here headline now says `The model adventure in one quick walk`, the standalone Markdown adds a `The 90-Second Walkthrough` chain that explains each modeling decision as a consequence of the previous limitation, and the deadline checklist now opens `START_HERE_STORY.html` before moving to `index.html#start-here-story`. The verifier now guards the corrected headline and the deadline-checklist story-first route. Verification: `npm run model:final-check` passed after the edit with browser QA clean, 38/38 tests passing, verifier passing twice, 202 required strings checked, 13 screenshots refreshed, zero console issues, zero page errors, and generated-before-deadline proof still true. Reflection: the package should never make a judge start in the evidence wall when the human story can earn attention first. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: preserve the story-first route and only add new work if it beats the current balance without weakening the handoff.

Latest checkpoint, May 23 2026 00:13 CST: removed another dashboard-first remnant from the judge handoff. `JUDGE_WALKTHROUGH.md` now starts with `START_HERE_STORY.html`, then moves to `index.html#start-here-story` and the printable summary only if the judge asks for proof. The 30-second row in `OPEN_THIS_FIRST.md` also now points to `index.html#start-here-story` instead of vaguely saying `index.html hero`, and the verifier requires the corrected walkthrough strings. Reflection: route consistency matters because a presenter under time pressure will follow whichever short file they opened last. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the regenerated walkthrough, cover sheet, verifier guard, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 23 2026 00:10 CST: aligned the final presentation lock with the story-first route. `FINAL_PRESENTATION_LOCK.md` no longer locks the route to start at `index.html`; it now starts at `START_HERE_STORY.html`, moves to `index.html#start-here-story` for dashboard proof, and keeps `FIRST_90_SECONDS.md`, `FINAL_COHERENCE_AUDIT.md`, and `HOSTILE_JUDGE_CROSS_EXAM.md` as the opening, consistency, and hard-question companions. The verifier now requires that locked route. Reflection: a lock file is dangerous if it preserves an old habit after the rest of the package improves. This makes the final route contract match the story-first handoff everywhere. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the regenerated lock file, verifier guard, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 23 2026 00:03 CST: aligned the remaining spoken-script surfaces with the story-first route. `PRESENTATION_SCRIPT.md` now names `START_HERE_STORY.html` and `index.html#start-here-story` as its companion route, and `JUDGE_BRIEF.md` now tells a judge or teacher to open the standalone story before asking for dashboard proof. The verifier requires those lines, so the handoff cannot split into story-first docs and dashboard-first scripts. Reflection: under judging pressure, the spoken script is often what the presenter actually follows, so it must match the route we want the judge to experience. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the updated scripts, verifier guard, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 23 2026 00:00 CST: added a top-of-log deadline correction note so the research narrative cannot confuse a cold reader with historical references to the earlier May 22 target. The note states that the active deadline is Saturday May 23 2026 18:00 CST, that pre-22:15 entries are historical audit records, and that the generated dashboard, manifest, final-check summary, browser QA, verifier, and short-route handoff files use the corrected May 23 deadline. Reflection: immutable-looking logs are valuable, but only if the reader knows which entries are current and which are historical. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the research-log correction is source-fingerprinted and verifier-checked.

Latest checkpoint, May 22 2026 23:54 CST: aligned the remaining short-route presentation files with the story-first path. `FIRST_90_SECONDS.md`, `COLD_READER_ROUTE.md`, and `LIVE_DEMO_RUNBOOK.md` now start from `START_HERE_STORY.html` before moving to `index.html#start-here-story` and deeper proof files, and the 90-second evidence pointer starts from the story metric cards instead of the dashboard hero. The verifier now checks those story-first route strings, so the handoff cannot quietly drift back to dashboard-first. Reflection: the project already had strong evidence, but the first minute matters more than the fiftieth page. This pass makes the fastest spoken route, cold-reader route, printable handout, and live demo route all point to the same humane opening. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the regenerated route files, verifier guard, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 22 2026 23:49 CST: aligned the one-page printable handout with the story-first judge route. `PRINTABLE_HANDOUT.md` now tells a cold reader to open `START_HERE_STORY.html` first, then use `index.html` and `index.html#start-here-story` for proof, screenshots, source fingerprints, and the full dashboard. It also repeats the safe claim boundaries: before-match only, strategy support rather than scout replacement, avoid exact-score certainty, and avoid live-app deployment claims. Reflection: the shortest artifact must point to the clearest artifact. This closes a quiet handoff mismatch where the handout still began with the proof-heavy dashboard. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the regenerated handout, verifier guard, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 22 2026 23:41 CST: added a `Safe Wording Before You Present` layer to the story route. The standalone story and in-dashboard `Start Here` section now put the safe claim language beside the opening story: current best defended local model, no-future replay, strategy support rather than scout replacement, and avoid exact-score certainty, live-app deployment claims, or certainty about future defense choices. Reflection: the final package is only as strong as the words used to present it. This keeps the most important claim boundaries visible before the long appendices. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and visually confirm the safe-wording cards fit cleanly.

Latest checkpoint, May 22 2026 23:07 CST: added a compact `If A Judge Pushes Back` layer to the story route. The standalone story and in-dashboard `Start Here` section now answer the three likely first challenges: no-future leakage, why not a smarter model, and whether the accuracy is enough. Reflection: a polished story should not force the presenter to hunt through the full hard-question appendix for the first skeptical question. This keeps safe wording close to the opening narrative. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and visually confirm the pushback cards still fit cleanly.

Latest checkpoint, May 22 2026 23:04 CST: added a plain-English metric translation layer to the story route. The standalone story and in-dashboard `Start Here` section now explain score MAE, margin MAE, Brier, and deployment score in judge language, and the verifier requires those explanations. Reflection: metrics should not be a private language. A busy judge should know immediately that score MAE is typical score miss, margin MAE is score-gap miss, Brier is win-probability honesty, and deployment score is the lower-is-better selection rule. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and visually confirm the metric cards still fit cleanly.

Latest checkpoint, May 22 2026 22:54 CST: added a `Three Things To Remember` memory layer to the story route. The standalone story and the in-dashboard `Start Here` section now summarize the model's trust rule, strategy value, and selection discipline before the longer adventure, and the verifier requires those lines. Reflection: the report should not only be true and beautiful; it should be memorable under time pressure. The three takeaways are: before-match only, strategy not prophecy, and rejected cleverness. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and visually confirm the story screenshot still reads cleanly.

Latest checkpoint, May 22 2026 22:46 CST: added direct proof links to the standalone story page. After the `Thirty-second answer`, the HTML now gives one-click routes to the full dashboard story anchor, finalist comparison, leakage audit, and final-check proof, and the verifier requires those links. Reflection: this closes the "then what?" gap. A judge can understand the story quickly and immediately choose the proof path that matches their question, instead of hunting through the full dashboard. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and visually confirm the proof-link row in the refreshed story screenshot.

Latest checkpoint, May 22 2026 22:41 CST: compressed the story-first route again for true judge-time pressure. The standalone story, in-dashboard `Start Here` section, and `OPEN_THIS_FIRST.md` route table now put a `Thirty-second answer` before the longer narrative, and the 30-second handoff opens `START_HERE_STORY.html` before the proof dashboard. Reflection: a beautiful report still fails if the first useful sentence appears too late. This pass keeps the same evidence and same winner, but changes the order so the reader gets the answer, then the adventure, then the proof. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the compressed story route is browser-verified and verifier-locked.

Latest checkpoint, May 22 2026 22:38 CST: aligned the cold-open route around the new story-first handoff. `OPEN_THIS_FIRST.md` now tells a busy judge to open `START_HERE_STORY.html` first, then use `index.html#start-here-story` for the same adventure inside the full proof dashboard, and the verifier now requires both route strings so this cannot silently regress. Reflection: the previous proof package was strong but still asked readers to start in the densest place. The stronger presentation path is story first, evidence immediately after, with the same bounded claim and unchanged winning model. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the story-first route, browser QA, screenshots, fingerprints, and deadline proof pass together.

Latest checkpoint, May 22 2026 22:15 CST: extended the final package deadline to the exact date requested, May 23 2026 at 18:00 CST. Note: May 23 2026 is Saturday, so the package uses `Saturday May 23 2026 18:00 CST` as the concrete deadline label. I also promoted the plain-English model adventure into the generated dashboard as a checked `Start Here` Quick Jump route at `#start-here-story`, generated standalone `START_HERE_STORY.html` and `START_HERE_STORY.md`, and added a browser-QA screenshot proof named `start-here-story-screenshot.png`. Reflection: the previous dashboard was rigorous but too heavy for a busy judge. The new first route explains why we started simple, why walk-forward replay mattered, how RoleV3 and TailGuard emerged, why SelectiveTailGuard was rejected, and why Conservative TailGuard Strong RoleV3 remains the defended model. Next: rerun the full final gate with the May 23 deadline and confirm the story route, manifest entries, fingerprints, and thirteen screenshot proofs pass together.

Latest checkpoint, May 22 2026 03:33 CST: promoted `Final Readiness Check` into a checked Quick Jump route named `Ready Check`. The dashboard already had the go/no-go presentation gate for model claim, evidence included, verification gate, and presentation boundary, but now the top route points directly to `#final-readiness-check`, and both the final-check summary and verifier require that anchor. Reflection: the final report should not only prove the model; it should make the last human readiness check impossible to miss before presenting. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the readiness route appears in the generated proof.

Latest checkpoint, May 22 2026 03:29 CST: promoted `Finalist Comparison` into a checked Quick Jump route named `Finalists`. The dashboard already had the direct why-this-model table, but now the top route points directly to `#finalist-comparison`, and both the final-check summary and verifier require that anchor. Reflection: judges will naturally ask why the promoted model beat close alternatives. The best answer should be fast, score-backed, and caveated, not buried in the middle of the report. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the finalists route appears in the generated proof.

Latest checkpoint, May 22 2026 03:27 CST: promoted `Strategy Example` into a checked Quick Jump route named `Strategy Use`. The dashboard already had a concrete saved walk-forward prediction, but now the top route points directly to `#strategy-example`, and both the final-check summary and verifier require that anchor. Reflection: this strengthens the usefulness story. Judges should be able to see quickly how the model becomes pre-match strategy evidence: expected score, win probability, role/defense clues, actual result, and error, with the same bounded claim discipline as the rest of the package. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the strategy route appears in the generated proof.

Latest checkpoint, May 22 2026 03:25 CST: promoted `Model Source Map` into a checked Quick Jump route named `Source Map`. The dashboard already connected presentation claims to local source files, but now the top route points directly to `#model-source-map`, and both the final-check summary and verifier require that anchor. Reflection: this strengthens the best-model-code deliverable because a judge can audit not just source hashes, but where the model definitions, walk-forward features, diagnostics, scoring rule, dashboard generator, and verifier live. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the source-map route appears in the generated proof.

Latest checkpoint, May 22 2026 03:23 CST: promoted `Risk Register` into a checked Quick Jump route. The dashboard already named near-tie model selection, early-event uncertainty, championship-tail errors, sparse scout/PPC rows, timestamp provenance, and strategy overuse, but now the top route points directly to `#risk-register`, and both the final-check summary and verifier require that anchor. Reflection: the strongest handoff keeps risk visible next to evidence instead of burying it after the confident parts. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the risk route appears in the generated proof.

Latest checkpoint, May 22 2026 03:21 CST: promoted `Evidence Matrix` into a checked Quick Jump route named `Evidence Map`. The dashboard already mapped every important claim to evidence, caveats, and audit files, but now the top route points directly to `#evidence-matrix`, and both the final-check summary and verifier require that anchor. Reflection: this is a cold-judge improvement. The strongest report is not just pretty; it lets someone inspect the claim chain quickly and see the caveats beside the proof. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the evidence route appears in the generated proof.

Latest checkpoint, May 22 2026 03:20 CST: promoted `Failure Mode Atlas` into a checked Quick Jump route named `Failure Modes`. The dashboard already showed worst events, phase bias, calibration gaps, and known weak spots, but now the top route points directly to `#failure-mode-atlas`, and both the final-check summary and verifier require that anchor. Reflection: this is the right kind of final polish because honest weakness analysis is part of the model's credibility. The package should make it easy to show not only why the promoted model won, but where it still struggles and why TailGuard exists. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the failure-mode route appears in the generated proof.

Latest checkpoint, May 22 2026 03:18 CST: promoted `Leakage Audit` into a checked Quick Jump route named `Leakage Guard`. The dashboard already had the no-future audit table, but now the top route points directly to `#leakage-audit`, and both the final-check summary and verifier require that anchor. Reflection: this is a model-validity improvement for the handoff. The whole claim depends on proving that predictions are made before current-match state updates, so the no-leakage proof should be as easy to find as the model score and final gate. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the leakage route appears in the generated proof.

Latest checkpoint, May 22 2026 03:15 CST: promoted `Judge Dry-Run Scorecard` into a checked Quick Jump route named `Dry Run`. The dashboard already had a rehearsal gate for the presenter, but now the top route points directly to `#judge-dry-run-scorecard`, and both the final-check summary and verifier require that route. Reflection: the final package should not only be technically correct; it should help the presenter prove the bounded claim under time pressure without drifting into overclaiming. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the dry-run route appears in the generated proof.

Latest checkpoint, May 22 2026 03:12 CST: promoted `Judge Rubric Alignment` into a checked Quick Jump route named `Rubric Fit`. The report already translated the project into process, rigor, validation, iteration, usefulness, integrity, honesty, and communication evidence, but now teachers and judges can reach that section directly from the top of the HTML, and both the final-check summary and verifier require `#judge-rubric-alignment`. Reflection: this is a judging-context improvement, not a score change. A strong model needs a clear route from technical work to evaluation criteria, especially when the audience is deciding quality under time pressure. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the rubric route appears in the generated proof.

Latest checkpoint, May 22 2026 03:08 CST: promoted `Hostile Judge Cross-Exam` into a checked Quick Jump route named `Cross-Exam`. The dashboard already had hard-question answers, evidence pointers, and unsafe phrases to avoid, but now the top route points directly to `#hostile-judge-cross-exam`, and both the final-check summary and verifier require that target. Reflection: the model package is stronger if skeptical judging is treated as a first-class path, not a buried backup section. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the cross-exam route appears in the generated proof.

Latest checkpoint, May 22 2026 03:04 CST: promoted `Claim Boundaries` into a checked Quick Jump route named `Claim Safety`. The dashboard already had safe-claim versus avoid-saying language, but now the top navigation points directly to `#claim-boundaries`, and both the final-check summary and verifier require that route. Reflection: the model claim is stronger when the presentation makes its boundaries easy to find. This prevents the most dangerous failure mode in judging: making a true but modest result sound like an oracle or a best-possible proof. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the claim-safety route appears in the generated proof.

Latest checkpoint, May 22 2026 03:00 CST: promoted the `Live Demo Runbook` section into a checked Quick Jump route. The dashboard already contained the live presentation order and fallback row, but now the top route includes a `Live Demo` card pointing to `#live-demo-runbook`, and both final-check and verifier anchor guards require it. Reflection: this is another presentation-pressure fix. If the live page, timing, or judge flow gets awkward, the presenter should not have to hunt; the exact order and fallback files are now one click from the first screen. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and confirm the new route appears in the human final-check proof.

Latest checkpoint, May 22 2026 02:55 CST: added a `Documentation Proof Index` route so the Markdown deliverables are as easy to audit as the screenshot set. The dashboard now has a `Docs Proof` Quick Jump card to `#documentation-proof-index`, grouping the long-form research log, cold-handoff files, model explanation, metric docs, leakage/claim-boundary audits, judge-defense docs, strategy examples, rerun docs, and artifact inventories by purpose. Reflection: the final package already had many strong Markdown files, but a cold judge should not need to hunt through a long artifact map to know which document answers which question. This is documentation clarity, not a model-score change. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, verify the new docs route, and recheck localhost cleanup.

Latest checkpoint, May 22 2026 02:49 CST: added a `Screenshot Proof Index` route to make the twelve visual proof files audit-friendly inside the HTML itself. The dashboard now has a Quick Jump card to `#screenshot-proof-index`, a table explaining each screenshot's purpose and verifier rule, and updated anchor guards in both `npm run model:final-check` and `npm run model:verify-dashboard`. Reflection: the package had strong screenshots, but a cold reader should not have to infer why each PNG exists. This keeps the visual proof set legible without embedding screenshots into the dashboard and creating a circular screenshot-of-screenshot proof problem. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, verify the new route, and inspect screenshots again.

Latest checkpoint, May 22 2026 02:40 CST: added a focused final-gate screenshot proof for the last handoff check itself. The dashboard already had `Final Gate Proof` as a Quick Jump route to `#final-gate-proof`, but now browser QA also captures `dashboard-final-gate-screenshot.png`, the deliverables manifest names it, and both the verifier and final-check screenshot digest require its freshness and PNG dimensions. Reflection: this makes the final proof more self-contained. A teacher or judge can see the human summary card, machine summary card, and verification checklist from one screenshot fallback instead of trusting only JSON or terminal output. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, independently audit screenshot coverage and deadline proof, then inspect the focused final-gate image.

Latest checkpoint, May 22 2026 02:33 CST: added a focused starred-coverage screenshot proof for the prompt-to-dashboard checklist. The dashboard already had `Starred Coverage` as a Quick Jump route to `#starred-html-coverage`, but now browser QA also captures `dashboard-starred-coverage-screenshot.png`, the deliverables manifest names it, and both the verifier and final-check screenshot digest require its freshness and PNG dimensions. Reflection: this is a meta-proof for the final handoff: the starred items from the repeated deadline prompt are now visually auditable in one place, alongside the individual screenshots for source evidence, model anatomy, accuracy charts, story spine, and model scores. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, independently audit screenshot coverage and deadline proof, then inspect the focused starred-coverage image.

Latest checkpoint, May 22 2026 02:25 CST: added a focused accuracy-and-stats screenshot proof for the chart requirement. The dashboard now has an `Accuracy Stats` Quick Jump route to `#prediction-behavior`, browser QA captures `dashboard-accuracy-stats-screenshot.png`, the deliverables manifest names it, and both the verifier and final-check screenshot digest require its freshness and PNG dimensions. Reflection: the score-vs-actual scatter and calibration chart already existed, but now the exact accuracy visualization has the same fallback evidence discipline as the model anatomy, story spine, source evidence, print preview, and model leaderboard. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, independently audit screenshot coverage and deadline proof, then inspect the focused accuracy-stats image.

Latest checkpoint, May 22 2026 02:15 CST: added a focused model-anatomy screenshot proof for the best-model visualization requirement. The dashboard now has a `Model Visual` Quick Jump route to `#model-anatomy`, browser QA captures `dashboard-model-anatomy-screenshot.png`, the deliverables manifest names it, and both the verifier and final-check screenshot digest require its freshness and PNG dimensions. Reflection: this makes the promoted model's actual pipeline auditable from a single screenshot fallback, not only from the full HTML report. The model itself remains unchanged: Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, independently audit screenshot coverage and deadline proof, then inspect the focused model-anatomy image.

Latest checkpoint, May 22 2026 02:00 CST: added a focused story-spine screenshot proof for the refined journey-story requirement. The dashboard now has a `Story Spine` Quick Jump route to `#judge-story-spine`, browser QA captures `dashboard-story-spine-screenshot.png`, the deliverables manifest names it, and both the verifier and final-check screenshot digest require its freshness and PNG dimensions. Reflection: this does not change the model, but it strengthens the judge handoff because the narrative route now has the same screenshot fallback discipline as the source-code evidence, print preview, and model-score sections. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate, independently audit screenshot coverage and deadline proof, then inspect the focused story/source/model-score images.

Latest checkpoint, May 22 2026 01:49 CST: added a focused model-scores screenshot proof for the alternative-model visualization requirement. The dashboard already had the `Model Scores` Quick Jump route and model leaderboard tables, but now browser QA also captures `dashboard-model-scores-screenshot.png` at `#model-leaderboard`, the deliverables manifest names it, the verifier checks its freshness and PNG dimensions, and the final-check screenshot digest records it. Reflection: this makes the starred "all other models and their scores, visualized" item easier to defend from a screenshot fallback, not just from the full HTML page. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun syntax check, typecheck, final gate, independent model-score/source/manifest/deadline checks, and inspect the refreshed images.

Latest checkpoint, May 22 2026 01:44 CST: added a print-preview screenshot proof for the document-style HTML report. The dashboard already had print CSS and verifier-required print strings, but now browser QA also captures `dashboard-print-preview-screenshot.png` under print media emulation, the deliverables manifest names it, the verifier checks its freshness and PNG dimensions, and the final-check screenshot digest records it. Reflection: this strengthens the starred "report inside an HTML file" requirement with visual evidence rather than only CSS text checks. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun syntax check, typecheck, final gate, independent print/source/manifest/deadline checks, and inspect the refreshed images.

Latest checkpoint, May 22 2026 01:33 CST: added a focused visual proof for the source-code evidence lock. The browser-QA command now captures `dashboard-source-evidence-screenshot.png`, the deliverables manifest names it, the verifier requires its browser-QA path plus PNG dimensions, and the final-check screenshot digest includes it alongside the hero/mobile/full-page screenshots. Reflection: the previous pass made the code evidence visible in HTML; this pass makes it screenshot-verifiable for a fallback presentation or quick judge audit. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun syntax check, typecheck, final gate, independent screenshot/source/manifest/deadline checks, and inspect the refreshed images.

Latest checkpoint, May 22 2026 01:24 CST: promoted the source-code evidence digest into the visible HTML route. The final-check proof already recorded the exact six source paths and hashes, but the dashboard itself now has a `Code Evidence` jump card and a `Source Code Evidence Lock` section that lists the same locked source set: model training code, walk-forward features, diagnostics, report scoring, CLI, and the research log. The verifier and final-check navigation digest now require `#source-code-evidence-lock`, so this proof route cannot silently disappear. Reflection: this turns the "best model code" claim into something a judge can see immediately in the report, while still keeping the honest boundary that hashes prove package identity, not model perfection. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun syntax check, typecheck, final gate, independent source/manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 01:07 CST: added a first-class source-code evidence digest to the final-check proof. The final package already fingerprinted the model code, but now `final-check-summary.json` and `FINAL_CHECK_SUMMARY.md` explicitly report the core source paths and their hashes: training code, walk-forward features, diagnostics, report scoring, CLI, and the research log. The dashboard verifier now fails if that digest is missing, if a source file is missing, or if the final-check digest no longer matches `artifact-fingerprints.json`. Reflection: this directly strengthens the "best model code" deliverable instead of leaving it implicit in the fingerprint table. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun syntax check, typecheck, final gate, independent source/manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:57 CST: pushed the exact Quick Jump route proof into the final-check digest itself. The `model:final-check` runner now writes `navigationAnchors` into `final-check-summary.json`, including required targets, found targets, missing required targets, and missing section IDs; `FINAL_CHECK_SUMMARY.md` prints the same target list for humans. The dashboard verifier now fails if this final-check digest is absent, wrong, or missing `#starred-html-coverage`. Reflection: the final proof is now less scattered. A judge can open the final-check summary and see the navigation route, not just trust that the separate verifier knew it. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, final gate, independent manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:51 CST: made the human verification summary list the exact checked Quick Jump anchor targets. The verifier already enforced the required five anchors, but `VERIFICATION_SUMMARY.md` only reported the count. It now writes the target names too: `#final-gate-proof`, `#final-package-map`, `#model-leaderboard`, `#what-should-surprise`, and `#starred-html-coverage`. Reflection: this improves cold-reader auditability. A teacher or judge can now open the proof summary and see which navigation route was checked without reading TypeScript. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, final gate, independent manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:47 CST: made the Quick Jump route verifier exact instead of count-only. The dashboard verifier now requires the five named in-page targets `final-gate-proof`, `final-package-map`, `model-leaderboard`, `what-should-surprise`, and `starred-html-coverage`; the regression test now catches a page with five valid anchors if the starred coverage route is swapped out. Reflection: this closes a small but real navigation loophole. A dashboard could previously have five valid links while losing the one link that matters for the starred prompt audit. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, final gate, independent manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:36 CST: promoted the starred-requirements proof into the checked Quick Jump route. The dashboard now has a `Starred Coverage` jump card that links directly to the `Starred HTML Coverage` section, and the in-page anchor guard plus regression test now require at least five checked jump targets instead of four. Reflection: this is a navigation-safety improvement, not a model-score change. If a judge asks, "Where did you satisfy the starred HTML requirements?", the answer is now one click from the top of the report and protected by tests. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, the full final gate, independent manifest/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:29 CST: added a visible `Starred HTML Coverage` proof section to the final dashboard. The package already had the detailed deadline deliverables checklist, but this pass makes the HTML itself say, near the top, that every starred prompt item is represented inside the dashboard: best-model visualization, alternative model scores, refined journey story, accuracy/stat visuals, document-style report, judge notes, and surprises. The verifier and browser QA now require that section, so it cannot silently disappear from the rendered handoff. Reflection: this is presentation-integrity work rather than model math. The final package should make the user request easy to audit without asking a judge to infer coverage from scattered sections. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, rerun the full final gate, independently audit manifest/port/deadline coverage, and inspect screenshots.

Latest checkpoint, May 22 2026 00:24 CST: strengthened the deadline proof cross-check inside the final dashboard verifier. The final-check summary already declares `deadlineProof.generatedBeforeDeadline: true`, but the verifier now also computes the deadline comparison directly from `generatedAt` against `2026-05-22T18:00:00+08:00`. Reflection: this makes the deadline evidence less self-referential. A stale or hand-edited boolean is no longer enough; the timestamp itself must land before Friday May 22 2026 18:00 CST. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, final gate, independent manifest/port/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:19 CST: added explicit before-deadline proof to the final-check summary. The machine-readable `final-check-summary.json` now includes a top-level `deadlineProof` with the target deadline, local deadline timestamp, and `generatedBeforeDeadline: true`; the human-readable `FINAL_CHECK_SUMMARY.md` has a matching Deadline Proof section. The verifier now fails if the JSON proof is missing, points to the wrong deadline, or says the run was not generated before Friday May 22 2026 18:00 CST, and it also checks that the human summary says `Generated before deadline: yes`. Reflection: this closes a subtle handoff gap. Freshness alone is not the same as deadline compliance; now the final proof says both. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, final gate, independent manifest/port/anchor/deadline checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:13 CST: added local CST/Asia-Shanghai time to the final-check proof. The machine summary now records both `generatedAt` in UTC and `generatedAtLocal` as `CST (Asia/Shanghai, UTC+08:00)`, and the human-readable `FINAL_CHECK_SUMMARY.md` prints both. The verifier now fails if the JSON local timestamp is missing or not explicitly in the deadline timezone, and it also checks that the human summary contains the local generated-time line. Reflection: this is a deadline-handoff improvement. The package already proved freshness, but a judge or teacher reading the final proof should not have to mentally convert UTC near a hard CST deadline. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, the full final gate, independent manifest/port/anchor checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:07 CST: raised the final-check test-count floor from 37 to 38 after adding the anchor-guard regression test. The final-check runner and dashboard verifier now both require at least 38 tests in the `testSuiteHealth` digest, so the newest navigation-safety test cannot quietly disappear while the package still reports a passed gate. Reflection: this is a small but important maintenance step. Whenever the suite grows to protect a real handoff risk, the final gate should remember the new floor. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, the full final gate, independent manifest/port/anchor checks, and screenshot inspection.

Latest checkpoint, May 22 2026 00:03 CST: added direct unit coverage for the dashboard in-page anchor guard. The verifier already checked the Quick Jump anchors in the generated HTML, but the guard itself was not tested in isolation. I split the anchor logic into a pure helper, added a test that accepts four valid jump targets and flags a broken target plus too-few-link case, and kept the final verifier using the same helper. Reflection: this is a small quality move, but it is the right kind of small: the final package now tests the safety rail that protects the live judge navigation route. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, tests, final gate, and independent cleanup/screenshot checks.

Latest checkpoint, May 21 2026 23:58 CST: added a verifier check for in-page dashboard navigation anchors. After adding the Quick Jump route, the next failure mode was simple but embarrassing: a link could point to a missing section while the page still looked fine. The verifier now extracts every `href="#..."` target in `index.html`, compares it against actual section IDs, requires at least four checked jump targets, writes the anchor-target count into `VERIFICATION_SUMMARY.md`, and the CLI prints that count during `npm run model:verify-dashboard`. Reflection: this is another handoff-integrity improvement. It protects the live judge route from silent navigation drift without changing the model. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, the full final gate, and independent cleanup/screenshot checks.

Latest checkpoint, May 21 2026 23:54 CST: added print-ready CSS to the generated HTML dashboard and made the verifier require it. The dashboard already works well in a browser, but the prompt asks for a document-like HTML report, and teachers or judges may print it or save it as a PDF. The new print rules preserve color intent, remove fragile browser-only shadows, tighten table spacing, protect cards and headings from awkward page breaks, and keep the report readable on paper without changing the model claim. Reflection: this is final-delivery polish, not model research. The package should survive both live browser inspection and a static printed handoff. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser screenshots, rerun the final gate, and inspect the first-screen screenshots.

Latest checkpoint, May 21 2026 23:48 CST: added a `Quick Jump` route near the top of the HTML dashboard. The report had all the proof sections, but under judge pressure a long page still makes people hunt; the new route links directly to Final Gate Proof, Final Package Map, Model Scores, and Judge Surprises. I anchored those destination sections and made browser QA plus the verifier require the quick-route labels, so this navigation layer is checked rather than purely cosmetic. Reflection: this is presentation ergonomics, not model math. The strongest package is the one that lets a cold reader find the proof quickly and still keeps the claim bounded. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser screenshots, rerun typecheck/tests/verifier through the final gate, and inspect the screenshots.

Latest checkpoint, May 21 2026 23:43 CST: added a `Final Gate Proof Route` section to the dashboard itself. The package already had `FINAL_CHECK_SUMMARY.md` and `final-check-summary.json`, but a cold reader opening only `index.html` still had to discover where the final passed proof lived. The new section points directly to the human proof, machine proof, test-suite health digest, browser-QA digest, screenshot dimensions, deliverables coverage, and second verifier run, while repeating that this proves package consistency rather than model perfection. I also made browser QA and the verifier require the new section text so it cannot silently disappear. Reflection: this is not model math; it is handoff ergonomics. Judges often start with the pretty HTML, so the HTML should route them to the strongest audit artifacts without making them hunt. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser screenshots, rerun typecheck/tests/verifier through the final gate, and inspect the screenshots.

Latest checkpoint, May 21 2026 23:36 CST: added a test-suite health digest to the final-check proof. The runner now parses the `npm run test` output into `testSuiteHealth` inside `final-check-summary.json`, displays the pass count directly in `FINAL_CHECK_SUMMARY.md`, and the verifier requires the command, exit code, pass/fail/cancelled counts, and at least the current 37-test floor to remain consistent. Reflection: this is a small but useful auditability upgrade. The final gate already ran the tests, but a judge should be able to read the proof file and see the suite count immediately without interpreting terminal output. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the full final gate and inspect the refreshed human summary, manifest coverage, screenshots, and no-server cleanup.

Latest checkpoint, May 21 2026 23:30 CST: added direct test coverage for the overclaim wording guard. The verifier now exposes a small `findOverclaimWordingIssues` helper, and the modeling test suite checks that unsafe positive claims are flagged while warning phrasing and dedicated audit examples remain allowed. Reflection: the first overclaim guard pass was useful, but a guard that protects final presentation wording should itself be tested. This keeps the claim-boundary layer from becoming a fragile one-off regex hidden inside the verifier. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun typecheck, tests, and the final gate so the generated dashboard and proof summaries include the tested verifier.

Latest checkpoint, May 21 2026 23:24 CST: added a package-wide overclaim wording guard to the verifier. The final package already had claim-boundary docs, but this pass makes the guard executable: `npm run model:verify-dashboard` now scans generated HTML and Markdown lines for dangerous positive claims like "best possible model", "model is accurate", win-guarantee wording, or "verifier proves model correctness", while allowing those phrases only when they appear inside explicit warning, do-not-say, unsafe, or overclaim contexts. Reflection: this is another presentation-integrity improvement, not a model-score change. The final model is strongest when the package can prove both what we found and what we refuse to overstate. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate so the new wording guard checks the full generated handoff package.

Latest checkpoint, May 21 2026 23:12 CST: added a human-readable final-check summary beside the machine JSON proof. The final-check runner now writes `FINAL_CHECK_SUMMARY.md` with the promoted model claim, command steps, post-checks, browser-QA counts, screenshot dimensions, and final verifier status, then the dashboard generator lists it in `deliverables.json`, `DELIVERABLES.md`, and the final package map. I also made `npm run model:verify-dashboard` require the file, require the package map to mention it, and validate the key proof text so it cannot silently drift from `final-check-summary.json`. Reflection: this does not change the model, but it makes the last-mile audit kinder to humans. A judge or teacher should not need to parse JSON to see that the local handoff gate actually ran and what it proved. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate and inspect the generated human summary plus refreshed screenshots.

Latest checkpoint, May 21 2026 23:06 CST: improved failure reporting for the final gate. After adding header-level browser QA, the standalone `npm run model:qa-dashboard` command still printed only body-text misses, and `scripts/model-final-check.mjs` wrote detailed post-check failures into JSON without printing the specific failed category to the terminal. I patched the QA command so it reports missing body text, missing header text, stale forbidden matches, outside-table offenders, overflow, console issues, and page errors, and exits nonzero when any of those checks fail. I also made the final-check runner print concise post-check failure bullets, including header-text counts, before exiting. Reflection: this does not change the model, but it makes the proof workflow more humane under deadline pressure. A failed gate should tell the presenter what broke immediately, not require spelunking through JSON while nervous. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate so the generated dashboard, docs, fingerprints, screenshots, and final proof summary all reflect the clearer QA reporting.

Latest checkpoint, May 21 2026 22:58 CST: promoted the handoff snapshot into the dashboard hero and made browser QA check it at the header level. The first screen now shows the deadline target, the one-command final gate, and the bounded claim before anyone scrolls. I also added a separate `missingHeaderText` check to the browser-QA summary and final-check digest, so `npm run model:verify-dashboard` fails if the hero stops containing the current verdict, deadline, final gate, or claim boundary. The first final-gate attempt caught that the new guard was using a brittle rendered-text extraction; I switched the header guard to read `textContent`, then reran the full gate successfully. Reflection: this is a judge-readiness improvement, and the verifier catching the first attempt was a good sign. The package already had the information, but important proof that lives below the fold can be missed under presentation pressure. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: inspect desktop/mobile screenshots to confirm the first-screen handoff is readable.

Latest checkpoint, May 21 2026 22:49 CST: added a separate mobile first-screen screenshot to the final visual proof set. The browser-QA command now writes `dashboard-mobile-hero-screenshot.png` in addition to the desktop hero, mobile full-page, and desktop full-page screenshots. I updated the verifier, final-check screenshot digest, deliverables manifest, reference audit, package-map wording, and presentation fallback docs so the new artifact is required and documented rather than orphaned. Reflection: the old mobile full-page screenshot was useful for overflow auditing but awkward for quick human inspection because it is extremely tall. The package now has a mobile proof image that a judge or teacher can actually read at first glance, while still preserving the full-page mobile audit evidence. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate so the new screenshot is generated, manifested, browser-checked, and verified.

Latest checkpoint, May 21 2026 22:43 CST: made the final-check proof less circular. The runner now writes an `awaiting_verifier` summary, runs `npm run model:verify-dashboard`, writes a final `passed` summary containing the verifier result, and then runs the verifier a second time so that the final passed summary is itself checked. The verifier now accepts the temporary awaiting state during the first pass and requires the final passed summary to contain a passed verifier result plus the second-run validation marker. Reflection: this is a small but important proof-shape fix. The summary no longer merely says "a verifier will run"; the final artifact says a verifier did run, and the package has a fresh verifier summary produced after that final proof file existed. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate and inspect the final summary status.

Latest checkpoint, May 21 2026 22:38 CST: added the promoted-model claim digest to `final-check-summary.json`. The final-check runner now copies the deadline target, displayed model name, internal model config, and headline metrics from `deliverables.json` into the machine-readable final proof, and `npm run model:verify-dashboard` validates those values against the locked Conservative TailGuard Strong RoleV3 metrics. Reflection: this makes the final summary stand on its own better. A reader can inspect one JSON proof file and see both what was verified and exactly which model claim the verification applies to. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the final gate and inspect the updated digest.

Latest checkpoint, May 21 2026 22:35 CST: expanded `final-check-summary.json` from command/pass coverage into a compact handoff proof digest. The final-check runner now records browser-QA health counts, desktop/mobile overflow status, console/page-error counts, and PNG screenshot dimensions, in addition to no-server cleanup, deliverables coverage, and entry-point command checks. I tightened the verifier so it fails if those digest fields disappear or report nonzero browser issues or undersized screenshots. Reflection: this makes the final summary useful by itself instead of only pointing to other files. The detailed browser summary and screenshots remain the source evidence, but the one-command gate now gives judges a concise machine-readable proof that the visual package was checked. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the strengthened final gate and inspect the generated proof digest.

Latest checkpoint, May 21 2026 22:31 CST: folded the final manual cleanup audit into `npm run model:final-check`. The runner now writes post-checks into `final-check-summary.json`: port 4177 must be closed after browser QA, every generated file in the final dashboard folder must be represented in `deliverables.json`, every manifest path must exist on disk, and the main entry-point docs must still mention `npm run model:final-check`. I tightened `npm run model:verify-dashboard` so it fails if those post-check fields are missing or false, and updated the generated package wording to explain what the final-check summary proves. Reflection: this removes another hidden chat-only ritual. The package now captures the cleanup checks I was doing manually, which is better for a real handoff. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: run the strengthened final gate and inspect the generated summaries/screenshots one more time.

Latest checkpoint, May 21 2026 22:19 CST: upgraded `npm run model:final-check` from a shell chain into a small Node runner that leaves machine-readable proof in the final handoff folder. The new `scripts/model-final-check.mjs` runs dashboard regeneration, browser QA/screenshot refresh, modeling typecheck, and tests, writes `final-check-summary.json`, then runs the package verifier after that summary exists. I added the runner and summary to the generated package map, deliverables manifest, source map, fingerprints, and verifier requirements, so the final package now proves not only that artifacts exist, but that the final gate itself recorded its passed pre-verifier steps. Reflection: this improves auditability without changing the model. It makes the package easier to defend because the one-command gate now leaves an evidence artifact instead of only terminal scrollback. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: run the upgraded final gate and final independent checks.

Latest checkpoint, May 21 2026 22:15 CST: tightened the first-open documentation around the new one-command final gate. After adding `npm run model:final-check`, I checked the generated entry points and found the detailed QA/runbook pages named it, but the coldest handoff surfaces could still send someone into the older multi-command sequence. I updated `OPEN_THIS_FIRST.md`, `README.md`, `DELIVERABLES.md`, and the evidence matrix generation so a teammate, teacher, or judge sees the one-command gate immediately, and I made the verifier require `OPEN_THIS_FIRST.md` to contain that command. Reflection: this is a small documentation move, but it protects the final package from a very human failure mode: remembering the wrong sequence under pressure. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: rerun the one-command final gate and final outside-the-pipeline checks.

Latest checkpoint, May 21 2026 22:10 CST: added a one-command final handoff gate. The package already had separate commands for dashboard regeneration, browser QA/screenshot refresh, package verification, modeling typecheck, and tests, but a presenter under deadline pressure should not have to remember the exact sequence. I added `npm run model:final-check` to `package.json`, wired the dashboard/report text to name it as the fastest audit route, added `package.json` to the source map and reference targets, and made the verifier require the new command to appear in the rendered dashboard and browser QA text. Reflection: this is not a model-score change; it is an operational reliability improvement. The final package now has a single command that rebuilds the evidence, refreshes the visual proof, verifies the manifest/fingerprints, and runs code tests before judging. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: run `npm run model:final-check`, then do final no-server, manifest, QA-summary, and screenshot-dimension checks.

Latest checkpoint, May 21 2026 22:05 CST: tightened the repeatable browser-QA audit one more step before handoff. The final cleanup audit already showed no open server on port 4177, fresh screenshot/summary files, and a clean `deliverables.json` to folder match, but I noticed the browser-QA JSON did not record explicit per-viewport page metadata. I added `page.url` and `page.viewport` to both desktop and mobile checks and made `npm run model:verify-dashboard` fail if those local-browser metadata fields disappear or point at the wrong viewport. Reflection: this is small, but it improves the evidence trail. A future reader can now see not only that Chrome passed the QA gate, but exactly which local URL and viewport dimensions produced the proof screenshots. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, rerun browser QA, verifier, typecheck, tests, and final no-server/manifest checks.

Latest checkpoint, May 21 2026 22:00 CST: completed the verification loop for the new repeatable browser-QA command. After adding `npm run model:qa-dashboard`, I regenerated the dashboard, ran the new command, fixed one verifier-caught bug where the Playwright page metric function was defined but not invoked, regenerated again after adding the command source to the fingerprint set, and reran the full handoff gate. The current pass is clean: `npm run model:qa-dashboard` reports 0 missing required text, 0 forbidden stale phrases, 0 console issues, and 0 page errors; `npm run model:verify-dashboard` passes with 48 files, 52 required dashboard strings, 44 Markdown files, 60 manifest paths, 24 reference paths, fresh browser QA, 59 fingerprints, and 3 screenshot-dimension checks; `npm run model:typecheck` passes; `npm run test` passes 36/36. The saved screenshots are current at hero 1440x1100, mobile 780x98478, and full page 1440x64574, and port 4177 has no lingering local server. Reflection: the verifier catching the first QA-summary shape bug was a good sign. The package now has a closed loop: generate, browser-check, verify, typecheck, test, with the browser-check code itself documented and fingerprinted. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: preserve this stable handoff unless a new change removes a real judge-facing ambiguity.

Latest checkpoint, May 21 2026 21:48 CST: turned the browser-QA and screenshot refresh step from an ad hoc Playwright snippet into a repeatable local command. I added `modeling/src/reporting/browserQaDashboard.ts`, exposed it through `npm run model:qa-dashboard`, and wired the generated dashboard docs, model source map, reference integrity audit, final package map, manifest, and verifier requirements to that command. The command starts a local static server for the generated dashboard, opens Chrome through Playwright, checks required body text and stale forbidden wording, checks desktop/mobile overflow, captures console/page errors, refreshes `browser-qa-summary.json`, writes the hero/mobile/full-page screenshots, and closes the server. Typecheck initially caught DOM globals inside browser-side Playwright callbacks because the modeling TS config intentionally uses Node libs only; I fixed that by moving those checks into string-evaluated browser functions. Reflection: this is exactly the kind of final-hand-off hardening that matters under deadline pressure. The package no longer depends on hidden chat-only browser QA code; a teacher, judge, teammate, or future me can reproduce the screenshot proof from a named npm command. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, run the new browser-QA command, run the verifier/typecheck/tests, and confirm no localhost process remains open.

Latest checkpoint, May 21 2026 21:42 CST: completed the full regeneration and verification pass for the fingerprint-scope wording audit. I regenerated `modeling/artifacts/reports/final-judge-dashboard/`, refreshed local Chrome QA through `http://127.0.0.1:4177/`, rewrote `browser-qa-summary.json`, and refreshed the hero, mobile, and full-page dashboard screenshots. Browser QA found 0 missing required text strings, 0 forbidden stale phrases, 0 page-overflow issues, 0 console errors, and 0 page errors. `npm run model:verify-dashboard` passes with 48 files, 51 dashboard strings, 44 Markdown files, 59 manifest paths, 23 reference paths, fresh browser QA, 58 fingerprints, and 3 screenshot-dimension checks; `npm run model:typecheck` passes; `npm run test` passes 36/36. I also rechecked the generated final folder against `deliverables.json`: 52 files, 52 manifest paths, no missing files, and no orphaned files. Reflection: the score did not change, which is exactly the right outcome for a wording-integrity pass. The package is now clearer about which artifacts are hashed and which are verified by browser freshness/dimension gates. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: keep polishing only if it removes real ambiguity; otherwise preserve the stable handoff state.

Latest checkpoint, May 21 2026 21:32 CST: continued the fingerprint-scope audit from the generated fingerprint artifact into the full judge-facing package. The earlier scope note was correct, but several dashboard/report phrases still used "fingerprinted" broadly enough that a cold reader might think browser QA summaries, screenshots, and `VERIFICATION_SUMMARY.md` are hashed in the regeneration-time fingerprint table. I patched the dashboard generator so public wording now says source/generated text artifacts are fingerprinted, while browser QA, screenshots, and verifier summaries are separately checked for freshness, paths, and PNG dimensions. I also tightened the verifier so the rendered HTML and browser QA must include the new text-package boundary. Reflection: this is a small language change with a high integrity payoff. The package now explains each proof mechanism with less hand-waving, which makes it easier for a skeptical judge to trust the handoff without over-reading the hashes. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and confirm the generated docs no longer imply screenshots are part of the fingerprint table.

Latest checkpoint, May 21 2026 21:26 CST: audited fingerprint and integrity wording after the manifest/package-map completeness pass. The generated fingerprint table was correct for source files and generated text/package artifacts, but its wording could be read as if browser QA, screenshots, and `VERIFICATION_SUMMARY.md` were also part of the regeneration-time hash table. That would be misleading because those files are refreshed after generation and are verified through freshness, path, and PNG-dimension checks instead. I patched `ARTIFACT_FINGERPRINTS.md` generation to state that scope boundary directly, changed the "How To Use This" instruction to say text-package hash changes require refreshed browser QA/screenshots and rerunning the verifier, and made the verifier require the scope-boundary sentence. Reflection: this is another communication-integrity improvement. The package is stronger when it says exactly what each integrity control proves instead of letting "fingerprinted" become a vague magic word. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and confirm the new fingerprint scope wording appears in the final artifact.

Latest checkpoint, May 21 2026 21:18 CST: audited package-map completeness after tightening rendered dashboard QA. The final dashboard folder had strong human and visual routes, but the machine-readable `deliverables.json` still did not list the package `README.md`, `DELIVERABLES.md`, or itself, and the visible Final Package Map did not explicitly call out the README, deliverables manifest, browser-QA summary, or fingerprint JSON. I patched the dashboard generator so `deliverables.json` now includes `readme`, `deliverablesMap`, and `deliverablesManifest`, and the HTML Final Package Map now names the package README, human deliverables map, machine-readable manifest, browser QA summary, and fingerprint manifest. I also expanded the verifier's required manifest keys so the manifest must explicitly expose every major generated handoff artifact instead of only failing later as a generic missing path, and made static HTML/browser QA require the new package-map entries. Reflection: this is final-packaging work, not a model improvement, but it matters because the package should survive without this chat. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and re-run the manifest-vs-folder audit to confirm no important local artifact is orphaned.

Latest checkpoint, May 21 2026 21:14 CST: audited the rendered-dashboard QA contract after tightening the short-route Markdown. The HTML already had the new Open This First Handoff Snapshot, but the verifier's required dashboard strings and browser-QA required text still only checked the broader deadline/model/metric fragments. I patched the verifier so both static HTML verification and browser QA now require `Handoff Snapshot`, `Deadline target`, and `Headline accuracy` in the rendered dashboard. Reflection: this is a small guardrail, but it closes an easy regression: a future edit could accidentally remove the visible first-open snapshot while leaving the raw words elsewhere in the page. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard so the verifier fingerprint updates, refresh browser QA/screenshots with the new required text list, rerun verifier/typecheck/tests, and keep looking for package surfaces where visual proof and documentation could diverge.

Latest checkpoint, May 21 2026 21:09 CST: audited the shortest presentation routes after adding the standalone Handoff Snapshot to `OPEN_THIS_FIRST.md`. The cover sheet, README, manifest, and deadline checklist had the exact Friday May 22 2026 18:00 CST target, but `PRINTABLE_HANDOUT.md`, `JUDGE_BRIEF.md`, `PRESENTATION_SCRIPT.md`, and `FIRST_90_SECONDS.md` could still be opened cold without immediately showing the deadline. I patched the dashboard generator so each of those short-route artifacts now starts with a compact delivery-target line and points back to the correct first-open route. I also tightened the verifier so those four files fail verification if the exact deadline line disappears. Reflection: this is another final-handoff improvement rather than a model-score improvement. It reduces the chance that the fastest docs drift from the deadline-aware package story. Current best model remains Conservative TailGuard Strong RoleV3, with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and continue searching for any remaining short-route ambiguity.

Latest checkpoint, May 21 2026 20:55 CST: audited the "open this first" route after making the machine-readable manifest standalone. `README.md` and `deliverables.json` now carried the exact Friday May 22 2026 18:00 CST deadline, the promoted short model name, and headline metrics, but `OPEN_THIS_FIRST.md` still asked a cold reader to open the dashboard before giving them the full snapshot directly. I patched the dashboard generator so the cover sheet now starts with a Handoff Snapshot: deadline, promoted model, internal config, 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, 0.130 deployment score, and the "best defended local model, not a perfect oracle" boundary. I mirrored that snapshot in the HTML Open This First section and made the verifier fail if those cover-sheet lines disappear. Reflection: this is a handoff-quality improvement, not a score improvement. It means a judge can open one Markdown file cold and recover the exact deadline, model, metrics, and claim boundary without relying on this chat or hunting through the dashboard. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and keep checking for any final surface that still hides essential context behind another click.

Latest checkpoint, May 21 2026 20:50 CST: audited the machine-readable deliverables manifest after improving the human deadline checklist. The Markdown handoff now had the exact Friday May 22 2026 18:00 CST deadline and the short promoted model name, but `deliverables.json` still only exposed the long internal model configuration and artifact paths. I patched the dashboard generator so the manifest now includes `deadlineTarget`, `currentDisplayedModelShortName`, and a display-ready `headlineMetrics` object with 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. I also tightened the dashboard verifier so it fails if those manifest fields drift or disappear. Reflection: this makes the final package more standalone and less dependent on the HTML or this chat. A teacher, judge, script, or future teammate can inspect `deliverables.json` and immediately recover the deadline, promoted short name, metrics, and artifact map. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard so the manifest and fingerprints include these new fields, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and continue looking for any final handoff surface that still depends on implicit context.

Latest checkpoint, May 21 2026 20:44 CST: audited the final handoff and deadline-deliverable layer rather than the model math. The package already mapped every requested deliverable, but `DEADLINE_DELIVERABLES_CHECKLIST.md` only said "May 22" without the exact Friday May 22 2026 18:00 CST deadline, and `DELIVERABLES.md` ended with the long internal model configuration name without also showing the friendly promoted name. I patched the dashboard generator so the deadline checklist and dashboard deadline section now state the exact deadline, the checklist has a fast submission order, and both `README.md` and `DELIVERABLES.md` include the short promoted name: Conservative TailGuard Strong RoleV3. I also made browser QA require the deadline text so the handoff cannot regress to a vague date. Reflection: this is not a modeling improvement, but it is a final-delivery improvement. A judge, teacher, or teammate should be able to open the folder without this chat and immediately know the deadline target, the first file to open, the exact promoted short name, and the verification path. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and continue hardening the package as a standalone handoff artifact.

Latest checkpoint, May 21 2026 20:35 CST: ran a scout/PPC wording precision pass after the direct ScoutGate/RoleGate cross-exam update. The package was factually correct, but one visible dashboard Q&A card still said "Real scout/PPC data would be the most valuable next signal," and one hard-question answer said "Matched scout/PPC data..." without the word "broader." That could accidentally imply we still have no scout data, even though the current evidence is 356 matched Firebase rows with sparse, concentrated coverage. I patched the dashboard generator so all next-step language now asks for broader timestamped scout/PPC coverage or broader matched scout/PPC data, and I changed a hard-question defense answer from "missing scout rows are disclosed" to "sparse scout/PPC coverage is disclosed rather than stretched beyond the matched rows." I also added verifier copy-quality guards for the old ambiguous next-step phrases and made browser QA require "Broader timestamped scout/PPC coverage." Reflection: this is the kind of tiny wording issue that can matter in judging. The model decision did not change, but the story now threads the needle more cleanly: scouting data exists, it is useful evidence, and the next improvement is broader timestamp-safe coverage rather than pretending the current cache is zero. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and keep hunting for wording that is true but too easy to misunderstand.

Latest checkpoint, May 21 2026 20:28 CST: ran another judge-skeptic pass focused on direct cross-exam readiness. The package already explained scouting data honestly, but the pressure sheets did not yet give a clean answer to the obvious judge question: "if ScoutGate and RoleGate are newer or stricter, why are they not the final model?" I patched the dashboard generator so `PRESENTATION_WORDING_AUDIT.md`, `HOSTILE_JUDGE_CROSS_EXAM.md`, the visible dashboard Q&A, the hard-question table, and `JUDGE_QA.md` now answer that directly: recency is not the promotion rule; ScoutGate helped dense scout-heavy checks, RoleGate improved audit discipline, but neither produced holdout-confirmed evidence strong enough to replace Conservative TailGuard Strong RoleV3. I also made the dashboard verifier require the exact "Why not promote ScoutGate or RoleGate?" wording in browser QA, so this direct answer cannot disappear silently. Reflection: this is a presentation-defense improvement, not a model-score improvement. Judges often ask about the newest branch first; the answer now rewards methodological discipline instead of sounding like we ignored the latest work. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and keep searching for any remaining place where the story might be easier to attack than it needs to be.

Latest checkpoint, May 21 2026 20:19 CST: audited the shortest handoff artifacts: `PRINTABLE_HANDOUT.md`, `JUDGE_BRIEF.md`, `PRESENTATION_SCRIPT.md`, `FIRST_90_SECONDS.md`, and `JUDGE_STORY_SPINE.md`. The metric and sparse-scout story were already current, but the one-page handout, judge brief, and speaking script did not yet carry the newest ScoutGate/RoleGate lesson. I patched the dashboard generator so those short routes now say ScoutGate was promising on dense scout-heavy checks but fragmented in holdouts, and RoleGate improved audit discipline without becoming the promoted model. Reflection: this is not a model improvement, but it is a presentation-quality improvement. Judges often only read the first one or two pages; those pages now contain the latest rejected-branch evidence instead of only the older SelectiveTailGuard story. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and keep the short-route docs aligned with the long research log.

Latest checkpoint, May 21 2026 20:14 CST: strengthened the final-package stale-wording guard after the cold-reader scout/PPC fix. I added a new `PRESENTATION_WORDING_AUDIT.md` row that explicitly replaces "we have no scout/PPC data" with the current, evidence-backed wording: 356 matched Firebase scout rows, sparse and concentrated, not enough to promote a global scout-driven model. I also upgraded the dashboard verifier's copy-quality patterns so generated files fail if old phrases such as "missing scout/PPC rows", "0 cached scout rows", "Firebase scout ingest is currently blocked", or "0 scout-enriched rows" come back. Reflection: this does not change the model score, but it turns a manual cleanup into a repeatable guardrail. The package now protects one of the most important story updates automatically: scouting evidence exists, but it is coverage-limited. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and then keep auditing for any other high-risk short-route wording.

Latest checkpoint, May 21 2026 20:01 CST: ran a cold-reader presentation audit on the generated final package. The package was mostly coherent, but `JUDGE_WALKTHROUGH.md` still used stale wording that implied scout/PPC rows were missing. That is no longer true after the Firebase import fix and coverage audit: the accurate story is 356 matched Firebase scout rows, concentrated mostly in 2026mnum, useful as sparse supporting evidence but not enough to promote a new global point model. I patched the dashboard generator so the fast judge walkthrough now says exactly that, and it also includes the latest ScoutGate/RoleGate lesson: ScoutGate is promising but fragmented, and RoleGate improved audit discipline without becoming the promoted model. I then made the verifier require those corrected phrases in browser QA so this stale wording cannot quietly return, and marked older "0 scout rows" research-log caveats as superseded historical notes. Reflection: this is a small wording fix, but it matters because judges often read the short route first; a stale limitation in the first walkthrough can weaken the whole package. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun verifier/typecheck/tests, and continue looking for stale short-route wording before trying any new expensive model branch.

Latest checkpoint, May 21 2026 19:56 CST: completed a final-package polish pass after the RoleGate research branch. I updated the dashboard generator so `What Should Surprise Judges` now explicitly says the stricter RoleGate branch improved audit integrity but did not earn promotion, and that the 356 matched Firebase scout rows are real evidence without being broad enough to act like magic. I also added the RoleGate report to the final package map and `deliverables.json`, then tightened the verifier so `latestCrossRunSummary`, `firebaseScoutEnrichmentSummary`, `scoutGateSummary`, `roleGateSummary`, and `What Should Surprise Judges` are checked as formal handoff requirements. Regenerated `modeling/artifacts/reports/final-judge-dashboard/`, refreshed Chrome QA and the hero/mobile/full-page screenshots, and reran the gates: `npm run model:verify-dashboard` passes with 48 files, 42 dashboard strings, 44 Markdown files, 56 manifest paths, 23 reference paths, fresh browser QA, 58 fingerprints, and 3 screenshot-dimension checks; `npm run model:typecheck` passes; `npm run test` passes 36/36. Reflection: this prompt was not a new model improvement; it was a story-integrity improvement. That matters because the final package now presents the latest lesson clearly: a stricter, more careful model branch can still be rejected if it does not survive holdout confirmation. Current best model remains Conservative TailGuard Strong RoleV3, with headline final-package quality of 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: unless a genuinely new timestamp-safe data source appears, spend remaining time on final-package rehearsal, copy tightening, and checking that every judge-facing claim has a nearby evidence path.

Latest checkpoint, May 21 2026 19:43 CST: implemented and rejected the stricter ScoutGate RoleGate branch. The modeling code now has a parallel RoleV3Gated feature family: scout defense enters role reasoning through `scoutGatedDefense` instead of raw scout defense, the scout confidence bonus scales with scout defense confidence, and the gated role summary only selects a defender when pre-match role confidence is at least 0.35. I added exact RoleGate configs, new experiment manifests, and a no-future test assertion proving sparse scout evidence is shrunk in gated role features. Validation: `event-2026mnum` did not reward RoleGate; plain Strong RoleV3 still won the focused scout-dense event. Full 2026 gave RoleGate TailGuarded a tiny relative win at 60.26 score MAE, 82.63 margin MAE, 0.1572 Brier, and 103.80 max worst-event MAE, but that was the familiar near-tie trap. I then ran 2026 holdout buckets 0, 1, and 2 and generated `modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md`. Bucket 0 favored RoleGate TailGuarded by relative score, but bucket 1 and bucket 2 favored plain ScoutGate TailGuarded by both relative/fixed leadership; the report states the full-2026 RoleGate winner is not confirmed, with only 1/3 relative holdout wins and 0/3 fixed holdout wins. Reflection: this was a good safety experiment because it closed a subtle pathway where raw scout defense could leak into "gated" model variants through role features. But it is not a final-model upgrade. Current best model remains Conservative TailGuard Strong RoleV3, and the RoleGate result should be presented as a rejected regularization branch that improved auditability more than prediction quality. Next: regenerate the final dashboard so the research atlas and reference map include RoleGate, refresh browser QA/screenshots, and rerun verifier/typecheck/tests.

Latest checkpoint, May 21 2026 18:40 CST: completed the ScoutGate handoff verification pass. After regenerating the judge dashboard with the new ScoutGate evidence, I refreshed the local browser QA artifacts against `http://127.0.0.1:4177/` using installed Chrome: `browser-qa-summary.json`, `dashboard-hero-screenshot.png`, `dashboard-mobile-screenshot.png`, and `dashboard-fullpage-screenshot.png` are now newer than `index.html`. The QA summary reports no missing required judge text, no visible `undefined` or `NaN`, no desktop/mobile page overflow, no outside-table overflow offenders, and no console/page errors. `npm run model:verify-dashboard` passes with 48 files, 41 required dashboard strings, 44 Markdown files, 53 manifest paths, 22 reference paths, 1 browser QA summary, 5 freshness rules, 58 fingerprints, 3 screenshots, and 3 screenshot-dimension checks. `npm run model:typecheck` and the full `npm run test` suite also pass, including the new no-future ScoutGate leakage test. Reflection: the important decision is unchanged. ScoutGate is documented as promising but fragmented, not promoted. The current best model remains Conservative TailGuard Strong RoleV3, with the final package headline still 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, and 0.130 deployment score. Next: avoid cosmetic micro-tweaks; either find genuinely broader pre-match data or use the remaining time for final-package polish and presentation readiness.

Latest checkpoint, May 21 2026 18:27 CST: implemented and benchmarked the coverage-aware ScoutGate branch. The feature generator now keeps no-future scout evidence counts, event/season confidence, and confidence-shrunk scout offense/defense signals; model configs can choose raw scout features, gated scout features, both, or neither. This was tested with a new leakage test proving match 1 cannot see its own scout observation and match 2 only sees the prior observation after confidence shrinkage. The focused `2026mnum` run shows the gate is doing something real: raw compact ridge was terrible at 107.70 score MAE, while ScoutGate compact ridge improved to 62.49 and ScoutGate compact robust ridge improved to 59.80, with better Brier. But neither beats RoleV3 on point score. Full 2026 then gave ScoutGate TailGuarded a tiny relative win at 60.26 score MAE, 82.63 margin MAE, 0.1572 Brier, and 103.80 max worst-event MAE. I ran all five 2026 bucket holdouts before considering promotion. Result: `modeling/artifacts/reports/scoutgate-check/CROSS_RUN_SUMMARY.md` marks the branch `fragmented`. ScoutGate TailGuarded wins 3 of 7 relative leaderboards, 2 of 7 fixed-score leaderboards, and only 2 of 5 relative/fixed holdouts; all seven runs are near-ties. Deployment review inside this branch gives ScoutGate TailGuarded the best branch point score, 0.195, but that is not enough to displace the existing final model because bucket 0 and bucket 4 reject the promotion and the effect size is microscopic. Reflection: ScoutGate is a good engineering improvement and a useful future path for denser scouting data. It is also a textbook example of why we do not promote a model just because the full replay nudged downward by 0.01 MAE. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the final dashboard so the research atlas and documentation include the ScoutGate check, refresh browser QA/screenshots, and rerun verifier/typecheck/tests.

Latest checkpoint, May 21 2026 17:55 CST: completed the Firebase scout-enrichment validation loop across the focused `2026mnum` replay, full 2026 replay, and all five predeclared 2026 event-key holdout buckets. This started with a real ingestion fix: the Firebase ingester now reads nested event scouting collections with Firestore collection-group queries instead of only root collections. Live import finds 597 Firebase scouting observations; the scout coverage audit reports 528 normalized observations, 356 matched to official match/team slots, 172 unmatched rows, 67.4% observation match coverage, 7 events with scout data, and 55 teams with scout data. Coverage is heavily concentrated in `2026mnum` with 444 cached observations, so this is real scout/PPC progress but still not broad-history coverage. The regenerated report is `modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md`. Result: useful confirmation, no final-model promotion. TailGuarded Strong RoleV3 wins 5 of 7 relative leaderboards and 4 of 5 relative holdouts; TailRiskWinProb wins 4 of 7 fixed-score leaderboards and 3 of 5 fixed-score holdouts; every promoted/reviewed RoleV3-family result is still a near-tie. Deployment review inside this branch gives TailGuarded Strong RoleV3 the best point score, 0.075, with 60.18 weighted score MAE, 82.52 weighted margin MAE, 0.1572 weighted Brier, and 103.80 max worst-event MAE. The compact ridge/robust-ridge/elastic scout-heavy models are decisively worse across buckets, often by 8-19 score MAE points, and continue to trigger VIF or quality rejections. The stability review is `mixed` because relative and fixed-score holdouts disagree. Reflection: this is exactly the defensible balance the project needs. The old "zero matched scout rows" story is gone; we can now say Firebase scout data is ingested and partially matched. But the model does not let sparse one-event-heavy data take over the global point model. Current best model remains Conservative TailGuard Strong RoleV3. Next: move back to final package polish and make sure the dashboard/brief says "sparse scout data exists but did not justify a new global model," not either of the two bad extremes.

Latest checkpoint, May 21 2026 16:40 CST: added deterministic bucket-holdout manifests for the smooth TailRisk candidate set and ran bucket 0 before switching away from an inefficient five-bucket replay loop. Bucket 0 scored 2,912 held-out matches and produced the same story as the full replays: unsmoothed TailGuard+TailRisk `TP=0.75` wins the relative benchmark; smooth `TP=1.25` wins the fixed benchmark by a tiny amount; every candidate remains a near-tie; score MAE and margin MAE are effectively unchanged at 43.14 and 59.62 inside the bucket; and the stability review still says "not enough holdout runs to make a stability claim." The generated report is `modeling/artifacts/reports/role-v3-tailguard-smooth-tailrisk-bucket0-check/CROSS_RUN_SUMMARY.md`. Reflection: this makes the rejection more defensible, not less. The smoothing idea is mathematically reasonable, but it is not bringing new score information; it is moving probability confidence at the edge. Current best model remains Conservative TailGuard Strong RoleV3. The remaining bucket manifests are kept as predeclared future checks, but I am not spending the current prompt recomputing four more broad replays for a candidate that has already failed the promotion standard.

Latest checkpoint, May 21 2026 16:07 CST: tested a probability-only smoothing branch, `TailGuard+SmoothTailRiskWinProb RoleV3`, which keeps the Conservative TailGuard score means but scales the TailRisk win-probability overlay by expected margin and confidence (`MR=35 PR=0.25 SF=0.50`). I added exact manifests for full 2026 and broad 2024-2026 replay, ran both, and generated `modeling/artifacts/reports/role-v3-tailguard-smooth-tailrisk-check/CROSS_RUN_SUMMARY.md`. Result: not promoted. The earlier unsmoothed TailGuard+TailRisk `TP=0.75` wins the exact relative benchmark on both full replays, while smooth `TP=1.25` wins the fixed benchmark by tiny amounts and has slightly better Brier/calibration. But every result is a near-tie, score MAE, margin MAE, and worst-event MAE are unchanged, and the report has zero holdout runs, so this is a diagnostic probability overlay rather than a new best model. Reflection: the smoothing did what it was supposed to do, slightly softening probabilities when the tail-risk signal is less trustworthy, but it did not add enough new pre-match information to justify replacing the defended point model. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 15:02 CST: regenerated current TailGuard residual diagnostics for the actual promoted family and began turning them into a judge-facing `FAILURE_MODE_ATLAS.md` plus an HTML `Failure Mode Atlas` dashboard section. This is a failure-analysis pass, not a model promotion. The fresh diagnostics show the model's hardest misses cluster around high-scoring 2026 events and championship-like phases: the broad replay's worst event remains `2026hop` at 103.84 score MAE, with `2026cmptx`, `2026cur`, `2026gal`, and `2026arc` close behind; championship-like middle phases are still underpredicted more than late phases; win calibration is broadly usable but still noisy in some probability buckets. Reflection: this is exactly the sort of weakness we should show judges instead of hiding. It strengthens the story because it explains why worst-event MAE, uncertainty bands, and TailGuard exist. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh browser QA/screenshots, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 14:27 CST: tested a real model-side challenger, `No-Future TailGuard+TailRiskWinProb Strong RoleV3 ... TW=0.20 TP=0.75`, which combines the current TailGuard score-mean correction with the earlier TailRisk win-probability softening. I added exact manifests for full 2026 and broad 2024-2026 replay, ran both, and generated `modeling/artifacts/reports/role-v3-tailguard-tailrisk-combo-check/CROSS_RUN_SUMMARY.md`. Result: rejected for promotion. The combo slightly improves Brier/calibration and fixed benchmark at tiny scale, but the existing Conservative TailGuard wins the relative benchmark on both full replays, keeps the same score and margin MAE, and remains the lower deployment-score choice in the two-run combo report. Reflection: this was worth trying because it asked a different question from another TailGuard weight tweak: can we preserve point accuracy while improving probability honesty? The answer is "not enough to promote." Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the final dashboard so the research atlas includes this rejected challenger, refresh browser QA/screenshots, and rerun the full verifier.

Latest checkpoint, May 21 2026 14:19 CST: added `MOCK_JUDGE_PANEL_BRIEF.md` and a matching `Mock Judge Panel Brief` dashboard section. This is the judge-personality pressure pass: it prepares separate routes for technical modeling, strategy, skeptical statistics, software/reproducibility, project-impact, and data-source judges, with evidence files to open and phrases to avoid for each. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from the evidence matrix, final readiness check, README, and QA text. Reflection: this is not a new model iteration. It is a communication and safety improvement so the same model can be defended honestly under different judge priorities without overclaiming. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh Chrome screenshots and browser-QA summary, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 14:02 CST: added `JUDGE_DRY_RUN_SCORECARD.md` and a matching `Judge Dry-Run Scorecard` dashboard section. This is the presentation-rehearsal pass: it turns the final live story into a pass/fail checklist for opening claim, no-future rule, model-selection defense, strategy usefulness, hard-question handling, package integrity, and fallback route. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from the evidence matrix, final readiness check, README, and QA text. Reflection: this is not a new model iteration. It is the last-mile quality check that keeps a strong technical project from being weakened by an overconfident or poorly routed presentation. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh Chrome screenshots and browser-QA summary, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 13:56 CST: tightened the final-package verifier so browser QA and screenshots must be fresh relative to the generated dashboard. This is the stale-visual-proof pass: `browser-qa-summary.json`, its `checkedAt` timestamp, and the hero/mobile/full-page screenshots now fail verification if they are older than `index.html` beyond a small filesystem tolerance. I also updated the dashboard docs and evidence matrix so the package says exactly what the verifier checks. Reflection: this still does not change the model, and it should not pretend to. It closes a presentation failure mode: making a small dashboard edit, accidentally presenting old screenshots, and having the package look verified when the visual evidence is stale. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh Chrome screenshots and browser-QA summary, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 13:44 CST: added `REFERENCE_INTEGRITY_AUDIT.md` and promoted `browser-qa-summary.json` into the formal final-package manifest and verifier gate. This is the reference-integrity pass: it checks the critical local source files, evidence summaries, dashboard files, browser-QA summary, screenshots, deliverables manifest, and fingerprint manifest that the judge package points people toward. The verifier now fails if those handoff references are missing, if the browser QA summary reports missing required text, visible bad tokens, page overflow, console issues, page errors, or screenshot-path gaps, or if the latest browser-QA required-text list does not include the newest reference-audit section. Reflection: the current best model still does not change, and that is the honest answer. This pass improves trust in the package, not the score: a polished dashboard is only useful if every cited artifact is actually there and was checked in a browser. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the dashboard, refresh Chrome screenshots and browser-QA summary, rerun the verifier, typecheck, and tests.

Latest checkpoint, May 21 2026 13:32 CST: added `FINAL_PRESENTATION_LOCK.md` and a matching `Final Presentation Lock` dashboard section. This is the handoff-lock pass: it records the current safe-to-present model claim, artifact set, verification gate, screenshot fallback, presentation route, do-not-claim list, and local-only boundary, plus the exact triggers that force regeneration and fresh verification. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the evidence matrix, final readiness evidence package, and QA text. Reflection: this is again not a model improvement; it is a presentation safety improvement. At this point, the largest remaining risk is accidental stale handoff after a tiny edit, so the package now says when it must be reopened and rechecked. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 13:26 CST: added `FINAL_COHERENCE_AUDIT.md` and a matching `Final Coherence Audit` dashboard section. This is the consistency pass I queued last turn: it pins the promoted model name, dashboard metrics, no-future validation rule, scout/PPC honesty, defense role boundary, model-selection rule, package-integrity claim, and next-work claim to exact files. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the evidence matrix, final readiness evidence package, and QA text. Reflection: this is not a model improvement; it is a drift-control improvement. The package now has enough layers that inconsistent wording is a real risk, especially because older run metrics and current dashboard metrics are both visible. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 13:12 CST: added `HOSTILE_JUDGE_CROSS_EXAM.md` and a matching `Hostile Judge Cross-Exam` dashboard section. This is the hostile-question pass: it prepares concise, evidence-backed answers for overfitting, neural-network pressure, 41-point MAE usefulness, future-data leakage, then-absent scout/PPC rows later superseded by the Firebase import, defense-label uncertainty, and next-step challenges. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the evidence matrix, final readiness evidence package, and QA text. Reflection: the model still does not change, and I should say that plainly. This is about judge resilience: a strong project needs its worst questions answered without bluffing. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 13:03 CST: added `COLD_READER_ROUTE.md` and a matching `Cold Reader Route` dashboard section. This is the cold-open pass I queued last turn: it gives a no-context reader a five-minute route through the package, including what to open, when they are ready to move on, and what not to open first. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the final readiness evidence package, and QA text. Reflection: the model still does not change; this is about removing presentation friction. The final package is large because the research was large, so the first contact needs guardrails as much as the model math does. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:55 CST: added `PRESENTATION_WORDING_AUDIT.md` and a matching `Presentation Wording Audit` dashboard section. This is the stale-wording pass: it names risky presentation sentences such as "best possible model", "the model is accurate", "we used every API signal", and "package verification proves the model is correct", then replaces each with safer evidence-backed wording. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the final readiness evidence package, and QA text. Reflection: again, no score change; this is about communication integrity. Judges can forgive a limitation if we name it clearly, but they should not have to decode accidental overconfidence. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:48 CST: added `FINAL_FREEZE_AUDIT.md` and a matching `Final Freeze Audit` dashboard section. This is the pre-presentation guardrail sheet: bounded model claim, no-future replay discipline, model-selection honesty, data-source honesty, strategy-use boundary, presentation resilience, and package integrity are now captured in one verifier-required artifact. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, the final readiness evidence package, and QA text. Reflection: the model score still does not change, but this directly improves final-readiness. The biggest remaining risk is not a missing chart; it is an accidental overclaim during judging. This audit gives the presenter a fast way to stay honest. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:38 CST: added `FIRST_90_SECONDS.md` and a matching `First 90 Seconds` section near the top of the dashboard. This is a timed opening script for judge pressure: it says what to say in each time band, which artifact to point at, and which boundary prevents accidental overclaiming. The artifact is generated, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from `OPEN_THIS_FIRST.md`, `DELIVERABLES.md`, README, and QA text. Reflection: this does not improve the model's score, but it improves presentation reliability. A strong model package can still lose credibility if the first explanation is rambling or overconfident; this makes the opening disciplined. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:31 CST: added `JUDGE_STORY_SPINE.md` and a matching `Judge Story Spine` section near the top of the dashboard. This is the final narrative compression pass: problem, no-future rule, search process, promoted model, why it won, strategy use, and package integrity are now visible in one short table with proof files and watch-outs beside each claim. The artifact is generated, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and reflected in the README and QA text. Reflection: this does not change model performance, but it improves the chance that a judge understands the work in the right order before getting lost in appendices. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:27 CST: tightened `MODEL_SOURCE_MAP.md` from a broad file map into a function-level source audit route. The generated map now names the concrete implementation entry points: `candidateModelConfigs`, `runModelSearch`, `buildWalkForwardDataset`, `buildRow`, `getSnapshot`, `updateTeamAfterMatch`, `RoleV3Signal`, `roleV3SignalForSnapshot`, `chooseRoleV3Summary`, `addAllianceFeatures`, `fitOprRatings`, `createOnlineEpaState`, `updateOnlineEpa`, `buildVifDiagnostics`, `buildCorrelationDiagnostics`, `buildFeatureImportance`, `buildDeploymentReview`, `buildCrossRunSummary`, `writeJudgeDashboardArtifacts`, and `verifyJudgeDashboardArtifacts`. I also made the dashboard verifier require several of those strings so a vague source map cannot quietly replace the precise one. Reflection: this is still not a model-score improvement, but it is a real auditability improvement. The judges asked for best model code; this makes the code path inspectable. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the package, browser-check the source-map section, refresh screenshots only if needed, then rerun tests and verifier.

Latest checkpoint, May 21 2026 12:13 CST: added `MODEL_SOURCE_MAP.md` and a matching `Model Source Map` dashboard section. This is a source-code audit route for the final package: it points judges and teachers from each claim to the local files that implement candidate definitions, walk-forward features, RoleV3 defense logic, OPR/EPA-style state, diagnostics, nuanced deployment scoring, report generation, verification, CLI commands, and the research log. It is generated into the dashboard package, listed in `deliverables.json`, included in the final package map and fingerprints, required by `npm run model:verify-dashboard`, and cross-linked from the runbook, evidence matrix, live demo route, and README. Reflection: this again does not change the model, but it directly strengthens the `best model(code)` deliverable. The model story is much safer when someone can audit where the math actually lives instead of trusting a pretty dashboard. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 12:03 CST: added `OPEN_THIS_FIRST.md` and an `Open This First` dashboard section. This is the final package cover sheet: it tells a cold reader to open `index.html`, then points them to the exact evidence files for trust (`LEAKAGE_AUDIT.md`), model choice (`FINALIST_COMPARISON.md`), model mechanics (`MODEL_ANATOMY.md` and `OPR_EPA_EXPLAINER.md`), strategy usefulness (`STRATEGY_EXAMPLE.md`, `DEFENSE_ROLE_GUIDE.md`, and `PREDICTION_CASE_STUDIES.md`), and fallback presentation (`LIVE_DEMO_RUNBOOK.md`, `DELIVERABLES.md`, and screenshots). It is generated into the dashboard package, listed in `deliverables.json`, added to the final package map and fingerprints, and required by `npm run model:verify-dashboard`. Reflection: this again does not alter the model, but it makes the handoff safer. A judge-ready package should not rely on me being present to explain where the story starts. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 11:56 CST: added `LIVE_DEMO_RUNBOOK.md` and a matching `Live Demo Runbook` dashboard section. This is a practical presentation-resilience artifact: it tells the presenter exactly what to open, what to say, which evidence file supports each claim, how to time a 30-second/90-second/3-minute version, and how to recover using screenshots and Markdown if the local browser demo fails. It is now generated into the final dashboard package, included in `deliverables.json`, listed in the final package map, fingerprinted, and required by `npm run model:verify-dashboard`. Reflection: the model did not change, but this matters because a judge presentation can fail for non-model reasons. The live demo runbook reduces that risk and keeps the final story tied to evidence instead of improvisation. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, refresh screenshots, and rerun the full verification gate.

Latest checkpoint, May 21 2026 11:50 CST: added `LEAKAGE_AUDIT.md` as a verifier-backed dashboard artifact. This gives the no-future discipline its own judge-facing page instead of scattering the argument across the methodology, tests, and model card. The audit names seven guardrails: walk-forward row order, online residual correction, TailGuard evidence gating, deterministic event-key holdouts, Statbotics provenance, scout/PPC honesty, and generated package verification. It is now generated into the final dashboard package, listed in `deliverables.json`, fingerprinted, linked from the package map/evidence matrix/runbook/readiness checks, and required by `npm run model:verify-dashboard`. Reflection: this is not a new model iteration, but it directly protects the credibility of the model. The easiest way to fool ourselves would be accidental leakage; the new artifact makes that failure mode explicit and auditable. Current best model remains Conservative TailGuard Strong RoleV3. Next: refresh browser screenshots after the dashboard layout change, rerun tests/verifier, and continue final package polishing only where it improves judge clarity or auditability.

Latest checkpoint, May 21 2026 11:36 CST: added `DEFENSE_ROLE_GUIDE.md` and promoted the dashboard's role section into a verifier-backed `Defense Role Guide`. This guide explains the original strategic question directly: defense is only valuable when expected opponent suppression is greater than lost offense plus foul risk. It now documents the net-swing formula, opportunity cost, suppression value, foul-risk penalty, confidence boundary, scout/PPC limitation, and saved walk-forward role examples. The artifact is generated into the final dashboard package, listed in the final package map, included in `deliverables.json`, fingerprinted, required by `npm run model:verify-dashboard`, and cross-linked from the evidence matrix/readiness checks. Reflection: this is important because the model's defense logic is one of the most strategically interesting parts of the work, but also one of the easiest places to overstate causality. The new guide makes the role layer explainable while repeating that it is a strategy clue, not proof of a future drive-team choice. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, refresh screenshots, run browser QA, and verify the final package.

Latest checkpoint, May 21 2026 11:29 CST: added `JUDGE_RUBRIC_ALIGNMENT.md` and a matching `Judge Rubric Alignment` dashboard section. This translates the technical modeling package into judge/teacher language: engineering process, mathematical rigor, no-leakage validation, iteration and reflection, real-world usefulness, integrity/reproducibility, honesty/safety, and communication. The artifact is now generated, listed in `deliverables.json`, included in the final package map, fingerprinted, required by `npm run model:verify-dashboard`, and added to the final readiness evidence list. Reflection: this is presentation work, not model work, but it matters because judges often evaluate process and impact as much as raw technical sophistication. A strong model with poor framing is easy to undersell; a strong model with bounded claims, visible evidence, and rubric alignment is much easier to defend. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate the final package, refresh screenshots, run browser QA, and rerun tests/verifier.

Latest checkpoint, May 21 2026 11:20 CST: added a judge-facing claim-boundary layer to keep the final model story strong without overclaiming. The dashboard generator now writes `CLAIM_BOUNDARIES.md`, adds a `Claim Boundaries` section to `index.html`, includes the artifact in `deliverables.json`, fingerprints it, lists it in the final package map, and makes `npm run model:verify-dashboard` require it. The new page separates safe claims from unsafe claims: current best known local model versus best possible model, known-before-match discipline versus assuming all external data is leakage-safe, useful small improvement versus huge win, role reasoning versus proving future defense choices, dashboard integrity versus model correctness, and data-driven next steps versus complexity for its own sake. Reflection: this does not change the model, but it materially improves judge readiness because the easiest way to damage a good modeling project is to say more than the evidence supports. Current best model remains Conservative TailGuard Strong RoleV3. Next: regenerate, browser-check, and verify the final package after this documentation change.

Latest checkpoint, May 21 2026 11:11 CST: the model choice did not change, but the final package QA gate is now stricter. I upgraded `npm run model:verify-dashboard` so it parses PNG headers and verifies screenshot dimensions, not just screenshot existence and byte count. The generated runbook and QA checklist now state that screenshot dimensions are part of the presentation gate. I regenerated the final judge dashboard, refreshed desktop/mobile/full-page screenshots through local Chrome against `http://127.0.0.1:4177/`, and verified title/body content, zero desktop/mobile page overflow, no visible `undefined` or `NaN`, and valid PNG screenshots at 1440x1100, 780x63636, and 1440x40833. `npm run model:typecheck`, `npm run test`, and `npm run model:verify-dashboard` all pass after the change. Reflection: this is not a new modeling improvement, but it is a meaningful judge-readiness improvement because it reduces the chance of presenting a stale, corrupted, or thumbnail screenshot as evidence. Current best model remains Conservative TailGuard Strong RoleV3; next work should stay on final-package polish unless genuinely new pre-match data appears.

Latest checkpoint, May 21 2026 03:32-10:16 CST: the RoleV3 tail-guarded mean-correction branch has now completed full 2026, broad 2024-2026, all five broad event-key holdout buckets, and the SelectiveTailGuard follow-up checks. Conservative TailGuard `TW=0.20 TL=50 TN=32 TC=20 F=PR G=8/R4/F20` wins both full replays and has the best generated point deployment score across the completed TailGuard report, 0.145 versus 0.161 for stronger TailGuard and 0.202 for plain Strong RoleV3. Stronger TailGuard `TW=0.35 TL=40 TN=24 TC=25` wins buckets 0-3 by relative score, including bucket 1 by both relative and fixed score, and trims several worst-event metrics. Bucket 4 rejects a universal stronger-tail story: Strong RoleV3 wins the relative benchmark at 21.80 score MAE, 29.93 margin MAE, 0.1629 Brier, and 54.76 worst-event MAE, while both TailGuard variants tie the rounded metrics but lose the exact relative score. The stability review remains `fragmented`, with no majority winner across both relative and fixed holdouts. In response, I added `SelectiveTailGuarded` with a stricter no-future min gate requiring both prior event residual evidence and prior event score-scale evidence before the stronger correction turns on. Its full-2026 smoke was a positive clue at 60.26 score MAE, 82.64 margin MAE, 0.1572 Brier, and 103.79 worst-event MAE, but broad confirmation rejects it as a promotion path: bucket 4 promotes plain Strong RoleV3 while SelectiveTailGuard ranks fourth, and bucket 1 promotes stronger TailGuard while SelectiveTailGuard again ranks fourth, barely behind plain Strong RoleV3. Decision: conservative TailGuard remains the current deployment-rule point candidate because it has completed broad confirmation; Strong RoleV3 remains the simple baseline and strongest holdout relative leader; stronger TailGuard remains a high-tail specialist; SelectiveTailGuard is rejected as over-gated/under-helpful. Delivery update: added a static judge dashboard generator at `npm run model:dashboard`, an automated package verifier at `npm run model:verify-dashboard`, generated `modeling/artifacts/reports/final-judge-dashboard/index.html`, and browser-verified desktop/mobile rendering with screenshots saved in the same artifact folder. The dashboard now includes a research atlas that scans all saved `cross-run-summary.json` files, so judges can see the broader model journey rather than only the latest TailGuard comparison. It also writes `JUDGE_WALKTHROUGH.md`, `DEADLINE_DELIVERABLES_CHECKLIST.md`, `PRINTABLE_HANDOUT.md`, `PRESENTATION_SCRIPT.md`, `MODEL_JOURNEY_TIMELINE.md`, `FINALIST_COMPARISON.md`, `MODEL_ANATOMY.md`, `MODEL_LEADERBOARD_APPENDIX.md`, `STRATEGY_EXAMPLE.md`, `PREDICTION_CASE_STUDIES.md`, `FINAL_MODEL_CARD.md`, `JUDGE_BRIEF.md`, `JUDGE_QA.md`, `METHODOLOGY_APPENDIX.md`, `OPR_EPA_EXPLAINER.md`, `METRIC_GLOSSARY.md`, `DEPLOYMENT_SCORING_RUBRIC.md`, `EVIDENCE_MATRIX.md`, `LIMITATIONS_AND_RISK_REGISTER.md`, `REPRODUCIBILITY_RUNBOOK.md`, `FINAL_READINESS_CHECK.md`, `QA_CHECKLIST.md`, `VERIFICATION_SUMMARY.md`, `ARTIFACT_FINGERPRINTS.md`, `artifact-fingerprints.json`, `DELIVERABLES.md`, and `deliverables.json` as the final handoff package. The newest polish passes add a fast `Judge Walkthrough`, a `Deadline Deliverables Checklist`, an explicit `Presentation Flow`, a `Model Journey Timeline`, a side-by-side `Finalist Comparison`, a visual/plain-English `Model Anatomy`, a grouped `Model Leaderboard Appendix`, one concrete saved `Strategy Example`, a representative `Prediction Case Studies` page, a generated `OPR vs EPA Explainer`, a plain-English `Metric Glossary`, a generated `Deployment Scoring Rubric`, a claim-by-claim `Evidence Matrix`, a `Risk Register`, a final go/no-go `Final Readiness Check`, a separate 30-second/90-second/3-minute speaking script, an `Audit Trail And Reproducibility` section plus runbook, an `Integrity Fingerprints` section plus generated hash files, and a generated verification summary, plus a hard-question `JUDGE_QA.md`, because the judging package needs technical evidence, a live route through the material, a short arc from baselines to the final model, an explicit answer to why this finalist is promoted over close alternatives, a picture of how the promoted model actually thinks before a match, a visible map of other saved model scores, examples of both useful and uncomfortable predictions, an explicit answer to the OPR/EPA distinction, understandable scoring language, the actual weighted/nonlinear model-selection rule, visible limitations, a final presentation gate, file-identity fingerprints, an automated consistency check, and a rerunnable audit path. Next: verify this package end to end after every generated-document change, then only return to modeling if a genuinely different feature source appears.

Latest checkpoint, completed broad RoleV2 sweep: the full RoleV2 confirmation report now includes full 2026, full 2024-2026, five 2026 buckets, and five broad 2024-2026 buckets. Strong RoleV2 wins the most relative leaderboards, 8 of 12, and has the best max worst-event MAE, 103.67, but every single promotion is still `near_tie`. Fixed-score winners are split across five candidates, and the deployment review still selects plain residual `RW=0.25 L=30 C=40` as the point-default and robustness-monitor candidate: deployment score 0.401 versus 0.433 for moderate RoleV2 and 0.465 for Strong RoleV2. Decision: RoleV2 is not promoted. Role-aware features are valuable enough to keep, but the next serious modeling idea should be RoleV3, separating suppression value, foul risk, and role-choice confidence rather than blending them into one net-swing proxy.

Latest checkpoint, broad RoleV2 continuation: broad buckets 0 and 1 are now complete. Bucket 0 promotes Strong RoleV2 by both relative and fixed score, but bucket 1 promotes stronger non-role residual by relative score and only gives Strong RoleV2 a tiny fixed-score edge. The regenerated cross-run report across 9 RoleV2-related runs restores plain residual `RW=0.25 L=30 C=40` as the point-default and robustness-monitor candidate: deployment score 0.368 versus 0.401 for moderate RoleV2 and 0.471 for Strong RoleV2. Strong RoleV2 still has the most relative wins, 6 of 9, and the best max worst-event MAE, 103.67, so it remains a serious role/defense challenger. But the honest decision is still not to promote it. Continue broad buckets 2-4 only as confirmation pressure, and start designing RoleV3 around separate suppression value, foul risk, and decision-confidence terms.

Latest checkpoint, May 20 2026 21:54 CST: the completed 2026 RoleV2 bucket sweep is mixed, not a clean promotion. Strong RoleV2 wins full 2026, full 2024-2026, and 2026 buckets 0/2/3 by relative score; bucket 1 prefers stronger non-role residual and bucket 4 prefers the older role-feature residual. The generated deployment review gives moderate RoleV2 the best point score inside that candidate set, 0.370 versus 0.383 for plain residual, but all seven runs are `near_tie`, fixed winners are scattered across five candidates, and the stability review is `mixed`. The defended point default remains plain residual-ridge until broad RoleV2 holdout confirmation says otherwise. The constructive takeaway is that role features contain real signal, but the next research branch should either confirm RoleV2 broadly or build a RoleV3 encoding that separates suppression value, foul risk, and role-choice confidence.

The model is not finished, and we should not claim it is impossible to improve. The current strongest 2026 point-prediction candidate is an online, no-future EPA-style model with a small Monte Carlo score ensemble, known-before-match scaled event-archetype adjustment, and a no-future residual-ridge correction layer. The residual-ridge layer is refit during replay only from previous prediction errors, so it is closer to a leakage-safe stacked correction than a one-shot offline fit. It now has real confirmation: the plain residual-ridge candidate wins the full 2026 replay and four of five 2026 event-bucket holdouts by relative benchmark. Broad 2024-2026 validation also supports the residual family: residual-ridge wins all five direct residual-vs-event-type holdouts by relative score, with plain residual `RW=0.25 L=30 C=40` winning buckets 0 and 2 and stronger residual `RW=0.40 L=60 C=35` winning buckets 1, 3, and 4. However, every direct holdout promotion remains `near_tie`, fixed-score winners split five ways, and the generated cross-run stability report marks the suite `mixed`. A direct-bucket-only deployment review favors stronger residual `RW=0.40 L=60 C=35`, but the mixed-scope residual review across full broad replay, full 2026 replay, broad buckets, and 2026 buckets favors plain residual `RW=0.25 L=30 C=40` decisively: 8 of 12 relative wins, point deployment score 0.256 vs 0.517, and the best robustness score. The defensible baseline stance is therefore: residual-ridge is the best fully bucket-confirmed point-prediction family, and plain residual remains the conservative defended default. Conformal uncertainty remains useful but not a universal point-model default. Official foul-risk features are now implemented for role experiments, but role-scaled replay and the more conservative role-feature residual replay both failed to beat the non-role point baseline cleanly. The first nonlinear residual-tree branch also fails to displace residual-ridge; its only real clue is slightly better worst-event MAE from a ridge+tree hybrid. The championship-scoped high-score tail branch repeats that same pattern more directly: it can reduce worst-event MAE by about 1.1 to 1.5 points, but it spends too much margin/Brier/relative-benchmark quality to promote as the point default. Residual-gated and low-amplitude tail selectors were tested next and also rejected on 2026 replay; they did not keep the tail gain while preserving average margin/Brier. A new residual-diagnostics command then showed the tail is concentrated in early/middle championship-like underprediction. A no-future championship phase-shift candidate improved 2026 score MAE slightly from 60.36 to 60.33 and worst-event MAE from 103.73 to 103.36, but broad 2024-2026 replay kept plain residual-ridge as the point default at 32.31 score MAE, 44.25 margin MAE, and 0.1665 Brier. The richer phase+residual-boost hybrid is now the strongest tail-correction challenger rather than a defended replacement: across full 2026, full 2024-2026, and all five broad holdout buckets it has the best deployment score in that exact candidate set (0.252 vs 0.339 for plain residual) and 4 of 7 relative wins, but every run is a `near_tie`, it has 0 fixed-score wins, the stability report is `mixed`, and bucket 2 still promotes the conservative residual baseline by both relative and fixed score. The first residual-mean gated version was tested next and is not promoted: the ungated phase+residual boost still won both full replays by relative score, while the gated variants only won fixed-score diagnostics and did not restore the conservative baseline's 2026 margin/Brier advantage. The first score/win split was then implemented with a parallel no-tail online EPA state for win probability. It works mechanically and improves calibration error, but it does not improve Brier; on full 2026 it keeps tail score/margin at 60.3490/82.8629 while Brier is 0.157718 versus conservative residual 0.157576, and broad replay repeats the same tradeoff at 32.3039/44.2793/0.166615 versus conservative residual 32.3139/44.2516/0.166458. A no-future learned championship-tail residual correction was tested next. The aggressive learned tail is the strongest tail challenger on full replays: 2026 score MAE 60.28 and worst-event MAE 102.94, broad score MAE 32.30 and worst-event MAE 103.40, and it wins both full replays by relative benchmark. The first three broad learned-tail holdout buckets now show why that is not enough: bucket 0 prefers the feature-reduced learned tail, bucket 1 prefers the defended residual baseline by relative score, and bucket 2 prefers aggressive learned tail by relative score. A conditional learned-tail gate was then added to use prior event residual evidence before applying the learned correction. It fixes part of the bucket-1 failure mode: the conservative conditional gate improves bucket-1 score MAE from 24.76 to 24.75, margin from 34.68 to 34.65, Brier from 0.1775 to 0.1774, and calibration from 0.0191 to 0.0172. But 2026 full replay still keeps plain residual-ridge as the relative winner; the conservative gate improves margin, Brier, and worst-event MAE slightly while worsening score MAE from 60.36 to 60.37, and the aggressive gate worsens the main point metrics. The tail-risk interval branch then stopped pushing learned-tail into the mean score and used the same no-future signal only to widen asymmetric score intervals. Across the 2026 full replay and all five broad holdout buckets, score MAE, margin MAE, and worst-event MAE remained exactly unchanged, Brier improved on every checked slice, and `TU=1.25` won fixed-score diagnostics on 5 of 6 broad holdouts. But relative-score holdouts split the other way: plain residual won broad buckets 2, 3, and 4. The TailRiskWinProb branch is sharper: it uses the same no-future signal only to soften win probabilities, leaving both mean scores and score intervals unchanged. A completed full bucket confirmation now makes the tradeoff clear: TailRiskWinProb improves Brier on every checked slice, `TP=0.75` wins the full 2026 replay and broad buckets 0/1 by relative score, residual-ridge wins broad buckets 2/3/4 by relative score, and `TP=1.25` wins fixed-score diagnostics on 4 of 5 broad holdouts. The generated stability review is `mixed`, with relative and fixed-score holdouts disagreeing. Comparison-safe slice diagnostics are now written before artifact compaction. The first slice-inspired margin/confidence-gated TailRiskWinProb idea was rejected on full 2026, and smooth shrinkage was rejected on broad 2024-2026 replay. The learned WinCal probability-residual layer is also rejected as a TailRisk replacement: it improved some calibration-error slices, but it worsened Brier or close-match behavior and lost to ungated TailRisk on broad replay. The new RoleV2 branch is now the strongest active point-model challenger: it adds conservative all-attempt suppression and all-foul-exposure features, then lets no-future residual-ridge decide whether those role features explain prior score errors. Strong RoleV2 won full 2026, full 2024-2026, and 2026 bucket 0 by relative score, but every run is still `near_tie` and the first holdout fixed benchmark prefers old role features. The honest current stance is: Strong RoleV2 is the best-known point challenger and may become the point default if more buckets confirm it; until then, plain residual-ridge remains the defended baseline and TailRiskWinProb `TP=0.75` remains the reporting overlay. Historical note: the scout/PPC blockage named in this older checkpoint was later superseded by the Firebase ingestion fix and scout coverage audit, which found 356 matched Firebase scout rows but did not promote a new global model.

| Scope | Current best defended model | Matches | Score MAE | Margin MAE | Brier | Calibration | Coverage | Worst event MAE |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2024-2026 official replay | direct set: `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 15,015 | 32.31 | 44.25 | 0.1665 | 0.0086 | 77.6% | 103.76 |
| 2024-2026 bucket-0 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 2,912 eval | 43.18 | 59.68 | 0.1685 | 0.0183 | 74.9% | 103.76 |
| 2024-2026 bucket-1 holdout | `No-Future Residual-Ridge ... RW=0.40 L=60 C=35` | 2,470 eval | 24.75 | 34.64 | 0.1775 | 0.0186 | 79.0% | 98.82 |
| 2024-2026 bucket-2 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 3,247 eval | 33.64 | 46.20 | 0.1627 | 0.0167 | 78.4% | 93.04 |
| 2024-2026 bucket-3 holdout | `No-Future Residual-Ridge ... RW=0.40 L=60 C=35` | 3,631 eval | 35.45 | 47.40 | 0.1627 | 0.0203 | 76.5% | 98.37 |
| 2024-2026 bucket-4 holdout | `No-Future Residual-Ridge ... RW=0.40 L=60 C=35` | 2,755 eval | 21.89 | 30.07 | 0.1641 | 0.0195 | 79.8% | 54.73 |
| 2026-only official replay | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 5,091 | 60.36 | 82.81 | 0.1576 | 0.0136 | 76.9% | 103.73 |
| 2026-only bucket-0 holdout | `No-Future Residual-Ridge Component ... RW=0.25 L=40 C=35 CP=0.10 CM=4` | 1,526 eval | 65.75 | 91.37 | 0.1657 | 0.0302 | 73.4% | 102.87 |
| 2026-only bucket-1 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 526 eval | 51.18 | 70.54 | 0.1653 | 0.0343 | 80.8% | 98.86 |
| 2026-only bucket-2 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 1,325 eval | 57.18 | 79.51 | 0.1543 | 0.0227 | 79.8% | 93.27 |
| 2026-only bucket-3 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 1,276 eval | 66.41 | 89.28 | 0.1539 | 0.0311 | 73.7% | 98.45 |
| 2026-only bucket-4 holdout | `No-Future Residual-Ridge ... RW=0.25 L=30 C=40` | 438 eval | 44.55 | 59.49 | 0.1394 | 0.0703 | 85.2% | 54.98 |

Interpretation: residual-ridge is the first new branch in this cycle with both 2026 and broad-history point-prediction support. It improves full-2026 score MAE from 60.43 to 60.36, margin MAE from 82.86 to 82.81, and Brier from 0.1578 to 0.1576. In the direct broad 2024-2026 comparison it beats the previous event-type residual family on score MAE, margin MAE, and Brier, though event-type residual still has better worst-event MAE and a slightly better fixed benchmark at `T=0.05`. Those gains are real but small, and the broad stability report is still `mixed` because relative and fixed-score holdouts disagree. This is exactly the right kind of progress for a serious model: promote the stronger hypothesis as the current point candidate, document the uncertainty, and keep searching.

## Follow-Up Iteration: RoleV3 Separated Role Signals

Problem: RoleV2 showed that role-aware defense features contain signal, but its combined net-swing proxy made it hard to tell whether the model was learning useful suppression, overreacting to foul risk, or simply using a noisy role label. The next hypothesis was that a residual-ridge model could use role information more safely if suppression value, consistency/confidence, foul exposure, offense cost, and defender-selection net swing were independent features.

Change implemented:

- Added RoleV3 no-future role features behind `useRoleV3Features`.
- For each team snapshot, estimated a pre-match role signal from prior offense, all-attempt opponent suppression, sample confidence, optional scout-defense evidence, foul exposure, and reliability penalty.
- For each alliance, exposed aggregate and best-candidate terms: suppression sum, consistency mean, foul exposure, offense cost, confidence, best defender value, best defender cost, best defender foul exposure, best net swing, selected net swing, and whether a defender is selected.
- Added exact manifests for 2026 and broad 2024-2026 RoleV3 full replays.
- Added regression coverage that RoleV3 features only use prior match history and remain zero before any relevant evidence exists.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Decision |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Strong RoleV3 | Strong RoleV2 | 60.27 | 82.64 | 0.1572 | 103.81 | Promising average-error gain, but tail worsens versus RoleV2. |
| 2024-2026 full replay | Strong RoleV3 | Strong RoleV3 | 32.26 | 44.15 | 0.1660 | 103.86 | Strongest broad full-replay point candidate so far, still near-tie. |

Comparison to defended residual baseline:

| Scope | Defended residual | Strong RoleV3 | Interpretation |
| --- | --- | --- | --- |
| 2026 | 60.36 / 82.81 / 0.1576 / 103.73 | 60.27 / 82.64 / 0.1572 / 103.81 | Better score, margin, and Brier; slightly worse worst-event risk. |
| 2024-2026 | 32.31 / 44.25 / 0.1665 / 103.76 | 32.26 / 44.15 / 0.1660 / 103.86 | Cleaner broad gain; still worsens the worst event. |

Cross-run deployment review:

| Model | Runs | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong RoleV3 | 2 | 2 | 1 | 39.36 | 53.90 | 0.1638 | 103.86 | 0.037 |
| Moderate RoleV3 | 2 | 0 | 0 | 39.38 | 53.91 | 0.1640 | 103.74 | 0.182 |
| Strong RoleV2 | 4 | 2 | 2 | 39.40 | 54.00 | 0.1642 | 103.67 | 0.223 |
| Defended residual `RW=0.25 L=30 C=40` | 6 | 2 | 0 | 39.42 | 54.01 | 0.1642 | 103.76 | 0.350 |

Completed broad holdout update:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2024-2026 bucket 0 | Strong RoleV3 | Strong RoleV2 | 43.14 | 59.62 | 0.1678 | 103.86 | RoleV3 confirms average gain, but RoleV2 still owns fixed/tail diagnostics. |
| 2024-2026 bucket 1 | Strong RoleV3 | Strong RoleV3 | 24.73 | 34.58 | 0.1769 | 98.99 | Clear RoleV3 win; cleaner than RoleV2 on this slice. |
| 2024-2026 bucket 2 | Strong RoleV3 | Moderate RoleV3 | 33.61 | 46.10 | 0.1628 | 92.87 | RoleV3 wins point/tail; Strong RoleV2 has slightly better Brier. |
| 2024-2026 bucket 3 | Moderate RoleV3 | Moderate RoleV3 | 35.42 | 47.28 | 0.1624 | 98.52 | Moderate RoleV3 is safer than Strong RoleV3 here. |
| 2024-2026 bucket 4 | Strong RoleV3 | Old role-feature residual | 21.80 | 29.93 | 0.1629 | 54.76 | RoleV3 improves the easiest slice without overcorrecting average score. |

Reflection: RoleV3 is now more than a clue. It is the strongest current point-model family because it wins both full replays and all five broad buckets at the family level without future leakage. Strong RoleV3 is the current point-default candidate because it has 6 relative wins across the clean RoleV3-suite report and the lowest deployment score. The caveat remains real: the stability review is still `mixed`, fixed-score winners split across RoleV3/RoleV2/old role features, and the worst-event maximum remains worse than the RoleV2 tail comparator. The most defensible stance is therefore: promote Strong RoleV3 as the best current point model, keep moderate RoleV3 as the average-error alternate, keep Strong RoleV2 as a tail-risk/defense robustness comparator, and next try a tail-guarded RoleV3 or RoleV3 plus TailRisk reporting layer.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/reports/role-v3-residual-ridge-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/role-v3-bucket-confirmation/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: RoleV3 TailRiskWinProb Overlay

Problem: Strong RoleV3 is now the best point model by full replay and broad bucket confirmation, but its worst-event maximum is worse than the Strong RoleV2 tail comparator. The next low-risk idea was to reuse the existing no-future TailRiskWinProb overlay, not to move score means, but to see whether probability calibration could improve while keeping Strong RoleV3's score advantage.

Change implemented:

- Added two Strong RoleV3 TailRiskWinProb candidates: `TP=0.75` and `TP=1.25`.
- Both share the exact Strong RoleV3 simulation seed so score forecasts remain comparable.
- Both keep `learnedTailCorrectionApplyToMean: false`, so the learned tail signal only changes win probabilities.
- Added 2026 and broad manifests for this branch; ran the full 2026 check first.

Result on full 2026:

| Model | Score MAE | Margin MAE | Brier | Worst event MAE | Relative benchmark | Fixed benchmark | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Strong RoleV3 | 60.27 | 82.64 | 0.1572 | 103.81 | 0.431 | 0.861 | Still the relative winner. |
| Strong RoleV3 + TailRiskWinProb `TP=0.75` | 60.27 | 82.64 | 0.1572 | 103.81 | 0.458 | 0.860 | Score-neutral, but not better overall. |
| Strong RoleV3 + TailRiskWinProb `TP=1.25` | 60.27 | 82.64 | 0.1572 | 103.81 | 0.505 | 0.860 | Stronger probability softening is worse by relative score. |
| Moderate RoleV3 | 60.31 | 82.63 | 0.1574 | 103.69 | 1.825 | 0.864 | Better tail, worse score/Brier. |
| Strong RoleV2 | 60.31 | 82.78 | 0.1575 | 103.59 | 2.542 | 0.860 | Still the fixed/tail comparator. |

Reflection: this branch is rejected as a model promotion after the 2026 smoke check. It did exactly what it was designed to do mechanically: score means, margins, and worst-event behavior stayed fixed. But the probability-only overlay did not improve the relative leaderboard enough to justify adding complexity to the current best model. It remains a useful reporting/diagnostic idea, but the next serious tail-risk attempt should operate on role choice or residual correction directly, not only on win-probability softening.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-v3-tailrisk-winprob/MODEL_CARD.md`
- `modeling/artifacts/reports/role-v3-tailrisk-winprob-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: RoleV3 TailGuarded Mean Correction

Problem: the RoleV3 point model improved average score and margin, but kept a worse maximum worst-event MAE than the Strong RoleV2 tail comparator. The previous TailRiskWinProb overlay was too weak because it only softened win probabilities and left score means unchanged. The next hypothesis was that the same no-future learned-tail signal might be useful if it made a small, gated correction to expected scores.

Change implemented:

- Added two Strong RoleV3 TailGuarded candidates that share the Strong RoleV3 Monte Carlo seed.
- The conservative candidate uses `TW=0.20 TL=50 TN=32 TC=20 F=PR G=8/R4/F20`.
- The stronger candidate uses `TW=0.35 TL=40 TN=24 TC=25 F=PR G=8/R4/F20`.
- Both use the existing no-future gate, so the correction can only open after enough prior event residual evidence exists.
- Added full 2026 and broad 2024-2026 exact manifests and generated a cross-run report at `modeling/artifacts/reports/role-v3-tailguard-check/CROSS_RUN_SUMMARY.md`.
- Added five exact broad bucket manifests; all five buckets are now complete.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Decision |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Conservative TailGuarded Strong RoleV3 | Strong RoleV2 | 60.27 | 82.64 | 0.1572 | 103.80 | Tiny tail improvement; still a near-tie. |
| 2024-2026 full replay | Conservative TailGuarded Strong RoleV3 | Conservative TailGuarded Strong RoleV3 | 32.26 | 44.15 | 0.1660 | 103.84 | Broad full replay confirms the same tiny direction. |
| 2024-2026 bucket 0 | Stronger TailGuarded Strong RoleV3 | Strong RoleV2 | 43.14 | 59.62 | 0.1678 | 103.82 | First holdout confirms tiny tail gain, but not fixed/tail ownership. |
| 2024-2026 bucket 1 | Stronger TailGuarded Strong RoleV3 | Stronger TailGuarded Strong RoleV3 | 24.72 | 34.58 | 0.1769 | 98.81 | Stronger holdout support: wins relative and fixed benchmarks. |
| 2024-2026 bucket 2 | Stronger TailGuarded Strong RoleV3 | Moderate RoleV3 | 33.61 | 46.10 | 0.1628 | 92.86 | Supportive but modest; fixed benchmark still prefers moderate RoleV3. |
| 2024-2026 bucket 3 | Stronger TailGuarded Strong RoleV3 | Moderate RoleV3 | 35.40 | 47.33 | 0.1626 | 98.36 | Relative win with tail gain; margin/Brier/fixed score still favor moderate or conservative RoleV3 variants. |
| 2024-2026 bucket 4 | Strong RoleV3 | Strong RoleV2 | 21.80 | 29.93 | 0.1629 | 54.76 | Final easy slice does not reward TailGuard; both TailGuard variants tie rounded metrics but lose exact relative score. |

Comparison:

| Model | Runs in tailguard report | Relative wins | Fixed wins | Max worst-event MAE | Point deployment score | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Conservative TailGuarded Strong RoleV3 | 7 | 2 | 1 | 103.84 | 0.145 | Current deployment-rule point candidate; best stability-adjusted score, but only full-replay relative wins. |
| Stronger TailGuarded Strong RoleV3 | 7 | 4 | 1 | 103.82 | 0.161 | High-tail specialist; wins buckets 0-3 but loses bucket 4 and is not the most stable candidate. |
| Strong RoleV3 | 14 | 7 | 2 | 103.86 | 0.202 | Simpler defended baseline; still strongest holdout relative leader, especially on bucket 4. |
| Strong RoleV2 | 14 | 0 | 5 | 103.67 | 0.585 | Remains the fixed/tail diagnostic comparator, not a point default. |

Reflection: this branch is not rejected, but it is also not a clean "we solved it" promotion. It gives a consistent, small worst-event improvement without hurting rounded full-replay MAE/Brier, which means the tail signal is probably real. Bucket 0 strengthens that clue because the stronger tailguard improves worst-event MAE from Strong RoleV3's 103.86 to 103.82 while keeping rounded average metrics fixed. Bucket 1 is stronger evidence because the stronger tailguard improves score MAE from 24.73 to 24.72 and worst-event MAE from 98.99 to 98.81 while also winning the fixed benchmark. Bucket 2 is a stress test that previous tail ideas often failed; TailGuarded survives it, but only by a hair, and fixed scoring still prefers moderate RoleV3. Bucket 3 confirms the same pattern while showing the cost: the stronger tailguard owns the generated relative score and the best tail number, but conservative/Strong RoleV3 have tiny margin/Brier advantages and moderate RoleV3 wins fixed score. Bucket 4 is the corrective: on the easiest slice, plain Strong RoleV3 wins the exact relative benchmark, the TailGuard variants only tie rounded metrics, and Strong RoleV2 wins fixed score by a microscopic amount. The cleanest current stance is: conservative TailGuard is the current deployment-rule point candidate because the benchmark includes overfit/fragility penalties and still ranks it first; Strong RoleV3 remains the simpler baseline we should keep showing judges; stronger TailGuard is a high-tail specialist; and the next iteration should be a selective chooser/blend that only borrows stronger TailGuard behavior when no-future event-state diagnostics identify a high-tail regime.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tail-guarded/MODEL_CARD.md`
- `modeling/artifacts/reports/role-v3-tailguard-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Selective RoleV3 TailGuard Gate

Problem: the completed TailGuard sweep showed a real but tiny tail signal, plus a clear warning from bucket 4. Stronger TailGuard won buckets 0-3, but the easy bucket 4 preferred plain Strong RoleV3 by exact relative score. A universal stronger correction is therefore too blunt. The next hypothesis is a selective gate: use the stronger correction only when pre-match event diagnostics indicate a high-tail regime.

Change implemented:

- Added `SelectiveTailGuarded Strong RoleV3` as a new local model candidate.
- It keeps the stronger TailGuard correction weight `TW=0.35`, but changes the gate to require both prior residual evidence and prior event score-scale evidence.
- The gate is stricter: `G=12/R8/S10/MIN/F28`, meaning 12 prior event samples, residual threshold 8, score-delta threshold 10, min-combined gate, and slower full activation.
- Added `modeling/experiments/current-2026-role-v3-selective-tailguard.json` as a full-2026 smoke manifest before spending broad bucket compute.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Decision |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | SelectiveTailGuarded Strong RoleV3 | Strong RoleV2 | 60.26 | 82.64 | 0.1572 | 103.79 | Positive smoke: tiny score/tail gain without rounded margin/Brier cost; still near-tie. |
| 2024-2026 bucket 4 | Strong RoleV3 | Strong RoleV2 | 21.80 | 29.93 | 0.1629 | 54.76 | First broad holdout rejects SelectiveTailGuard on the easy slice; SelectiveTailGuard ranks fourth by exact relative score. |
| 2024-2026 bucket 1 | Stronger TailGuarded Strong RoleV3 | Stronger TailGuarded Strong RoleV3 | 24.72 | 34.58 | 0.1769 | 98.81 | Supportive slice also rejects SelectiveTailGuard; it ranks fourth and fails to preserve the stronger TailGuard gain. |

Comparison to immediate baselines:

| Model | Score MAE | Margin MAE | Brier | Worst event MAE | Relative score | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Strong RoleV3 | 60.27 | 82.64 | 0.1572 | 103.81 | 0.658 | Simpler baseline. |
| Conservative TailGuard | 60.27 | 82.64 | 0.1572 | 103.80 | 0.506 | Completed broad confirmation; current deployment-rule candidate. |
| Stronger TailGuard | 60.27 | 82.64 | 0.1572 | 103.79 | 0.552 | High-tail specialist. |
| SelectiveTailGuard | 60.26 | 82.64 | 0.1572 | 103.79 | 0.414 | Best full-2026 smoke result; needs broad bucket confirmation. |

Reflection: this is exactly the kind of follow-up the bucket-4 result asked for, and it gave the honest answer we needed. SelectiveTailGuard is rejected as a promotion path. It improves exact full-2026 score MAE and keeps the stronger tail gain while leaving rounded margin and Brier unchanged, but the broad checks do not confirm it. Bucket 4 was the failure-mode slice and it failed there: Strong RoleV3 remains best by exact relative benchmark, while SelectiveTailGuard spends a tiny amount of score MAE. Bucket 1 was the supportive slice and it also failed there: stronger TailGuard keeps the bucket-1 gain while SelectiveTailGuard falls back near plain Strong RoleV3. The defended story should now be stable: conservative TailGuard is the current deployment-rule point candidate, Strong RoleV3 is the simple baseline, stronger TailGuard is a high-tail specialist, and SelectiveTailGuard is a documented rejected branch that shows we tested a smarter-sounding idea and let the holdouts say no.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-v3-selective-tailguard/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-selective-tailguard/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-selective-tailguard/MODEL_CARD.md`
- `modeling/artifacts/reports/role-v3-selective-tailguard-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Championship Phase+Residual-Boost Holdout Completion

Problem: the phase+residual-boost hybrid looked promising after broad full replay and bucket 0, but one holdout is not enough to promote a correction that explicitly targets the hardest championship-like tails. The question was whether the improvement survived the remaining broad 2024-2026 event buckets without overcorrecting easier slices.

Change tested:

- Added exact bucket manifests for broad buckets 1-4 using the same four-candidate set: conservative residual-ridge, phase-only championship shift, residual-boost-only, and phase+residual-boost.
- Ran all remaining broad holdout buckets and regenerated `modeling/artifacts/reports/championship-residual-boost-tail-check/CROSS_RUN_SUMMARY.md`.
- Kept the same leakage boundary: all features and residual shifts are computed only from matches known before the predicted match.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Bucket 0 | Phase+residual boost | Residual boost | 43.13 | 59.64 | 0.1684 | 103.30 | Tail improvement confirmed, still `near_tie`. |
| Bucket 1 | Phase+residual boost | Residual boost | 24.74 | 34.68 | 0.1776 | 97.40 | Better score/tail, weaker Brier than baseline. |
| Bucket 2 | Conservative residual-ridge | Conservative residual-ridge | 33.64 | 46.20 | 0.1627 | 93.04 | Clear warning against universal boost. |
| Bucket 3 | Phase+residual boost | Phase-only | 35.41 | 47.46 | 0.1629 | 98.26 | Score/tail win, margin/Brier tradeoff. |
| Bucket 4 | Residual boost | Phase-only | 21.91 | 30.07 | 0.1638 | 54.77 | Easy slice; baseline has better score/margin/Brier. |

Deployment review:

| Model | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score | Robustness score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Phase+residual boost | 4/7 | 0/7 | 36.37 | 49.87 | 0.1653 | 103.30 | 0.252 | 0.416 |
| Conservative residual-ridge | 1/7 | 2/7 | 36.38 | 49.84 | 0.1652 | 103.76 | 0.339 | 0.670 |
| Residual boost only | 1/7 | 2/7 | 36.38 | 49.88 | 0.1653 | 103.53 | 0.366 | 0.662 |
| Phase-only | 1/7 | 2/7 | 36.39 | 49.86 | 0.1654 | 103.38 | 0.512 | 0.948 |

Reflection: the hybrid is a real clue, not a clean promotion. It has the best point deployment score inside this exact tail-correction set and trims max worst-event MAE by about 0.46 against the conservative residual baseline, but the average metric differences are tiny, all seven runs are `near_tie`, fixed-score winners split, and the stability report remains `mixed`. Bucket 2 is especially important because it rejects the boost by both relative and fixed scoring. The next serious tail experiment should not be a larger fixed bump; it should be a no-future gated selector that only turns on the tail correction when pre-match event residual evidence says the baseline is underpredicting. Until that exists and survives 2026 plus broad bucket confirmation, the defended operational point model stays the conservative residual-ridge default.

Artifacts:

- `modeling/artifacts/runs/holdout-2024-2026-bucket1-championship-residual-boost-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-championship-residual-boost-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-championship-residual-boost-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-championship-residual-boost-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/championship-residual-boost-tail-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Residual-Mean Gated Championship Tail Selector

Problem: the completed phase+residual-boost sweep showed a tempting but messy pattern: better score and worst-event behavior, but worse margin/Brier and no fixed-score holdout wins. A fixed universal boost is too blunt, so the next hypothesis was to gate the championship tail correction using only prior event residual evidence.

Change implemented:

- Added `championshipTailResidualGateMinSamples`, `championshipTailResidualGateWindow`, `championshipTailResidualGateThreshold`, and `championshipTailResidualGateFullAt` to `ModelConfig`.
- The gate multiplies both the fixed championship phase shift and the championship residual boost.
- With no gate fields set, existing candidates are unchanged.
- With gate fields set, the correction opens only when enough prior alliance rows in the same event have positive mean residuals above the configured threshold.
- Added exact manifests:
  - `modeling/experiments/current-2026-gated-championship-tail.json`
  - `modeling/experiments/current-2024-2026-gated-championship-tail.json`
- Added a regression test proving the gate blocks before enough prior residuals exist and opens only after no-future residual evidence is available.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Ungated phase+residual boost | Strict gate `G=8/18/18` | 60.35 | 82.86 | 0.1577 | 103.30 | Ungated wins score/tail; conservative baseline still has better margin/Brier. |
| 2024-2026 full replay | Ungated phase+residual boost | Moderate gate `G=4/18/24` | 32.30 | 44.28 | 0.1666 | 103.30 | Gate improves fixed score only; does not beat the ungated relative winner. |

Deployment review on the two full replays:

| Model | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ungated phase+residual boost | 2/2 | 0/2 | 39.41 | 54.05 | 0.1644 | 103.30 | 0.093 |
| Residual boost only | 0/2 | 0/2 | 39.41 | 54.05 | 0.1643 | 103.53 | 0.203 |
| Conservative residual-ridge | 0/2 | 0/2 | 39.42 | 54.01 | 0.1642 | 103.76 | 0.344 |
| Moderate gate `G=4/18/24` | 0/2 | 1/2 | 39.42 | 54.04 | 0.1644 | 103.59 | 0.364 |
| Strict gate `G=8/18/18` | 0/2 | 1/2 | 39.43 | 54.06 | 0.1643 | 103.60 | 0.523 |

Reflection: this first gate family is rejected as a point-model promotion. It did what it was supposed to do mechanically, but not statistically. The soft gate lagged and lost both 2026 and broad replays. The moderate gate reduced some margin damage and won broad fixed score, but still lost the relative score and did not beat the conservative baseline on the most important 2026 margin/Brier evidence. The stricter gate won 2026 fixed score but had worse point metrics. The lesson is useful: simply gating by recent mean residual is not enough. The next branch should either separate the score expectation layer from win-probability calibration, or learn a smaller phase/event correction from pre-match features instead of using a hand-shaped residual gate.

Artifacts:

- `modeling/artifacts/runs/current-2026-gated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-gated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/gated-championship-tail-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/runs/current-2026-win-calibrated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-win-calibrated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/win-calibrated-championship-tail-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Split Championship Tail Score From Win Calibration

Problem: the phase+residual championship tail improves score MAE and worst-event MAE, but it hurts margin and Brier against the conservative residual baseline. The next question was whether the score expectation could keep the tail correction while win probability stayed calibrated from a parallel no-tail state.

Change implemented:

- Added `winProbabilityScoreSource: 'noChampionshipTailOnlineEpa'` to `ModelConfig`.
- Split event context into ordinary event/archetype shifts versus championship phase/residual tail shifts.
- Added a parallel online EPA state used only for win probability. It receives the same component and residual correction layers, but excludes championship phase/residual tail shifts.
- Added `simulationSeedName` so calibration-only variants can share the exact Monte Carlo score seed with the score-tail candidate. This avoids accidentally changing score forecasts just because the candidate name changed.
- Added regression coverage proving the split can change win probability while keeping ensemble score predictions identical when the shared seed is set.
- Added exact manifests:
  - `modeling/experiments/current-2026-win-calibrated-championship-tail.json`
  - `modeling/experiments/current-2024-2026-win-calibrated-championship-tail.json`

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Calibration | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Phase+residual boost | WinCal-NoTail | 60.3490 | 82.8629 | 0.15771 | 0.01314 for WinCal | 103.30 | WinCal keeps score/margin identical and improves calibration, but Brier is still worse than conservative residual. |
| 2024-2026 full replay | Phase+residual boost | WinCal-NoTail | 32.3039 | 44.2793 | 0.16662 | 0.00803 for WinCal | 103.30 | Same pattern: better calibration and fixed score, but no Brier rescue. |

Comparison against conservative residual:

| Scope | Conservative score/margin/Brier | Tail/WinCal score/margin/Brier | Decision |
| --- | --- | --- | --- |
| 2026 | 60.3638 / 82.8090 / 0.157576 | 60.3490 / 82.8629 / 0.157718 | Tail gains score/worst-event, but loses margin/Brier. |
| 2024-2026 | 32.3139 / 44.2516 / 0.166458 | 32.3039 / 44.2793 / 0.166615 | Broad replay repeats the tradeoff. |

Reflection: this was a good infrastructure iteration and a rejected promotion. The no-tail probability head does exactly what it was designed to do: it isolates score expectation from win calibration and improves calibration error on both full replays. But the actual Brier score still worsens, and Brier is the cleaner probability objective than calibration alone. A model can be better calibrated on average while assigning enough probability mass to the wrong side in close matches to lose Brier. The defended operational default therefore remains conservative residual-ridge. The next tail branch should stop hand-shaping global championship corrections and instead learn a small no-future event/phase correction from pre-match features, then require bucket confirmation before promotion.

Artifacts:

- `modeling/artifacts/runs/current-2026-win-calibrated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-win-calibrated-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/win-calibrated-championship-tail-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Learned Championship Tail Residual Correction

Problem: fixed phase/residual championship boosts and the no-tail WinCal split both found real tail signal, but neither cleanly improved score, margin, and Brier together. The next hypothesis was to learn a small tail correction from pre-match championship-like features instead of hand-shaping the correction.

Change implemented:

- Added `learnedTailCorrectionWeight`, `learnedTailCorrectionLambda`, `learnedTailCorrectionMinRows`, `learnedTailCorrectionClip`, `learnedTailCorrectionScope`, `learnedTailCorrectionFeatureSet`, and `learnedTailCorrectionPositiveOnly` to `ModelConfig`.
- Added a separate no-future residual-ridge accumulator for tail examples. It records only prediction-time feature rows and only after the match prediction is complete, so the fitted correction never sees current-match results before prediction.
- Tail features include championship/district championship scope, phase, prior event row count, prior event residual mean, prior event score delta, event week, and event team count depending on feature-set choice.
- Added regression coverage proving the learned tail does not affect regional rows, waits for prior championship residuals, and only changes later championship predictions.
- Added exact manifests:
  - `modeling/experiments/current-2026-learned-championship-tail.json`
  - `modeling/experiments/current-2024-2026-learned-championship-tail.json`

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Calibration | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | LearnedTail `TW=0.50 TL=15 TN=16 TC=35 F=PRS POS` | Same | 60.28 | 82.84 | 0.1580 | 0.0111 | 102.94 | Best tail score/worst-event result so far, but Brier worsens. |
| 2026 conservative learned tail | LearnedTail `TW=0.35 TL=40 TN=24 TC=25 F=PR` | n/a | 60.36 | 82.75 | 0.15755 | 0.0141 | 103.68 | Better 2026 margin/Brier than defended residual, but tiny and not broad-confirmed. |
| 2024-2026 full replay | LearnedTail `TW=0.50 TL=15 TN=16 TC=35 F=PRS POS` | LearnedTail `TW=0.35 TL=40 TN=24 TC=25 F=PR` | 32.30 | 44.28 | 0.1668 | 0.0085 | 103.40 | Relative winner, but Brier/margin tradeoff remains. |
| 2024-2026 conservative learned tail | LearnedTail `TW=0.35 TL=40 TN=24 TC=25 F=PR` | Same | 32.31 | 44.25 | 0.16656 | 0.0075 | 103.71 | Good calibration/fixed score, but still worse Brier than conservative residual. |

Comparison against defended conservative residual:

| Scope | Defended residual | Best learned tail | Decision |
| --- | --- | --- | --- |
| 2026 | 60.36 / 82.81 / 0.15758 / 103.73 | 60.28 / 82.84 / 0.15797 / 102.94 | Learned tail gives meaningful score/tail gain but spends Brier. |
| 2024-2026 | 32.31 / 44.25 / 0.16646 / 103.76 | 32.30 / 44.28 / 0.16676 / 103.40 | Broad relative winner, still not a clean probability default. |

Reflection: this is the strongest tail branch so far, but it still should not replace the defended point model yet. The learned correction is better than the hand-shaped phase+residual boost on the two full replays and it is methodologically cleaner because it learns from no-future residual evidence. However, the leaderboard still marks every promotion as `near_tie`, and the Brier cost persists. The feature-reduced learned tail is a subtler clue: it improves 2026 margin and fixed-score diagnostics, but broad Brier remains worse than plain residual. The next serious test is not another full-replay tweak; it is checkpointed event-bucket confirmation for the two learned-tail variants, especially broad bucket 2 where previous championship-tail ideas failed.

Artifacts:

- `modeling/artifacts/runs/current-2026-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/learned-championship-tail-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Learned Championship Tail Bucket-2 Confirmation

Problem: the learned championship-tail branch won the two full replays, but full replays are not enough. The earlier hand-shaped championship-tail candidate failed broad bucket 2, so bucket 2 is a useful first confirmation slice for whether learned tail is real signal or just an over-specialized full-replay adjustment.

Change tested:

- Added `modeling/experiments/holdout-2024-2026-bucket2-learned-championship-tail.json`.
- Candidate set: defended conservative residual-ridge, the previous hand-shaped phase+residual boost, aggressive learned tail `TW=0.50 TL=15 TN=16 TC=35 F=PRS POS`, and feature-reduced learned tail `TW=0.35 TL=40 TN=24 TC=25 F=PR`.
- Generated `modeling/artifacts/reports/learned-championship-tail-bucket2-check/CROSS_RUN_SUMMARY.md` from the two full replays plus the new bucket-2 holdout.

Result on broad 2024-2026 bucket 2:

| Rank | Model | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Calibration | Worst event MAE | Interpretation |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Aggressive learned tail `TW=0.50 TL=15 TN=16 TC=35 F=PRS POS` | 3.810 | 4.536 | 33.62 | 46.24 | 0.1628 | 0.0167 | 93.06 | Relative winner, but only because score MAE improves slightly. |
| 2 | Defended residual-ridge `RW=0.25 L=30 C=40` | 3.864 | 4.540 | 33.64 | 46.20 | 0.1627 | 0.0167 | 93.04 | Better margin, Brier, and worst-event behavior. |
| 3 | Feature-reduced learned tail `TW=0.35 TL=40 TN=24 TC=25 F=PR` | 3.924 | 4.532 | 33.64 | 46.20 | 0.1627 | 0.0162 | 93.29 | Fixed-score winner, but tail risk worsens. |
| 4 | Hand-shaped phase+residual boost | 4.902 | 4.546 | 33.67 | 46.28 | 0.1630 | 0.0165 | 93.30 | Rejected on this bucket. |

Deployment review across 2026 full, broad full, and bucket 2:

| Model | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score | Robustness score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Aggressive learned tail | 3/3 | 1/3 | 38.58 | 52.96 | 0.1643 | 103.40 | 0.072 | 0.084 |
| Feature-reduced learned tail | 0/3 | 2/3 | 38.61 | 52.91 | 0.1641 | 103.71 | 0.312 | 0.604 |
| Defended residual-ridge | 0/3 | 0/3 | 38.61 | 52.93 | 0.1640 | 103.76 | 0.511 | 0.995 |

Reflection: this is partial confirmation, not a promotion. The aggressive learned tail now wins one real holdout bucket by the relative leaderboard, so it is not just a full-replay mirage. But the win is small and not well-rounded: it improves bucket-2 score MAE by about 0.02 points while losing margin, Brier, and worst-event MAE to the defended baseline. The feature-reduced learned tail is interesting for fixed-score diagnostics, but its worse bucket-2 worst-event behavior makes it a bad robustness default. The learned-tail family should stay alive, but the defended operational model remains plain residual-ridge until learned tail survives more buckets with cleaner probability and margin behavior. Practical note: learned-tail bucket replay is much slower than ordinary residual-ridge because it refits an online ridge tail correction, so the next infrastructure improvement should cache or sufficient-stat the learned-tail fit before running the full five-bucket confirmation suite.

Artifacts:

- `modeling/artifacts/runs/holdout-2024-2026-bucket2-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/learned-championship-tail-bucket2-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Learned Championship Tail Buckets 0-1 Confirmation

Problem: bucket 2 gave partial support to aggressive learned-tail but also showed the same margin/Brier tradeoff seen in full replays. The next question was whether learned-tail generalizes across different held-out event buckets, especially a high-error slice (bucket 0) and a lower-error slice (bucket 1).

Change tested:

- Added exact bucket manifests for buckets 0, 1, 3, and 4. The new manifests compare only the defended residual baseline against the two learned-tail variants because the older hand-shaped phase/residual boost already lost bucket 2.
- Ran buckets 0 and 1.
- Generated `modeling/artifacts/reports/learned-championship-tail-buckets012-check/CROSS_RUN_SUMMARY.md` from the two full replays plus buckets 0, 1, and 2.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Full 2026 | Aggressive learned tail | Aggressive learned tail | 60.28 | 82.84 | 0.1580 | 102.94 | Best tail score/worst-event replay, but Brier tradeoff. |
| Full 2024-2026 | Aggressive learned tail | Feature-reduced learned tail | 32.30 | 44.28 | 0.1668 | 103.40 | Full replay likes aggressive score correction, not probability quality. |
| Bucket 0 | Feature-reduced learned tail | Feature-reduced learned tail | 43.17 | 59.67 | 0.1684 | 103.71 | Mild support for conservative learned-tail; all deltas are small. |
| Bucket 1 | Defended residual-ridge | Feature-reduced learned tail | 24.76 | 34.68 | 0.1775 | 98.18 | Rejects learned-tail as a universal default on a lower-error slice. |
| Bucket 2 | Aggressive learned tail | Feature-reduced learned tail | 33.62 | 46.24 | 0.1628 | 93.06 | Aggressive wins score only; baseline keeps margin/Brier/tail edge. |

Combined deployment review:

| Model | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score | Robustness score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Aggressive learned tail | 3/5 | 1/5 | 37.86 | 52.07 | 0.1659 | 103.40 | 0.235 | 0.435 |
| Feature-reduced learned tail | 1/5 | 4/5 | 37.88 | 52.03 | 0.1657 | 103.71 | 0.347 | 0.684 |
| Defended residual-ridge | 1/5 | 0/5 | 37.89 | 52.04 | 0.1656 | 103.76 | 0.477 | 0.927 |

Reflection: the learned-tail branch is real, but not stable enough to promote. The strongest positive reading is that the aggressive branch improves score and worst-event behavior on the hard high-score tails, while the feature-reduced branch wins fixed-score diagnostics more often and can slightly improve Brier on bucket 0. The strongest negative reading is more important for deployment: the full-replay aggressive winner fails holdout confirmation, bucket 1 rejects both learned-tail variants on point metrics, and all results remain near-ties. This is a good research outcome because it prevents us from overclaiming a flashy full-replay winner. The next useful model idea should either make learned-tail conditional on a clearer pre-match evidence trigger or move the tail correction into uncertainty reporting instead of the mean score default. Buckets 3 and 4 remain available, but current evidence already says learned-tail should not replace plain residual-ridge yet.

Artifacts:

- `modeling/artifacts/runs/holdout-2024-2026-bucket0-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/learned-championship-tail-buckets012-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Conditional Learned-Tail Routing

Problem: ungated learned-tail found real high-error tail signal, but it was too eager. Bucket 1 showed the failure mode clearly: both ungated learned-tail variants damaged point metrics on a lower-error slice. The next hypothesis was to route learned-tail only when pre-match event residual evidence says the event is already being underpredicted.

Change implemented:

- Added learned-tail gate fields to `ModelConfig`: `learnedTailCorrectionGateMinSamples`, `learnedTailCorrectionGateWindow`, `learnedTailCorrectionGateResidualThreshold`, `learnedTailCorrectionGateScoreDeltaThreshold`, and `learnedTailCorrectionGateFullAt`.
- The gate uses only prior event residuals and prior event score scale, then multiplies the learned-tail correction by a 0-1 gate. No current-match result can open the gate.
- Added two conditional candidates:
  - aggressive conditional learned-tail `TW=0.50 TL=15 TN=16 TC=35 F=PRS POS G=8/R4/F20`
  - conservative conditional learned-tail `TW=0.35 TL=40 TN=24 TC=25 F=PR G=8/R4/F20`
- Added regression coverage proving a closed learned-tail gate leaves predictions identical to baseline and an open gate can affect later championship predictions.
- Added exact manifests:
  - `modeling/experiments/holdout-2024-2026-bucket1-conditional-learned-championship-tail.json`
  - `modeling/experiments/current-2026-conditional-learned-championship-tail.json`

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Calibration | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Bucket 1 ungated reference | Defended residual-ridge | Ungated feature-reduced learned-tail | 24.76 | 34.68 | 0.1775 | 0.0191 | 98.18 | Ungated learned-tail did not fix point metrics. |
| Bucket 1 conditional | Conservative conditional learned-tail | Same | 24.75 | 34.65 | 0.1774 | 0.0172 | 98.38 | Gate fixes the average-error failure mode, but worsens worst-event MAE. |
| 2026 conditional | Defended residual-ridge | Aggressive conditional learned-tail | 60.36 | 82.81 | 0.1576 | 0.0136 | 103.73 | Plain residual still wins relative point score. |
| 2026 conservative conditional | n/a | n/a | 60.37 | 82.78 | 0.1575 | 0.0139 | 103.55 | Better margin/Brier/tail, slightly worse score MAE. |
| 2026 aggressive conditional | n/a | n/a | 60.41 | 82.86 | 0.1577 | 0.0098 | 103.43 | Better calibration/tail, worse point metrics. |

Reflection: this was a useful refinement, not a promotion. The gate is methodologically sound and it proves that learned-tail can be made less reckless: on bucket 1, the conservative conditional route beats the defended baseline on score, margin, Brier, and calibration. But the main 2026 replay still ranks plain residual-ridge first by relative point benchmark, and the conditional candidates trade exact score quality for robustness/probability clues. The next iteration should stop pushing learned-tail into the mean score. A better use is likely uncertainty: widen championship/high-residual intervals or report a tail-risk flag while leaving the defended residual mean prediction alone.

Artifacts:

- `modeling/artifacts/runs/holdout-2024-2026-bucket1-conditional-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2026-conditional-learned-championship-tail/MODEL_CARD.md`
- `modeling/artifacts/reports/conditional-learned-tail-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Learned-Tail Tail-Risk Intervals

Problem: the conditional learned-tail branch proved that championship/high-residual tail signal exists, but applying it to mean score remained unstable. The next hypothesis was narrower: keep the defended residual-ridge expected score untouched, and use the learned-tail signal only to widen the side of the prediction interval that the model believes is at risk.

Change implemented:

- Added `learnedTailCorrectionApplyToMean`, `learnedTailUncertaintyWeight`, and `learnedTailUncertaintyClip` to `ModelConfig`.
- Refactored learned-tail scoring so the same no-future gated residual signal can either alter the mean or act only as an interval-widening signal.
- Added TailRisk interval candidates with `TW=0.35`, championship scope, phase/residual features, `G=8/R4/F20`, and uncertainty weights `TU=0.75` and `TU=1.25`.
- Set `simulationSeedName` to the defended residual-ridge baseline for these interval-only candidates. A first replay exposed a seed-contamination bug: changing only the model name changed Monte Carlo samples and therefore point metrics. After adding the seed alias, interval-only candidates kept score/margin predictions identical to baseline, which is the correct isolation test.
- Added regression coverage proving interval-only TailRisk leaves expected scores unchanged while allowing later championship `p90Score`/`p10Score` widening.
- Updated cross-run reporting so TailRisk models are labeled as uncertainty/reporting candidates or uncertainty diagnostics, not point-default candidates, even when their deployment score ranks first.

Result:

| Scope | Candidate | Score MAE | Margin MAE | Brier | Calibration | Coverage | Width | Worst event MAE | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Defended residual-ridge | 60.3638 | 82.8090 | 0.157576 | 0.013558 | 76.91% | 171.28 | 103.73 | Baseline point model. |
| 2026 full replay | TailRisk `TU=0.75` | 60.3638 | 82.8090 | 0.157559 | 0.013271 | 76.93% | 171.38 | 103.73 | Same point metrics; slightly better Brier/calibration/coverage. |
| 2026 full replay | TailRisk `TU=1.25` | 60.3638 | 82.8090 | 0.157548 | 0.013316 | 76.94% | 171.45 | 103.73 | Best fixed-score diagnostic, with slightly wider intervals. |
| Broad bucket 0 | Defended residual-ridge | 43.1829 | 59.6746 | 0.168513 | 0.018511 | 74.86% | 115.05 | 103.76 | Baseline for a high-error confirmation slice. |
| Broad bucket 0 | TailRisk `TU=0.75` | 43.1829 | 59.6746 | 0.168485 | 0.017992 | 74.90% | 115.13 | 103.76 | Same point metrics; best relative score in this slice. |
| Broad bucket 0 | TailRisk `TU=1.25` | 43.1829 | 59.6746 | 0.168467 | 0.017952 | 74.95% | 115.19 | 103.76 | Best Brier/fixed score in this slice. |
| Broad bucket 1 | Defended residual-ridge | 24.7620 | 34.6809 | 0.177484 | 0.019116 | 79.07% | 75.37 | 98.18 | Baseline for lower-error confirmation slice. |
| Broad bucket 1 | TailRisk `TU=0.75` | 24.7620 | 34.6809 | 0.177463 | 0.018174 | 79.11% | 75.40 | 98.18 | Same point metrics; best relative score in this interval-only check. |
| Broad bucket 1 | TailRisk `TU=1.25` | 24.7620 | 34.6809 | 0.177451 | 0.018145 | 79.13% | 75.42 | 98.18 | Best Brier/fixed score in this slice. |
| Broad bucket 2 | Defended residual-ridge | 33.6355 | 46.2032 | 0.162655 | 0.016706 | 78.38% | 98.67 | 93.04 | Baseline wins relative score. |
| Broad bucket 2 | TailRisk `TU=1.25` | 33.6355 | 46.2032 | 0.162648 | 0.016681 | 78.38% | 98.74 | 93.04 | Best Brier/fixed score, no coverage gain. |
| Broad bucket 3 | Defended residual-ridge | 35.4568 | 47.4218 | 0.162838 | 0.022075 | 76.66% | 95.55 | 98.41 | Baseline wins relative score. |
| Broad bucket 3 | TailRisk `TU=1.25` | 35.4568 | 47.4218 | 0.162810 | 0.021909 | 76.71% | 95.67 | 98.41 | Best Brier/calibration/coverage/fixed score. |
| Broad bucket 4 | Defended residual-ridge | 21.8965 | 30.0520 | 0.163657 | 0.018266 | 79.60% | 69.63 | 55.05 | Baseline wins relative score. |
| Broad bucket 4 | TailRisk `TU=1.25` | 21.8965 | 30.0520 | 0.163644 | 0.018297 | 79.66% | 69.65 | 55.05 | Best Brier/coverage/fixed score but slightly worse calibration. |

Reflection: this is the cleanest learned-tail result so far, but still not a point-model promotion. It improves the things an interval overlay should improve and leaves the defended mean score untouched. The full five-bucket confirmation changed the interpretation from "possible default overlay" to "useful uncertainty diagnostic with a mixed deployment story." TailRisk improves Brier on every checked slice and `TU=1.25` wins fixed-score diagnostics on every TailRisk run, but the relative benchmark rejects TailRisk on buckets 2, 3, and 4. That matters because the leaderboard intentionally penalizes overfit-looking gains even when a single metric improves. The next model idea should not keep widening the same TailRisk overlay blindly. A better next step is to derive a conditional reporting rule: show TailRisk intervals only when pre-match residual/tail evidence is strong, or train an interval-only calibration layer directly against coverage/Brier without letting it claim point-model promotion.

Artifacts:

- `modeling/artifacts/runs/current-2026-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-tail-risk-interval/MODEL_CARD.md`
- `modeling/artifacts/reports/tail-risk-interval-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: TailRisk Win-Probability Only

Problem: the completed TailRisk interval sweep suggested the learned-tail signal was useful, but not primarily as wider score intervals. Brier improved on every checked slice, while the relative benchmark rejected interval widening on buckets 2, 3, and 4. The next hypothesis was to apply the tail-risk signal only to win-probability uncertainty, leaving mean scores and score intervals unchanged.

Change implemented:

- Added `learnedTailWinProbabilityWeight` and `learnedTailWinProbabilityClip` to `ModelConfig`.
- Added TailRiskWinProb candidates with the same no-future learned-tail gate and feature set as TailRiskInterval, but no interval widening.
- The win-probability-only adjustment increases the analytic win-probability standard deviation from the tail-risk signal; expected scores, `p10Score`, and `p90Score` are not changed.
- Extended regression coverage so probability-only TailRisk preserves expected scores and score intervals while producing explicit win probabilities.
- Updated report short names and uncertainty-only role labeling for TailRiskWinProb.

Result:

| Scope | Candidate | Score MAE | Margin MAE | Brier | Calibration | Coverage | Width | Relative score | Fixed score | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Defended residual-ridge | 60.3638 | 82.8090 | 0.157576 | 0.013558 | 76.91% | 171.28 | 0.423 | 0.867 | Baseline point model. |
| 2026 full replay | TailRiskWinProb `TP=0.75` | 60.3638 | 82.8090 | 0.157559 | 0.013269 | 76.91% | 171.28 | 0.275 | 0.866 | Best relative/fixed score; no interval-width cost. |
| 2026 full replay | TailRiskWinProb `TP=1.25` | 60.3638 | 82.8090 | 0.157548 | 0.013313 | 76.91% | 171.28 | 0.429 | 0.866 | Best Brier but worse relative score than `TP=0.75`. |
| Broad bucket 2 | Defended residual-ridge | 33.6355 | 46.2032 | 0.162655 | 0.016706 | 78.38% | 98.67 | 3.782 | 4.540 | Baseline still wins relative score. |
| Broad bucket 2 | TailRiskWinProb `TP=0.75` | 33.6355 | 46.2032 | 0.162650 | 0.016692 | 78.38% | 98.67 | 3.795 | 4.540 | Narrows the interval-overlay miss, but does not promote. |
| Broad bucket 2 | TailRiskWinProb `TP=1.25` | 33.6355 | 46.2032 | 0.162648 | 0.016682 | 78.38% | 98.67 | 3.869 | 4.540 | Best Brier/fixed score, too much relative penalty. |

Reflection: this is a better-shaped probability experiment than interval widening. It keeps score intervals untouched, improves 2026 relative score more than TailRiskInterval, and nearly closes the bucket-2 relative gap. But it still fails the hard bucket-2 confirmation, so it is not a promoted default. The next iteration should not increase `TP`; `TP=1.25` already shows the over-softening pattern. The better next move is conditional routing for `TP=0.75`: only apply probability softening when pre-match event residual/tail evidence is strong enough, and leave ordinary matches at the defended residual-ridge probability.

Artifacts:

- `modeling/artifacts/runs/current-2026-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/reports/tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Conditional TailRisk Win-Probability Routing

Problem: TailRiskWinProb `TP=0.75` improved 2026 Brier/calibration and nearly closed the broad bucket-2 gap, but it was still too easy to overclaim. The next hypothesis was to soften win probabilities only when two no-future event signals agree: recent event residuals say we have been underpredicting, and recent event scores are running above the current online alliance score scale.

Change implemented:

- Added `learnedTailCorrectionGateMode` to `ModelConfig`, defaulting to the old `max` behavior.
- Added `min` and `mean` gate-combination modes; `min` requires all configured gate signals to open.
- Added two probability-only conditional candidates:
  - `TP=0.75 ... G=8/R4/S8/F20/MIN`
  - `TP=1.00 ... G=8/R4/S12/F20/MIN`
- Added exact manifests for 2026 replay and broad bucket 2.
- Added regression coverage proving a `min` gate can close a learned-tail correction even when the residual subgate alone would be open.

Result:

| Scope | Candidate | Score MAE | Margin MAE | Brier | Calibration | Coverage | Width | Relative score | Fixed score | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | TailRiskWinProb `TP=0.75` | 60.3638 | 82.8090 | 0.157559 | 0.013269 | 76.91% | 171.28 | 0.205 | 0.866 | Best relative/fixed in the conditional manifest. |
| 2026 full replay | Conditional `TP=0.75 S8/MIN` | 60.3638 | 82.8090 | 0.157559 | 0.013269 | 76.91% | 171.28 | 0.355 | 0.866 | Same metrics as ungated, worse rank/relative score. |
| 2026 full replay | Conditional `TP=1.00 S12/MIN` | 60.3638 | 82.8090 | 0.157553 | 0.013330 | 76.91% | 171.28 | 0.434 | 0.867 | Best Brier, worse calibration/rank. |
| Broad bucket 2 | TailRiskWinProb `TP=0.75` | 33.6355 | 46.2032 | 0.162650 | 0.016692 | 78.38% | 98.67 | 3.720 | 4.540 | Best relative in this four-model manifest. |
| Broad bucket 2 | Conditional `TP=1.00 S12/MIN` | 33.6355 | 46.2032 | 0.162649 | 0.016687 | 78.38% | 98.67 | 3.869 | 4.540 | Best fixed/Brier, not a relative winner. |
| Broad bucket 2 | Defended residual-ridge | 33.6355 | 46.2032 | 0.162655 | 0.016706 | 78.38% | 98.67 | 3.919 | 4.540 | Still the defended point model. |

Reflection: the stricter gate did not solve the core confirmation problem. It is useful scientifically because it proves the gate-combination code works and shows that the high-score context gate mostly changes probability calibration/fixed diagnostics, not point quality. But it did not beat the simpler `TP=0.75` overlay. The cross-run deployment report gives `TP=0.75` the best uncertainty/reporting score across the checked runs, while the stability review is still `fragmented` because only bucket 2 has been checked. The next defensible move is not more gate tuning; it is a full bucket 0/1/3/4 TailRiskWinProb confirmation sweep using the same predeclared probability-only candidates.

Artifacts:

- `modeling/artifacts/runs/current-2026-conditional-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-conditional-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/reports/conditional-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: TailRisk Win-Probability Full Bucket Confirmation

Problem: the conditional routing check was still under-confirmed because only bucket 2 had been used as a broad holdout for TailRiskWinProb. A probability overlay that improves 2026 but fails hidden event buckets would be an overfit story, not a model improvement.

Change implemented:

- Added exact broad holdout manifests for buckets 0, 1, 3, and 4.
- Ran the full five-bucket broad 2024-2026 TailRiskWinProb confirmation sweep using the same predeclared candidates:
  - defended residual-ridge point model,
  - TailRiskWinProb `TP=0.75`,
  - TailRiskWinProb `TP=1.25`.
- Generated a cross-run report covering full 2026 plus all five broad buckets.

Result:

| Scope | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Calibration | Relative score | Fixed score | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | `TP=0.75` | `TP=0.75` | 60.36 | 82.81 | 0.157559 | 0.013269 | 0.275 | 0.866 | Current-season probability gain. |
| Broad bucket 0 | `TP=0.75` | `TP=1.25` | 43.18 | 59.67 | 0.168485 | 0.017991 | 3.611 | 4.394 | Overlay helps, but near-tie. |
| Broad bucket 1 | `TP=0.75` | `TP=1.25` | 24.76 | 34.68 | 0.177463 | 0.018173 | 3.792 | 4.700 | Overlay helps, but near-tie. |
| Broad bucket 2 | residual-ridge | `TP=1.25` | 33.64 | 46.20 | 0.162655 | 0.016706 | 3.782 | 4.540 | Relative score keeps baseline. |
| Broad bucket 3 | residual-ridge | `TP=1.25` | 35.46 | 47.42 | 0.162838 | 0.022075 | 3.735 | 4.611 | Relative score keeps baseline. |
| Broad bucket 4 | residual-ridge | residual-ridge | 21.90 | 30.05 | 0.163657 | 0.018266 | 2.785 | 3.609 | Cleanest slice rejects overlay. |

Cross-run deployment review:

| Model | Suggested role | Relative wins | Fixed wins | Weighted Brier | Mean rank | Deployment score | Stability note |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `TP=0.75` | uncertainty/reporting candidate | 3/6 | 1/6 | 0.164194 | 1.48 | 0.153 | Best overall reporting overlay, all near-ties. |
| residual-ridge | defended point model | 3/6 | 1/6 | 0.164209 | 1.79 | 0.272 | Still best point-model stance. |
| `TP=1.25` | fixed-score/Brier diagnostic | 0/6 | 4/6 | 0.164184 | 2.73 | 0.429 | Best Brier, too much rank penalty. |

Reflection: this is the strongest evidence so far that the learned-tail signal is real for probability calibration, but the effect size is tiny and not stable enough to replace the point model. `TP=0.75` improves Brier in every checked run and has the best uncertainty/reporting deployment score, but the full-replay winner was not confirmed by holdouts: it won only 2 of 5 broad holdouts by relative score and 0 of 5 by fixed-score winner. `TP=1.25` is the pure Brier/fixed-score diagnostic, not a practical default, because it never wins relative score. The next good research move is a slice diagnostic: identify whether TailRiskWinProb helps particular event regimes before designing another predeclared probability-calibration candidate. A quick post-hoc slice script could not complete from the saved compact artifacts because non-promoted models do not retain full match-prediction rows, so the next tooling improvement should either preserve comparison-safe prediction rows or generate slice deltas during `model:report`. Blindly tuning `TP` again would be curve-fitting.

Artifacts:

- `modeling/artifacts/reports/tail-risk-winprob-full-bucket-confirmation/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-tail-risk-winprob/MODEL_CARD.md`

## Infrastructure And Follow-Up: Comparison-Safe Slice Diagnostics

Problem: after full TailRiskWinProb bucket confirmation, the obvious next question was not another blind weight sweep. We needed to know where the probability overlay helped and hurt. The existing compact `run.json` artifacts removed prediction rows for non-promoted models, so post-hoc model-vs-baseline slice diagnostics were impossible from saved artifacts.

Change implemented:

- Added `MODEL_COMPARISON_SLICES.md` and `model-comparison-slices.json` artifacts written during `writeRunArtifacts`.
- Diagnostics are computed before `run.json` compaction, so non-promoted candidates can still be compared safely without storing all prediction rows in the compact artifact.
- Reference selection now uses `simulationSeedName` when present, which correctly compares TailRisk overlays against the residual-ridge seed model even when the leaderboard sorts models by benchmark rank.
- Added a regression test proving non-promoted predictions can be compacted while comparison-slice diagnostics still exist.

2026 slice clue from rerunning `current-2026-tail-risk-winprob`:

| Candidate | All-match Brier delta | Wide-margin delta | High-confidence delta | Medium-margin delta | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| `TP=0.75` | -0.000016 | -0.000021 | -0.000025 | +0.000003 | Helps mostly when baseline is already confident. |
| `TP=1.25` | -0.000027 | -0.000035 | -0.000041 | +0.000006 | Stronger Brier gain, stronger over-softening risk. |

Follow-up candidate tested:

- Added margin/confidence-gated TailRiskWinProb candidates with `MG=25` and `CG=0.25`.
- Ran `current-2026-margin-confidence-tail-risk-winprob`.

Result:

| Candidate | Relative rank | Relative score | Fixed score | Brier | Calibration | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Ungated `TP=0.75` | 1 | 0.190 | 0.866 | 0.157559 | 0.013269 | Still best 2026 reporting overlay. |
| Ungated `TP=1.25` | 2 | 0.219 | 0.866 | 0.157548 | 0.013313 | Best Brier, still less balanced. |
| Residual-ridge | 3 | 0.280 | 0.867 | 0.157576 | 0.013558 | Defended point model. |
| Gated `TP=0.75 MG=25 CG=0.25` | 4 | 0.452 | 0.867 | 0.157562 | 0.013514 | Rejected. |
| Gated `TP=1.25 MG=25 CG=0.25` | 5 | 0.496 | 0.867 | 0.157553 | 0.013563 | Rejected. |

Reflection: the slice diagnostic worked; the model idea it inspired did not. Hard gating removed too many small beneficial adjustments and made calibration worse than the ungated overlay. This is a useful negative result because it says the next probability candidate should not be a crude high-confidence gate. A better next idea is a smooth shrinkage rule or learned probability calibration that uses the slice features continuously, but it needs broad holdout discipline from the start.

Artifacts:

- `modeling/artifacts/runs/current-2026-tail-risk-winprob/MODEL_COMPARISON_SLICES.md`
- `modeling/artifacts/runs/current-2026-margin-confidence-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2026-margin-confidence-tail-risk-winprob/MODEL_COMPARISON_SLICES.md`
- `modeling/artifacts/reports/margin-confidence-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`

## Probability Calibration Iteration: Smooth TailRiskWinProb Shrinkage

Problem: the hard margin/confidence gate was too crude. It removed too many small helpful probability adjustments even though the slice diagnostics showed TailRiskWinProb was most useful on wider-margin and higher-confidence predictions. The next defensible attempt was a continuous shrinkage rule, not another hard threshold.

Change implemented:

- Added continuous TailRiskWinProb shrinkage controls:
  - `learnedTailWinProbabilityMarginRamp`
  - `learnedTailWinProbabilityConfidenceRamp`
  - `learnedTailWinProbabilityShrinkFloor`
- The shrinkage factor uses only pre-match score means and uncertainty bands. It scales the probability-only TailRisk widening, and it still leaves score means and score intervals unchanged.
- Added smooth candidates with `MR=35`, `PR=0.25`, and shrink floors `SF=0.50`/`SF=0.35`.
- Added exact manifests for full 2026 and broad 2024-2026 replays.
- Added a regression test confirming the smooth probability branch preserves score means/intervals and cannot move probabilities more than the full overlay in the synthetic fixture.

Results:

| Run | Relative winner | Fixed winner | Smooth result | Interpretation |
| --- | --- | --- | --- | --- |
| `current-2026-smooth-tail-risk-winprob` | Ungated `TP=0.75` | Smooth `TP=0.75 MR=35 PR=0.25 SF=0.50` | Smooth `TP=0.75` ranked 3rd by relative score | Interesting fixed-score clue, not a promotion. |
| `current-2024-2026-smooth-tail-risk-winprob` | Ungated `TP=1.25` | Ungated `TP=1.25` | Best smooth candidate ranked 3rd by relative score | Broad replay rejects smooth shrinkage as the better default. |

Broad slice diagnostics still support the underlying TailRisk probability idea: compared with residual-ridge, ungated `TP=1.25` improves all-match Brier by about `0.000024`, medium-margin Brier by about `0.000028`, wide-margin Brier by about `0.000035`, and high-confidence Brier by about `0.000033`. Smooth `TP=1.25 SF=0.50` nearly matches those slice gains but does not beat the ungated overlay in the leaderboard.

Reflection: smooth shrinkage was the correct next test after rejecting hard gates, but the data does not promote it. The useful lesson is that the TailRisk signal is already small and sparse; shrinking it reduces a few low-confidence harms, but it also spends the tiny gains that made the ungated overlay worthwhile. The current reporting overlay remains ungated TailRiskWinProb, with `TP=0.75` preferred for the 2026-facing deployment story and `TP=1.25` remaining a broad Brier/fixed-score diagnostic. The next probability-calibration attempt should be a genuinely learned pre-match calibration layer with holdout discipline, not another hand-shaped margin gate.

Artifacts:

- `modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob/MODEL_COMPARISON_SLICES.md`
- `modeling/artifacts/runs/current-2024-2026-smooth-tail-risk-winprob/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-smooth-tail-risk-winprob/MODEL_COMPARISON_SLICES.md`
- `modeling/artifacts/reports/smooth-tail-risk-winprob-check/CROSS_RUN_SUMMARY.md`

## Probability Calibration Iteration: Learned WinCal

Problem: after hard gates and smooth shrinkage both failed to improve TailRiskWinProb, the next defensible question was whether the model should learn a probability correction from its own prior calibration errors. This branch deliberately left score means and score intervals unchanged, then fit a no-future ridge calibration layer on prior win-probability residuals.

Change implemented:

- Added `winProbabilityCalibrationWeight`, `winProbabilityCalibrationLambda`, `winProbabilityCalibrationMinMatches`, `winProbabilityCalibrationWindow`, `winProbabilityCalibrationClip`, and `winProbabilityCalibrationFeatureSet` to `ModelConfig`.
- Added a walk-forward learned WinCal layer. It records the base red win probability and actual outcome only after a match is predicted, then periodically refits a small ridge correction on prior examples only.
- Tested both an intercept-only feature set and a margin/confidence feature set using probability, expected margin, and interval width.
- Added a regression test proving learned WinCal is score-neutral when it shares the same simulation seed: expected scores and score bands stay identical, while some win probabilities can move.
- Added exact 2026 and broad 2024-2026 manifests so the learned layer could be compared against residual-ridge and ungated TailRiskWinProb.

Results:

| Run | Relative winner | Fixed winner | Learned WinCal result | Interpretation |
| --- | --- | --- | --- | --- |
| `current-2026-learned-win-calibration` | Residual-ridge | Aggressive Learned WinCal `TP=1.25 WC=0.65` | Learned variants ranked 4th-7th by relative score | Aggressive learning improved calibration-error slices but overcorrected Brier. |
| `current-2026-learned-win-calibration-v2` | Ungated TailRiskWinProb `TP=0.75` | Conservative Learned WinCal `TP=1.25 WC=0.15 F=B` | Learned variants ranked 4th-6th by relative score | Conservative learning reduced calibration error but still hurt close-match behavior. |
| `current-2024-2026-learned-win-calibration-v2` | Ungated TailRiskWinProb `TP=0.75` | Ungated TailRiskWinProb `TP=1.25` | Learned variants ranked 4th-6th by relative score | Broad replay rejects learned WinCal as a TailRisk replacement. |

The best conservative learned variants gave tiny Brier or calibration clues in isolated slices. For example, the 2026 `TP=1.25 WC=0.10 F=MC` candidate improved all-match Brier by about `0.000023` versus residual-ridge and reduced calibration error by about `0.000657`, but it still ranked below ungated TailRisk and worsened close-margin Brier. On broad 2024-2026 replay, the learned candidates again failed to beat ungated TailRisk, and their close/medium-margin slice behavior was weaker.

Reflection: learned WinCal was the right next branch, and it is now rejected. The implementation is leakage-safe and score-neutral, but it mostly learned to smooth a probability signal that was already tiny. It can improve calibration-error accounting while spending Brier quality in the matches where probability matters most. The lesson is important: stop tuning probability-only corrections that reuse the same residual, margin, and uncertainty features. The next serious improvement should add new pre-match information, especially real scout/PPC/defense labels or a rebuilt role simulator with separate suppression and foul-risk estimates. A richer calibration layer is only worth revisiting if it has genuinely new inputs, not another reshape of the same probability residual.

Artifacts:

- `modeling/artifacts/runs/current-2026-learned-win-calibration/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2026-learned-win-calibration-v2/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-learned-win-calibration-v2/MODEL_CARD.md`
- `modeling/artifacts/reports/learned-win-calibration-check/CROSS_RUN_SUMMARY.md`

## Role/Defense Iteration: RoleV2 Suppression Residuals

Problem: previous role experiments used official-score defense and foul proxies, but the defense proxy had an important bias: it averaged only positive opponent suppression. That can over-credit a team for rare opponent underperformance and hide the many matches where no suppression happened. The next role branch needed to separate "had one good-looking suppression result" from "consistently suppresses opponents without giving away fouls."

Change implemented:

- Added RoleV2 feature tracking to the walk-forward feature builder:
  - positive-only defense denial remains available for compatibility,
  - all-attempt defense suppression now includes zero outcomes,
  - defense suppression rate counts how often the proxy was positive,
  - all-attempt foul exposure now includes zero-foul outcomes,
  - RoleV2 net swing uses conservative suppression, all-attempt foul risk, and offense cost.
- Added `useRoleV2Features` to `ModelConfig` so old residual-ridge candidates do not silently receive the new role features.
- Added exact manifests for full 2026, broad 2024-2026, all five 2026 event-key hash bucket holdouts, and all five broad 2024-2026 event-key hash bucket holdouts.
- Added regression coverage proving RoleV2 features are walk-forward and include failed defense attempts without future leakage.

Results:

| Run | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `current-2026-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Strong RoleV2 | 60.31 | 82.78 | 0.1575 | 103.59 | First clean full-2026 role/defense win, but still `near_tie`. |
| `current-2024-2026-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Moderate RoleV2 `RW=0.25 L=50 C=35` | 32.30 | 44.25 | 0.1665 | 103.67 | Broad replay supports the branch, but deltas remain tiny. |
| `holdout-2026-bucket0-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Old role-feature residual `RW=0.25 L=40 C=35` | 65.72 | 91.17 | 0.1661 | 103.59 | First holdout confirms relative point score, but fixed/Brier caution remains. |
| `holdout-2026-bucket1-role-v2-residual-ridge` | Stronger residual `RW=0.40 L=60 C=35` | Plain residual `RW=0.25 L=30 C=40` | 51.12 | 70.37 | 0.1653 | 99.82 | RoleV2 loses the point leaderboard; moderate RoleV2 only gives a Brier clue. |
| `holdout-2026-bucket2-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Strong RoleV2 | 57.13 | 79.50 | 0.1542 | 93.23 | Strongest holdout confirmation: RoleV2 wins both scoring views. |
| `holdout-2026-bucket3-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Stronger residual `RW=0.40 L=60 C=35` | 66.35 | 89.19 | 0.1537 | 98.49 | RoleV2 wins relative score, but fixed-score diagnostics prefer non-role residual. |
| `holdout-2026-bucket4-role-v2-residual-ridge` | Old role-feature residual `RW=0.25 L=40 C=35` | Moderate RoleV2 `RW=0.25 L=50 C=35` | 44.49 | 59.42 | 0.1390 | 54.60 | Role information helps, but RoleV2 is not the relative winner on this small slice. |

Comparison against the defended residual baseline:

| Scope | Defended residual | Strong RoleV2 | Decision |
| --- | --- | --- | --- |
| 2026 full | 60.36 / 82.81 / 0.1576 / 103.73 | 60.31 / 82.78 / 0.1575 / 103.59 | RoleV2 improves all headline metrics. |
| 2024-2026 full | 32.31 / 44.25 / 0.1665 / 103.76 | 32.30 / 44.25 / 0.1665 / 103.67 | RoleV2 improves score and worst-event, with margin/Brier essentially tied. |
| 2026 bucket 0 | 65.78 / 91.18 / 0.1660 / 103.73 | 65.72 / 91.17 / 0.1661 / 103.59 | RoleV2 improves score, margin, and tail, but old role features win fixed score. |
| 2026 bucket 1 | 51.18 / 70.54 / 0.1653 / 98.86 | 51.15 / 70.47 / 0.1653 / 99.52 | Stronger non-role residual is the relative winner; RoleV2 is not cleanly better. |
| 2026 bucket 2 | 57.18 / 79.51 / 0.1543 / 93.27 | 57.13 / 79.50 / 0.1542 / 93.23 | RoleV2 improves every headline metric and wins fixed score. |
| 2026 bucket 3 | 66.41 / 89.28 / 0.1539 / 98.45 | 66.35 / 89.19 / 0.1537 / 98.49 | RoleV2 improves score, margin, and Brier, but not worst-event/fixed score. |
| 2026 bucket 4 | 44.55 / 59.49 / 0.1394 / 54.98 | 44.52 / 59.55 / 0.1394 / 54.65 | RoleV2 improves score/tail, but older role features win relative and moderate RoleV2 wins fixed. |

Reflection: this remains the best role/defense evidence so far, but it is no longer a clean promotion story. The important methodological improvement is not that we "solved defense"; we made the proxy less naive by including failed suppression attempts and zero-foul matches. Strong RoleV2 wins 5 of 7 relative leaderboards when full replays are included, and 3 of 5 2026 holdouts by relative score. The generated deployment review even gives moderate RoleV2 the lowest point deployment score inside this candidate set: 0.370 versus 0.383 for plain residual. But the stability review is still `mixed`, every run is a `near_tie`, fixed-score winners are scattered, and bucket 1 plus bucket 4 show that this exact RoleV2 encoding is not universally better than plain residual or the older role-feature proxy. The defensible conclusion is "role features have real signal and deserve broad bucket confirmation," not "RoleV2 replaces the defended model." The next step should be a 2024-2026 RoleV2 bucket sweep; if that remains mixed, the better idea is a RoleV3 encoding that separates suppression value, foul risk, and role-decision confidence more explicitly.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket1-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket2-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket3-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket4-role-v2-residual-ridge/MODEL_CARD.md`
- `modeling/artifacts/reports/role-v2-residual-ridge-check/CROSS_RUN_SUMMARY.md`

Broad continuation:

| Run | Relative winner | Fixed winner | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `holdout-2024-2026-bucket0-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Strong RoleV2 | 43.17 | 59.69 | 0.1686 | 103.67 | RoleV2 survives the first broad bucket as a near-tie: score and tail improve, margin/Brier are slightly worse. |
| `holdout-2024-2026-bucket1-role-v2-residual-ridge` | Stronger residual `RW=0.40 L=60 C=35` | Strong RoleV2 | 24.75 | 34.64 | 0.1775 | 98.82 | Bucket 1 rejects RoleV2 by relative score; fixed score gives only a tiny near-tie RoleV2 edge. |
| `holdout-2024-2026-bucket2-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Old role-feature residual `RW=0.25 L=40 C=35` | 33.63 | 46.18 | 0.1626 | 93.21 | Strong RoleV2 wins relative score, but fixed score prefers the older role proxy. |
| `holdout-2024-2026-bucket3-role-v2-residual-ridge` | Old role-feature residual `RW=0.25 L=40 C=35` | Moderate RoleV2 `RW=0.25 L=50 C=35` | 35.44 | 47.38 | 0.1626 | 98.32 | Role signal helps, but the older proxy beats RoleV2 on relative score. |
| `holdout-2024-2026-bucket4-role-v2-residual-ridge` | Strong RoleV2 `RW=0.40 L=70 C=35` | Old role-feature residual `RW=0.25 L=40 C=35` | 21.88 | 30.06 | 0.1638 | 54.80 | Strong RoleV2 wins relative score, but fixed/Brier diagnostics stay cautious. |

Updated reflection after the completed broad sweep: Strong RoleV2 is the best role/defense challenger by relative wins, but not the defended point model. Across 12 RoleV2-related runs, Strong RoleV2 wins 8 relative leaderboards and has the best max worst-event MAE, 103.67. That is too much signal to ignore. But all 12 promotions are `near_tie`, fixed-score winners split across five candidates, and the deployment review still chooses plain residual `RW=0.25 L=30 C=40` as point default and robustness monitor with point deployment score 0.401. Moderate RoleV2 scores 0.433; Strong RoleV2 scores 0.465 because its instability penalty is higher. This is a valuable negative result, not a failure: role features matter, but the current RoleV2 blended net-swing encoding is too unstable to replace the defended baseline. The next modeling branch should be RoleV3, keeping role signals but separating suppression magnitude, suppression consistency, foul exposure, offense opportunity cost, and role-choice confidence as independent residual features.

## Infrastructure Iteration: Residual-Ridge Sufficient-Stats Refit

Problem: residual-ridge became the best point-prediction family, so it also became the main bottleneck for future searches. The previous implementation re-standardized every prior residual row and rebuilt the full design matrix every time the walk-forward replay refit the residual layer. That was scientifically valid but computationally wasteful, making wider holdout sweeps slower than necessary.

Change implemented:

- Replaced repeated full residual-matrix rebuilds with a no-future sufficient-stat accumulator.
- The accumulator stores prior residual counts, sums, squared sums, feature-target sums, and triangular feature cross-products.
- Each residual fit reconstructs the same standardized ridge normal equations from prior examples only.
- The walk-forward timing and leakage boundary are unchanged: the current match is predicted first, then its prediction error is recorded for future matches.

Verification:

| Check | Result |
| --- | --- |
| Modeling TypeScript check | `npm run model:typecheck` passed |
| Unit/regression tests | `npm run test` passed, 27/27 |
| Focused 2026 replay smoke | `modeling/artifacts/runs/residual-accumulator-2026-smoke/MODEL_CARD.md` |
| Smoke metrics | score MAE 60.36, margin MAE 82.81, Brier 0.1576, worst-event MAE 103.73 |

Reflection: this was not a new model promotion; it was a necessary research-system improvement. The smoke replay reproduced the defended 2026 residual-ridge metrics exactly, so we did not silently change the current best model while making future iteration cheaper. The next modeling step should use this speed improvement to run direct residual-vs-event-type holdout manifests and then revisit the deployment rule: plain residual is the default point model, but broad fixed-score evidence still argues for caution around event-type residual and scaled defaults.

## Follow-Up Iteration: Direct Residual-vs-Event-Type Holdout Bucket 0

Problem: the broad full replay compared residual-ridge and event-type residuals directly, but the existing holdout evidence mostly came from separate family-specific leaderboards. That can mislead us, because a model can look good inside its own family while losing to another family on the same held-out events.

Change implemented:

- Added five predeclared broad 2024-2026 direct-comparison holdout manifests:
  - `modeling/experiments/holdout-2024-2026-bucket0-residual-vs-event-type.json`
  - `modeling/experiments/holdout-2024-2026-bucket1-residual-vs-event-type.json`
  - `modeling/experiments/holdout-2024-2026-bucket2-residual-vs-event-type.json`
  - `modeling/experiments/holdout-2024-2026-bucket3-residual-vs-event-type.json`
  - `modeling/experiments/holdout-2024-2026-bucket4-residual-vs-event-type.json`
- Ran bucket 0 after the residual-ridge refit speedup.
- Candidate set included EPA-MC, event shift, archetype, scaled archetype, three event-type residuals, two plain residual-ridge strengths, and the residual-ridge component variant.

Result on broad 2024-2026 bucket 0:

| Rank | Model family | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Promotion result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Plain residual-ridge `RW=0.25 L=30 C=40` | 3.500 | 4.395 | 43.18 | 59.68 | 0.1685 | 74.9% | 103.76 | promoted, `near_tie` |
| 2 | Stronger residual-ridge `RW=0.40 L=60 C=35` | 3.647 | 4.399 | 43.20 | 59.75 | 0.1688 | 75.0% | 103.74 | reviewed |
| 3 | Scaled archetype | 3.809 | 4.380 | 43.25 | 59.79 | 0.1688 | 74.9% | 103.73 | near-tie |
| 4 | Event-type residual `T=0.05 M=40` | 3.834 | 4.380 | 43.25 | 59.81 | 0.1689 | 74.9% | 103.66 | near-tie |
| 7 | Event-type residual `T=0.15 M=60` | 3.874 | 4.370 | 43.27 | 59.84 | 0.1688 | 74.9% | 103.27 | fixed-best near-tie |
| 8 | Residual-ridge component | 4.274 | 4.396 | 43.29 | 59.92 | 0.1685 | 74.5% | 103.48 | reviewed |

Artifact:

- `modeling/artifacts/runs/holdout-2024-2026-bucket0-residual-vs-event-type/MODEL_CARD.md`

Reflection: bucket 0 strengthens the current default point-model claim because plain residual-ridge won the direct relative benchmark against the event-type residual family on the same held-out events. It does not settle the model. The promotion confidence is still `near_tie`, four eligible models are near enough to matter, and fixed scoring prefers event-type residual `T=0.15 M=60` because it improves worst-event behavior. The correct next step is to run the remaining direct buckets, then make a deployment rule that distinguishes point prediction from robustness monitoring instead of forcing one model to answer every question.

## Follow-Up Iteration: Direct Residual-vs-Event-Type Holdout Bucket 1

Problem: bucket 0 supported plain residual-ridge, but one held-out event bucket is not enough to choose a deployment rule. Bucket 1 is a lower-error slice than bucket 0, so it tests whether residual-ridge still helps when the baseline model is already relatively accurate.

Result on broad 2024-2026 bucket 1:

| Rank | Model family | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Promotion result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Stronger residual-ridge `RW=0.40 L=60 C=35` | 3.660 | 4.704 | 24.75 | 34.64 | 0.1775 | 79.0% | 98.82 | promoted, `near_tie` |
| 2 | Plain residual-ridge `RW=0.25 L=30 C=40` | 3.690 | 4.702 | 24.76 | 34.68 | 0.1775 | 79.1% | 98.18 | near-tie |
| 3 | Event-type residual `T=0.05 M=40` | 4.021 | 4.714 | 24.78 | 34.69 | 0.1777 | 79.1% | 98.68 | reviewed |
| 4 | Event-type residual `T=0.15 M=60` | 4.099 | 4.711 | 24.76 | 34.72 | 0.1780 | 79.0% | 98.90 | reviewed |
| 5 | Scaled archetype | 4.159 | 4.728 | 24.77 | 34.74 | 0.1778 | 79.0% | 98.36 | reviewed |
| 8 | Event shift | 4.397 | 4.698 | 24.84 | 34.71 | 0.1776 | 79.0% | 98.95 | fixed-best near-tie |

Artifact:

- `modeling/artifacts/runs/holdout-2024-2026-bucket1-residual-vs-event-type/MODEL_CARD.md`

Reflection: bucket 1 keeps residual-ridge ahead of event-type residual in the direct relative benchmark, but it does not cleanly endorse a stronger residual default. The stronger residual wins average score and margin error by tiny amounts; the plain residual has slightly better fixed score and better worst-event error. That supports a cautious operational rule: keep plain residual-ridge as the default unless additional buckets show the stronger residual winning consistently without worsening tail risk.

## Follow-Up Iteration: Direct Residual-vs-Event-Type Holdout Bucket 2

Problem: buckets 0 and 1 both favored residual-ridge by relative benchmark, but both were near-ties with different secondary stories. Bucket 2 is a larger middle-difficulty slice, so it is a useful check on whether plain residual-ridge improves the whole metric bundle rather than only one headline metric.

Result on broad 2024-2026 bucket 2:

| Rank | Model family | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Promotion result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Plain residual-ridge `RW=0.25 L=30 C=40` | 3.629 | 4.540 | 33.64 | 46.20 | 0.1627 | 78.4% | 93.04 | promoted, `near_tie` |
| 2 | Stronger residual-ridge `RW=0.40 L=60 C=35` | 3.762 | 4.539 | 33.65 | 46.21 | 0.1629 | 78.4% | 93.22 | near-tie |
| 3 | Scaled archetype | 4.005 | 4.539 | 33.68 | 46.24 | 0.1630 | 78.4% | 93.28 | near-tie |
| 4 | Event-type residual `T=0.05 M=40` | 4.085 | 4.530 | 33.68 | 46.27 | 0.1628 | 78.4% | 93.24 | fixed near-tie |
| 5 | Event-type residual `T=0.15 M=60` | 4.160 | 4.530 | 33.67 | 46.30 | 0.1632 | 78.4% | 93.60 | fixed near-tie |
| 8 | Residual-ridge component | 4.715 | 4.544 | 33.70 | 46.38 | 0.1634 | 78.1% | 93.35 | reviewed |

Artifact:

- `modeling/artifacts/runs/holdout-2024-2026-bucket2-residual-vs-event-type/MODEL_CARD.md`

Reflection: bucket 2 is the cleanest direct holdout so far for the current plain residual default. It improves score MAE, margin MAE, Brier, coverage, and worst-event MAE against scaled archetype in the same candidate set. The fixed benchmark still slightly prefers event-type residual variants because the fixed score is extremely compressed, but those variants lose the point metrics that matter most for exact score prediction. Current bucket tally: plain residual wins buckets 0 and 2, stronger residual wins bucket 1 by a hair, event-type residual has not won a relative direct holdout. The remaining buckets should decide whether this becomes a formal deployment rule.

## Follow-Up Iteration: Direct Residual-vs-Event-Type Holdout Bucket 3

Problem: after bucket 2, plain residual-ridge had the stronger default case. Bucket 3 is the largest direct holdout slice and has a tougher tail than bucket 2, so it is important evidence for whether the stronger residual should become the point default or remain a slice-specific near-tie.

Result on broad 2024-2026 bucket 3:

| Rank | Model family | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Promotion result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Stronger residual-ridge `RW=0.40 L=60 C=35` | 3.858 | 4.609 | 35.45 | 47.40 | 0.1627 | 76.5% | 98.37 | promoted, `near_tie` |
| 2 | Event-type residual `T=0.10 M=40` | 3.870 | 4.605 | 35.46 | 47.44 | 0.1629 | 76.5% | 98.26 | near-tie |
| 3 | Event-type residual `T=0.15 M=60` | 3.928 | 4.607 | 35.45 | 47.47 | 0.1629 | 76.5% | 98.27 | near-tie |
| 4 | Plain residual-ridge `RW=0.25 L=30 C=40` | 3.973 | 4.611 | 35.46 | 47.42 | 0.1628 | 76.5% | 98.41 | reviewed |
| 5 | Event-type residual `T=0.05 M=40` | 4.112 | 4.609 | 35.47 | 47.45 | 0.1629 | 76.5% | 98.37 | near-tie |
| 6 | Scaled archetype | 4.444 | 4.619 | 35.47 | 47.48 | 0.1629 | 76.5% | 98.55 | reviewed |

Artifact:

- `modeling/artifacts/runs/holdout-2024-2026-bucket3-residual-vs-event-type/MODEL_CARD.md`

Reflection: bucket 3 is the first direct holdout where event-type residual nearly matches the residual-ridge winner on the relative benchmark and slightly wins the fixed score. Stronger residual-ridge still wins the relative benchmark, but only by 0.012 over event-type residual `T=0.10 M=40`. This weakens any simple "plain residual always" rule. The better current interpretation is: residual-ridge is still the point-prediction family to beat, but residual strength and event-type robustness should be decided by a final cross-bucket stability review after bucket 4, not by a single global MAE.

## Follow-Up Iteration: Direct Residual-vs-Event-Type Holdout Bucket 4

Problem: bucket 4 was the final missing direct comparison slice. Earlier family-only evidence had hinted that component residuals might help this bucket, so the direct run tests whether that survives against plain residual, stronger residual, event-type residual, and the simpler baselines.

Result on broad 2024-2026 bucket 4:

| Rank | Model family | Relative benchmark | Fixed benchmark | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Promotion result |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Stronger residual-ridge `RW=0.40 L=60 C=35` | 2.917 | 3.608 | 21.89 | 30.07 | 0.1641 | 79.8% | 54.73 | promoted, `near_tie` |
| 2 | Plain residual-ridge `RW=0.25 L=30 C=40` | 2.973 | 3.609 | 21.90 | 30.05 | 0.1637 | 79.3% | 55.05 | reviewed |
| 3 | Residual-ridge component | 3.025 | 3.642 | 21.87 | 30.06 | 0.1634 | 79.3% | 55.12 | reviewed |
| 4 | Event-type residual `T=0.15 M=60` | 3.142 | 3.592 | 21.91 | 30.13 | 0.1643 | 79.4% | 54.80 | fixed near-tie |
| 5 | EPA-MC baseline | 3.205 | 3.582 | 21.97 | 30.10 | 0.1639 | 79.3% | 54.64 | fixed-best near-tie |
| 6 | Event-type residual `T=0.10 M=40` | 3.310 | 3.587 | 21.92 | 30.16 | 0.1645 | 79.4% | 54.54 | reviewed |

Artifact:

- `modeling/artifacts/runs/holdout-2024-2026-bucket4-residual-vs-event-type/MODEL_CARD.md`
- `modeling/artifacts/reports/residual-vs-event-type-direct-buckets-2024-2026/CROSS_RUN_SUMMARY.md`

Cross-bucket direct holdout tally:

| Bucket | Relative winner | Confidence | Fixed-best model | Key interpretation |
| ---: | --- | --- | --- | --- |
| 0 | Plain residual-ridge `RW=0.25 L=30 C=40` | near-tie | Event-type residual `T=0.15 M=60` | Plain residual wins points; event-type helps tail/fixed score. |
| 1 | Stronger residual-ridge `RW=0.40 L=60 C=35` | near-tie | Event shift | Stronger residual wins by 0.030 relative over plain; plain has better fixed score and worst-event. |
| 2 | Plain residual-ridge `RW=0.25 L=30 C=40` | near-tie | Event-type residual `T=0.10 M=40` | Cleanest plain-residual confirmation: improves every headline metric against scaled archetype. |
| 3 | Stronger residual-ridge `RW=0.40 L=60 C=35` | near-tie | Archetype `C=20 D=10` | Stronger residual wins, but event-type residual is only 0.012 relative points behind. |
| 4 | Stronger residual-ridge `RW=0.40 L=60 C=35` | near-tie | EPA-MC baseline | Easy slice; stronger residual wins relative, but fixed score favors simpler models. |

Reflection: the direct holdout suite is now complete, and it changes the deployment discussion. Residual-ridge is no longer just a promising full-replay result; it won all five direct relative holdouts against event-type residual and the earlier baselines. However, the wins are all `near_tie`, and the winner alternates between plain and stronger residual strengths. A final promotion should be based on a cross-run stability report and an explicit deployment score that separates point accuracy from robustness monitoring.

The generated cross-run stability report is deliberately conservative: status `mixed`, relative leader `RW=0.40 L=60 C=35` with 3 of 5 holdouts, fixed-score leaders split five ways, and no clear fixed-score majority. That is exactly the right warning label for judges: we have a stronger model family, not proof that every future event should use one fixed residual strength without monitoring.

## Follow-Up Iteration: Formal Deployment-Rule Score

Problem: winner counts alone are too blunt. Bucket 1, 3, and 4 promoted the stronger residual, but bucket 0 and 2 promoted the plain residual, every promotion was a near-tie, and fixed-score winners split five ways. We needed a repeatable deployment-rule score that looks at all candidates across all direct holdouts, not just the top row from each run.

Change implemented:

- Extended the cross-run report generator with a `Deployment Rule Review`.
- The review scores every deployable model across all supplied runs, not just promoted winners.
- Point deployment score averages per-run regret against the best deployable candidate for score MAE, margin MAE, Brier, calibration, coverage miss, worst-event MAE, fixed benchmark, and relative rank.
- The score adds an instability penalty from weighted standard deviation plus worst-run regret, so a model is punished for being fragile on one holdout.
- A separate robustness score emphasizes worst-event MAE, coverage miss, Brier, calibration, fixed benchmark, and rank.

Result on the broad direct residual-vs-event-type suite:

| Model | Suggested role | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score | Robustness score |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Stronger residual `RW=0.40 L=60 C=35` | point default candidate + robustness monitor candidate | 3 | 0 | 32.32 | 44.26 | 0.1666 | 103.74 | 0.239 | 0.379 |
| Plain residual `RW=0.25 L=30 C=40` | average-error alternate | 2 | 0 | 32.31 | 44.25 | 0.1665 | 103.76 | 0.259 | 0.453 |
| Event-type residual `T=0.15 M=60` | fixed-score diagnostic | 0 | 1 | 32.34 | 44.34 | 0.1668 | 103.27 | 0.448 | 0.705 |
| Event-type residual `T=0.10 M=40` | fixed-score diagnostic | 0 | 1 | 32.34 | 44.34 | 0.1669 | 103.57 | 0.506 | 0.767 |
| Event-type residual `T=0.05 M=40` | near-tie review | 0 | 0 | 32.35 | 44.32 | 0.1668 | 103.66 | 0.519 | 0.838 |

Artifact:

- `modeling/artifacts/reports/residual-vs-event-type-direct-buckets-2024-2026/CROSS_RUN_SUMMARY.md`

Reflection: the formal broad direct-holdout deployment score slightly favors the stronger residual. This is not a complete override of the plain residual default because the plain model still has marginally better weighted score MAE, margin MAE, Brier, the full broad replay, the full 2026 replay, and the 2026 bucket sweep. The next defensible research move is a mixed-scope deployment-rule review that includes full broad replay, full 2026 replay, 2026 buckets, and the broad direct buckets with explicit weights. If stronger residual still wins after that, it deserves to replace plain residual as the default; if not, it remains a broad-history diagnostic.

## Follow-Up Iteration: Mixed-Scope Residual Deployment Review

Problem: the direct broad holdout deployment score favored the stronger residual, but that view ignored full replays and current-season residual holdouts. Since our real deployment target is 2026 scouting, the score needs to include both broad historical breadth and current-season relevance.

Change tested:

- Generated a residual-only mixed-scope cross-run report using the same four residual-family candidates across 12 runs:
  - full 2024-2026 residual replay,
  - full 2026 residual replay,
  - five broad 2024-2026 residual holdouts,
  - five 2026 residual holdouts.
- Used the same deployment-rule score as the direct-bucket report.

Result:

| Model | Suggested role | Runs | Relative wins | Fixed wins | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Point deployment score | Robustness score |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Plain residual `RW=0.25 L=30 C=40` | point default candidate + robustness monitor candidate | 12 | 8 | 2 | 39.42 | 54.01 | 0.1642 | 103.76 | 0.256 | 0.469 |
| Stronger residual `RW=0.40 L=60 C=35` | average-error alternate | 12 | 2 | 3 | 39.42 | 54.04 | 0.1644 | 103.74 | 0.517 | 0.919 |
| Scaled archetype baseline | fixed-score diagnostic | 12 | 0 | 5 | 39.46 | 54.08 | 0.1645 | 103.73 | 0.602 | 1.000 |
| Residual component `RW=0.25 L=40 C=35 CP=0.10 CM=4` | average-error alternate | 12 | 2 | 2 | 39.50 | 54.21 | 0.1644 | 104.50 | 0.994 | 1.810 |

Artifact:

- `modeling/artifacts/reports/residual-ridge-mixed-scope-deployment-2024-2026/CROSS_RUN_SUMMARY.md`

Reflection: this resolves the temporary conflict from the direct-bucket-only review. Stronger residual is a useful broad direct-holdout alternate, but it does not survive the mixed-scope deployment review. Plain residual is now the best defended default because it wins the most relative runs, has the lowest deployment score, and is also the robustness-score winner under this residual-only mixed scope. The model is still not final because all 12 runs are near-ties and fixed-score diagnostics still often prefer the scaled baseline, but the default residual strength is now much better defended.

## Follow-Up Iteration: Official Foul-Risk Role Penalty

Problem: the previous role/defense branch inferred defense value from opponent underperformance, but it did not penalize teams that give away foul points while attempting disruptive play. That makes the role simulator too optimistic about defense, especially without real scout labels.

Change implemented:

- Added a no-future team foul-risk feature from official foul points.
- For each completed match, foul points awarded to an alliance are recorded as conceded foul risk for the opponent teams.
- Added alliance features for own/opponent foul-risk sums and role-specific foul risk.
- Subtracted foul risk when choosing inferred defender roles.
- Added a regression check proving that the foul-risk feature appears only after the prior match that created it.
- Added `modeling/experiments/current-2026-residual-ridge-scaled-archetype.json` so the current-season residual replay is a reproducible exact manifest instead of an ad hoc command.

Role-scaled replay results after the foul-risk feature:

| Scope | Best relative model in role suite | Confidence | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 role suite | Scaled archetype, no role adjustment | near-tie | 60.43 | 82.86 | 0.1578 | 76.9% | 103.73 | Role variants do not beat the point baseline; `R=0.10` slightly improves margin by 0.01 but worsens score, Brier, and tail behavior. |
| 2024-2026 role suite | Role-scaled `R=0.15` | near-tie | 32.36 | 44.33 | 0.1668 | 77.7% | 103.78 | Technical relative win, but the non-role baseline has better score MAE, margin MAE, and worst-event MAE. |

Residual reconfirmation after the new feature columns:

| Scope | Promoted residual model | Confidence | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026 full replay | Plain residual `RW=0.25 L=30 C=40` | near-tie | 60.36 | 82.81 | 0.1576 | 76.9% | 103.73 |
| 2024-2026 full replay | Plain residual `RW=0.25 L=30 C=40` | near-tie | 32.31 | 44.25 | 0.1665 | 77.6% | 103.76 |

Artifacts:

- `modeling/artifacts/runs/current-2026-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/residual-ridge-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/residual-ridge-mixed-scope-deployment-2024-2026/CROSS_RUN_SUMMARY.md`

Reflection: official foul-risk is worth keeping because it is interpretable, no-future, and directly connected to the real strategic question of whether defense is net-positive. But it does not make the inferred role branch deployable. The likely reason is signal quality: without actual scout defense labels, residual suppression mixes defense, opponent bad shooting, schedule strength, and event scoring drift. Current decision: keep foul risk in the feature system and documentation, reject the role branch as the point-model default, and keep plain residual-ridge as the defended default. The next serious role attempt should wait for real Firebase scout/PPC defense records or a much better official component adapter.

## Follow-Up Iteration: Role Features Only Inside Residual Correction

Problem: direct role-scaled score injection still looked too blunt. A more conservative idea was to let inferred role, defense, and foul-risk features enter only the residual-ridge correction layer. That lets the model learn when role features explain prior prediction errors without directly subtracting offense or defense from every score.

Change implemented:

- Added two role-feature residual candidates:
  - `Role-Feature Residual Ridge RW=0.25 L=40 C=35`
  - `Strong Role-Feature Residual Ridge RW=0.40 L=60 C=35`
- Added exact manifests:
  - `modeling/experiments/current-2026-role-feature-residual-ridge.json`
  - `modeling/experiments/current-2024-2026-role-feature-residual-ridge.json`
- Fixed the cross-run stability footer for reports that contain only full replays and no holdout runs.

Result:

| Scope | Relative winner | Best role-feature candidate | Confidence | Score MAE | Margin MAE | Brier | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Role-feature `RW=0.25 L=40 C=35` | near-tie | 60.36 vs 60.38 | 82.81 vs 82.78 | 0.1576 vs 0.1576 | Role features improve margin slightly, but lose score MAE and the relative benchmark. |
| 2024-2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Strong role-feature `RW=0.40 L=60 C=35` | near-tie | 32.31 vs 32.31 | 44.25 vs 44.25 | 0.1665 vs 0.1666 | The broad run is close, but Brier and deployment score still favor plain residual. |

Artifact:

- `modeling/artifacts/reports/role-feature-residual-ridge-check/CROSS_RUN_SUMMARY.md`

Reflection: this was the most charitable test of role/foul features so far, and it still does not displace the current best model. The margin-only improvement is a clue, not a promotion. The logically defensible interpretation is that inferred role features may contain a small matchup signal, but the signal is too weak/noisy to trust without scout labels or a better official defense adapter. Plain residual-ridge remains the default.

## Follow-Up Iteration: Nonlinear Residual-Tree Correction

Problem: residual-ridge is linear. If our remaining errors depend on thresholds such as event score scale, experience minimums, foul-risk bands, or role-cost cutoffs, a linear correction may miss them. The next defensible nonlinear check was a shallow boosted-stump residual learner trained only on previous prediction errors during replay.

Change implemented:

- Added a no-future residual-tree correction path.
- The tree correction stores prior residual examples only, refits on a cadence, selects high-correlation candidate features, and fits shallow boosted stumps with shrinkage.
- Added exact manifests:
  - `modeling/experiments/current-2026-residual-tree.json`
  - `modeling/experiments/current-2024-2026-residual-tree.json`
- Added tests proving the tree residual correction cannot change the first prediction before prior residuals exist.

Result:

| Scope | Relative winner | Best tree-family clue | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Ridge+tree `TW=0.15` | near-tie | 60.36 vs 60.38 | 82.81 vs 82.83 | 0.1576 vs 0.1577 | 103.73 vs 103.57 | Hybrid improves tail error but loses the point metrics and relative benchmark. |
| 2024-2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Ridge+tree `TW=0.15` | near-tie | 32.31 vs 32.32 | 44.25 vs 44.26 | 0.1665 vs 0.1666 | 103.76 vs 103.60 | Broad replay repeats the same pattern: tail clue, not point-default promotion. |

Artifact:

- `modeling/artifacts/reports/residual-tree-check/CROSS_RUN_SUMMARY.md`

Reflection: nonlinear residual trees are rejected as the current point default. The result is still useful because it independently found the same weakness that other branches found: the model can slightly reduce worst-event errors by spending average score and Brier accuracy. That means our next serious improvement probably should not be another generic residual learner. It should target the failure mode directly: high-score event tails, championship divisions, and scout/defense labels.

## Follow-Up Iteration: Championship-Scoped High-Score Tail Correction

Problem: several rejected branches pointed at the same failure mode. Championship-style 2026 events such as `2026hop`, `2026gal`, `2026cur`, and `2026cmptx` dominate the worst-event slices. A blunt event-score-scale correction already existed, but broad scale shifting hurt normal events. The cleaner hypothesis was to let event score-scale correction activate only when pre-match event metadata says the row is a FIRST Championship or championship division context.

Change implemented:

- Added `eventScoreScaleScope` with scoped modes for all events, FIRST Championship contexts, championship divisions, and championship-or-district-championship contexts.
- Reused only prior alliance scores inside the same event, so the correction remains no-future.
- Added exact manifests:
  - `modeling/experiments/current-2026-high-score-tail.json`
  - `modeling/experiments/current-2024-2026-high-score-tail.json`
- Added a regression test proving championship-scoped score scaling leaves regional predictions unchanged while changing later championship predictions after prior event scores exist.

Result:

| Scope | Relative winner | Best scoped-tail clue | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Champs scale `A=0.20 T=8 N=12` | near-tie | 60.36 vs 60.53 | 82.81 vs 83.03 | 0.1576 vs 0.1579 | 103.73 vs 102.29 | Stronger scope reduces the worst slice by 1.44 points, but pays too much in point metrics. |
| 2024-2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Champs scale `A=0.10 T=8 N=12` | near-tie | 32.31 vs 32.31 | 44.25 vs 44.29 | 0.1665 vs 0.1667 | 103.76 vs 102.67 | Broad replay confirms a tail lever, but margin and Brier still reject it as the point default. |

Artifact:

- `modeling/artifacts/reports/high-score-tail-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/high-score-tail-check/TAIL_DELTA_AUDIT.md`

Reflection: this branch is not a failure in the usual sense. It found a repeatable and leakage-safe way to reduce the championship tail, and the broad fixed benchmark even narrowly prefers the stronger scoped variant. The event-delta audit shows the tradeoff clearly: `2026hop` and `2026cmptx` improve, while other championship divisions such as `2026arc`, `2026dal`, and `2026cur` get worse. The point-model benchmark is therefore right to reject it: a model that trims the worst event while degrading average margin and win calibration should be documented as a robustness/risk-control clue, not silently promoted. Current decision: keep plain residual-ridge as the default, keep championship-scoped scaling available for future risk-aware ensemble/selector work, and avoid more generic residual learners until we add real scout defense/PPC data or build a dedicated tail-aware deployment rule.

## Follow-Up Iteration: Residual-Gated And Low-Amplitude Tail Selectors

Problem: the first championship-scoped tail correction found a real high-score lever, but it was too blunt. It improved `2026hop` and `2026cmptx` while hurting other championship divisions. The next logical selector was no-future residual gating: only apply the high-score scale correction if earlier predictions at that event show underprediction. After that failed, a smaller-amplitude sweep tested whether the correction was simply too strong.

Change implemented:

- Added residual-gated event score-scale config fields:
  - `eventScoreScaleResidualGateMinSamples`
  - `eventScoreScaleResidualGateWindow`
  - `eventScoreScaleResidualGateThreshold`
  - `eventScoreScaleResidualGateFullAt`
- The gate uses prior event residuals only, so it cannot know the current match result.
- Added exact manifests:
  - `modeling/experiments/current-2026-residual-gated-tail.json`
  - `modeling/experiments/current-2024-2026-residual-gated-tail.json`
  - `modeling/experiments/current-2026-tail-amplitude.json`
- Expanded the championship-scoped regression test to prove the residual gate blocks scale correction until enough prior residual evidence exists.

Result:

| 2026 replay | Relative winner | Best selector clue | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Residual-gated tail | Plain residual `RW=0.25 L=30 C=40` | Residual-gated champs-div `A=0.15 G=0 F=24` | near-tie | 60.36 vs 60.51 | 82.81 vs 82.94 | 0.1576 vs 0.1578 | 103.73 vs 103.15 | Gate reduced tail less than ungated scale and made point metrics worse. |
| Low-amplitude tail | Plain residual `RW=0.25 L=30 C=40` | Champs-div `A=0.05 T=8 N=12` | near-tie | 60.36 vs 60.39 | 82.81 vs 82.84 | 0.1576 vs 0.1577 | 103.73 vs 103.29 | Smaller scale is safer but still loses score, margin, Brier, and relative benchmark. |

Artifact:

- `modeling/artifacts/reports/tail-selector-2026-check/CROSS_RUN_SUMMARY.md`

Reflection: this was a useful rejection. Residual gating sounded attractive because it was causal and no-future, but the actual replay says it does not choose the right championship events well enough. Low-amplitude scaling is less harmful, but it also gives up most of the tail benefit. The current evidence says the tail problem is not solved by score-scale gating alone. The next serious tail work should either use richer event/team context or real scout defense/PPC labels, not another scalar event-score knob.

## Follow-Up Iteration: Residual Diagnostics And Championship Phase Tail

Problem: after residual-gated and low-amplitude score-scale selectors failed, the next risk was continuing to guess scalar tail fixes. I added a reusable residual diagnostic command to show where the current best actually fails before proposing another model.

Change implemented:

- Added `npm run model:diagnose -- --run-dirs <comma-separated run dirs>`.
- The command writes `RESIDUAL_DIAGNOSTICS.md`, `residual-diagnostics.json`, and `residual-event-mae.svg`.
- The report summarizes worst events, biggest signed under/overprediction, event-phase residuals, championship-like phase residuals, and win-probability calibration.
- Added a no-future championship phase-shift family. It uses only the count of prior alliance rows in the same event, not future scores, to apply early/middle/late championship score shifts.
- Added exact manifests:
  - `modeling/experiments/current-2026-championship-phase-tail.json`
  - `modeling/experiments/current-2024-2026-championship-phase-tail.json`

Residual diagnostic finding:

| Scope | Championship early signed residual | Championship middle signed residual | Championship late signed residual | Interpretation |
| --- | ---: | ---: | ---: | --- |
| 2026 replay | +12.42 | +16.34 | +1.65 | Underprediction is concentrated early/middle; late championship matches are much less biased. |
| 2024-2026 replay | +7.13 | +8.86 | +2.21 | The same shape exists broadly, but it is weaker than in 2026. |

Phase-tail result:

| Replay | Relative winner | Best phase clue | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Decision |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Champs phase `E=8 M=12 LATE=0` | Same | near-tie | 60.33 vs 60.36 default | 82.82 vs 82.81 default | 0.1577 vs 0.1576 default | 103.36 vs 103.73 default | Useful 2026 tail clue, not enough alone. |
| 2024-2026 full replay | Plain residual `RW=0.25 L=30 C=40` | Champs phase `E=8 M=12 LATE=0` for tail only | near-tie | 32.31 default vs 32.33 phase | 44.25 default vs 44.27 phase | 0.1665 default vs 0.1667 phase | 103.76 default vs 103.38 phase | Reject as point default; keep as robustness clue. |

Artifacts:

- `modeling/artifacts/reports/current-best-residual-diagnostics/RESIDUAL_DIAGNOSTICS.md`
- `modeling/artifacts/reports/current-best-residual-diagnostics/residual-event-mae.svg`
- `modeling/artifacts/reports/championship-phase-tail-check/CROSS_RUN_SUMMARY.md`

Reflection: this was a better iteration than the previous tail guesses because it started from a diagnostic pattern. The model learned something real: championship-like early/middle underprediction exists, and a phase boost can trim the worst-event tail. But the broad replay is the judge here. The phase boost spends average score, margin, and Brier quality across 2024-2026, so it is not promoted. Current best remains plain residual-ridge. The next tail attempt should use richer predictors of which championship divisions are underpredicted, not just phase, or it should wait for real scout/PPC/defense labels.

## Follow-Up Iteration: Championship Phase Plus Residual-Boost Tail

Problem: the phase-tail candidate found a real pattern, but it was still a fixed correction. The next hypothesis was to let the model react to prior same-event underprediction inside championship-like events, while avoiding future leakage. This tests whether the model can say, "this championship field is underpredicting right now," rather than giving every championship phase the same boost.

Change implemented:

- Added no-future championship phase residual-boost config fields:
  - `championshipPhaseResidualShiftEarlyWeight`
  - `championshipPhaseResidualShiftMiddleWeight`
  - `championshipPhaseResidualShiftLateWeight`
  - `championshipPhaseResidualShiftMinSamples`
  - `championshipPhaseResidualShiftWindow`
  - `championshipPhaseResidualShiftPositiveOnly`
  - `championshipPhaseResidualShiftScope`
- The boost uses only prior residuals from the same event and the existing prior-event-row phase count.
- Added exact manifests:
  - `modeling/experiments/current-2026-championship-residual-boost-tail.json`
  - `modeling/experiments/current-2024-2026-championship-residual-boost-tail.json`
  - `modeling/experiments/holdout-2024-2026-bucket0-championship-residual-boost-tail.json`
- Hardened the CLI so an optional SQLite `research_runs` cache write failure does not discard completed training artifacts. This matters because one long holdout run completed all model evaluations and then hit a transient `disk I/O error` before writing artifacts.

Result:

| Replay | Relative winner | Fixed-score winner | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Decision |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | Phase-only `E=8 M=12` | Scaled baseline | near-tie | 60.33 | 82.82 | 0.1577 | 103.36 | Residual boost did not improve the 2026 point model. |
| 2024-2026 full replay | Phase+residual boost `E=4 M=6 RB=0.15/0.25/0` | Plain residual `RW=0.25` | near-tie | 32.30 | 44.28 | 0.1666 | 103.30 | Broad relative win, but margin/Brier/fixed diagnostics still disagree. |
| 2024-2026 bucket 0 holdout | Phase+residual boost `E=4 M=6 RB=0.15/0.25/0` | Residual boost only `RB=0.15/0.25/0` | near-tie | 43.13 | 59.64 | 0.1684 | 103.30 | First holdout confirms the hybrid by relative score, but fixed score still splits. |

Artifact:

- `modeling/artifacts/reports/championship-residual-boost-tail-check/CROSS_RUN_SUMMARY.md`

Reflection: this branch is the strongest tail candidate so far, but it is not yet defended enough to replace plain residual-ridge as the conservative default. It now has a broad full-replay win and one broad holdout win, and it improves worst-event MAE meaningfully versus the default. The caution signs are also real: every promotion is a near-tie, 2026 full replay prefers phase-only, fixed-score winners split across scaled/default/residual-boost-only, and margin/Brier usually remain slightly better for plain residual-ridge. The next correct move is not another new tail idea; it is to run the remaining broad bucket holdouts for this exact candidate set and see whether the hybrid survives out-of-sample slices.

## Earlier Iteration: Gated Event Residual Shift

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

## Promoted Iteration: Event-Archetype Score Shift

Reflection from the failed high-event scale runs: event score scale was a real signal, but applying a dynamic score boost based on early event averages was too noisy. The cleaner hypothesis was that some event categories are known before the match and have systematically different score environments.

Change implemented:

- Added championship division event-key detection.
- Added championship/district-championship style event-key detection using `cmp` in the event slug.
- Added model config fields:
  - `championshipDivisionScoreShift`
  - `championshipEventScoreShift`
- Tested archetype variants:
  - `C=8 D=4`
  - `C=12 D=6`
  - `C=16 D=8`
  - `C=20 D=10`

Result:

| Scope | Promoted model | Benchmark | Score MAE | Margin MAE | Brier | Calibration | Worst event MAE |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-only | `C=12 D=6` | 0.633 | 60.51 | 82.78 | 0.1577 | 0.0119 | 104.22 |
| 2024-2026 | `C=12 D=6` | 4.122 | 32.37 | 44.29 | 0.1668 | 0.0082 | 104.22 |

Interpretation: the archetype branch is promoted because it improves the defended leaderboard in both current-season and broad-history validation. Stronger shifts such as `C=20 D=10` achieved lower raw score MAE and lower worst-event MAE, but lost the benchmark because they damaged the balanced metric blend. This is an important judge-facing example of why the leaderboard is not just a single MAE number.

Artifacts:

- `modeling/artifacts/runs/statbotics-2026-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/statbotics-2024-2026-archetype/MODEL_CARD.md`

## Validation Iteration: Per-Season Archetype Check

Reflection after promotion: a broad-history win can hide season-specific weaknesses, so the archetype model needs per-season validation before we talk about it confidently.

Initial substring-filter result:

| Scope | Promoted model | Benchmark | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2024-only | `No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00` | 0.603 | 13.38 | 19.62 | 0.1767 | 27.05 | Archetype shifts improve raw score MAE slightly, but lose the balanced leaderboard. |
| 2025-only | `No-Future Archetype Ensemble ... C=12 D=6` | 0.424 | 22.49 | 29.44 | 0.1660 | 34.95 | Archetype shift promotes cleanly. |
| 2026-only | `No-Future Archetype Ensemble ... C=12 D=6` | 0.633 | 60.51 | 82.78 | 0.1577 | 104.22 | Archetype shift promotes cleanly. |

Exact-manifest follow-up:

| Scope | Exact manifest promoted model | Benchmark | Score MAE | Margin MAE | Brier | Worst event MAE | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2024-only | `No-Future Archetype Ensemble ... C=8 D=4` | 0.635 | 13.35 | 19.65 | 0.1772 | 27.62 | A smaller archetype shift wins this exact candidate set, but with slightly worse margin/Brier than EPA-MC. |
| 2025-only | `No-Future Archetype Ensemble ... C=12 D=6` | 0.516 | 22.49 | 29.44 | 0.1660 | 34.95 | Same defended archetype model promotes. |
| 2026-only | `No-Future Archetype Ensemble ... C=12 D=6` | 0.650 | 60.51 | 82.78 | 0.1577 | 104.22 | Same defended archetype model promotes. |

Interpretation: the archetype shift is not a universal fixed-strength season winner. It is currently the defended choice for broad 2024-2026 replay and current 2026 deployment, but 2024 is sensitive to candidate set and prefers either the simpler EPA-MC model or a smaller `C=8 D=4` archetype shift depending on the exact benchmark suite. This is not a contradiction; it exposes that the leaderboard score is intentionally relative to the candidate set. From here, exact manifests should be the default for judge-facing claims.

Artifacts:

- `modeling/artifacts/runs/statbotics-2024-archetype-validation/MODEL_CARD.md`
- `modeling/artifacts/runs/statbotics-2025-archetype-validation/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2024-archetype-check/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2025-archetype-check/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2026-archetype/MODEL_CARD.md`

## Research System Update: Exact Experiment Manifests

Substring model filters were useful for fast exploration, but they are too ambiguous for final evidence because adding a new model can silently change which candidates run. The CLI now supports exact manifests:

```sh
npm run model:train -- --manifest modeling/experiments/current-2026-archetype.json
```

The manifest supplies exact model names, scope, output directory, and notes. Each manifest run copies its manifest into the artifact directory as `experiment-manifest.json`, which makes the model card reproducible.

Tracked manifests added:

- `modeling/experiments/current-2026-archetype.json`
- `modeling/experiments/current-2024-archetype-check.json`
- `modeling/experiments/current-2025-archetype-check.json`
- `modeling/experiments/current-2024-scaled-archetype.json`
- `modeling/experiments/current-2025-scaled-archetype.json`
- `modeling/experiments/current-2026-scaled-archetype.json`
- `modeling/experiments/current-2024-2026-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket0-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket0-scaled-archetype.json`
- `modeling/experiments/current-2026-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket0-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket0-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket1-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket1-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket2-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket2-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket3-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket3-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket4-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket4-widening-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket3-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket3-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket4-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket4-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket0-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket0-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket1-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket1-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket2-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket2-targeted-conformal-scaled-archetype.json`
- `modeling/experiments/current-2026-role-monte-carlo.json`
- `modeling/experiments/current-2024-2026-role-monte-carlo.json`
- `modeling/experiments/current-2026-role-scaled-archetype.json`
- `modeling/experiments/current-2024-2026-role-scaled-archetype.json`
- `modeling/experiments/holdout-2026-bucket0-role-scaled-archetype.json`
- `modeling/experiments/holdout-2024-2026-bucket0-role-scaled-archetype.json`
- `modeling/experiments/current-2026-residual-ridge-scaled-archetype.json`
- `modeling/experiments/current-2026-role-feature-residual-ridge.json`
- `modeling/experiments/current-2024-2026-role-feature-residual-ridge.json`
- `modeling/experiments/current-2026-residual-tree.json`
- `modeling/experiments/current-2024-2026-residual-tree.json`

## Research System Update: Checkpointed Event-Bucket Holdouts

Reflection from the near-tie runs: a near-tie leaderboard should trigger confirmation, not overconfidence. The next improvement was to make repeatable event-key holdout manifests so we can score a predeclared subset without changing the candidate list after seeing the answer.

Change implemented:

- Added `evaluationEventKeyHashFilter` to experiment manifests.
- The manifest can now score only deterministic event-key hash buckets, for example bucket `0` of `5`.
- The walk-forward replay still runs through all selected matches in chronological order, so the model state can use prior information. Only the reported metrics are restricted to the checkpointed evaluation bucket.
- Model cards now report both total replay rows and evaluation rows.

Checkpointed results:

| Scope | Evaluation subset | Promoted model | Confidence | Fixed score | Score MAE | Margin MAE | Brier | Reflection |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026 bucket 0 of 5 | 1,526 matches | `CR=0.100 DR=0.050` | `near_tie` | 0.999 | 65.83 | 91.23 | 0.1660 | Confirms the scaled 2026 candidate on a tougher event bucket, but `C=12 D=6` is only 0.003 fixed-score points behind. |
| 2024-2026 bucket 0 of 5 | 2,912 matches | `CR=0.100 DR=0.050` | `near_tie` | 4.380 | 43.25 | 59.79 | 0.1688 | Broad holdout favors scaled archetype over the full-replay `C=20 D=10` winner, but still only with near-tie confidence. |

Interpretation: this is the best evidence so far for the scaled-archetype branch. It wins the current-season full replay, the current-season checkpoint holdout, and the broad checkpoint holdout. It still does not end the search because the broad full replay picks `C=20 D=10` and several candidates remain inside near-tie thresholds. The next defensible step is either additional predeclared holdout buckets or interval calibration, not a triumphant final model claim.

Artifacts:

- `modeling/artifacts/runs/holdout-2026-bucket0-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-scaled-archetype/MODEL_CARD.md`

## Latest Iteration: No-Future Conformal Interval Calibration

Reflection from the checkpointed holdouts: the leading point models were under-covering their nominal 10-90 score bands, especially on hard event buckets. The model should not just predict a score; it should honestly express uncertainty. The next test was therefore not a new scoring model, but a no-future interval calibration layer.

Change implemented:

- Added optional conformal interval calibration to model configs:
  - `conformalInterval`
  - `conformalTargetCoverage`
  - `conformalMinSamples`
  - `conformalWindow`
- For each match group, interval half-width is computed from absolute residuals from earlier replayed predictions only.
- The current match residual never contributes to its own interval width.
- Tested conformal scaled-archetype variants:
  - `Q=0.80`
  - `Q=0.84`
  - `Q=0.88`

Result:

| Scope | Relative promoted model | Best fixed-score model | Coverage | Width | Brier | Reflection |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026 full replay | non-conformal scaled `CR=0.100 DR=0.050` | conformal `Q=0.80` | 76.9% promoted / 77.9% fixed-best | 171.3 / 179.6 | 0.1578 / 0.1573 | Q=0.80 improves Brier and fixed score, but relative score keeps the narrower interval. |
| 2026 bucket-0 holdout | conformal `Q=0.80` | conformal `Q=0.84` | 75.9% promoted / 79.9% fixed-best | 190.3 / 209.9 | 0.1651 / 0.1648 | Conformal clearly helps this hard holdout; Q=0.84 is best for honest coverage. |
| 2024-2026 bucket-0 holdout | conformal `Q=0.80` | conformal `Q=0.84` | 76.8% promoted / 80.8% fixed-best | 125.5 / 138.4 | 0.1681 / 0.1681 | Conformal improves broad-holdout Brier and coverage; Q=0.84 best balances the fixed benchmark. |
| 2026 bucket-1 holdout | non-conformal scaled `CR=0.100 DR=0.050` | conformal `Q=0.80` / fixed `C=12 D=6` tie | 81.0% promoted / 78.8% fixed-best | 163.0 / 157.8 | 0.1659 / 0.1654 | Conformal Q=0.80 improves Brier and fixed score, but it narrows the interval and loses the relative benchmark. |
| 2024-2026 bucket-1 holdout | non-conformal scaled `CR=0.100 DR=0.050` | fixed `C=12 D=6` | 79.0% promoted / 79.1% fixed-best | 75.5 / 75.5 | 0.1778 / 0.1779 | Replace-mode conformal does not help this bucket; Q=0.84 improves coverage but pays too much width/score penalty. |

Interpretation: conformal calibration is useful and should stay in the research system, but bucket 1 exposed an important problem: replace-mode conformal can make intervals narrower than the base simulation interval. The most defensible operational stance is: keep the non-conformal scaled model as the current point predictor, and use conformal variants as uncertainty-calibrated candidates until more holdout buckets decide the tradeoff.

Artifacts:

- `modeling/artifacts/runs/manifest-current-2026-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket1-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-conformal-scaled-archetype/MODEL_CARD.md`

## Latest Iteration: Widening Conformal Interval Calibration

Reflection from bucket 1: conformal replacement was mathematically leakage-safe, but not always conservative. On some slices `Q=0.80` chose a narrower interval than the base simulation interval, which can improve the fixed score while hiding uncertainty we had already estimated from the model state.

Change implemented:

- Added `conformalIntervalMode`.
- The default remains `replace`, preserving earlier runs.
- New `widen` mode sets the score interval half-width to the larger of:
  - the base model interval half-width, and
  - the no-future empirical absolute-residual quantile.
- Tested widening conformal scaled-archetype variants:
  - `Q=0.80`
  - `Q=0.84`
  - `Q=0.88`
- Evaluated on fresh bucket-2, bucket-3, and bucket-4 manifests after the issue was diagnosed, so this was not promoted on the same bucket that inspired the change.

Result:

| Scope | Relative promoted model | Best fixed-score model | Coverage | Width | Brier | Reflection |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026 bucket-2 holdout | non-conformal scaled `CR=0.100 DR=0.050` | non-conformal scaled `CR=0.100 DR=0.050` | 79.7% | 171.0 | 0.1547 | Widening Q=0.80 improves Brier slightly, but loses the relative and fixed benchmarks after width and point-error penalties. |
| 2024-2026 bucket-2 holdout | non-conformal scaled `CR=0.100 DR=0.050` | widening conformal `Q=0.80` | 78.3% promoted / 80.1% fixed-best | 98.8 / 104.2 | 0.1630 / 0.1629 | Widening Q=0.80 wins the fixed benchmark and is a near-tie, but the relative benchmark still keeps the narrower point model. |
| 2026 bucket-3 holdout | widening conformal `Q=0.80` | widening conformal `Q=0.84` | 77.8% promoted / 80.6% fixed-best | 195.3 / 210.1 | 0.1539 / 0.1543 | First fresh 2026 bucket where widening Q=0.80 wins the relative benchmark, still only as a near-tie. |
| 2024-2026 bucket-3 holdout | widening conformal `Q=0.80` | widening conformal `Q=0.80` | 79.2% | 105.5 | 0.1628 | Strongest broad evidence for widening Q=0.80: it wins both relative and fixed scoring, still with near-tie confidence. |
| 2026 bucket-4 holdout | non-conformal scaled `CR=0.100 DR=0.050` | replace conformal `Q=0.80` | 84.8% promoted / 83.3% fixed-best | 161.7 / 154.6 | 0.1398 / 0.1389 | Small 438-match bucket; base scaled wins relative, replace Q=0.80 wins fixed, and widening does not help. |
| 2024-2026 bucket-4 holdout | non-conformal scaled `CR=0.100 DR=0.050` | non-conformal scaled `CR=0.100 DR=0.050` | 79.5% | 69.8 | 0.1644 | Clear broad win for the base scaled point model; this blocks any honest universal conformal promotion. |

Interpretation: widening conformal is the best uncertainty-layer idea so far because it fixes a diagnosed conservatism bug and wins multiple fresh checkpoints. However, the full bucket sweep rejects a universal conformal default: the base scaled point model still wins most relative holdouts and broad bucket 4 wins clearly. The defensible stance is now split: use `CR=0.100 DR=0.050` as the point-prediction default, keep widening `Q=0.80` as the leading uncertainty candidate, and try season/event-phase conformal calibration before changing the promoted model.

Artifacts:

- `modeling/artifacts/runs/holdout-2026-bucket2-widening-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-widening-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket3-widening-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-widening-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket4-widening-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-widening-conformal-scaled-archetype/MODEL_CARD.md`

## Research System Update: Cross-Run Summary Reports

Reflection from the bucket sweep: manually copying one run at a time into this research log is error-prone. Judge-facing comparisons should be generated from saved artifacts so anyone can trace the table back to the exact `run.json` files.

Change implemented:

- Added `npm run model:report -- --run-dirs <comma-separated run dirs>`.
- The report writes:
  - `CROSS_RUN_SUMMARY.md`
  - `cross-run-summary.json`
- The summary table includes relative winner, fixed-score winner, confidence, score MAE, margin MAE, Brier, calibration, coverage, interval width, and worst-event MAE.
- The report also counts relative winners, fixed-score winners, and promotion confidence labels across the sweep.

Latest generated artifact:

- `modeling/artifacts/reports/widening-conformal-bucket-sweep/CROSS_RUN_SUMMARY.md`

## Latest Iteration: Targeted Event-Phase Conformal Calibration

Reflection from the widening-conformal bucket sweep: global widening `Q=0.80` helped in some buckets but hurt in others. The next hypothesis was that uncertainty should depend on what part of an event we are in. Early event predictions have less same-event evidence; later predictions should be able to use a different residual pool.

Change implemented:

- Added `conformalScope` to model configs:
  - `global`
  - `season`
  - `eventProgress`
  - `seasonEventProgress`
- Added event-progress buckets based only on prior alliance predictions from that event:
  - early
  - middle
  - late
- Scoped conformal calibration falls back to broader no-future pools when the scoped residual bucket is too small.
- Added targeted candidates:
  - season widening `Q=0.80`
  - event-phase widening `Q=0.80`
  - season+event-phase widening `Q=0.80`
  - season+event-phase widening `Q=0.84`

Result:

| Scope | Relative promoted model | Best fixed-score model | Coverage | Width | Brier | Reflection |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026 bucket-0 holdout | global widening `Q=0.84` | season+phase `Q=0.84` | 79.5% promoted / 80.4% fixed-best | 209.9 / 205.1 | 0.1647 / 0.1642 | Targeted scopes are competitive, but the relative winner is still a global conformal variant and the result is a near-tie. |
| 2026 bucket-1 holdout | non-conformal scaled `CR=0.100 DR=0.050` | event-phase `Q=0.80` | 81.0% promoted / 81.3% fixed-best | 163.0 / 165.3 | 0.1659 / 0.1655 | Event-phase improves the fixed score but loses the relative benchmark; this argues for uncertainty-layer use, not point-default promotion. |
| 2026 bucket-2 holdout | non-conformal scaled `CR=0.100 DR=0.050` | non-conformal scaled `CR=0.100 DR=0.050` | 79.7% | 171.0 | 0.1547 | The only clear promotion in the targeted sweep; scoped conformal did not improve this bucket enough. |
| 2026 bucket-3 holdout | global widening `Q=0.80` | season+phase `Q=0.84` | 77.8% promoted / 80.4% fixed-best | 195.3 / 205.1 | 0.1539 / 0.1540 | Targeted scopes did not beat the existing global widening relative winner, but season+phase improved fixed score. |
| 2026 bucket-4 holdout | event-phase `Q=0.80` | non-conformal scaled `CR=0.100 DR=0.050` | 86.4% promoted / 84.8% fixed-best | 164.8 / 161.7 | 0.1390 / 0.1398 | Event-phase scoping improved score, Brier, and worst-event MAE over the prior base-model winner, but fixed scoring still preferred base. |
| 2024-2026 bucket-0 holdout | season `Q=0.80` | global widening `Q=0.84` | 78.1% promoted / 81.6% fixed-best | 129.3 / 138.6 | 0.1678 / 0.1679 | Season scoping improves calibration and relative score, but the fixed winner is a different global conformal setting. |
| 2024-2026 bucket-1 holdout | event-phase `Q=0.80` | global widening `Q=0.80` | 80.3% promoted / 80.0% fixed-best | 77.9 / 78.3 | 0.1772 / 0.1777 | Event-phase is useful here, but five candidates are near-ties and fixed scoring does not uniquely support it. |
| 2024-2026 bucket-2 holdout | non-conformal scaled `CR=0.100 DR=0.050` | global widening `Q=0.80` | 78.3% promoted / 80.1% fixed-best | 98.8 / 104.2 | 0.1630 / 0.1629 | The base point model remains the relative winner, while conformal widening improves fixed uncertainty tradeoffs. |
| 2024-2026 bucket-3 holdout | season+phase `Q=0.84` | season `Q=0.80` | 82.6% promoted / 79.8% fixed-best | 113.6 / 107.6 | 0.1628 / 0.1627 | Very tight near-tie; targeted scopes slightly reshuffled the widening-conformal winner rather than creating a decisive promotion. |
| 2024-2026 bucket-4 holdout | event-phase `Q=0.80` | non-conformal scaled `CR=0.100 DR=0.050` | 81.0% promoted / 79.5% fixed-best | 71.9 / 69.8 | 0.1638 / 0.1644 | Strongest targeted-conformal signal: event-phase scoping improved score, margin, Brier, coverage, and worst-event MAE over the previous broad bucket-4 base winner. |

Aggregate targeted sweep:

- Relative winners: event-phase `Q=0.80` 3, scaled `CR=0.100 DR=0.050` 3, global widening `Q=0.80` 1, global widening `Q=0.84` 1, season `Q=0.80` 1, season+phase `Q=0.84` 1.
- Fixed-score winners: scaled `CR=0.100 DR=0.050` 3, global widening `Q=0.80` 2, season+phase `Q=0.84` 2, event-phase `Q=0.80` 1, global widening `Q=0.84` 1, season `Q=0.80` 1.
- Promotion confidence: 9 `near_tie`, 1 `clear`.

Interpretation: targeted conformal is a meaningful uncertainty improvement path, but the completed bucket sweep rejects it as a universal point-model default. Event-phase `Q=0.80` repaired the broad bucket-4 counterexample while staying leakage-safe, yet buckets 0-2 show that the improvement is not stable enough. The next defensible step is to stop tuning conformal scopes for now and move to a different source of signal: metadata-backed event adapters, audited pre-match Statbotics provenance, real Firebase scout enrichment, or role-aware Monte Carlo simulation.

Artifacts:

- `modeling/artifacts/runs/holdout-2026-bucket3-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket4-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket1-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket2-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-targeted-conformal-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/targeted-conformal-bucket-sweep/CROSS_RUN_SUMMARY.md`

## Latest Iteration: Role-Aware Monte Carlo And Dual Defense EPA

Reflection after the conformal sweep: conformal calibration can make uncertainty more honest, but it does not solve the user's core defense question. The next test was therefore to compare the current scaled archetype point model against role-aware Monte Carlo, direct role-cost EPA, and dual offense/defense EPA. This is only a first defense test because the current broad cache still has 0 scout-enriched rows; the role/defense signal is inferred mostly from official score residuals.

Change tested:

- Added exact role-model manifests for 2026-only and 2024-2026 broad replay.
- Compared:
  - `Role-Aware Prior`
  - plain Monte Carlo EPA
  - role-aware Monte Carlo EPA
  - direct role EPA
  - soft-role EPA
  - dual offense/defense EPA
  - the current scaled archetype default

Result:

| Scope | Promoted model | Confidence | Best role/MC challenger | Promoted score MAE | Challenger score MAE | Promoted Brier | Challenger Brier | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026-only | scaled `CR=0.100 DR=0.050` | `clear` | soft-role EPA `R=0.25` by relative rank; role MC by raw score | 60.43 | 61.92 / 60.79 | 0.1578 | 0.1593 / 0.1597 | Role-aware models did not reach near-tie range. The closest raw-score role MC still lost score, margin, Brier, and worst-event MAE. |
| 2024-2026 | scaled `CR=0.100 DR=0.050` | `clear` | role Monte Carlo `R=0.15` | 32.35 | 32.58 | 0.1668 | 0.1685 | Broad replay confirms the rejection. Role MC is second by relative rank, but still worse on every core metric. |

Interpretation: the current role-aware Monte Carlo branch is rejected as a promoted model. This does not reject defense modeling as a concept; it rejects the current weak proxy. The next defense branch needs real scout labels, separate opponent-suppression and foul-risk estimates, and role assignment simulation as a net point swing. Without that, direct role-cost subtraction damages too many events.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-monte-carlo/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-monte-carlo/MODEL_CARD.md`
- `modeling/artifacts/reports/role-monte-carlo-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Iteration: Role-Scaled Archetype Ensemble

Reflection from the failed role-Monte-Carlo branch: the test was too blunt. It asked a weak inferred role signal to replace the entire scaled archetype score engine. A more realistic hypothesis is that role/defense information might help only as a small perturbation inside the current best point model.

Change tested:

- Added role-scaled archetype ensemble candidates that keep the current scaled archetype configuration:
  - `R=0.05`
  - `R=0.10`
  - `R=0.15`
  - light blend `W=0.10 R=0.15`
- Compared them against the current scaled archetype default, standalone role Monte Carlo, and published Statbotics comparator.
- Ran 2026-only, broad 2024-2026, and the first deterministic bucket-0 confirmation for both scopes.

Result:

| Scope | Relative winner | Fixed winner | Confidence | Score MAE | Margin MAE | Brier | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 2026 full replay | scaled `CR=0.100 DR=0.050` | scaled `CR=0.100 DR=0.050` | `near_tie` | 60.43 | 82.86 | 0.1578 | Role-scaled variants are close, but all lose score MAE or Brier. |
| 2024-2026 full replay | role-scaled `R=0.15` | role-scaled `R=0.15` | `near_tie` | 32.36 | 44.33 | 0.1668 | Tiny benchmark win from better calibration, but base has slightly better raw score and margin. |
| 2026 bucket-0 holdout | scaled `CR=0.100 DR=0.050` | role-scaled `R=0.10` | `near_tie` | 65.83 | 91.23 | 0.1660 | Fixed score likes a role variant, but relative point metrics still favor base. |
| 2024-2026 bucket-0 holdout | scaled `CR=0.100 DR=0.050` | scaled `CR=0.100 DR=0.050` | `near_tie` | 43.25 | 59.79 | 0.1688 | Bucket confirmation blocks promotion of the broad full-replay `R=0.15` near-tie. |

Aggregate:

- Relative winners: scaled base 3, role-scaled `R=0.15` 1.
- Fixed winners: scaled base 2, role-scaled `R=0.10` 1, role-scaled `R=0.15` 1.
- Promotion confidence: 4 `near_tie`, 0 `clear`.

Interpretation: role-scaled archetype injection is not promoted. It is a better experiment than standalone role Monte Carlo because it does not destroy the score engine, but the gains are too small and unstable. This result prompted the follow-up foul-risk branch documented near the top of this log. Official foul-risk is now implemented, but the role branch still does not beat the non-role point baseline cleanly, so the remaining blocker is actual scouted defense/offense-role labels rather than only foul-risk accounting.

Artifacts:

- `modeling/artifacts/runs/current-2026-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/current-2024-2026-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-role-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/role-scaled-archetype-sweep/CROSS_RUN_SUMMARY.md`

## Research System Update: Public Event Metadata Cache

Reflection from the archetype and role branches: some of the strongest current signal comes from event context, especially championship-style events. Until now, the code identified those mostly through event-key slug heuristics such as `arc`, `gal`, or `cmp`. That was defensible enough for exploration, but weak for judge-facing evidence because it hides where the event-type knowledge came from.

Change implemented:

- Added an `event_metadata` table to the local SQLite cache.
- Added `npm run model:ingest:statbotics-events`.
- Cached 646 public Statbotics event records across 2024-2026.
- Added known-before-match metadata features:
  - event week,
  - team count,
  - event type flags for regional, district, district championship, championship, and championship division.
- Kept post-event Statbotics fields such as event EPA and prediction metrics in raw JSON only; they are not exposed as model features.
- Updated archetype score-shift logic so it prefers explicit metadata event types such as `champs_div` and `district_cmp`, with event-key slug matching retained only as fallback for cache rows that do not have metadata.
- Added an explicit `einstein` championship-event path after discovering Statbotics event metadata uses that label for Einstein fields such as `2026cmptx`.

Result:

| Scope | Metadata rows | Relative winner | Confidence | Score MAE | Margin MAE | Brier | Reflection |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- |
| 2026 scaled-archetype exact manifest | 10,182 alliance rows | scaled `CR=0.100 DR=0.050` | `near_tie` | 60.43 | 82.86 | 0.1578 | Winner unchanged; metadata backs the previous archetype result with explicit event type provenance. |
| 2024-2026 scaled-archetype exact manifest | 30,030 alliance rows | fixed `C=20 D=10` | `near_tie` | 32.34 | 44.35 | 0.1671 | Broad winner unchanged; still a near-tie that trades better score/worst-event behavior for worse margin/Brier. |

Interpretation: metadata-backed event typing improves scientific defensibility more than raw model performance. The Einstein-specific follow-up closed a real event-type blind spot, but the exact 2026 and broad 2024-2026 leaderboards stayed materially unchanged. That is still valuable: the branch converts a hidden heuristic into cached, inspectable provenance and gives future feature/model families access to safe event context. It does not change the current point-model default.

Artifacts:

- `modeling/artifacts/runs/manifest-current-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2024-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/metadata-backed-archetype-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/metadata-einstein-archetype-check/CROSS_RUN_SUMMARY.md`

## Research System Update: Statbotics Prediction Provenance Audit

Reflection from the latest leaderboards: the published Statbotics match-prediction comparator is very strong on raw score error, but using it as a model feature would be a leakage risk unless we can prove each archived prediction was generated before the match being predicted. Top-line strength is not enough; provenance decides whether the signal is allowed.

Change implemented:

- Added `npm run model:audit:statbotics-predictions`.
- Added a raw-payload reader for the local SQLite cache.
- Added a generated audit artifact with JSON plus Markdown output.
- Added a regression test proving undated prediction payloads stay non-promotable.
- Checked the [official Statbotics Python API documentation](https://statbotics.readthedocs.io/). It documents that match queries return match data, score breakdowns, and predictions, but the documented match API surface does not establish a per-prediction generation timestamp. It also documents Einstein as a first-class event type, supporting the metadata fix above.

Result from the current local cache:

| Metric | Value |
| --- | ---: |
| Raw Statbotics match payload batches | 16 |
| Raw match rows scanned | 15,500 |
| Rows with prediction values | 15,500 |
| Rows with prediction-specific timestamps | 0 |
| Prediction timestamp coverage | 0.0% |
| Recommendation | `keep_non_promotable` |

Interpretation: this closes a major temptation loop. Published Statbotics predictions remain useful as an external comparator, and their raw performance tells us what might be achievable, but they are not eligible for promoted model features in the current cache. The only time-like fields seen were top-level `time` and `predicted_time`, which describe match timing, not when the prediction object was produced.

Artifact:

- `modeling/artifacts/audits/statbotics-prediction-provenance/AUDIT.md`

## Research System Update: Cross-Run SVG Metric Charts

Reflection from judge-documentation review: the tables are precise, but they ask readers to work too hard. The report generator should keep the exact numbers and also emit a fast visual summary, especially for near-tie comparisons where tradeoffs matter.

Change implemented:

- Cross-run reports now write `leaderboard-metrics.svg`.
- The SVG compares score MAE, margin MAE, Brier, coverage miss, and worst-event MAE.
- Bars are normalized within each metric, so the chart is for visual comparison across runs, not a replacement for the exact table.
- The cross-run report test now verifies the SVG artifact exists.

Artifact:

- `modeling/artifacts/reports/metadata-einstein-archetype-check/leaderboard-metrics.svg`

## Research System Update: Scout Archive Import And Coverage Audit

Reflection from the data-enrichment branch: the next real improvement probably needs scout data, but the current local environment has no Firebase credentials and the available Admin V4 backup contains TBA cache rows only. The right move was not to pretend we had scout labels; it was to make the importer and audit path ready for the next real backup.

Change implemented:

- Local backup import now unwraps nested `scoutArchive.records`.
- Match, V4 match, and defense archive records can become modeling `ScoutingObservation` rows.
- Pit records and deleted records are ignored for match modeling.
- V4 scout offense now preserves `totalMatchPoints`; if total is absent, auto + teleop + endgame points are summed instead of accidentally taking only the first field.
- Added `npm run model:audit:scout-coverage`.
- Added regression tests for nested scout archive import and matched/unmatched scout coverage auditing.

Result from the current local cache:

| Metric | Value |
| --- | ---: |
| Official matches | 15,015 |
| Official team slots | 90,090 |
| Scouting observations | 0 |
| Matched observations | 0 |
| Observation match coverage | 0.0% |

Interpretation: current official-data model runs are still not scout-enriched. The useful progress is infrastructural: when a Firebase token or a backup with scout archive rows is available, the pipeline can now ingest those rows and prove how many align with official matches before any model promotion attempt.

Artifact:

- `modeling/artifacts/audits/scout-coverage/SCOUT_COVERAGE.md`

## Research System Update: TBA Event Metadata Adapter

Reflection from the metadata branch: relying only on Statbotics event metadata is better than event-key guessing, but the app already stores TBA event summaries in Admin backups. Those summaries should feed the same event metadata table, as long as they do not erase richer fields from another source.

Change implemented:

- Added TBA event-summary normalization into `EventMetadata`.
- Added TBA event-type mapping from the [official TBA event enum](https://raw.githubusercontent.com/the-blue-alliance/the-blue-alliance/master/consts/event_type.py):
  - regional,
  - district,
  - district championship,
  - championship division,
  - championship finals / Einstein,
  - offseason/preseason/unknown.
- TBA yearly/event ingestion now caches event metadata when credentials are available.
- Local Admin V4 backup import now extracts `event-summary` cache entries into event metadata.
- Event metadata upsert now merges with existing rows, preserving non-null fields such as Statbotics `teamCount` when a TBA summary does not include them.

Result from the current local backup:

| Event | Source after import | Event type | Week | Team count |
| --- | --- | --- | ---: | ---: |
| `2026mnum` | TBA | regional | 5 | 47 |

Interpretation: this is a provenance improvement, not a new model promotion. The exact event type can now come from TBA when available, while existing richer metadata survives the merge. This should make future metadata-backed experiments less brittle.

## Research System Update: FIRST Events Metadata Adapter

Reflection after the TBA adapter: FIRST Events is another canonical official source already touched by the ingestion pipeline. It should contribute event metadata under the same merge rules, but we should not claim live FIRST coverage until credentials are present and a real ingest has run.

Change implemented:

- FIRST yearly event responses are cached as raw payloads.
- FIRST event rows are normalized into `EventMetadata`.
- FIRST event types are mapped into the same modeling archetypes:
  - regional,
  - district,
  - district championship,
  - championship division,
  - Einstein/championship finals,
  - offseason/preseason/unknown.
- FIRST metadata uses the same merge-safe `upsertEventMetadata` path as Statbotics and TBA.
- Added a unit test for district championship, championship division, and Einstein mapping.

Result:

- `npm run model:typecheck` passes.
- `npm run test` passes with 20 tests.
- No live FIRST ingest was run in this environment because `FIRST_EVENTS_USERNAME` and `FIRST_EVENTS_AUTH_TOKEN` are not currently set.

Interpretation: this completes the planned event-metadata adapter layer across Statbotics, TBA, and FIRST. It is still only a provenance/data-readiness improvement until a live FIRST ingest or FIRST-backed cache is available.

## Research System Update: Event Metadata Coverage Audit

Reflection after adding the FIRST adapter: once multiple sources can populate event metadata, we need a coverage audit just like the scout-data and Statbotics-prediction audits. Otherwise we would only know coverage indirectly from training logs.

Change implemented:

- Added `npm run model:audit:event-metadata`.
- The audit compares cached official match events against `event_metadata`.
- It reports source counts, event-type counts, missing event samples, and coverage percentage.
- Added a unit test with one covered event and one missing event.

Result from the current local cache:

| Metric | Value |
| --- | ---: |
| Official matches | 15,015 |
| Official events | 165 |
| Metadata rows | 646 |
| Official events with metadata | 165 |
| Official events missing metadata | 0 |
| Official event coverage | 100.0% |

Current official event types:

- regional: 87
- district: 47
- championship division: 16
- district championship: 12
- Einstein/championship finals: 3

Interpretation: event metadata coverage is now good for the current cached match set. This removes one data-readiness concern, but it does not solve the larger scout-data gap.

Artifact:

- `modeling/artifacts/audits/event-metadata-coverage/EVENT_METADATA_COVERAGE.md`

## Research System Update: Fixed Benchmark Score

Reflection after the exact-manifest runs: the relative leaderboard is still useful for choosing a winner inside one run, but it cannot be the only judge-facing score because it depends on which other models happened to be in that run. A model can look better or worse simply because the candidate set changed.

Change implemented:

- Kept the existing relative benchmark for within-run promotion.
- Added a fixed benchmark score to every model result and model card.
- The fixed benchmark uses explicit metric targets instead of peer ranks:
  - score MAE and RMSE relative to average actual alliance score,
  - margin MAE relative to average actual alliance score,
  - season-normalized score and margin MAE,
  - win Brier score,
  - calibration error,
  - interval coverage miss,
  - worst-event and worst-season score MAE,
  - event/season instability,
  - interval width.
- Each metric component is nonlinear: values worse than the target are magnified by adding squared excess.
- The fixed score then adds the same leakage, eligibility, and overfit-risk penalties used by the relative benchmark.

Interpretation: the fixed score should be used for cross-run comparison and judge-facing trend lines. The relative benchmark still decides the promoted model inside a single experiment for now, because it remains sensitive to the local Pareto frontier of that candidate set.

Fixed-score cross-season check:

| Scope | Relative benchmark promoted model | Best fixed-score model | Promoted fixed score | Best fixed score | Reflection |
| --- | --- | --- | ---: | ---: | --- |
| 2024-only | `C=8 D=4` | `EPA-MC W=0.20 P=0.00` | 0.709 | 0.701 | 2024 is lower-scoring; archetype boosts are not clearly stable. |
| 2025-only | `C=12 D=6` | `C=12 D=6` | 0.590 | 0.590 | 2025 supports the defended archetype strength. |
| 2026-only | `C=12 D=6` | `C=20 D=10` | 0.864 | 0.862 | The fixed-score advantage for `C=20 D=10` is tiny and trades worse margin/Brier for better score/worst-event MAE. |

Reflection: this is useful disagreement. It does not justify blindly replacing the promoted model, because the 2026 fixed-score gap is only 0.002 and the stronger shift regresses margin and Brier. It does justify the next modeling branch: a game-year-conditioned event-archetype adapter or a multi-objective promotion rule that treats fixed-score near-ties as unresolved instead of pretending one score is the whole truth.

## Research System Update: Near-Tie Promotion Confidence

Reflection after the scaled-archetype runs: a single promoted model name can be misleading when the leading candidates differ by hundredths of a benchmark point and trade score MAE against margin/Brier. We should not tell judges or ourselves that a model is clearly better when the evidence says it is only barely ahead.

Change implemented:

- Added `promotionConfidence` to every model result:
  - `clear`
  - `near_tie`
  - `not_promoted`
- Added `promotionNotes` to model cards, summaries, and CLI output.
- A promotion is marked `near_tie` when another eligible model is within:
  - `0.050` relative-benchmark points, or
  - `0.010` fixed-benchmark points, or
  - the fixed benchmark prefers a different eligible model.
- Near-tie candidates are listed with relative and fixed deltas.

Updated evidence:

| Scope | Promoted model | Confidence | Near-tie evidence |
| --- | --- | --- | --- |
| 2026-only scaled manifest | `CR=0.100 DR=0.050` | `near_tie` | Six eligible models are within near-tie thresholds; `C=12 D=6` is only `0.045` relative and `0.003` fixed points behind. |
| 2024-2026 scaled manifest | `C=20 D=10` | `near_tie` | Six eligible models are within near-tie thresholds; `C=12 D=6` is only `0.019` relative and `0.002` fixed points behind. |

Interpretation: the current pipeline now distinguishes “winner of this manifest” from “decisive model.” This is a major documentation improvement because it prevents benchmark overclaiming. The next modeling work should use this flag to decide when to run a confirmation manifest or hidden holdout before changing operational guidance.

## Latest Iteration: Season-Score-Scaled Archetype Shift

Reflection from fixed-score disagreement: fixed championship boosts are suspicious because FRC score scales vary wildly by game. Adding 12 alliance points is modest in 2026 and enormous in 2024. The next defensible hypothesis was to scale the championship/division boost by the known season score environment before the match.

Change implemented:

- Added `championshipDivisionScoreShiftRatio`.
- Added `championshipEventScoreShiftRatio`.
- The shift uses `season_average_alliance_score`, which is already a walk-forward feature known before the predicted match.
- Tested ratio variants:
  - `CR=0.055 DR=0.0275`
  - `CR=0.075 DR=0.0375`
  - `CR=0.100 DR=0.050`

Result:

| Scope | Relative benchmark promoted model | Best fixed-score model | Promoted fixed score | Best fixed score | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2024-only | `CR=0.100 DR=0.050` | `EPA-MC W=0.20 P=0.00` | 0.711 | 0.701 | 13.36 | 19.64 | 0.1771 | 27.54 | Relative scoring likes the ratio branch, but fixed scoring still prefers the simpler model. |
| 2025-only | `C=12 D=6` | `C=12 D=6` | 0.590 | 0.590 | 22.49 | 29.44 | 0.1660 | 34.95 | Fixed points still fit 2025 better than score-scale ratios. |
| 2026-only | `CR=0.100 DR=0.050` | `CR=0.100 DR=0.050` | 0.860 | 0.860 | 60.43 | 82.86 | 0.1578 | 103.73 | Accepted as the strongest current-season 2026 candidate so far. |
| 2024-2026 | `C=20 D=10` | `C=20 D=10` | 4.590 | 4.590 | 32.34 | 44.35 | 0.1671 | 103.70 | Broad replay is a near-tie; `C=12 D=6` fixed score is 4.592 and `CR=0.075` is 4.595. |

Interpretation: scaled archetypes are useful but not a complete solution. They improve the 2026 current-season candidate and reduce the arbitrary-point-size objection, but 2025 still prefers fixed `C=12 D=6` and 2024 fixed scoring still prefers no archetype boost. This branch should stay alive for 2026 operations, but the judge-facing claim should be modest: event-archetype modeling is real, exact strength is unresolved, and the next step is either a hidden holdout or a meta-rule that handles near-ties explicitly.

Artifacts:

- `modeling/artifacts/runs/manifest-current-2024-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2025-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2024-2026-scaled-archetype/MODEL_CARD.md`

## Latest Iteration: Season-Scoped Event-Type Residual Shift

Reflection from the metadata-backed archetype runs: explicit event type is now available for every cached official event, but the model only used it for coarse championship archetype shifts. A safer next hypothesis was that completed events of the same type within the same season might reveal a small systematic score bias without leaking future matches or crossing game-year score scales.

Change implemented:

- Added `eventTypeResidualShiftWeight`.
- Added `eventTypeResidualShiftMinSamples`.
- Added `eventTypeResidualShiftWindow`.
- The residual key is season-scoped: `season|eventType`.
- The correction is updated only after each alliance row is scored, and it is cleared on season reset.
- Tested three small variants on top of the current scaled-archetype model:
  - `T=0.05 M=40`
  - `T=0.10 M=40`
  - `T=0.15 M=60`

Result:

| Scope | Relative benchmark promoted model | Best fixed-score model | Confidence | Score MAE | Margin MAE | Brier | Calibration | Coverage | Worst event MAE | Reflection |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-only | `T=0.10 M=40` | `T=0.15 M=60` | `near_tie` | 60.43 | 82.90 | 0.1579 | 0.0117 | 77.0% | 103.57 | Narrowly promotes by the nuanced relative benchmark, mainly improving worst-event behavior over the prior scaled default. |
| 2024-2026 | `T=0.15 M=60` | `T=0.05 M=40` | `near_tie` | 32.34 | 44.34 | 0.1668 | 0.0094 | 77.6% | 103.27 | Generalizes as a tiny broad-history improvement, but six eligible models remain inside near-tie thresholds. |

Interpretation before confirmation: event-type residual correction was worth testing further, but it was not a decisive discovery. The raw score MAE barely moved; the value was in slightly better worst-event behavior and a better multi-metric leaderboard score. The next defensible step was a predeclared confirmation sweep across event-key buckets before presenting this as stronger than the scaled-archetype default.

Artifacts:

- `modeling/artifacts/runs/manifest-current-2026-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/runs/manifest-current-2024-2026-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/reports/event-type-residual-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/event-type-residual-check/leaderboard-metrics.svg`

## Follow-Up Confirmation: 2026 Event-Type Residual Buckets

Reflection from the full event-type residual replay: a near-tie full-replay win is not enough. The right next question was whether the improvement survives deterministic event-key holdouts.

Change tested:

- Added five predeclared 2026 event-bucket manifests:
  - `holdout-2026-bucket0-event-type-residual`
  - `holdout-2026-bucket1-event-type-residual`
  - `holdout-2026-bucket2-event-type-residual`
  - `holdout-2026-bucket3-event-type-residual`
  - `holdout-2026-bucket4-event-type-residual`
- Each manifest replays all 2026 matches chronologically, but only scores one deterministic event-key hash bucket.
- The candidate set matches the exact event-type residual replay so this is a confirmation run, not a new tuning sweep.

Result:

| Bucket | Eval matches | Relative winner | Fixed-score winner | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 0 | 1,526 | scaled `CR=0.100 DR=0.050` | scaled `CR=0.100 DR=0.050` | `near_tie` | 65.83 | 91.23 | 0.1660 | 103.73 | Rejects event-type residual as the bucket winner. |
| 1 | 526 | event-type residual `T=0.05 M=40` | fixed `C=12 D=6` | `near_tie` | 51.27 | 70.51 | 0.1657 | 98.67 | Mixed evidence; relative and fixed scoring disagree. |
| 2 | 1,325 | fixed `C=12 D=6` | fixed `C=12 D=6` | `clear` | 57.33 | 79.47 | 0.1546 | 93.46 | Clear rejection of event-type residual on this slice. |
| 3 | 1,276 | event-type residual `T=0.15 M=60` | event-type residual `T=0.05 M=40` | `near_tie` | 66.41 | 89.29 | 0.1540 | 98.26 | Supports event-type residual, but still near-tie. |
| 4 | 438 | `EPA-MC W=0.20 P=0.00` | fixed `C=12 D=6` | `near_tie` | 44.56 | 59.61 | 0.1390 | 54.64 | Rejects event-type residual; simple EPA-MC wins relative scoring. |

Interpretation: this confirmation sweep rejects promoting event-type residual as the 2026 default. It remains a useful research clue because buckets 1 and 3 improved under some leaderboard views, but the five-bucket split is exactly the kind of instability the near-tie system is meant to expose. For 2026 operations, keep the scaled-archetype model as the defended point-model default and continue searching.

Artifacts:

- `modeling/artifacts/reports/event-type-residual-2026-bucket-confirmation/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/event-type-residual-2026-bucket-confirmation/leaderboard-metrics.svg`
- `modeling/artifacts/runs/holdout-2026-bucket0-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket1-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket2-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket3-event-type-residual/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket4-event-type-residual/MODEL_CARD.md`

## Follow-Up Confirmation: Broad Event-Type Residual Buckets

Reflection from the 2026 confirmation: if event-type residual was unstable in the current game, the broad 2024-2026 full replay also needed the same stress test before being treated as a defended broad-history default.

Change tested:

- Ran the five predeclared broad event-bucket manifests:
  - `holdout-2024-2026-bucket0-event-type-residual`
  - `holdout-2024-2026-bucket1-event-type-residual`
  - `holdout-2024-2026-bucket2-event-type-residual`
  - `holdout-2024-2026-bucket3-event-type-residual`
  - `holdout-2024-2026-bucket4-event-type-residual`
- Each manifest replays all cached 2024-2026 matches chronologically, but only scores one deterministic event-key hash bucket.
- Generated a full-plus-buckets stability report so the broad full-replay winner is checked against the broad holdouts.

Result:

| Bucket | Eval matches | Relative winner | Fixed-score winner | Confidence | Score MAE | Margin MAE | Brier | Worst event MAE | Reflection |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 0 | 2,912 | event-type residual `T=0.05 M=40` | event-type residual `T=0.15 M=60` | `near_tie` | 43.25 | 59.81 | 0.1689 | 103.66 | Weakly supports event-type residual, but scaled archetype is almost tied. |
| 1 | 2,470 | event-type residual `T=0.05 M=40` | event-shift `S=0.15 M=8` | `near_tie` | 24.78 | 34.69 | 0.1777 | 98.68 | Relative winner is event-type residual; fixed scoring prefers simpler event shift. |
| 2 | 3,247 | scaled `CR=0.100 DR=0.050` | event-type residual `T=0.10 M=40` | `near_tie` | 33.68 | 46.24 | 0.1630 | 93.28 | Mixed evidence; relative and fixed scoring disagree. |
| 3 | 3,631 | event-type residual `T=0.10 M=40` | fixed `C=20 D=10` | `near_tie` | 35.46 | 47.44 | 0.1629 | 98.26 | Supports event-type residual by relative score, but fixed scoring prefers fixed archetype. |
| 4 | 2,755 | `EPA-MC W=0.20 P=0.00` | `EPA-MC W=0.20 P=0.00` | `near_tie` | 21.97 | 30.10 | 0.1639 | 54.64 | Rejects event-type residual; simpler EPA-MC wins. |

Stability review:

- Holdout stability status: `fragmented`.
- Relative leader was `T=0.05 M=40`, but only with two of five holdout wins.
- Fixed-score winners split five ways.
- The broad full-replay winner `T=0.15 M=60` was not confirmed: `0/5` relative and `1/5` fixed holdouts.

Interpretation: broad history gives event-type residual more encouragement than the 2026-only confirmation, but still not enough for a defended default. The most honest conclusion is that event-type residual is a small, sometimes-helpful residual correction, not a stable replacement for the scaled-archetype/default EPA-MC family. This branch should stay in the candidate pool, but future work should probably pursue better labels or a calibration split rather than keep tuning `T`.

Artifacts:

- `modeling/artifacts/reports/event-type-residual-2024-2026-bucket-confirmation/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/event-type-residual-2024-2026-full-plus-buckets/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/event-type-residual-2024-2026-full-plus-buckets/cross-run-summary.json`

## Research System Update: Stability Review

Reflection from the event-type residual branch: near-tie full-replay winners are too easy to overstate. The report system needed to make bucket confirmation visible without hand-written interpretation.

Change implemented:

- Cross-run reports now include a `Stability Review` section.
- The review counts relative winners and fixed-score winners across holdout rows only.
- If a full replay is included beside holdouts, the report checks whether the full-replay winner was confirmed by the holdout winners.
- The same result is written into `cross-run-summary.json` under `stabilityReview`.
- The report now shortens event-type residual model names so stability tables are readable.

Result on the 2026 event-type residual confirmation set:

- Holdout stability status: `mixed`.
- Relative holdout winners split five ways.
- Fixed-score winner was fixed `C=12 D=6` in three of five buckets.
- When the full 2026 replay is included, the report says the full-replay winner `Event-Type Residual T=0.10 M=40` was not confirmed: `0/5` relative and `0/5` fixed holdouts.
- The broad 2024-2026 full-plus-buckets report says the full-replay winner `Event-Type Residual T=0.15 M=60` was also not confirmed: `0/5` relative and `1/5` fixed holdouts.

Interpretation: this is a guardrail, not a model improvement. It makes the research process more honest by forcing any future full-replay promotion to pass a visible stability check before we describe it as a defended default.

Artifacts:

- `modeling/artifacts/reports/event-type-residual-2026-full-plus-buckets/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/event-type-residual-2026-full-plus-buckets/cross-run-summary.json`

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
- `T` controls a season-scoped event-type residual shift, using prior residuals from events of the same public type such as regional, district, championship division, or Einstein.
- `C`/`D` fixed-shift variants add fixed expected alliance points for championship division or championship-style event keys.
- `CR`/`DR` scaled-shift variants add a percentage of the known season average alliance score for those event archetypes.
- `Q` conformal variants use prior absolute residual quantiles to calibrate score bands without changing the point model.
- `Widening-Conformal` variants only apply the conformal band when it is wider than the base simulation interval, preventing a calibration layer from reducing uncertainty that the model already estimated.
- `Event-Phase` conformal variants split residual pools by how many alliance predictions have already happened in the same event, then fall back to broader no-future pools when the scoped bucket is too small.

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

## Research Data Audit: Local Backup Inventory

Reflection: before building another role/defense/PPC model branch, we needed to verify whether the local admin backup actually contains scout rows. Reading the full payload manually would risk exposing private scout/device/API data, so the safer move was a structure-only inventory that skips sensitive-looking filenames before parsing and never prints raw records, scout names, team-level rows, API keys, or credentials.

Change implemented:

- Added `npm run model:audit:local-backups`.
- The audit scans explicit local paths, defaulting to `.playwright-cli`.
- It counts archive records, direct match/defense/pit collections, admin cache entries, event keys, parse errors, and sensitive-looking filenames skipped before parse.
- It writes `modeling/artifacts/audits/local-backup-inventory/LOCAL_BACKUP_INVENTORY.md` and `local-backup-inventory.json`.
- Added a regression test proving that a file named like `ADMIN API KEYS.json` is skipped before parse and that the markdown report does not leak scout names or token-looking values.

Result on the current `.playwright-cli` backup:

- JSON files found: 1.
- Parsed files: 1.
- Admin cache entries: 4.
- Archive records: 0.
- Importable match/defense records: 0.
- Defense records: 0.
- Pit records: 0.

Interpretation: the current local backup is useful as an admin cache artifact, but it does not contain usable local scout, PPC, defense, or pit labels for training. The current best model therefore remains an official-data/Statbotics-context model with zero scout-enriched rows. The next real unlock is not another small hyperparameter tweak; it is importing actual Firebase scout observations or a real scout archive backup, then rerunning scout coverage and the same defended leaderboard.

Artifact:

- `modeling/artifacts/audits/local-backup-inventory/LOCAL_BACKUP_INVENTORY.md`

## Model Iteration: Robust EPA Update Clipping

Reflection: after the local backup audit confirmed we still have no scout/PPC/defense labels, the next safe model idea was to test whether outlier matches were poisoning online EPA ratings. The hypothesis was that official scores and residual diagnostics should still record the full error, but future team-rating updates might improve if extreme score errors are clipped before they move ratings.

Change implemented:

- Added `ratingUpdateErrorClip` to cap the error used for team rating movement.
- Added `residualMemoryErrorClip` to cap residual pools used for future uncertainty/event residual state.
- Added three robust-update scaled-archetype candidates: `U=80 R=120`, `U=100 R=140`, and `U=120 R=160`.
- Added a regression test with an extreme outlier match to prove clipped updates affect future predictions without using future information.

Focused 2026 result:

| Model | Benchmark | Fixed | Score MAE | Margin MAE | Brier | Worst Event MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| defended scaled archetype | 0.071 | 0.860 | 60.43 | 82.86 | 0.1578 | 103.73 | keep default |
| robust `U=120 R=160` | 0.484 | 1.001 | 61.74 | 84.97 | 0.1593 | 112.23 | reject |
| robust `U=100 R=140` | 0.787 | 1.084 | 62.68 | 86.38 | 0.1610 | 116.19 | reject |
| robust `U=80 R=120` | 1.205 | 1.271 | 64.40 | 88.51 | 0.1629 | 122.87 | reject |

Interpretation: clipping outlier-driven rating movement sounds mathematically sensible, but in this 2026 replay it removed real signal faster than it removed noise. The defended scaled-archetype model won with `clear` confidence and no near-tie rival. This branch should stay as a documented rejected idea unless future scout labels show a separate source of outlier/foul/reliability information that lets us clip only bad observations instead of all large official errors.

Artifact:

- `modeling/artifacts/runs/robust-update-2026-scaled-archetype/MODEL_CARD.md`

## Model Iteration: Official Component-Prior Features

Reflection: Firebase scout enrichment is still blocked because the local environment currently has no `MODEL_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_PROJECT_ID`, or `MODEL_FIREBASE_ACCESS_TOKEN`. Rather than fake PPC/defense labels, the next defensible source of known-before-match signal was official score-breakdown history. TBA/Statbotics cached matches expose component points such as auto, teleop, endgame, and fouls. Those labels are known only after prior matches, so they can be used as walk-forward team tendencies without leaking the current match.

Change implemented:

- Added prior component state to the feature builder:
  - `own_component_auto_sum`
  - `own_component_teleop_sum`
  - `own_component_endgame_sum`
  - `own_component_foul_sum`
  - `own_component_modeled_score_sum`
  - matching opponent and gap features.
- Added `componentPriorWeight` and `componentPriorMinMatches` for no-future ensemble candidates.
- Added three component-prior scaled-archetype candidates: `CP=0.05 CM=2`, `CP=0.10 CM=2`, and `CP=0.10 CM=4`.
- Added a leakage regression test proving match 1 has zero prior component features and match 2 sees only match 1's component breakdown.
- Added a bucket-0 confirmation manifest for the component-prior near-tie.

Full 2026 focused result:

| Model | Benchmark | Fixed | Score MAE | Margin MAE | Brier | Worst Event MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| defended scaled archetype | 0.069 | 0.860 | 60.43 | 82.86 | 0.1578 | 103.73 | keep default |
| component `CP=0.05 CM=2` | 0.122 | 0.861 | 60.49 | 83.10 | 0.1581 | 103.53 | near-tie, do not promote |
| component `CP=0.10 CM=4` | 0.124 | 0.857 | 60.54 | 83.19 | 0.1579 | 102.78 | fixed-score winner, do not promote |
| component `CP=0.10 CM=2` | 0.178 | 0.859 | 60.54 | 83.19 | 0.1580 | 103.19 | near-tie, do not promote |

Bucket-0 confirmation:

| Model | Benchmark | Fixed | Score MAE | Margin MAE | Brier | Worst Event MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| defended scaled archetype | 0.324 | 0.999 | 65.83 | 91.23 | 0.1660 | 103.73 | relative winner |
| component `CP=0.10 CM=4` | 0.329 | 0.999 | 65.82 | 91.46 | 0.1660 | 102.78 | near-tie, not enough |
| component `CP=0.10 CM=2` | 0.759 | 0.989 | 65.90 | 91.57 | 0.1662 | 103.19 | fixed-score winner, not enough |
| component `CP=0.05 CM=2` | 0.995 | 1.008 | 65.90 | 91.50 | 0.1665 | 103.53 | reject |

Interpretation: component priors contain some useful information for worst-event and fixed-score diagnostics, but the score is too mixed to promote. They slightly reduce worst-event MAE, but usually worsen margin and Brier. Keep the component feature plumbing because it is leakage-safe and may help future component/foul models, but keep the defended scaled-archetype point model as the default.

Artifacts:

- `modeling/artifacts/runs/component-prior-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-component-prior-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/component-prior-2026-check/CROSS_RUN_SUMMARY.md`

## Model Iteration: No-Future Residual-Ridge Correction

Reflection: the component-prior branch showed that official breakdown fields contain some signal, but direct blending into EPA was too blunt. The next stronger idea was a stacked residual layer: keep the online EPA/scaled-archetype model as the base predictor, then let a regularized ridge model learn from previous prediction errors only. This is not a generic offline fit over all rows. The residual model is refit during replay, uses only prior residuals, clips its correction, and waits for a minimum training history before it can affect predictions.

Change implemented:

- Added residual correction config fields:
  - `residualCorrectionWeight`
  - `residualCorrectionLambda`
  - `residualCorrectionMinRows`
  - `residualCorrectionClip`
- Added a no-future residual training cache inside replay. It records each row's final prediction error only after the match has been predicted.
- Added compact-feature residual ridge fitting with regularization and clipped correction.
- Added three candidates:
  - plain residual ridge `RW=0.25 L=30 C=40`
  - stronger residual ridge `RW=0.40 L=60 C=35`
  - residual ridge plus component prior `RW=0.25 L=40 C=35 CP=0.10 CM=4`
- Added a regression test proving the residual layer cannot change the first prediction before prior errors exist, and does change later predictions after enough prior rows exist.
- Fixed the residual refit cadence so a failed zero-row attempt does not suppress the first real fit.

Full 2026 focused result:

| Model | Benchmark | Fixed | Score MAE | Margin MAE | Brier | Worst Event MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| residual ridge `RW=0.25 L=30 C=40` | 0.210 | 0.867 | 60.36 | 82.81 | 0.1576 | 103.73 | promising near-tie |
| residual ridge `RW=0.40 L=60 C=35` | 0.501 | 0.863 | 60.36 | 82.86 | 0.1579 | 103.69 | near-tie, weaker |
| defended scaled archetype | 0.620 | 0.860 | 60.43 | 82.86 | 0.1578 | 103.73 | still fixed-score winner |
| residual + component prior | 1.262 | 0.866 | 60.49 | 83.11 | 0.1578 | 102.87 | not full-replay winner |

Bucket-0 confirmation:

| Model | Benchmark | Fixed | Score MAE | Margin MAE | Brier | Worst Event MAE | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| residual + component prior | 0.424 | 0.995 | 65.75 | 91.37 | 0.1657 | 102.87 | bucket winner |
| residual ridge `RW=0.25 L=30 C=40` | 0.537 | 1.019 | 65.78 | 91.18 | 0.1660 | 103.73 | improves score/margin, not winner |
| defended scaled archetype | 0.666 | 0.999 | 65.83 | 91.23 | 0.1660 | 103.73 | near-tie |
| residual ridge `RW=0.40 L=60 C=35` | 0.878 | 1.017 | 65.82 | 91.33 | 0.1665 | 103.69 | reject for now |

Interpretation: this is the most promising new branch in the latest work because the residual family beats the defended default on full 2026 replay and on bucket 0. However, the exact winning config is unstable: full replay promotes plain residual ridge, while bucket 0 promotes residual plus component prior. Fixed scoring also still prefers the old default on full replay. Therefore the defended operational default should not change yet. The residual family should move to a full five-bucket confirmation sweep next.

Artifacts:

- `modeling/artifacts/runs/residual-ridge-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket0-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/residual-ridge-2026-check/CROSS_RUN_SUMMARY.md`

## Follow-Up Confirmation: Residual-Ridge 2026 Buckets

Reflection from the first residual-ridge check: full replay plus one holdout was encouraging, but not enough. The right next move was a full deterministic five-bucket confirmation sweep using the same residual candidate set, then a generated stability report so the evidence could not be cherry-picked from one friendly slice.

Change tested:

- Added and ran residual-ridge holdout manifests for buckets 1-4, completing buckets 0-4.
- Generated a full-plus-buckets cross-run report from the saved artifacts.
- Compared relative winners and fixed-score winners separately, because residual-ridge improves point metrics while fixed scoring still penalizes instability, coverage, and width.

Result:

| Scope | Eval matches | Relative winner | Fixed-score winner | Confidence | Score MAE | Margin MAE | Brier | Coverage | Worst event MAE | Reflection |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2026 full replay | 5,091 | residual `RW=0.25 L=30 C=40` | scaled `CR=0.100 DR=0.050` | `near_tie` | 60.36 | 82.81 | 0.1576 | 76.9% | 103.73 | Plain residual wins relative score; old scaled model still wins fixed score. |
| Bucket 0 | 1,526 | residual + component `RW=0.25 L=40 C=35 CP=0.10 CM=4` | residual + component | `near_tie` | 65.75 | 91.37 | 0.1657 | 73.4% | 102.87 | Component prior helps this hardest slice but hurts interval coverage. |
| Bucket 1 | 526 | residual `RW=0.25 L=30 C=40` | residual `RW=0.25 L=30 C=40` | `near_tie` | 51.18 | 70.54 | 0.1653 | 80.8% | 98.86 | Cleanest bucket-level support for the plain residual branch. |
| Bucket 2 | 1,325 | residual `RW=0.25 L=30 C=40` | residual + component | `near_tie` | 57.18 | 79.51 | 0.1543 | 79.8% | 93.27 | Relative and fixed both support the residual family, but not the same config. |
| Bucket 3 | 1,276 | residual `RW=0.25 L=30 C=40` | stronger residual `RW=0.40 L=60 C=35` | `near_tie` | 66.41 | 89.28 | 0.1539 | 73.7% | 98.45 | Supports residual correction, while warning that correction strength is still not settled. |
| Bucket 4 | 438 | residual `RW=0.25 L=30 C=40` | scaled `CR=0.100 DR=0.050` | `near_tie` | 44.55 | 59.49 | 0.1394 | 85.2% | 54.98 | Plain residual improves point metrics, but fixed scoring keeps the old default. |

Stability review:

- Holdout stability status: `mixed`.
- Relative holdout leader: residual `RW=0.25 L=30 C=40`, with 4 of 5 holdout wins.
- Fixed-score holdout leaders split: residual + component won 2, old scaled default won 1, plain residual won 1, stronger residual won 1.
- The full replay winner was confirmed by 4 of 5 relative holdouts, but only 1 of 5 fixed-score holdouts.

Interpretation: this branch is now promoted as the strongest current 2026 point-prediction candidate, with caveats. The evidence is stronger than the prior event-type residual branch because the same plain residual config survives most relative holdouts. It is not a universal or final model because the gains are small, every run is a near-tie, and the fixed benchmark is deliberately skeptical of the residual branch's coverage and stability tradeoffs. The next defensible test is broad 2024-2026 residual-ridge validation, followed by scout-enriched residual/role models only after real Firebase or archive scout rows are available.

Artifacts:

- `modeling/artifacts/runs/holdout-2026-bucket1-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket2-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket3-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2026-bucket4-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/residual-ridge-2026-full-plus-buckets/CROSS_RUN_SUMMARY.md`

## Follow-Up Validation: Broad Residual-Ridge Full Bucket Check

Reflection from the 2026 residual-ridge sweep: a current-season model can be genuinely better for 2026 and still fail across older games. The next test was therefore a broad 2024-2026 residual-family replay, followed by broad event-bucket checkpoints. This is not yet a full universal-candidate comparison against every earlier broad winner; it is a targeted question: does the same residual correction survive outside 2026?

Change tested:

- Added `current-2024-2026-residual-ridge-scaled-archetype.json`.
- Added broad event-bucket residual manifests for buckets 0-4.
- Ran the full broad residual-family replay and buckets 0-4.
- Generated the full broad residual stability report.

Result:

| Scope | Eval matches | Relative winner | Fixed-score winner | Confidence | Score MAE | Margin MAE | Brier | Calibration | Coverage | Worst event MAE | Reflection |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2024-2026 full replay | 15,015 | residual `RW=0.25 L=30 C=40` | stronger residual `RW=0.40 L=60 C=35` | `near_tie` | 32.31 | 44.25 | 0.1665 | 0.0086 | 77.6% | 103.76 | Plain residual improves score, margin, and Brier over the scaled baseline, but fixed score is tied with a stronger residual variant. |
| 2024-2026 bucket 0 | 2,912 | residual `RW=0.25 L=30 C=40` | scaled `CR=0.100 DR=0.050` | `near_tie` | 43.18 | 59.68 | 0.1685 | 0.0183 | 74.9% | 103.76 | Confirms the plain residual by relative score, but fixed scoring still prefers the old scaled default. |
| 2024-2026 bucket 1 | 2,470 | stronger residual `RW=0.40 L=60 C=35` | residual `RW=0.25 L=30 C=40` | `near_tie` | 24.75 | 34.64 | 0.1775 | 0.0186 | 79.0% | 98.82 | Confirms the residual family, but stronger residual gets the relative win while plain residual gets the fixed win. |
| 2024-2026 bucket 2 | 3,247 | residual `RW=0.25 L=30 C=40` | scaled `CR=0.100 DR=0.050` | `near_tie` | 33.64 | 46.20 | 0.1627 | 0.0167 | 78.4% | 93.04 | Clean relative support for plain residual; fixed score is effectively tied with the old scaled baseline. |
| 2024-2026 bucket 3 | 3,631 | stronger residual `RW=0.40 L=60 C=35` | stronger residual `RW=0.40 L=60 C=35` | `near_tie` | 35.45 | 47.40 | 0.1627 | 0.0203 | 76.5% | 98.37 | Supports a stronger residual setting on this broad slice. |
| 2024-2026 bucket 4 | 2,755 | residual + component `RW=0.25 L=40 C=35 CP=0.10 CM=4` | scaled `CR=0.100 DR=0.050` | `near_tie` | 21.87 | 30.06 | 0.1634 | 0.0249 | 79.3% | 55.12 | Relative score likes component prior here; fixed score defends the old scaled baseline. |

Baseline comparisons inside the same runs:

- Broad full scaled baseline: score MAE 32.35, margin MAE 44.32, Brier 0.1668.
- Broad full plain residual: score MAE 32.31, margin MAE 44.25, Brier 0.1665.
- Broad bucket-0 scaled baseline: score MAE 43.25, margin MAE 59.79, Brier 0.1688.
- Broad bucket-0 plain residual: score MAE 43.18, margin MAE 59.68, Brier 0.1685.
- Broad bucket-1 scaled baseline: score MAE 24.77, margin MAE 34.74, Brier 0.1778.
- Broad bucket-1 stronger residual: score MAE 24.75, margin MAE 34.64, Brier 0.1775.
- Broad bucket-1 plain residual: score MAE 24.76, margin MAE 34.68, Brier 0.1775.
- Broad bucket-2 scaled baseline: score MAE 33.68, margin MAE 46.24, Brier 0.1630.
- Broad bucket-2 plain residual: score MAE 33.64, margin MAE 46.20, Brier 0.1627.
- Broad bucket-3 scaled baseline: score MAE 35.47, margin MAE 47.48, Brier 0.1629.
- Broad bucket-3 stronger residual: score MAE 35.45, margin MAE 47.40, Brier 0.1627.
- Broad bucket-4 scaled baseline: score MAE 21.94, margin MAE 30.12, Brier 0.1644.
- Broad bucket-4 residual + component: score MAE 21.87, margin MAE 30.06, Brier 0.1634.

Stability review:

- Holdout stability status: `mixed`.
- Relative holdout leader: residual `RW=0.25 L=30 C=40`, but only with 2 of 5 broad holdout wins.
- Fixed-score holdout leader: scaled `CR=0.100 DR=0.050`, with 3 of 5 broad holdout wins.
- The broad full-replay winner was not confirmed by a majority: 2 of 5 relative holdouts and 1 of 5 fixed-score holdouts.

Interpretation: broad residual-ridge is a real family-level improvement but not a single stable broad default. Every broad residual-family relative row was won by a residual variant, and each winner improved score/margin/Brier versus the old scaled baseline. However, the exact winning residual configuration split across plain residual, stronger residual, and residual-plus-component, while fixed scoring still prefers the old scaled baseline in three of five holdouts. This is a useful judge-facing example of why the model is not "done": the family has signal, but the broad deployment rule is unresolved. Also, residual broad sweeps are slow enough that refit-performance optimization should become a research-system task if this family remains in the candidate pool.

Artifacts:

- `modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket0-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket1-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket2-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket3-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/runs/holdout-2024-2026-bucket4-residual-ridge-scaled-archetype/MODEL_CARD.md`
- `modeling/artifacts/reports/residual-ridge-2024-2026-initial-check/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/residual-ridge-2024-2026-partial-buckets-0-2/CROSS_RUN_SUMMARY.md`
- `modeling/artifacts/reports/residual-ridge-2024-2026-full-plus-buckets/CROSS_RUN_SUMMARY.md`

## Follow-Up Validation: Direct Residual-Ridge Vs Event-Type Residual

Reflection after the full broad residual bucket sweep: residual-ridge looked better inside its own family, but that was still not enough. The older event-type residual branch had previously won broad full replay in a different candidate set. The fair next question was to put the best residual-ridge, event-type residual, archetype, and scaled baselines into one exact manifest.

Change tested:

- Added `current-2024-2026-residual-vs-event-type.json`.
- Compared 10 no-future/promotable candidates:
  - simple EPA-MC,
  - event-shift baseline,
  - fixed `C=20 D=10`,
  - scaled `CR=0.100 DR=0.050`,
  - event-type residual `T=0.05`, `T=0.10`, `T=0.15`,
  - residual-ridge plain, stronger, and component variants.
- Omitted published Statbotics predictions from this promotion manifest because their prediction-generation timestamps are still unproven.

Result:

| Rank | Model | Confidence | Score MAE | Margin MAE | Brier | Calibration | Coverage | Worst event MAE | Reflection |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | residual `RW=0.25 L=30 C=40` | `near_tie` | 32.31 | 44.25 | 0.1665 | 0.0086 | 77.6% | 103.76 | Best direct point predictor by relative benchmark. |
| 2 | residual `RW=0.40 L=60 C=35` | `near_tie` | 32.32 | 44.26 | 0.1666 | 0.0085 | 77.6% | 103.74 | Very close; supported by broad buckets 1 and 3. |
| 3 | event-type residual `T=0.15 M=60` | `near_tie` | 32.34 | 44.34 | 0.1668 | 0.0094 | 77.6% | 103.27 | Better worst-event behavior, weaker point metrics. |
| 5 | event-type residual `T=0.05 M=40` | `near_tie` | 32.35 | 44.32 | 0.1668 | 0.0076 | 77.6% | 103.66 | Best fixed benchmark by 0.001, but not relative winner. |
| 6 | scaled `CR=0.100 DR=0.050` | `near_tie` | 32.35 | 44.32 | 0.1668 | 0.0100 | 77.6% | 103.73 | Old baseline remains close and fixed-score competitive. |

Interpretation: the direct comparison promotes plain residual-ridge as the current broad point-prediction candidate too. It beats the earlier event-type residual winners on score MAE, margin MAE, and Brier in the same candidate set. But this is still a near-tie result: seven eligible models are inside near-tie thresholds, event-type residual still has better worst-event MAE, and fixed scoring slightly prefers event-type residual `T=0.05`. The honest conclusion is not "residual-ridge solved it"; it is "residual-ridge is now the strongest known point model, while event-type residual remains a useful robustness clue."

Artifact:

- `modeling/artifacts/runs/residual-vs-event-type-2024-2026/MODEL_CARD.md`

## Current Data Caveats

- Superseded historical caveat: early official-data benchmarks had 0 scout-enriched rows and Firebase ingest was blocked by missing local modeling env vars. The later Firebase import and scout coverage audit superseded that state: 528 normalized observations, 356 matched to official match/team slots, concentrated mostly in 2026mnum. The current claim is sparse usable scout evidence, not no scout evidence.
- Event metadata is now cached for 646 public Statbotics events across 2024-2026, and local/TBA/FIRST event summaries can merge into the same table without erasing richer non-null fields. The metadata coverage audit confirms 165/165 official cached events have metadata. Only known-before-match fields are exposed as features; post-event EPA/metric summaries remain raw cached data and are not predictors. Einstein event metadata is treated as championship context.
- Published Statbotics match predictions are audited as high-risk for leakage in the current cache: 15,500 rows include prediction values, but 0 include prediction-specific timestamps. They remain non-promotable comparators.
- Role-defense rows exist where the feature builder can infer role context, but true defense modeling remains weak without reliable scouted defense labels.
- Championship-style 2026 events are the hardest current slices. Examples from the latest runs include `2026hop`, `2026gal`, `2026cur`, and `2026cmptx`.
- The training CLI now logs per-model progress, supports exact experiment manifests, annotates near-tie promotions, and supports deterministic event-bucket holdout scoring.

## Rejected Or Not-Yet-Promoted Ideas

- Published Statbotics predictions: strong raw scores, not promotable because the local provenance audit found 0 prediction-specific timestamps across 15,500 cached prediction rows.
- Plain season-reset EPA: still a strong baseline, but the event-shift ensembles now beat it in the latest focused tests.
- Ungated event shift: good broad-history winner, but too aggressive for the 2026-only scope compared with `S=0.15 M=8`.
- Global interval scaling: improved score-band coverage, but did not beat the unscaled 2026 event-shift model after width and calibration were counted.
- Event score-scale shifting: improved worst-event MAE slightly, but hurt overall score MAE, margin MAE, and Brier enough to lose the benchmark.
- Selective high-event score-scale shifting: reduced worst-event MAE more safely than blunt event scaling, but still lost too much global accuracy to promote.
- Championship-scoped high-score tail scaling: not promoted as the point default. It reduced worst-event MAE from 103.73 to as low as 102.29 on 2026 and from 103.76 to as low as 102.23 on broad replay, but degraded margin MAE/Brier enough that plain residual-ridge still won the relative benchmark.
- Residual-gated and low-amplitude tail selectors: rejected for now. The 2026 selector report gave plain residual-ridge all three relative wins; the best low-amplitude tail clue improved worst-event MAE by only 0.44 while still losing score MAE, margin MAE, and Brier.
- Championship phase and phase+residual boost: not promoted as the defended default yet. The completed broad bucket sweep gives phase+residual boost 4 of 7 relative wins and the best point deployment score inside the tail-correction candidate set, but all seven runs are `near_tie`, it has 0 fixed-score wins, bucket 2 promotes conservative residual-ridge by both relative and fixed scoring, and the stability report is `mixed`. This is now a strong tail-correction clue, not a universal point-model replacement.
- Residual-mean gated championship tail selector: rejected as first implementation. The gate works without future leakage and wins fixed-score diagnostics on the two full replays, but it loses to the ungated phase+residual boost by relative score and does not recover the conservative residual baseline's 2026 margin/Brier advantage.
- WinCal-NoTail championship tail probability split: rejected as a promotion, kept as useful infrastructure. It isolates boosted score forecasts from win probability, improves calibration error on 2026 and broad full replay, and wins the fixed benchmark in both runs, but it slightly worsens Brier compared with both the uncalibrated tail and conservative residual. Probability quality should follow Brier first, so calibration alone is not enough.
- Learned championship-tail residual correction: strongest tail challenger so far, but not the defended default yet. The aggressive learned tail wins 2026 and broad full replays by relative score and cuts 2026 worst-event MAE to 102.94, but it worsens Brier. The feature-reduced learned tail improves 2026 margin/Brier and wins broad fixed score, but broad Brier remains worse than conservative residual. Needs event-bucket confirmation before any promotion claim.
- Over-strong archetype shifts: `C=16 D=8` and `C=20 D=10` improve raw score MAE and worst-event MAE in some scopes, but often pay for it with worse margin MAE and Brier. `C=20 D=10` now narrowly promotes on broad replay, but only with `near_tie` confidence.
- Universal archetype claim: rejected. The archetype family is useful, but 2024-only, 2025-only, 2026-only, and broad 2024-2026 do not agree on one decisive strength.
- Universal replace-mode conformal claim: rejected. Bucket 0 favored conformal `Q=0.80`, but the later bucket sweep did not support replacing the base scaled point model.
- Widening conformal as point-model default: not promoted yet. Widening `Q=0.80` is the best uncertainty-layer candidate and won 2026 bucket 3 plus broad buckets 2-3 by fixed or relative scoring, but the base scaled model still wins most relative holdouts and broad bucket 4 wins clearly.
- Targeted conformal as point-model default: rejected for now. In the completed 10-run bucket sweep, event-phase `Q=0.80` and base scaled each won three relative buckets, all other wins were split across other scopes, fixed-score winners were also split, and the only clear promotion was the base scaled model on 2026 bucket 2. Targeted conformal remains useful for uncertainty reporting.
- Current role-aware Monte Carlo / direct role EPA: rejected for now. The 2026 and 2024-2026 exact manifests both promoted the scaled archetype default with `clear` confidence. Role Monte Carlo was closer than direct role subtraction, but still lost score MAE, margin MAE, Brier, and worst-event MAE.
- Role-scaled archetype injection: not promoted. It produced a tiny broad full-replay near-tie win for `R=0.15`, but 2026 full replay plus 2026 and broad bucket-0 confirmation still favor the base scaled point model. This remains a research clue, not a default.
- Season-scoped event-type residual as 2026 default: rejected for now. It narrowly won the 2026 full replay and broad full replay, but the 2026 bucket confirmation split across five different relative winners, with only buckets 1 and 3 favoring event-type residual and bucket 2 clearly favoring fixed `C=12 D=6`.
- Season-scoped event-type residual as broad point default: rejected for now. Direct broad comparison against residual-ridge promoted residual `RW=0.25 L=30 C=40`; event-type residual still has better worst-event behavior and the best fixed score at `T=0.05`, so it remains a robustness clue rather than the broad point default.
- Robust EPA update clipping: rejected for now. 2026 focused replay showed `U=120 R=160`, `U=100 R=140`, and `U=80 R=120` all worsened score MAE, margin MAE, Brier, and worst-event MAE compared with the defended scaled-archetype default.
- Component-prior score blending: not promoted. 2026 full replay and bucket 0 both kept the defended scaled-archetype model as the relative winner. Component priors improved fixed-score or worst-event diagnostics in places, but the tradeoff against margin/Brier is not strong enough.
- Residual-ridge correction: promoted as the strongest current point-prediction family, but not a final or universal default. Plain residual `RW=0.25 L=30 C=40` wins the full 2026 replay, 4 of 5 2026 relative holdouts, broad full replay, broad buckets 0 and 2, and the direct broad residual-vs-event-type manifest. Broad buckets 1 and 3 prefer stronger residual; broad bucket 4 prefers residual-plus-component; fixed-score winners remain split. This supports residual-ridge as the current point-model leader while showing the exact deployment rule is not settled.
- Relative EPA variants: tested earlier and did not improve the defended leaderboard.
- Monte Carlo-only variants: useful for uncertainty exploration, but did not beat the EPA-MC ensemble as a promoted point predictor.

## Next Defensible Iterations

These are the next model branches worth trying. They are not guaranteed improvements; each one should be promoted only if it improves the leaderboard without adding leakage or overfit risk.

1. Build a stability-aware deployment rule for residual-ridge: conservative `RW=0.25` for 2026/current point prediction, and a broad-family selector that does not blindly pick stronger or component variants from one bucket.
2. Optimize residual-ridge refit cadence, cached solves, or saved prediction reuse so broad sweeps do not require repeated long full replays.
3. Run direct residual-vs-event-type holdout manifests only after speedup, because the full broad direct comparison is already expensive.
4. Add plots for the residual-vs-event-type and high-score-tail tradeoffs: point error, worst-event behavior, fixed score, coverage, and calibration.
5. Run live FIRST Events metadata ingest when credentials are available, then regenerate metadata coverage and exact-manifest reports.
6. Seek source-level documentation or a historical snapshot endpoint for Statbotics prediction generation time. Unless that exists, keep published predictions as a comparator only.
7. Pull real Firebase scout rows or a real scout archive backup into the cache, run `npm run model:audit:local-backups` and `npm run model:audit:scout-coverage`, then rerun the same leaderboard with PPC/defense observations only if coverage is nonzero.
8. Rebuild role-aware Monte Carlo around better labels: real scout defense observations, separate opponent-suppression estimates, and explicit foul-risk penalties before trying to promote it again.
9. Build FIRST/TBA season-specific component adapters before promoting component/foul models.
10. Run checkpointed event-bucket confirmation for the two learned-tail variants, starting with broad bucket 2 because previous championship-tail ideas failed there.
11. Improve defense modeling by estimating opponent suppression and foul-risk separately, then simulate role assignments as net point swing.

## Commands Used For Latest Evidence

```sh
npm run model:typecheck
npm run test
npm run model:audit:local-backups -- --paths .playwright-cli
npm run model:train -- --year 2026 --model-filter "No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050,Robust-Update Scaled-Archetype" --output-dir modeling/artifacts/runs/robust-update-2026-scaled-archetype
npm run model:train -- --year 2026 --model-filter "No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050,Component-Prior Scaled-Archetype,No-Future Compact Ridge L2=10,No-Future Minimal Ridge L2=10,No-Future Ridge L2=15,No-Future Robust Ridge L2=10" --output-dir modeling/artifacts/runs/component-prior-2026-scaled-archetype
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-component-prior-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/component-prior-2026-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket0-component-prior-scaled-archetype --output-dir modeling/artifacts/reports/component-prior-2026-check
npm run model:train -- --year 2026 --model-filter "No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050,No-Future Residual-Ridge" --output-dir modeling/artifacts/runs/residual-ridge-2026-scaled-archetype
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-residual-ridge-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket0-residual-ridge-scaled-archetype --output-dir modeling/artifacts/reports/residual-ridge-2026-check
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket1-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket2-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket3-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket4-residual-ridge-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket0-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket1-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket2-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket3-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket4-residual-ridge-scaled-archetype --output-dir modeling/artifacts/reports/residual-ridge-2026-full-plus-buckets
npm run model:train -- --manifest modeling/experiments/current-2024-2026-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-residual-ridge-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket0-residual-ridge-scaled-archetype --output-dir modeling/artifacts/reports/residual-ridge-2024-2026-initial-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-residual-ridge-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket0-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket1-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket2-residual-ridge-scaled-archetype --output-dir modeling/artifacts/reports/residual-ridge-2024-2026-partial-buckets-0-2
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-residual-ridge-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-residual-ridge-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket0-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket1-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket2-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket3-residual-ridge-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket4-residual-ridge-scaled-archetype --output-dir modeling/artifacts/reports/residual-ridge-2024-2026-full-plus-buckets
npm run model:train -- --manifest modeling/experiments/current-2024-2026-residual-vs-event-type.json
npm run model:train -- --model-filter "Published Statbotics Match Prediction,No-Future Season-Reset EPA K=1.10,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.10 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.20 M=12" --output-dir modeling/artifacts/runs/statbotics-2024-2026-event-shift-gated
npm run model:train -- --year 2026 --model-filter "Published Statbotics Match Prediction,No-Future Season-Reset EPA K=1.10,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.10 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.20 M=12" --output-dir modeling/artifacts/runs/statbotics-2026-event-shift-gated
npm run model:train -- --year 2026 --model-filter "No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.05,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.10,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25 I=1.05,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-interval-event-shift
npm run model:train -- --year 2026 --model-filter "No-Future Event-Scale Ensemble,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-event-scale
npm run model:train -- --year 2026 --model-filter "A=0.05 N=24,A=0.10 N=24,A=0.20,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-event-scale-small
npm run model:train -- --year 2026 --model-filter "High-Event-Scale,A=0.05 N=24,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-high-event-scale
npm run model:train -- --year 2026 --model-filter "Archetype,High-Event-Scale A=0.15,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2026-archetype
npm run model:train -- --model-filter "Archetype,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2024-2026-archetype
npm run model:train -- --year 2024 --model-filter "Archetype,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2024-archetype-validation
npm run model:train -- --year 2025 --model-filter "Archetype,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25,No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8,No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00,No-Future Season-Reset EPA K=1.10,Published Statbotics Match Prediction" --output-dir modeling/artifacts/runs/statbotics-2025-archetype-validation
npm run model:train -- --manifest modeling/experiments/current-2026-archetype.json
npm run model:train -- --manifest modeling/experiments/current-2024-archetype-check.json
npm run model:train -- --manifest modeling/experiments/current-2025-archetype-check.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket1-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket2-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket3-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket4-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-widening-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket3-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket4-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-targeted-conformal-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/holdout-2026-bucket3-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket4-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket3-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket4-targeted-conformal-scaled-archetype --output-dir modeling/artifacts/reports/targeted-conformal-bucket-check
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket1-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket2-targeted-conformal-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-targeted-conformal-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/holdout-2026-bucket0-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket1-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket2-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket3-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket4-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket0-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket1-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket2-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket3-targeted-conformal-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket4-targeted-conformal-scaled-archetype --output-dir modeling/artifacts/reports/targeted-conformal-bucket-sweep
npm run model:train -- --manifest modeling/experiments/current-2026-role-monte-carlo.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-monte-carlo.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-monte-carlo,modeling/artifacts/runs/current-2024-2026-role-monte-carlo --output-dir modeling/artifacts/reports/role-monte-carlo-check
npm run model:train -- --manifest modeling/experiments/current-2026-role-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-role-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-role-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-scaled-archetype,modeling/artifacts/runs/current-2024-2026-role-scaled-archetype,modeling/artifacts/runs/holdout-2026-bucket0-role-scaled-archetype,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-scaled-archetype --output-dir modeling/artifacts/reports/role-scaled-archetype-sweep
npm run model:ingest:statbotics-events -- --start-year 2024 --end-year 2026
npm run model:train -- --manifest modeling/experiments/current-2026-scaled-archetype.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-scaled-archetype.json
npm run model:report -- --run-dirs modeling/artifacts/runs/manifest-current-2026-scaled-archetype,modeling/artifacts/runs/manifest-current-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/metadata-backed-archetype-check
npm run model:report -- --run-dirs modeling/artifacts/runs/manifest-current-2026-scaled-archetype,modeling/artifacts/runs/manifest-current-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/metadata-einstein-archetype-check
npm run model:audit:statbotics-predictions -- --output-dir modeling/artifacts/audits/statbotics-prediction-provenance
npm run model:import -- --file .playwright-cli/adminv2-full-local-backup-2026MNUM-2026-05-10T09-25-46-208Z.json
npm run model:audit:scout-coverage -- --output-dir modeling/artifacts/audits/scout-coverage
npm run model:audit:event-metadata -- --output-dir modeling/artifacts/audits/event-metadata-coverage
npm run model:train -- --manifest modeling/experiments/current-2026-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-event-type-residual.json
npm run model:report -- --run-dirs modeling/artifacts/runs/manifest-current-2026-event-type-residual,modeling/artifacts/runs/manifest-current-2024-2026-event-type-residual --output-dir modeling/artifacts/reports/event-type-residual-check
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket1-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket2-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket3-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket4-event-type-residual.json
npm run model:report -- --run-dirs modeling/artifacts/runs/holdout-2026-bucket0-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket1-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket2-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket3-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket4-event-type-residual --output-dir modeling/artifacts/reports/event-type-residual-2026-bucket-confirmation
npm run model:report -- --run-dirs modeling/artifacts/runs/manifest-current-2026-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket0-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket1-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket2-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket3-event-type-residual,modeling/artifacts/runs/holdout-2026-bucket4-event-type-residual --output-dir modeling/artifacts/reports/event-type-residual-2026-full-plus-buckets
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-event-type-residual.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-event-type-residual.json
npm run model:report -- --run-dirs modeling/artifacts/runs/holdout-2024-2026-bucket0-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket1-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket2-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket3-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket4-event-type-residual --output-dir modeling/artifacts/reports/event-type-residual-2024-2026-bucket-confirmation
npm run model:report -- --run-dirs modeling/artifacts/runs/manifest-current-2024-2026-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket0-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket1-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket2-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket3-event-type-residual,modeling/artifacts/runs/holdout-2024-2026-bucket4-event-type-residual --output-dir modeling/artifacts/reports/event-type-residual-2024-2026-full-plus-buckets
npm run model:train -- --manifest modeling/experiments/current-2026-residual-tree.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-residual-tree.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-residual-tree,modeling/artifacts/runs/current-2024-2026-residual-tree --output-dir modeling/artifacts/reports/residual-tree-check
npm run model:train -- --manifest modeling/experiments/current-2026-high-score-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-high-score-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-high-score-tail,modeling/artifacts/runs/current-2024-2026-high-score-tail --output-dir modeling/artifacts/reports/high-score-tail-check
# Generated modeling/artifacts/reports/high-score-tail-check/TAIL_DELTA_AUDIT.md from saved run.json artifacts using a local Node audit snippet.
npm run model:train -- --manifest modeling/experiments/current-2026-residual-gated-tail.json
npm run model:train -- --manifest modeling/experiments/current-2026-tail-amplitude.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-high-score-tail,modeling/artifacts/runs/current-2026-residual-gated-tail,modeling/artifacts/runs/current-2026-tail-amplitude --output-dir modeling/artifacts/reports/tail-selector-2026-check
npm run model:diagnose -- --run-dirs modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/current-best-residual-diagnostics
npm run model:train -- --manifest modeling/experiments/current-2026-championship-phase-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-championship-phase-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-championship-phase-tail,modeling/artifacts/runs/current-2024-2026-championship-phase-tail --output-dir modeling/artifacts/reports/championship-phase-tail-check
npm run model:train -- --manifest modeling/experiments/current-2026-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-championship-residual-boost-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-championship-residual-boost-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-championship-residual-boost-tail,modeling/artifacts/runs/current-2024-2026-championship-residual-boost-tail,modeling/artifacts/runs/holdout-2024-2026-bucket0-championship-residual-boost-tail,modeling/artifacts/runs/holdout-2024-2026-bucket1-championship-residual-boost-tail,modeling/artifacts/runs/holdout-2024-2026-bucket2-championship-residual-boost-tail,modeling/artifacts/runs/holdout-2024-2026-bucket3-championship-residual-boost-tail,modeling/artifacts/runs/holdout-2024-2026-bucket4-championship-residual-boost-tail --output-dir modeling/artifacts/reports/championship-residual-boost-tail-check
npm run model:train -- --manifest modeling/experiments/current-2026-gated-championship-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-gated-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-gated-championship-tail,modeling/artifacts/runs/current-2024-2026-gated-championship-tail --output-dir modeling/artifacts/reports/gated-championship-tail-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-win-calibrated-championship-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-win-calibrated-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-win-calibrated-championship-tail,modeling/artifacts/runs/current-2024-2026-win-calibrated-championship-tail --output-dir modeling/artifacts/reports/win-calibrated-championship-tail-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-learned-championship-tail.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-learned-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-learned-championship-tail,modeling/artifacts/runs/current-2024-2026-learned-championship-tail --output-dir modeling/artifacts/reports/learned-championship-tail-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-learned-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-learned-championship-tail,modeling/artifacts/runs/current-2024-2026-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket2-learned-championship-tail --output-dir modeling/artifacts/reports/learned-championship-tail-bucket2-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-learned-championship-tail.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-learned-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-learned-championship-tail,modeling/artifacts/runs/current-2024-2026-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket0-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket1-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket2-learned-championship-tail --output-dir modeling/artifacts/reports/learned-championship-tail-buckets012-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-conditional-learned-championship-tail.json
npm run model:train -- --manifest modeling/experiments/current-2026-conditional-learned-championship-tail.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-conditional-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket1-conditional-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket1-learned-championship-tail --output-dir modeling/artifacts/reports/conditional-learned-tail-check
npm run model:train -- --manifest modeling/experiments/current-2026-tail-risk-interval.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-tail-risk-interval.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-tail-risk-interval.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-tail-risk-interval.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-tail-risk-interval.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-tail-risk-interval.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket0-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket1-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket3-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket4-tail-risk-interval,modeling/artifacts/runs/current-2026-conditional-learned-championship-tail,modeling/artifacts/runs/holdout-2024-2026-bucket1-conditional-learned-championship-tail --output-dir modeling/artifacts/reports/tail-risk-interval-check
npm run model:train -- --manifest modeling/experiments/current-2026-tail-risk-winprob.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-winprob,modeling/artifacts/runs/current-2026-tail-risk-interval,modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-interval --output-dir modeling/artifacts/reports/tail-risk-winprob-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-conditional-tail-risk-winprob.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-conditional-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-conditional-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket2-conditional-tail-risk-winprob,modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-winprob --output-dir modeling/artifacts/reports/conditional-tail-risk-winprob-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-tail-risk-winprob.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-tail-risk-winprob.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-tail-risk-winprob.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket0-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket1-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket2-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket3-tail-risk-winprob,modeling/artifacts/runs/holdout-2024-2026-bucket4-tail-risk-winprob --output-dir modeling/artifacts/reports/tail-risk-winprob-full-bucket-confirmation
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-tail-risk-winprob.json
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-margin-confidence-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-margin-confidence-tail-risk-winprob,modeling/artifacts/runs/current-2026-tail-risk-winprob --output-dir modeling/artifacts/reports/margin-confidence-tail-risk-winprob-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-smooth-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob,modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/current-2026-margin-confidence-tail-risk-winprob --output-dir modeling/artifacts/reports/smooth-tail-risk-winprob-check
npm run model:train -- --manifest modeling/experiments/current-2024-2026-smooth-tail-risk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob,modeling/artifacts/runs/current-2024-2026-smooth-tail-risk-winprob,modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/current-2026-margin-confidence-tail-risk-winprob --output-dir modeling/artifacts/reports/smooth-tail-risk-winprob-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-learned-win-calibration.json
npm run model:train -- --manifest modeling/experiments/current-2026-learned-win-calibration-v2.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-learned-win-calibration,modeling/artifacts/runs/current-2026-learned-win-calibration-v2,modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob --output-dir modeling/artifacts/reports/learned-win-calibration-check
npm run model:train -- --manifest modeling/experiments/current-2024-2026-learned-win-calibration-v2.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-learned-win-calibration,modeling/artifacts/runs/current-2026-learned-win-calibration-v2,modeling/artifacts/runs/current-2024-2026-learned-win-calibration-v2,modeling/artifacts/runs/current-2026-tail-risk-winprob,modeling/artifacts/runs/current-2026-smooth-tail-risk-winprob,modeling/artifacts/runs/current-2024-2026-smooth-tail-risk-winprob --output-dir modeling/artifacts/reports/learned-win-calibration-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-v2-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge --output-dir modeling/artifacts/reports/role-v2-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket0-role-v2-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket0-role-v2-residual-ridge --output-dir modeling/artifacts/reports/role-v2-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket1-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket2-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket3-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2026-bucket4-role-v2-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket4-role-v2-residual-ridge --output-dir modeling/artifacts/reports/role-v2-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-role-v2-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket4-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge --output-dir modeling/artifacts/reports/role-v2-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-role-v2-residual-ridge.json
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-role-v2-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2026-bucket4-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v2-residual-ridge --output-dir modeling/artifacts/reports/role-v2-residual-ridge-check
npm run model:typecheck
npm run test
npm run model:train -- --manifest modeling/experiments/current-2026-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-initial-check
npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-role-v3-residual-ridge.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge,modeling/artifacts/runs/current-2026-role-v2-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v2-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v2-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-residual-ridge-check
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge,modeling/artifacts/runs/residual-ridge-2026-scaled-archetype,modeling/artifacts/runs/residual-ridge-2024-2026-scaled-archetype --output-dir modeling/artifacts/reports/role-v3-bucket-confirmation
npm run model:typecheck
npm run model:train -- --manifest modeling/experiments/current-2026-role-v3-tailrisk-winprob.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tailrisk-winprob,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailrisk-winprob-check
npm run model:typecheck
npm run model:train -- --manifest modeling/experiments/current-2026-role-v3-tail-guarded.json
npm run model:typecheck
npm run model:train -- --manifest modeling/experiments/current-2024-2026-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:typecheck
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket0-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket2-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket3-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-role-v3-tail-guarded.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2024-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/current-2024-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-tailguard-check
npm run model:typecheck
npm run model:train -- --manifest modeling/experiments/current-2026-role-v3-selective-tailguard.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-selective-tailguard,modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-selective-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket4-role-v3-selective-tailguard.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-selective-tailguard,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-selective-tailguard,modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-selective-tailguard-check
npm run model:train -- --manifest modeling/experiments/holdout-2024-2026-bucket1-role-v3-selective-tailguard.json
npm run model:report -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-selective-tailguard,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-selective-tailguard,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-selective-tailguard,modeling/artifacts/runs/current-2026-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tail-guarded,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tail-guarded,modeling/artifacts/runs/current-2026-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-residual-ridge,modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-residual-ridge --output-dir modeling/artifacts/reports/role-v3-selective-tailguard-check
```
