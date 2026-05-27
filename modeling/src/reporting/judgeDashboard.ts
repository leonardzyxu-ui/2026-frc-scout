import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MatchPrediction, ModelResult, ResearchRun, ScorePrediction } from '../types.ts';
import { readJsonFile, writeTextFile } from '../util.ts';

interface CrossRunRow {
  runName: string;
  isHoldout: boolean;
  evaluationMatches: number;
  relativeModel: string;
  relativeModelShort?: string;
  promotionConfidence: string;
  relativeBenchmark: number;
  fixedModel: string;
  fixedModelShort?: string;
  fixedBenchmark: number;
  scoreMae: number;
  marginMae: number;
  winBrier: number;
  calibrationError: number;
  scoreIntervalCoverage: number;
  scoreIntervalWidth: number;
  worstEventScoreMae: number;
}

interface DeploymentReviewRow {
  model: string;
  modelShort?: string;
  role: string;
  runs: number;
  evaluationMatches: number;
  relativeWins: number;
  fixedWins: number;
  nearTieRuns: number;
  weightedScoreMae: number;
  weightedMarginMae: number;
  weightedBrier: number;
  weightedCalibrationError: number;
  weightedCoverageMiss: number;
  maxWorstEventScoreMae: number;
  meanRank: number;
  pointDeploymentScore: number;
  pointInstabilityPenalty: number;
  robustnessScore: number;
}

interface StabilityReview {
  holdoutRuns: number;
  fullRuns: number;
  relativeLeader: string;
  relativeLeaderWins: number;
  fixedLeader: string;
  fixedLeaderWins: number;
  status: string;
  notes: string[];
}

interface CrossRunSummary {
  createdAt: string;
  rows: CrossRunRow[];
  relativeCounts: Record<string, number>;
  fixedCounts: Record<string, number>;
  confidenceCounts: Record<string, number>;
  stabilityReview: StabilityReview;
  deploymentReview: {
    rows: DeploymentReviewRow[];
  };
}

interface ModelJourneyRow {
  reportName: string;
  reportPath: string;
  runCount: number;
  holdoutRuns: number;
  evaluationMatches: number;
  status: string;
  relativeLeader: string;
  relativeLeaderWins: number;
  fixedLeader: string;
  fixedLeaderWins: number;
  bestDeploymentModel: string;
  pointDeploymentScore: number | null;
  weightedScoreMae: number | null;
  weightedMarginMae: number | null;
  weightedBrier: number | null;
  maxWorstEventScoreMae: number | null;
}

interface ModelLeaderboardRow {
  reportName: string;
  reportPath: string;
  status: string;
  model: string;
  role: string;
  runs: number;
  relativeWins: number;
  fixedWins: number;
  nearTieRuns: number;
  weightedScoreMae: number;
  weightedMarginMae: number;
  weightedBrier: number;
  maxWorstEventScoreMae: number;
  pointDeploymentScore: number;
  robustnessScore: number;
}

interface FinalistComparisonRow {
  label: string;
  row: DeploymentReviewRow | null;
  strength: string;
  caveat: string;
  decision: string;
}

interface PredictionCaseStudy {
  label: string;
  prediction: MatchPrediction;
  why: string;
}

const formatShanghaiTimestamp = (date: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} CST (Asia/Shanghai, UTC+08:00)`;
};

const generatedLocalTimestamp = (generatedAt: string) => {
  const generatedDate = new Date(generatedAt);
  return Number.isNaN(generatedDate.getTime()) ? 'unknown CST (Asia/Shanghai, UTC+08:00)' : formatShanghaiTimestamp(generatedDate);
};

const buildGeneratedStamp = (generatedAt: string) =>
  `Generated (UTC): ${generatedAt}
Generated (CST / Asia-Shanghai): ${generatedLocalTimestamp(generatedAt)}`;

const buildGeneratedInline = (generatedAt: string) =>
  `Generated (UTC): ${generatedAt}; Generated (CST / Asia-Shanghai): ${generatedLocalTimestamp(generatedAt)}`;

interface ResidualAggregate {
  key: string;
  predictionCount: number;
  matchCount: number;
  signedResidual: number;
  scoreMae: number;
  scoreRmse: number;
  actualMean: number;
  expectedMean: number;
  coverage: number;
  intervalWidth: number;
}

interface CalibrationBucket {
  bucket: string;
  matches: number;
  predictedWinRate: number;
  actualWinRate: number;
  brier: number;
}

interface ResidualDiagnosticsEntry {
  runName: string;
  model: string;
  modelShort?: string;
  scoreMae: number;
  marginMae: number;
  winBrier: number;
  worstEventScoreMae: number;
  eventResiduals: ResidualAggregate[];
  overallPhaseResiduals: ResidualAggregate[];
  championshipPhaseResiduals: ResidualAggregate[];
  calibrationBuckets: CalibrationBucket[];
}

interface ResidualDiagnosticsReport {
  createdAt: string;
  sources: string[];
  diagnostics: ResidualDiagnosticsEntry[];
}

interface FailureModeAtlas {
  sourcePath: string;
  createdAt: string;
  current2026?: ResidualDiagnosticsEntry;
  broad?: ResidualDiagnosticsEntry;
  diagnostics: ResidualDiagnosticsEntry[];
}

interface ArtifactInput {
  label: string;
  filePath: string;
}

interface ArtifactFingerprint {
  label: string;
  path: string;
  bytes: number;
  sha256: string;
}

export interface JudgeDashboardOptions {
  summaryDir?: string;
  bestRunDir?: string;
  outputDir?: string;
  researchLogPath?: string;
  reportsRoot?: string;
  residualDiagnosticsPath?: string;
}

const DEFAULT_SUMMARY_DIR = 'modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check';
const DEFAULT_BEST_RUN_DIR = 'modeling/artifacts/runs/current-2024-2026-role-v3-tailguard-micro-sensitivity';
const DEFAULT_OUTPUT_DIR = 'modeling/artifacts/reports/final-judge-dashboard';
const DEFAULT_RESEARCH_LOG_PATH = 'modeling/MODELING_RESEARCH_LOG.md';
const DEFAULT_REPORTS_ROOT = 'modeling/artifacts/reports';
const DEFAULT_RESIDUAL_DIAGNOSTICS_PATH =
  'modeling/artifacts/reports/current-tailguard-residual-diagnostics/residual-diagnostics.json';

const formatNumber = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : 'n/a');
const formatPercent = (value: number, digits = 1) => (Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : 'n/a');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const shortModelName = (name: string) => {
  if (name.includes('SelectiveTailGuarded')) return 'SelectiveTailGuard Strong RoleV3';
  if (name.includes('TailGuard+SmoothTailRiskWinProb')) return 'TailGuard+SmoothTailRiskWinProb RoleV3';
  if (name.includes('TailGuard+TailRiskWinProb')) return 'TailGuard+TailRiskWinProb RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.22')) return 'Conservative TailGuard Strong RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.23')) return 'TW=0.23 TailGuard Strong RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.20')) return 'TW=0.20 TailGuard Strong RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.21')) return 'TW=0.21 TailGuard Strong RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.25')) return 'TW=0.25 TailGuard Strong RoleV3';
  if (name.includes('TailGuarded') && name.includes('TW=0.35')) return 'Stronger TailGuard Strong RoleV3';
  if (name.includes('Strong RoleV3')) return 'Strong RoleV3';
  if (name.includes('Strong RoleV2')) return 'Strong RoleV2';
  if (name.includes('RoleV3')) return 'Moderate RoleV3';
  if (name.includes('Role-Feature Residual Ridge')) return 'Role-Feature Residual Ridge';
  if (name.includes('Residual Ridge RW=0.25 L=30')) return 'Conservative Residual Ridge';
  if (name.includes('Residual Ridge RW=0.40')) return 'Stronger Residual Ridge';
  return name.replace('No-Future ', '').replace(' Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050', '');
};

const modelFamilyLabel = (name: string) => {
  if (name.includes('SelectiveTailGuarded')) return 'Rejected gated tail correction';
  if (name.includes('TailGuard+SmoothTailRiskWinProb')) return 'Smoothed probability challenger';
  if (name.includes('TailGuard+TailRiskWinProb')) return 'Probability diagnostic';
  if (name.includes('TailGuarded') && name.includes('TW=0.22')) return 'Current point candidate';
  if (name.includes('TailGuarded') && name.includes('TW=0.20')) return 'Fixed-score diagnostic';
  if (name.includes('TailGuarded') && name.includes('TW=0.25')) return 'Holdout-rank challenger';
  if (name.includes('TailGuarded') && name.includes('TW=0.35')) return 'High-tail specialist';
  if (name.includes('Strong RoleV3')) return 'Simple point baseline';
  if (name.includes('Strong RoleV2')) return 'Defense/tail comparator';
  if (name.includes('RoleV3')) return 'Conservative role alternate';
  return 'Comparator';
};

const tableCell = (value: string | number) => `<td>${escapeHtml(String(value))}</td>`;

const deadlineDeliverableRows = [
  [
    'Best model code',
    'Ready',
    'modeling/src/modeling/train.ts, modeling/src/modeling/features.ts, modeling/src/modeling/diagnostics.ts, modeling/src/reporting/report.ts, MODEL_SOURCE_MAP.md, and modeling/src/cli.ts',
    'The model stays local; it is intentionally not bundled into the scouting website.'
  ],
  [
    'Best model visualization',
    'Ready in HTML',
    'index.html Model Anatomy, Defense Role Guide, Prediction Behavior, Leaderboard, Source Code Evidence Lock, and Integrity Fingerprints sections',
    'The visuals explain the selected model and its uncertainty; they do not claim the model is perfect.'
  ],
  [
    'Other models and scores',
    'Ready in HTML and Markdown',
    'MODEL_LEADERBOARD_APPENDIX.md, FINALIST_COMPARISON.md, Research Atlas, Model Scores',
    'Report families are not identical experiments, so the appendix is an audit map rather than one universal leaderboard.'
  ],
  [
    'Documentation',
    'Ready',
    'MODELING_RESEARCH_LOG.md, FINAL_MODEL_CARD.md, METHODOLOGY_APPENDIX.md, CLAIM_BOUNDARIES.md, LEAKAGE_AUDIT.md, JUDGE_RUBRIC_ALIGNMENT.md, REPRODUCIBILITY_RUNBOOK.md',
    'The long research log preserves detail; the dashboard and handout keep the judge-facing route shorter.'
  ],
  [
    'Journey story',
    'Ready in HTML and Markdown',
    'ONE_PAGE_JUDGE_STORY.html, ONE_PAGE_JUDGE_STORY.md, START_HERE_STORY.html, START_HERE_STORY.md, MODEL_JOURNEY_TIMELINE.md, PRESENTATION_SCRIPT.md, JUDGE_WALKTHROUGH.md, LIVE_DEMO_RUNBOOK.md',
    'The story includes rejected branches so it does not sound like a straight-line success myth.'
  ],
  [
    'Accuracy and stats visuals',
    'Ready in HTML',
    'Leaderboard, Prediction Behavior, Holdout Evidence, Diagnostics, and generated SVG charts',
    'The headline metrics are paired with caveats, holdouts, and overfit penalties.'
  ],
  [
    'HTML report',
    'Ready',
    'modeling/artifacts/reports/final-judge-dashboard/index.html',
    'Verified locally with desktop and mobile screenshots after each report edit.'
  ],
  [
    'Surprising judge points',
    'Ready in HTML',
    'What Should Surprise Judges, CLAIM_BOUNDARIES.md, JUDGE_QA.md, OPR_EPA_EXPLAINER.md',
    'The strongest surprise is methodological: several smarter-looking ideas were rejected.'
  ],
  [
    'Final integrity check',
    'Ready',
    'VERIFICATION_SUMMARY.md, ARTIFACT_FINGERPRINTS.md, artifact-fingerprints.json, JUDGE_DRY_RUN_SCORECARD.md, MOCK_JUDGE_PANEL_BRIEF.md',
    'The verifier proves package consistency and file identity; the dry-run and mock panel prove the presenter can defend the bounded claim.'
  ]
];

const buildDeadlineDeliverablesTable = () => deadlineDeliverableRows.map(row => `<tr>${row.map(tableCell).join('')}</tr>`).join('');

const starredHtmlCoverageCards: Array<[string, string]> = [
  [
    'Best model visualization in HTML',
    'Current Verdict, Model Anatomy, Defense Role Guide, Prediction Behavior, Source Code Evidence Lock, and Integrity Fingerprints explain what the promoted model does before a match.'
  ],
  [
    'Other models and scores visualized',
    'Model Scores, Model Leaderboard Appendix, Finalist Comparison, and the Research Atlas show the alternatives, rejected branches, and score evidence.'
  ],
  [
    'Refined journey story in HTML',
    'Start Here, Judge Story Spine, Model Journey Timeline, Presentation Script, and What We Tried sections explain how the winning model developed.'
  ],
  [
    'Accuracy and stats visualization',
    'The hero metrics, leaderboard tables, holdout evidence, prediction behavior, diagnostics, and generated charts keep accuracy evidence visible.'
  ],
  [
    'Document-style HTML report',
    'The dashboard is the document-like report: print-ready CSS, Quick Jump, Final Package Map, and Final Gate Proof all live in the HTML.'
  ],
  [
    'Judge notes and surprises',
    'What Should Surprise Judges, Hard Questions Judges May Ask, Evidence Matrix, and Claim Boundaries collect the points teachers or judges should know.'
  ]
];

const buildStarredHtmlCoverageCards = () =>
  starredHtmlCoverageCards.map(([title, body]) => `<div class="card"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>`).join('');

const buildDeadlineDeliverablesMarkdown = (generatedAt: string) => `# Deadline Deliverables Checklist

This checklist maps the requested Saturday May 23 2026 18:00 CST final deliverables to the exact local files and dashboard sections that satisfy them.

| Requested deliverable | Status | Where to open | Caveat |
| --- | --- | --- | --- |
${deadlineDeliverableRows.map(row => `| ${row.join(' | ')} |`).join('\n')}

## Fast Submission Order

1. Open \`ONE_PAGE_JUDGE_STORY.html\` for the one-page adventure.
2. Open \`START_HERE_STORY.html\` if the judge wants a richer walk-through before the proof wall.
3. Open \`index.html#start-here-story\` for the full visual dashboard route.
4. Open \`OPEN_THIS_FIRST.md\` if a judge or teacher wants the shortest route through the folder.
5. Open \`DEADLINE_DELIVERABLES_CHECKLIST.md\` to prove every requested deliverable has a local artifact.
6. Open \`VERIFICATION_SUMMARY.md\`, \`ARTIFACT_FINGERPRINTS.md\`, and the refreshed screenshots to prove the package was checked after the latest edit.

## Best One-Sentence Read

The final package is ready to present as a disciplined modeling journey: the current best model is Conservative TailGuard Strong RoleV3, the alternative models and rejected branches are visible, and the package is verified by tests, browser screenshot freshness checks, manifest path checks, and source/text artifact fingerprints.

${buildGeneratedStamp(generatedAt)}
`;

const buildOnePageJudgeStoryMarkdown = (generatedAt: string) => `# One-Page Judge Story

Use this when the reader has almost no time. It is the project adventure, the model intuition, the final decision, and the proof route on one page.

Delivery target: Saturday May 23 2026 18:00 CST.

Stop rule: if the judge has only one minute, this page is enough; the links are backup proof, not required reading.

## 30-Second Script

We built a no-future pre-match model, tested many tempting improvements, and kept the one that stayed trustworthy after holdouts and calibration checks. The winner is Conservative TailGuard Strong RoleV3: useful for expected score, win chance, uncertainty, and role risk, but still a human strategy aid, not an oracle.

## Three Takeaways

- Winner: Conservative TailGuard Strong RoleV3.
- Reason it won: it stayed strongest after no-future replay, holdout pressure, calibration checks, and TailGuard sanity sweeps.
- Safe use: treat it as a pre-match score, win-chance, uncertainty, and role-risk briefing, not an automatic decision-maker.

## The Adventure In One Page

We started with the simplest honest model because it set the standard: if a fancy model cannot beat a memory of how teams usually score, it has not earned trust.

That first model was useful but too blunt. It remembered team strength, but it could not explain uncertainty, event conditions, role tradeoffs, or defense. So we changed the rule of the whole project: every model had to replay history one match at a time, using only what would have existed before that match.

Once the validation became realistic, the model needed to sound like a scouting briefing instead of a fortune-telling number. We added score ranges, win probabilities, and calibration checks. Then RoleV3 split defense into real tradeoffs: opponent suppression, lost offense, foul exposure, confidence, and net swing.

The last hard problem was the tail. Some fast, high-scoring events could create ugly misses, so TailGuard became a cautious correction. SelectiveTailGuard sounded smarter, but it failed broad confirmation. The final micro-sensitivity pass promoted Conservative TailGuard Strong RoleV3 at TW=0.22, and the last TW=0.21/TW=0.23 decimal sanity sweep did not dislodge it.

## Judge Decision Trail

| Turn | Because | What it revealed | Next move |
| --- | --- | --- | --- |
| Baseline | A simple memory of how teams usually score is the honest starting line. | It remembered strength, but missed uncertainty, event context, and defense tradeoffs. | Next move: no-future replay. |
| No-future replay | The model had to prove it could predict before each match, not explain after it. | Accuracy alone was not enough for strategy. | Next move: score ranges and probability calibration. |
| RoleV3 | Defense needed to become suppression, own scoring cost, foul risk, confidence, and net swing. | Role clues were useful, but hard high-score matches still created dangerous misses. | Next move: TailGuard. |
| TailGuard | Risky match environments needed caution instead of overconfidence. | SelectiveTailGuard sounded clever but failed broad confirmation; TW=0.22 survived the final neighborhood sweep. | Next move: promote Conservative TailGuard Strong RoleV3. |

## Model In One Sentence

It remembers team strength, separates role and defense effects, predicts score ranges instead of only winners, and stays cautious when a match looks unusually risky.

## Final Numbers

- Weighted score MAE: 36.32
- Weighted margin MAE: 49.73
- Weighted Brier: 0.1648
- Deployment score: 0.126

## Plain-English Number Key

- Score MAE: the typical alliance-score miss; lower is better.
- Margin MAE: the typical miss on the red-blue gap; lower is better.
- Brier: whether win probabilities behave honestly over many matches; lower is better.
- Deployment score: our stability-adjusted selection score; lower is better.

## Why This Is Credible

- No-future replay blocks hindsight.
- Holdouts punish ideas that only work on the slice where they were invented.
- Calibration checks whether probabilities are honest.
- Tail-risk checks hard matches instead of hiding behind averages.
- Rejected branches are documented instead of quietly erased.

## Why The Extra Time Mattered

- The TW=0.21/TW=0.23 sanity checks tried to dislodge TW=0.22 and failed.
- The failure-mode atlas was refreshed from the current TW=0.22 diagnostics, not the older TW=0.20 run.
- Historical leaderboard rows now say report-local, so older defaults cannot impersonate the final claim.

## What To Say Out Loud

"This is the best defended local pre-match strategy model we found, not an oracle. It helps scouts and drive teams reason about expected scores, win chance, uncertainty, and role/defense risk, while leaving final judgment to humans."

## Proof Route

1. Open \`START_HERE_STORY.html\` for the richer adventure.
2. Open \`index.html#start-here-story\` for the visual dashboard proof.
3. Open \`FINALIST_COMPARISON.md\` for why this model beat the closest alternatives.
4. Open \`LEAKAGE_AUDIT.md\` before making any accuracy claim.
5. Open \`FINAL_CHECK_SUMMARY.md\` for tests, browser QA, screenshots, and verifier proof.

${buildGeneratedStamp(generatedAt)}
`;

const buildOnePageJudgeStoryHtml = (generatedAt: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>One-Page Judge Story</title>
  <link rel="icon" href="data:," />
  <style>
    :root { color-scheme: light; --ink: #111827; --muted: #4b5563; --line: #d5dde8; --paper: #ffffff; --bg: #f6f8fb; --teal: #0f766e; --blue: #1d4ed8; --gold: #b45309; --green: #15803d; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: linear-gradient(135deg, #f7fbff 0%, #fff8ee 48%, #f2fbf6 100%); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
    .sheet { background: var(--paper); border: 1px solid rgba(17, 24, 39, 0.12); border-radius: 8px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); overflow: hidden; }
    header { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr); gap: 28px; padding: clamp(28px, 5vw, 54px); border-bottom: 1px solid var(--line); }
    .kicker { color: var(--teal); font-size: 0.78rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    h1 { margin: 8px 0 14px; font-size: clamp(2rem, 5vw, 4.6rem); line-height: 0.95; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 1.08rem; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    .lead { max-width: 700px; font-size: 1.06rem; color: #1f2937; }
    .claim { display: grid; gap: 12px; align-content: start; }
    .claim-box { border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: #f8fafc; }
    .claim-box strong { display: block; margin-bottom: 6px; font-size: 1rem; }
    .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; min-height: 86px; }
    .metric span { display: block; color: var(--muted); font-size: 0.78rem; font-weight: 700; }
    .metric strong { display: block; margin-top: 5px; font-size: 1.35rem; }
    .content { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(300px, 0.88fr); gap: 24px; padding: clamp(24px, 4vw, 42px); }
    .story { display: grid; gap: 14px; }
    .story p { color: #243143; }
    .timeline { display: grid; gap: 10px; counter-reset: step; }
    .step { position: relative; border: 1px solid var(--line); border-radius: 8px; padding: 12px 12px 12px 48px; background: #fff; min-height: 82px; }
    .step::before { counter-increment: step; content: counter(step); position: absolute; left: 12px; top: 13px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #dbeafe; color: #1d4ed8; font-weight: 800; font-size: 0.82rem; }
    .step strong { display: block; margin-bottom: 4px; }
    .proof { display: grid; gap: 12px; }
    .proof-card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fbfcfe; }
    .proof-card strong { display: block; margin-bottom: 5px; }
    .proof-card p { font-size: 0.94rem; }
    .links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
    a { color: var(--blue); }
    .proof-link { display: block; border: 1px solid #bfd1f9; border-radius: 8px; padding: 12px; text-decoration: none; background: #eff6ff; color: #172554; font-weight: 800; min-height: 68px; }
    .say { border-left: 4px solid var(--green); padding: 14px 16px; background: #f0fdf4; border-radius: 0 8px 8px 0; color: #14532d; }
    .avoid { border-left: 4px solid var(--gold); padding: 14px 16px; background: #fff7ed; border-radius: 0 8px 8px 0; color: #7c2d12; }
    footer { padding: 18px clamp(24px, 4vw, 42px); color: var(--muted); border-top: 1px solid var(--line); font-size: 0.84rem; }
    @media (max-width: 860px) { header, .content { grid-template-columns: 1fr; } h1 { font-size: 2.55rem; } .metrics, .links { grid-template-columns: 1fr; } main { width: min(100% - 20px, 1120px); } }
    @media print { @page { margin: 12mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: #fff; } main { width: auto; padding: 0; } .sheet { box-shadow: none; } header, .content { padding: 12mm; gap: 8mm; } .metric, .step, .proof-card, .proof-link { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <article class="sheet">
      <header>
        <div>
          <div class="kicker">Fastest human route</div>
          <h1>One-page model adventure</h1>
          <p class="lead">We started with simple team-strength memory, forced every idea through no-future replay, added uncertainty and role-aware defense, rejected fragile cleverness, and promoted the cautious model that survived the final TailGuard checks.</p>
        </div>
        <div class="claim">
          <div class="claim-box">
            <strong>Model in one sentence</strong>
            <p>It remembers team strength, separates role and defense effects, predicts score ranges instead of only winners, and stays cautious when a match looks unusually risky.</p>
          </div>
          <div class="claim-box">
            <strong>Stop rule</strong>
            <p>If the judge has only one minute, this page is enough; the proof links are backup evidence, not required reading.</p>
          </div>
          <div class="claim-box">
            <strong>Three takeaways</strong>
            <p>Winner: Conservative TailGuard Strong RoleV3. Reason: it stayed strongest after no-future replay, holdouts, calibration, and TailGuard sanity sweeps. Use: a pre-match score, win-chance, uncertainty, and role-risk briefing, not an automatic decision-maker.</p>
          </div>
          <div class="metrics">
            <div class="metric"><span>Best model</span><strong>Conservative TailGuard Strong RoleV3</strong></div>
            <div class="metric"><span>Score MAE</span><strong>36.32</strong></div>
            <div class="metric"><span>Margin MAE</span><strong>49.73</strong></div>
            <div class="metric"><span>Deployment score</span><strong>0.126</strong></div>
          </div>
          <div class="claim-box">
            <strong>Plain-English number key</strong>
            <p>Score MAE is the typical alliance-score miss; margin MAE is the red-blue gap miss; Brier checks win-probability honesty; deployment score is our stability-adjusted selection score. Lower is better for all four.</p>
          </div>
        </div>
      </header>
      <div class="content">
        <section class="story">
          <h2>The adventure, without the proof wall</h2>
          <div class="say"><strong>30-second script:</strong> We built a no-future pre-match model, tested many tempting improvements, and kept the one that stayed trustworthy after holdouts and calibration checks. The winner is Conservative TailGuard Strong RoleV3: useful for expected score, win chance, uncertainty, and role risk, but still a human strategy aid, not an oracle.</div>
          <p>We began with the simplest honest idea: teams usually carry scoring memory from match to match. That baseline mattered because every fancier model had to beat it before earning attention.</p>
          <p>The baseline was useful but too blunt. It remembered strength, but it could not explain uncertainty, event conditions, role tradeoffs, or defense. So every candidate had to replay history one match at a time, using only evidence that existed before each match.</p>
          <p>Once validation became realistic, the model had to behave like a scouting briefing. We added score ranges, win probabilities, and calibration checks, then built RoleV3 to split defense into suppression, lost offense, foul exposure, confidence, and net swing.</p>
          <p>The last hard problem was tail risk. TailGuard kept the model cautious on fast, high-scoring environments. SelectiveTailGuard sounded smarter but failed broad confirmation, and the TW=0.21/TW=0.23 sanity sweep still left TW=0.22 on top. The final TailGuard model won because it was the best defended balance, not the fanciest idea.</p>
          <h2>Judge Decision Trail</h2>
          <div class="timeline" aria-label="Judge decision trail">
            <div class="step"><strong>Baseline because</strong><p>Simple team-strength memory was the honest starting line. It revealed missing uncertainty, context, and defense tradeoffs. Next move: no-future replay.</p></div>
            <div class="step"><strong>No-future replay because</strong><p>The model had to predict before each match, not explain after it. It revealed that strategy needed ranges and calibrated probabilities.</p></div>
            <div class="step"><strong>RoleV3 because</strong><p>Defense needed separate pieces: suppression, own scoring cost, foul risk, confidence, and net swing. It revealed the remaining hard-match tail problem.</p></div>
            <div class="step"><strong>TailGuard because</strong><p>Risky environments needed caution instead of overconfidence. SelectiveTailGuard failed broad confirmation, so the final move was to promote Conservative TailGuard Strong RoleV3.</p></div>
          </div>
          <div class="say"><strong>Say this:</strong> best defended local pre-match strategy model, not an oracle.</div>
          <div class="avoid"><strong>Avoid this:</strong> exact-score certainty, live scouting-app deployment claims, or pretending humans are no longer needed.</div>
        </section>
        <aside class="proof">
          <h2>Five proof beats</h2>
          <div class="timeline">
            <div class="step"><strong>Baseline</strong><p>Simple team-strength memory set the honest starting line.</p></div>
            <div class="step"><strong>No-future replay</strong><p>Predictions were made before each historical match result existed.</p></div>
            <div class="step"><strong>Strategy outputs</strong><p>Scores, ranges, probabilities, and role clues replaced a single winner label.</p></div>
            <div class="step"><strong>RoleV3 and TailGuard</strong><p>Defense became tradeoffs, and risky high-tail matches received caution.</p></div>
            <div class="step"><strong>Final discipline</strong><p>Fragile cleverness was rejected; TW=0.22 won the stability-adjusted rule.</p></div>
          </div>
          <div class="proof-card"><strong>Credibility chain</strong><p>No-future replay blocks hindsight; holdouts punish memorization; calibration checks probability honesty; tail-risk review checks hard matches; rejected branches stay documented.</p></div>
          <div class="proof-card"><strong>Why the extra time mattered</strong><p>It tried to dislodge TW=0.22 with TW=0.21/TW=0.23, refreshed failure-mode diagnostics to TW=0.22, and labeled report-local leaderboard history so older defaults cannot impersonate the final claim.</p></div>
          <div class="links">
            <a class="proof-link" href="START_HERE_STORY.html">Richer story</a>
            <a class="proof-link" href="index.html#start-here-story">Dashboard proof</a>
            <a class="proof-link" href="FINALIST_COMPARISON.md">Why this model won</a>
            <a class="proof-link" href="FINAL_CHECK_SUMMARY.md">Final gate proof</a>
          </div>
        </aside>
      </div>
      <footer>${buildGeneratedInline(generatedAt)}. Delivery target: Saturday May 23 2026 18:00 CST.</footer>
    </article>
  </main>
</body>
</html>`;

const buildStartHereStoryMarkdown = (generatedAt: string) => `# Start Here: The Model Adventure

Use this before the full dashboard. The dashboard is the proof vault; this file is the fast human story.

Delivery target: Saturday May 23 2026 18:00 CST.

## If You Only Read One Screen

We began with the simplest honest idea: teams usually carry some scoring memory from match to match. That baseline was a good starting point because any fancier model had to beat it before earning attention.

Then the baseline hit its limit. It could remember strength, but it could not explain uncertainty, event conditions, role tradeoffs, or defense. So we forced every idea through no-future replay, added score ranges and probability checks, then built RoleV3 to separate normal team strength from defense suppression, offensive cost, foul risk, and net swing.

The last hard problem was the dangerous tail: fast, high-scoring events where a single confident miss could hurt a drive-team briefing. TailGuard became the cautious correction. We tried smaller weights, a smarter-sounding SelectiveTailGuard branch, and then a micro-sensitivity pass around the final TailGuard weight. The final answer is Conservative TailGuard Strong RoleV3 with TW=0.22 because it survived the adventure, not because it had the fanciest name.

- Starting point: simple team-strength memory.
- Breakthrough: no-future replay plus score distributions and role-aware defense.
- Rejected temptation: SelectiveTailGuard and under-tuned TailGuard weights did not beat the defended balance.
- Final claim: best defended local pre-match strategy model, not an oracle.

## If You Remember Nothing Else

- The question: Can match history and scouting context give a drive team a useful pre-match warning?
- The answer: Yes, cautiously; the model estimates score, win chance, uncertainty, and role risk before the match.
- The proof idea: Every serious candidate was replayed as if standing before each match, then checked by browser QA, screenshots, tests, and verifier rules.
- The boundary: This is a disciplined starting point for strategy, not a replacement for scouts, repairs, drivers, or human judgment.

## Fast Reading Route

1. Answer: read the thirty-second answer and Busy Judge Card.
2. Loop: Read One Match Loop to understand how the model avoids hindsight.
3. Trust: Read Trust Ladder and Final Selection Filter.
4. Use: Read What A Drive Team Gets and When To Trust It.
5. Proof: Read Proof Receipt when a judge asks where the evidence lives.

Stop after Proof Receipt if time is brutal; everything below is backup proof and script material.

## What To Ignore Under Time Pressure

- Older 41.x score-MAE rows are audit history, not the current promoted 36.32 claim.
- Report-local point-default labels are historical report roles, not the final model choice.
- SelectiveTailGuard is rejected; it sounded clever but failed broad confirmation.
- ScoutGate and RoleGate are useful audit branches, not the final point model.
- Do not start with the full leaderboard unless a judge asks; start with the story, proof receipt, and final check.

## Thirty-Second Answer

We built a pre-match scouting model, not an oracle. It replays history one match at a time, only using information that would have existed before each match, then asks which model would be trustworthy enough to brief a drive team.

The winner is Conservative TailGuard Strong RoleV3 because it best balanced accuracy, uncertainty, role/defense reasoning, and caution on hard high-tail events. The important twist is that several smarter-sounding ideas were tested and rejected; the final model won by surviving realistic validation, not by sounding fancy.

## Busy Judge Card

- Model: Conservative TailGuard Strong RoleV3.
- Model in one sentence: it remembers team strength, separates role and defense effects, predicts score ranges, and stays cautious when matches look unusually risky.
- Why believe it: every finalist was judged through no-future replay, holdouts, calibration, tail-risk checks, and overfit penalties.
- Honest caveat: this supports pre-match strategy; it does not replace scouts, drive-team judgment, or live robot condition checks.

## So What For Strategy?

The model turns a pile of match history into a pre-match briefing, not a command. It is useful because it gives the human strategy group a better first question.

- Before a match: use expected score, win chance, uncertainty, and role clues to know what kind of match you are probably entering.
- During strategy talk: compare risk, not just average score; a near-tie with wide uncertainty needs a different plan than a clear favorite.
- For scouting focus: ask humans to verify the specific thing the model is unsure about, such as robot condition, defense tradeoff, or role fit.
- After a miss: use the miss as feedback for model improvement instead of pretending the prediction was always right.
- Human final call: scouts, drive team, and alliance strategy still own the decision.

## Judge Answer Finder

Use this when someone asks where exactly to look for one claim.

| Question | Open | Answer |
| --- | --- | --- |
| What won? | \`FINAL_MODEL_CARD.md\` | Conservative TailGuard Strong RoleV3, with the current 36.32 / 49.73 / 0.1648 / 0.126 metrics. |
| Why trust the validation? | \`LEAKAGE_AUDIT.md\`; \`FINAL_CHECK_SUMMARY.md\` | No-future replay plus a clean final gate. |
| Why this model over alternatives? | \`FINALIST_COMPARISON.md\`; \`MODEL_LEADERBOARD_APPENDIX.md\` | Shows closest contenders, rejected branches, and current-vs-historical labels. |
| How does this help strategy? | \`STRATEGY_EXAMPLE.md\`; \`DEFENSE_ROLE_GUIDE.md\` | Expected score, win chance, uncertainty, and role/defense clues before the match. |
| What should we not claim? | \`CLAIM_BOUNDARIES.md\`; \`LIMITATIONS_AND_RISK_REGISTER.md\` | Best defended local model, not oracle, not deployed, not replacement for scouts. |
| Is the package verified? | \`VERIFICATION_SUMMARY.md\`; \`browser-qa-summary.json\` | Required text, manifests, fingerprints, screenshots, and freshness checks passed. |

## Model Family Cheat Sheet

Use this to translate the model names before opening the full leaderboard.

| Family | Plain-English meaning | Final status |
| --- | --- | --- |
| Baseline | Remembers how teams usually score and sets the honest starting line. | Useful sanity check, not enough for strategy. |
| Residual correction | Learns from past misses only after those matches happen. | Helpful ingredient, but not the whole answer. |
| RoleV3 | Separates defense into suppression, scoring cost, foul risk, and net swing. | Core part of the promoted model. |
| TailGuard | Adds caution when a match environment looks unusually risky or high-scoring. | Promoted with TW=0.22. |
| SelectiveTailGuard | Tried to apply caution only in selected risky places. | Rejected because broad confirmation failed. |
| ScoutGate and RoleGate | Audit branches that test scout/role signal usefulness. | Useful evidence, not the final point model. |

## Judge Decision Trail

| Turn | Because | What it revealed | Next move |
| --- | --- | --- | --- |
| Baseline | A simple memory of how teams usually score is the honest starting line. | It remembered strength, but missed uncertainty, event context, and defense tradeoffs. | Next move: no-future replay. |
| No-future replay | The model had to prove it could predict before each match, not explain after it. | Accuracy alone was not enough for strategy. | Next move: score ranges and probability calibration. |
| RoleV3 | Defense needed to become suppression, own scoring cost, foul risk, confidence, and net swing. | Role clues were useful, but hard high-score matches still created dangerous misses. | Next move: TailGuard. |
| TailGuard | Risky match environments needed caution instead of overconfidence. | SelectiveTailGuard sounded clever but failed broad confirmation; TW=0.22 survived the final neighborhood sweep. | Next move: promote Conservative TailGuard Strong RoleV3. |

## Adventure Map

1. Baseline: remember how teams usually score.
2. No-future replay: make every prediction before seeing that match.
3. Distributions: show score ranges and confidence, not only winners.
4. RoleV3: separate team strength from defense suppression, cost, fouls, and net swing.
5. TailGuard: stay cautious when the match environment looks unusually risky.
6. Final model: reject clever branches that fail confirmation and keep the most defensible balance.

## Plain-English Decoder

- No-future replay: replaying old matches as if we were standing before each match, without using that match's result.
- MAE: average absolute miss. If a model predicts 100 and the real score is 110, that match misses by 10; lower is better.
- Margin MAE: the same miss idea, but for the red-blue score gap, which is harder than one alliance score.
- RoleV3: the model's way to separate normal scoring strength from defense effects, role costs, foul risk, and net swing.
- TailGuard: a caution layer for unusually risky high-score environments.
- Holdout: a validation slice away from the easiest full replay, used to punish memorization.
- Brier: a score for whether win probabilities are honest; if the model says 70% often, those teams should win about 70% of the time.
- Calibration: the same honesty idea for probabilities and intervals; it checks confidence, not just winners.
- Residual correction: learning from past prediction misses after they happen, then using that lesson only for future matches.
- TW=0.22: the TailGuard strength knob; it says the caution layer is present but deliberately conservative.
- Deployment score: the final lower-is-better selection score that blends accuracy, probability quality, tail risk, stability, and overfit penalties.

## One Match Loop

1. Before: The model only sees history, scout/context signals, and event information that existed before the match.
2. Predict: it outputs an expected score, win chance, uncertainty, and role clue for the drive-team briefing.
3. Learn: after the match is over, the real result updates team and event memory for future matches only.

## Trust Ladder

- No-future replay blocks hindsight by forcing every prediction to happen before the match result exists.
- Holdouts punish memorization by checking whether a promising idea still works away from the exact slice where it looked good.
- Calibration checks honesty by asking whether stated win chances behave like real probabilities.
- Tail-risk review checks the uncomfortable matches instead of hiding behind average accuracy.

## Final Selection Filter

- Accuracy first: a candidate had to keep score and margin error competitive.
- Probability honesty: win chances had to be calibrated enough for strategy, not just dramatic.
- Tail discipline: hard-match behavior mattered because one ugly miss can damage a drive-team briefing.
- Stability over sparkle: a clever branch only counted if it survived holdouts and overfit penalties.

## Proof Receipt

- No-future claim: open \`LEAKAGE_AUDIT.md\` to see why the replay does not peek at current-match results.
- Model-choice claim: open \`FINALIST_COMPARISON.md\` to see why the promoted model beat the closest alternatives.
- Accuracy claim: open \`FINAL_CHECK_SUMMARY.md\` to see the latest tests, browser QA, verifier, screenshots, and deadline proof.
- Visual claim: open \`index.html#start-here-story\` and the screenshot files to see the same story rendered and checked.

## What A Drive Team Gets

- Expected score: a reasonable pre-match scoring estimate, not an exact promise.
- Win chance: a calibrated probability, not a guaranteed winner.
- Uncertainty: a warning about how wide the realistic score range is.
- Role clue: a hint about whether defense or role tradeoffs may matter.
- Human boundary: scouts and drive teams still check robot condition, alliance plans, and live context.

## When To Trust It

- Trust more when the predicted gap is large, the uncertainty is narrow, and role warnings do not conflict with scout notes.
- Slow down when the match is near-tie, uncertainty is wide, the event is high-tail, or defense/role signals are unstable.
- Ask humans when robot condition, alliance plan, driver intent, or last-minute mechanical changes could override the model.

## What Surprised Us

- The winner was not the flashiest model. It was the model that stayed useful after leakage checks, holdouts, calibration checks, tail-risk review, and overfit penalties.
- Defense became useful only after we stopped treating it like one magic number. RoleV3 made defense a set of tradeoffs: suppression, offensive cost, foul exposure, and net swing.
- A documented no made the final yes stronger. SelectiveTailGuard sounded clever, but rejecting it after broad confirmation failed made the final model more believable.

## TailGuard Micro-Sensitivity Sweep

- We tested the immediate TailGuard neighborhood after TW=0.20 looked strong: TW=0.18, TW=0.21, TW=0.22, TW=0.23, and TW=0.25 challenged the defended setting.
- TW=0.22 ranked first in the exact 2026 replay: relative benchmark 0.485, ahead of TW=0.21 at 0.561, TW=0.25 at 0.583, TW=0.20 at 0.647, and TW=0.23 at 0.655.
- Broad replay agreed on the point candidate: in the 2024-2026 replay, TW=0.22 ranked first at 4.111, ahead of TW=0.23 at 4.130, TW=0.20 at 4.171, TW=0.25 at 4.174, and TW=0.21 at 4.193.
- Holdouts were mixed but useful: TW=0.25 led the holdout ranks, bucket 4 still preferred plain Strong RoleV3, and the stability-adjusted deployment rule promoted TW=0.22 at 0.126 versus TW=0.20 at 0.186 and TW=0.25 at 0.195.
- Decision: promote Conservative TailGuard Strong RoleV3 at TW=0.22 as the current point model, while documenting TW=0.25 as the holdout-rank challenger, TW=0.20 as the fixed-score diagnostic, and TW=0.21/TW=0.23 as last decimal sanity checks.

## The 90-Second Walkthrough

We started with simple baselines because they are the honest starting line: if a fancy model cannot beat a memory of how teams usually score, it has not earned trust.

That baseline was useful, but too blunt, so we moved to walk-forward replay. The model had to live through the season one match at a time, using only what would have been known before each match.

Then we realized a single predicted score was not enough for strategy. We added score distributions, win probabilities, and calibration checks so the output felt more like a scouting briefing than a fortune-telling number.

Defense was the next problem. RoleV3 separated team strength from defensive suppression, offensive cost, foul exposure, and net swing, because defense is not one magic feature.

Hard events still created bigger misses, so TailGuard became the cautious correction for high-risk score environments. SelectiveTailGuard sounded even smarter, but it failed broad confirmation, so we rejected it.

That is why Conservative TailGuard Strong RoleV3 won: not because it was the flashiest idea, but because the TW=0.22 version gave the best stability-adjusted balance after the micro-sensitivity and holdout checks.

## Three Things To Remember

1. It predicts before the match, not after the match.
2. It is useful because it gives score ranges, risk, and role/defense context, not just a winner.
3. It won because simpler and smarter-sounding alternatives were tested against the same no-future discipline and did not beat this balance of accuracy, caution, and stability.

## What The Numbers Mean

- Score MAE 36.32: the model's typical alliance-score miss after weighting the important evaluation slices.
- Margin MAE 49.73: the typical miss on the red-versus-blue score gap, which is harder than only predicting one alliance score.
- Brier 0.1648: a win-probability honesty score, where lower means the probabilities were better calibrated.
- Deployment score 0.126: the final selection score, combining accuracy, calibration, tail risk, stability, and overfit penalties; lower is better.

## If A Judge Pushes Back

- "Is this cheating with future data?" No. The promoted validation is a no-future replay: before each historical match, the model only sees evidence that would have existed before that match.
- "Why not use something smarter?" We tried smarter-sounding branches, but they only count when they survive holdouts. SelectiveTailGuard did not, so we rejected it.
- "Is this accurate enough?" It is accurate enough for pre-match strategy support, not for replacing scouts or drive-team judgment.

## Safe Wording Before You Present

- Say: current best defended local model.
- Say: no-future replay, not hindsight.
- Say: strategy support, not replacement for scouts.
- Avoid: exact-score certainty, live app deployment claims, or certainty about future defense choices.

## Proof Steps After The Story

- Open \`index.html#start-here-story\` for the full visual dashboard.
- Open \`FINALIST_COMPARISON.md\` for why this model beat the closest alternatives.
- Open \`LEAKAGE_AUDIT.md\` for the no-future validation guard.
- Open \`FINAL_CHECK_SUMMARY.md\` for the final generated proof gate.

## The Full Walkthrough

We were not trying to build the fanciest model. We were trying to find the model we would trust before a real match, when future scores are still unknown and a drive team needs an honest estimate.

We started with simple baselines because they are the most honest place to begin. In one sentence: the baseline model remembers how teams have performed before and uses that memory to estimate the next match. That was useful, but it was too blunt. It could say who looked strong overall, but it did not understand how matches change event by event, how uncertainty matters, or why defense can help one alliance while costing another.

So we moved to an online replay model. The model walks through history match by match, and before each prediction it only sees what would have existed before that match. This mattered because it turned the project from "can we explain old results?" into "could we have made this prediction at the time?"

Then we learned that a single expected score was not enough. Strategy does not only ask "who wins?" It asks "what score range is realistic, where can this go wrong, and how confident should we be?" So we added score distributions, win probabilities, and calibration checks. The model became less like a fortune cookie and more like a scouting briefing.

The next problem was defense. A simple model can accidentally treat defense like magic. We built RoleV3 because defense has several separate parts: suppressing the opponent, losing some of your own scoring, causing foul risk, and creating net swing. In one sentence: RoleV3 tries to separate "a team is good" from "a team changes the shape of the match." That made the model more useful and more honest.

But the hardest matches still caused trouble. Championship-like events and fast-changing score environments produced bigger misses. So we tested tail-risk ideas. TailGuard was the best of those ideas: instead of pretending the model solved every strange match, it nudges the model to respect risky high-tail situations.

Then came the tempting idea: SelectiveTailGuard. It sounded smarter because it tried to turn on stronger correction only when prior evidence said an event was hard. But the tests did not support it broadly. It looked good in one view and failed confirmation in others. We rejected it. That rejection is part of the win, because a real modeling project should have documented "no" answers, not just a polished final answer.

The final winner is Conservative TailGuard Strong RoleV3 at TW=0.22. It is not a miracle model. It wins because it keeps the strong RoleV3 average accuracy, slightly improves hard-tail behavior, and has the best stability-adjusted deployment score among the finalists.

## One-Minute Judge Script

"We built a local FIRST match prediction model that replays history one match at a time. Before each match, it only uses information that would have existed before that match, so the validation acts like a real pre-match prediction instead of a hindsight explanation.

We started with simple team-strength baselines, then added online memory, uncertainty, event context, residual correction, role-aware defense features, and tail-risk checks. The winning model is Conservative TailGuard Strong RoleV3. Intuitively, it remembers team strength, separates different kinds of role and defense impact, predicts score distributions instead of only winners, and stays cautious around hard high-tail events.

The important part is not that it is perfect. It is not. The important part is that flashier ideas were tested and rejected when they failed holdouts. The final model is the best defended local model we found: 36.32 weighted score MAE, 49.73 weighted margin MAE, 0.1648 weighted Brier, and 0.126 deployment score."

## The Adventure In Six Turns

1. The honest beginning: simple baselines.
   We used simple models first because if a complicated model cannot beat a simple one, it has not earned trust.

2. The realism rule: walk-forward replay.
   We forced the model to predict the past as if it was living through the season, never looking at current-match results before making that match's prediction.

3. The strategy shift: distributions, not just winners.
   A drive team needs likely scores, risk, and confidence, not just a win label.

4. The role breakthrough: RoleV3.
   We separated team strength, defense suppression, offensive cost, foul exposure, and net swing so "defense" would not become a vague magic feature.

5. The hard-match problem: tail risk.
   Championship-like matches and fast score environments created bigger misses, so TailGuard was tested as a cautious correction.

6. The final discipline: reject the clever thing.
   SelectiveTailGuard sounded clever, but it failed broad confirmation. The later TW=0.22 TailGuard pass won because it gave the best stability-adjusted balance of accuracy, caution, and stability.

## What To Say If Someone Asks "Why Not Something Smarter?"

Because smarter-sounding is not the same as better. Neural-style complexity, selective gates, and stronger corrections only count if they survive realistic validation. The final model is valuable because it did not just chase the lowest number. It survived a process that punished leakage, instability, overfit, and unsupported claims.

## What To Say If Someone Asks "Is This Accurate Enough?"

It is accurate enough to support pre-match strategy, not accurate enough to replace human judgment. The model gives a structured starting point: expected scores, win probability, uncertainty, role clues, and known risks. Scouts and strategists should use it as a briefing, then combine it with robot condition, alliance plans, and live scouting.

## Where To Go Next

- Open \`index.html#start-here-story\` for this story inside the full visual dashboard.
- Open \`FINALIST_COMPARISON.md\` for the "why this model" table.
- Open \`MODEL_JOURNEY_TIMELINE.md\` for the compressed research path.
- Open \`LEAKAGE_AUDIT.md\` if someone asks how we avoided cheating with future data.
- Open \`FINAL_CHECK_SUMMARY.md\` for the verified package gate.

${buildGeneratedStamp(generatedAt)}
`;

const buildStartHereStoryHtml = (generatedAt: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Start Here: The Model Adventure</title>
  <link rel="icon" href="data:," />
  <style>
    :root { color-scheme: light; --ink: #101827; --muted: #4b5c6e; --line: #d7e1ea; --card: #ffffff; --teal: #0f766e; --blue: #1d4ed8; --amber: #b45309; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: linear-gradient(135deg, #f8fbff 0%, #fff9f1 44%, #f3fbf6 100%); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    header { min-height: 82vh; display: grid; align-items: center; padding: 52px clamp(20px, 5vw, 76px); border-bottom: 1px solid rgba(16, 24, 39, 0.08); }
    .hero { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 40px; align-items: center; }
    .kicker { color: var(--teal); font-weight: 800; text-transform: uppercase; font-size: 0.82rem; margin-bottom: 14px; }
    h1 { margin: 0 0 18px; font-size: clamp(2.45rem, 5.2vw, 5.4rem); line-height: 0.98; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: clamp(1.55rem, 3vw, 2.65rem); line-height: 1.08; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 1rem; letter-spacing: 0; }
    p { margin: 0 0 14px; color: var(--muted); }
    code { background: #edf3f8; border-radius: 4px; padding: 2px 5px; overflow-wrap: anywhere; }
    .lead { font-size: 1.12rem; max-width: 690px; }
    .hero-panel, .card, .story, .script { background: var(--card); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 16px 46px rgba(15, 23, 42, 0.08); }
    .hero-panel { padding: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; }
    .metric span { display: block; color: var(--muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .metric strong { display: block; margin-top: 4px; font-size: 1.35rem; }
    main { max-width: 1120px; margin: 0 auto; padding: 42px clamp(18px, 4vw, 42px) 86px; }
    section { margin: 48px 0; }
    .story, .script { padding: clamp(20px, 3vw, 34px); }
    .story p { max-width: 830px; font-size: 1.04rem; }
    .turns, .cards { display: grid; gap: 16px; }
    .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .busy-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card { padding: 18px; }
    .card strong { display: block; margin-bottom: 6px; font-size: 1.06rem; }
    .script { background: #101827; color: #f8fafc; }
    .script p { color: #d9e4ef; font-size: 1.05rem; }
    .script strong { color: #fff; }
    .proof-links { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .proof-link { display: block; text-decoration: none; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 18px; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06); }
    .proof-link span { display: block; color: var(--teal); font-weight: 800; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .proof-link strong { display: block; margin-bottom: 6px; font-size: 1.04rem; }
    .proof-link p { margin: 0; font-size: 0.95rem; }
    .deadline-note { margin-top: 18px; font-weight: 800; color: var(--ink); }
    .stop-note { margin-top: 14px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px 16px; font-weight: 700; }
    footer { border-top: 1px solid var(--line); padding-top: 22px; color: var(--muted); font-size: 0.92rem; }
    @media (max-width: 900px) { header { min-height: auto; padding-top: 36px; } .hero, .cards, .metrics, .proof-links { grid-template-columns: 1fr; } }
    @media print { @page { margin: 14mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: #fff; } header { min-height: auto; padding: 12mm 0; } main { max-width: none; padding: 0; } section { margin: 12mm 0; } .hero, .cards, .metrics, .proof-links { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hero-panel, .card, .story, .script, .proof-link { box-shadow: none; break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <div class="hero">
      <div>
        <div class="kicker">Start here before the proof vault</div>
        <h1>The model adventure in one quick walk</h1>
        <p class="lead">This is the fast human route through the project: why we started simple, why the model changed, what failed, and why Conservative TailGuard Strong RoleV3 became the final defended answer.</p>
        <p class="deadline-note">Delivery target: Saturday May 23 2026 18:00 CST.</p>
      </div>
      <div class="hero-panel">
        <h2>Thirty-second answer</h2>
        <p>We chose the model that acted most like a serious pre-match scouting assistant: it remembers team strength, separates role and defense effects, predicts score ranges instead of only winners, and stays cautious around risky high-tail events.</p>
        <p>Several smarter-sounding ideas were tested and rejected; this model won by surviving realistic validation, not by sounding fancy.</p>
        <div class="metrics">
          <div class="metric"><span>Best model</span><strong>Conservative TailGuard Strong RoleV3</strong></div>
          <div class="metric"><span>Score MAE</span><strong>36.32</strong></div>
          <div class="metric"><span>Margin MAE</span><strong>49.73</strong></div>
          <div class="metric"><span>Deployment score</span><strong>0.126</strong></div>
        </div>
      </div>
    </div>
	  </header>
	  <main>
    <section>
      <h2>If you only read one screen</h2>
      <div class="story">
        <p>We began with the simplest honest idea: teams usually carry some scoring memory from match to match. That baseline was a good starting point because any fancier model had to beat it before earning attention.</p>
        <p>Then the baseline hit its limit. It could remember strength, but it could not explain uncertainty, event conditions, role tradeoffs, or defense. So we forced every idea through no-future replay, added score ranges and probability checks, then built RoleV3 to separate normal team strength from defense suppression, offensive cost, foul risk, and net swing.</p>
        <p>The last hard problem was the dangerous tail: fast, high-scoring events where a single confident miss could hurt a drive-team briefing. TailGuard became the cautious correction. We tried smaller weights, a smarter-sounding SelectiveTailGuard branch, and then a micro-sensitivity pass around the final TailGuard weight. The final answer is Conservative TailGuard Strong RoleV3 with TW=0.22 because it survived the adventure, not because it had the fanciest name.</p>
      </div>
      <div class="cards" style="margin-top:16px;">
        <div class="card"><strong>Starting point</strong><p>Simple team-strength memory.</p></div>
        <div class="card"><strong>Breakthrough</strong><p>No-future replay plus score distributions and role-aware defense.</p></div>
        <div class="card"><strong>Rejected temptation</strong><p>SelectiveTailGuard and under-tuned TailGuard weights did not beat the defended balance.</p></div>
        <div class="card"><strong>Final claim</strong><p>Best defended local pre-match strategy model, not an oracle.</p></div>
      </div>
    </section>
    <section>
      <h2>If You Remember Nothing Else</h2>
      <div class="cards">
        <div class="card"><strong>The question</strong><p>Can match history and scouting context give a drive team a useful pre-match warning?</p></div>
        <div class="card"><strong>The answer</strong><p>Yes, cautiously; the model estimates score, win chance, uncertainty, and role risk before the match.</p></div>
        <div class="card"><strong>The proof idea</strong><p>Every serious candidate was replayed as if standing before each match, then checked by browser QA, screenshots, tests, and verifier rules.</p></div>
        <div class="card"><strong>The boundary</strong><p>This is a disciplined starting point for strategy, not a replacement for scouts, repairs, drivers, or human judgment.</p></div>
      </div>
    </section>
    <section>
      <h2>Fast Reading Route</h2>
      <div class="cards">
        <div class="card"><strong>1. Answer</strong><p>Read the thirty-second answer and Busy Judge Card.</p></div>
        <div class="card"><strong>2. Loop</strong><p>Read One Match Loop to understand how the model avoids hindsight.</p></div>
        <div class="card"><strong>3. Trust</strong><p>Read Trust Ladder and Final Selection Filter.</p></div>
        <div class="card"><strong>4. Use</strong><p>Read What A Drive Team Gets and When To Trust It.</p></div>
        <div class="card"><strong>5. Proof</strong><p>Read Proof Receipt when a judge asks where the evidence lives.</p></div>
      </div>
      <p class="stop-note">Stop after Proof Receipt if time is brutal; everything below is backup proof and script material.</p>
    </section>
    <section>
      <h2>What To Ignore Under Time Pressure</h2>
      <div class="cards">
        <div class="card"><strong>Older metric rows</strong><p>Older 41.x score-MAE rows are audit history, not the current promoted 36.32 claim.</p></div>
        <div class="card"><strong>Report-local labels</strong><p>Report-local point-default labels are historical report roles, not the final model choice.</p></div>
        <div class="card"><strong>Rejected clever branch</strong><p>SelectiveTailGuard is rejected; it sounded clever but failed broad confirmation.</p></div>
        <div class="card"><strong>Useful audit branches</strong><p>ScoutGate and RoleGate are useful audit branches, not the final point model.</p></div>
        <div class="card"><strong>Leaderboard timing</strong><p>Do not start with the full leaderboard unless a judge asks; start with the story, proof receipt, and final check.</p></div>
      </div>
    </section>
	    <section>
	      <h2>Busy Judge Card</h2>
	      <div class="cards busy-cards">
        <div class="card"><strong>Model</strong><p>Conservative TailGuard Strong RoleV3.</p></div>
        <div class="card"><strong>Model in one sentence</strong><p>It remembers team strength, separates role and defense effects, predicts score ranges, and stays cautious when matches look unusually risky.</p></div>
        <div class="card"><strong>Why believe it</strong><p>Every finalist was judged through no-future replay, holdouts, calibration, tail-risk checks, and overfit penalties.</p></div>
        <div class="card"><strong>Honest caveat</strong><p>It supports pre-match strategy; it does not replace scouts, drive-team judgment, or live robot condition checks.</p></div>
      </div>
    </section>
    <section>
      <h2>So What For Strategy?</h2>
      <div class="story">
        <p>The model turns a pile of match history into a pre-match briefing, not a command. It is useful because it gives the human strategy group a better first question.</p>
      </div>
      <div class="cards" style="margin-top:16px;">
        <div class="card"><strong>Before a match</strong><p>Use expected score, win chance, uncertainty, and role clues to know what kind of match you are probably entering.</p></div>
        <div class="card"><strong>During strategy talk</strong><p>Compare risk, not just average score; a near-tie with wide uncertainty needs a different plan than a clear favorite.</p></div>
        <div class="card"><strong>For scouting focus</strong><p>Ask humans to verify the specific thing the model is unsure about, such as robot condition, defense tradeoff, or role fit.</p></div>
        <div class="card"><strong>After a miss</strong><p>Use the miss as feedback for model improvement instead of pretending the prediction was always right.</p></div>
        <div class="card"><strong>Human final call</strong><p>Scouts, drive team, and alliance strategy still own the decision.</p></div>
      </div>
    </section>
    <section>
      <h2>Judge Answer Finder</h2>
      <div class="story">
        <p>Use this when someone asks where exactly to look for one claim.</p>
      </div>
      <div class="cards" style="margin-top:16px;">
        <div class="card"><strong>What won?</strong><p><code>FINAL_MODEL_CARD.md</code>: Conservative TailGuard Strong RoleV3, with the current 36.32 / 49.73 / 0.1648 / 0.126 metrics.</p></div>
        <div class="card"><strong>Why trust the validation?</strong><p><code>LEAKAGE_AUDIT.md</code>; <code>FINAL_CHECK_SUMMARY.md</code>: no-future replay plus a clean final gate.</p></div>
        <div class="card"><strong>Why this model over alternatives?</strong><p><code>FINALIST_COMPARISON.md</code>; <code>MODEL_LEADERBOARD_APPENDIX.md</code>: closest contenders, rejected branches, and current-vs-historical labels.</p></div>
        <div class="card"><strong>How does this help strategy?</strong><p><code>STRATEGY_EXAMPLE.md</code>; <code>DEFENSE_ROLE_GUIDE.md</code>: expected score, win chance, uncertainty, and role/defense clues before the match.</p></div>
        <div class="card"><strong>What should we not claim?</strong><p><code>CLAIM_BOUNDARIES.md</code>; <code>LIMITATIONS_AND_RISK_REGISTER.md</code>: best defended local model, not oracle, not deployed, not replacement for scouts.</p></div>
        <div class="card"><strong>Is the package verified?</strong><p><code>VERIFICATION_SUMMARY.md</code>; <code>browser-qa-summary.json</code>: required text, manifests, fingerprints, screenshots, and freshness checks passed.</p></div>
      </div>
    </section>
    <section>
      <h2>Model Family Cheat Sheet</h2>
      <div class="story">
        <p>Use this to translate the model names before opening the full leaderboard.</p>
      </div>
      <div class="cards" style="margin-top:16px;">
        <div class="card"><strong>Baseline</strong><p>Remembers how teams usually score and sets the honest starting line. Useful sanity check, not enough for strategy.</p></div>
        <div class="card"><strong>Residual correction</strong><p>Learns from past misses only after those matches happen. Helpful ingredient, but not the whole answer.</p></div>
        <div class="card"><strong>RoleV3</strong><p>Separates defense into suppression, scoring cost, foul risk, and net swing. Core part of the promoted model.</p></div>
        <div class="card"><strong>TailGuard</strong><p>Adds caution when a match environment looks unusually risky or high-scoring. Promoted with TW=0.22.</p></div>
        <div class="card"><strong>SelectiveTailGuard</strong><p>Tried to apply caution only in selected risky places. Rejected because broad confirmation failed.</p></div>
        <div class="card"><strong>ScoutGate and RoleGate</strong><p>Audit branches that test scout/role signal usefulness. Useful evidence, not the final point model.</p></div>
      </div>
    </section>
    <section>
      <h2>Judge Decision Trail</h2>
      <div class="cards">
        <div class="card"><strong>Baseline because</strong><p>Simple team-strength memory was the honest starting line. It revealed missing uncertainty, context, and defense tradeoffs. Next move: no-future replay.</p></div>
        <div class="card"><strong>No-future replay because</strong><p>The model had to predict before each match, not explain after it. It revealed that strategy needed ranges and calibrated probabilities.</p></div>
        <div class="card"><strong>RoleV3 because</strong><p>Defense needed separate pieces: suppression, own scoring cost, foul risk, confidence, and net swing. It revealed the remaining hard-match tail problem.</p></div>
        <div class="card"><strong>TailGuard because</strong><p>Risky environments needed caution instead of overconfidence. SelectiveTailGuard failed broad confirmation, so the final move was to promote Conservative TailGuard Strong RoleV3.</p></div>
      </div>
    </section>
    <section>
      <h2>Adventure Map</h2>
      <div class="cards">
        <div class="card"><strong>1. Baseline</strong><p>Remember how teams usually score.</p></div>
        <div class="card"><strong>2. No-future replay</strong><p>Make every prediction before seeing that match.</p></div>
        <div class="card"><strong>3. Distributions</strong><p>Show score ranges and confidence, not only winners.</p></div>
        <div class="card"><strong>4. RoleV3</strong><p>Separate team strength from defense suppression, cost, fouls, and net swing.</p></div>
        <div class="card"><strong>5. TailGuard</strong><p>Stay cautious when the match environment looks unusually risky.</p></div>
        <div class="card"><strong>6. Final model</strong><p>Reject clever branches that fail confirmation and keep the most defensible balance.</p></div>
      </div>
    </section>
    <section>
      <h2>Plain-English Decoder</h2>
      <div class="cards">
        <div class="card"><strong>No-future replay</strong><p>Replay old matches as if we were standing before each match, without using that match's result.</p></div>
        <div class="card"><strong>MAE</strong><p>Average absolute miss. If a model predicts 100 and the real score is 110, that match misses by 10; lower is better.</p></div>
        <div class="card"><strong>Margin MAE</strong><p>The same miss idea, but for the red-blue score gap, which is harder than one alliance score.</p></div>
        <div class="card"><strong>RoleV3</strong><p>The model's way to separate normal scoring strength from defense effects, role costs, foul risk, and net swing.</p></div>
        <div class="card"><strong>TailGuard</strong><p>A caution layer for unusually risky high-score environments.</p></div>
        <div class="card"><strong>Holdout</strong><p>A validation slice away from the easiest full replay, used to punish memorization.</p></div>
        <div class="card"><strong>Brier</strong><p>A score for whether win probabilities are honest; if the model says 70% often, those teams should win about 70% of the time.</p></div>
        <div class="card"><strong>Calibration</strong><p>The same honesty idea for probabilities and intervals; it checks confidence, not just winners.</p></div>
        <div class="card"><strong>Residual correction</strong><p>Learning from past prediction misses after they happen, then using that lesson only for future matches.</p></div>
        <div class="card"><strong>TW=0.22</strong><p>The TailGuard strength knob; it says the caution layer is present but deliberately conservative.</p></div>
        <div class="card"><strong>Deployment score</strong><p>The final lower-is-better selection score that blends accuracy, probability quality, tail risk, stability, and overfit penalties.</p></div>
      </div>
    </section>
    <section>
      <h2>One Match Loop</h2>
      <div class="cards">
        <div class="card"><strong>1. Before</strong><p>The model only sees history, scout/context signals, and event information that existed before the match.</p></div>
        <div class="card"><strong>2. Predict</strong><p>It outputs an expected score, win chance, uncertainty, and role clue for the drive-team briefing.</p></div>
        <div class="card"><strong>3. Learn</strong><p>After the match is over, the real result updates team and event memory for future matches only.</p></div>
      </div>
    </section>
    <section>
      <h2>Trust Ladder</h2>
      <div class="cards">
        <div class="card"><strong>No-future replay</strong><p>Blocks hindsight by forcing every prediction to happen before the match result exists.</p></div>
        <div class="card"><strong>Holdouts</strong><p>Punish memorization by checking whether an idea still works away from the slice where it looked good.</p></div>
        <div class="card"><strong>Calibration</strong><p>Checks honesty by asking whether stated win chances behave like real probabilities.</p></div>
        <div class="card"><strong>Tail-risk review</strong><p>Checks the uncomfortable matches instead of hiding behind average accuracy.</p></div>
      </div>
    </section>
    <section>
      <h2>Final Selection Filter</h2>
      <div class="cards">
        <div class="card"><strong>Accuracy first</strong><p>A candidate had to keep score and margin error competitive.</p></div>
        <div class="card"><strong>Probability honesty</strong><p>Win chances had to be calibrated enough for strategy, not just dramatic.</p></div>
        <div class="card"><strong>Tail discipline</strong><p>Hard-match behavior mattered because one ugly miss can damage a drive-team briefing.</p></div>
        <div class="card"><strong>Stability over sparkle</strong><p>A clever branch only counted if it survived holdouts and overfit penalties.</p></div>
      </div>
    </section>
    <section>
      <h2>Proof Receipt</h2>
      <div class="cards">
        <div class="card"><strong>No-future claim</strong><p>Open <code>LEAKAGE_AUDIT.md</code> to see why the replay does not peek at current-match results.</p></div>
        <div class="card"><strong>Model-choice claim</strong><p>Open <code>FINALIST_COMPARISON.md</code> to see why the promoted model beat the closest alternatives.</p></div>
        <div class="card"><strong>Accuracy claim</strong><p>Open <code>FINAL_CHECK_SUMMARY.md</code> to see the latest tests, browser QA, verifier, screenshots, and deadline proof.</p></div>
        <div class="card"><strong>Visual claim</strong><p>Open <code>index.html#start-here-story</code> and the screenshot files to see the same story rendered and checked.</p></div>
      </div>
    </section>
    <section>
      <h2>What A Drive Team Gets</h2>
      <div class="cards">
        <div class="card"><strong>Expected score</strong><p>A reasonable pre-match scoring estimate, not an exact promise.</p></div>
        <div class="card"><strong>Win chance</strong><p>A calibrated probability, not a guaranteed winner.</p></div>
        <div class="card"><strong>Uncertainty</strong><p>A warning about how wide the realistic score range is.</p></div>
        <div class="card"><strong>Role clue</strong><p>A hint about whether defense or role tradeoffs may matter.</p></div>
        <div class="card"><strong>Human boundary</strong><p>Scouts and drive teams still check robot condition, alliance plans, and live context.</p></div>
      </div>
    </section>
    <section>
      <h2>When To Trust It</h2>
      <div class="cards">
        <div class="card"><strong>Trust more</strong><p>Use it with more confidence when the predicted gap is large, uncertainty is narrow, and role warnings do not conflict with scout notes.</p></div>
        <div class="card"><strong>Slow down</strong><p>Treat the output as fragile when the match is near-tie, uncertainty is wide, the event is high-tail, or defense/role signals are unstable.</p></div>
        <div class="card"><strong>Ask humans</strong><p>Robot condition, alliance plan, driver intent, and last-minute mechanical changes can override the model.</p></div>
      </div>
    </section>
    <section>
      <h2>What surprised us</h2>
      <div class="cards">
        <div class="card"><strong>Not flashiest</strong><p>The winner was not the flashiest model. It was the one that stayed useful after leakage checks, holdouts, calibration checks, tail-risk review, and overfit penalties.</p></div>
        <div class="card"><strong>Defense is tradeoffs</strong><p>RoleV3 worked because it split defense into suppression, offensive cost, foul exposure, and net swing instead of treating defense like one magic number.</p></div>
        <div class="card"><strong>Documented no</strong><p>A documented no made the final yes stronger: SelectiveTailGuard sounded clever, but failed broad confirmation.</p></div>
      </div>
    </section>
    <section>
      <h2>TailGuard Micro-Sensitivity Sweep</h2>
      <div class="cards">
        <div class="card"><strong>Question</strong><p>We tested the immediate TailGuard neighborhood after TW=0.20 looked strong: TW=0.18, TW=0.21, TW=0.22, TW=0.23, and TW=0.25 challenged the defended setting.</p></div>
        <div class="card"><strong>2026 result</strong><p>TW=0.22 ranked first in the exact 2026 replay: relative benchmark 0.485, ahead of TW=0.21 at 0.561, TW=0.25 at 0.583, TW=0.20 at 0.647, and TW=0.23 at 0.655.</p></div>
        <div class="card"><strong>Broad result</strong><p>Broad replay agreed on the point candidate: in the 2024-2026 replay, TW=0.22 ranked first at 4.111, ahead of TW=0.23 at 4.130, TW=0.20 at 4.171, TW=0.25 at 4.174, and TW=0.21 at 4.193.</p></div>
        <div class="card"><strong>Holdout result</strong><p>Holdouts were mixed but useful: TW=0.25 led the holdout ranks, bucket 4 still preferred plain Strong RoleV3, and the deployment rule promoted TW=0.22 at 0.126.</p></div>
        <div class="card"><strong>Decision</strong><p>Promote Conservative TailGuard Strong RoleV3 at TW=0.22 while documenting TW=0.25 as the holdout-rank challenger and TW=0.21/TW=0.23 as last decimal sanity checks.</p></div>
      </div>
    </section>
    <section class="story">
      <h2>The 90-Second Walkthrough</h2>
      <p><strong>Thirty-second answer:</strong> We built a pre-match scouting model, not an oracle. It replays history one match at a time, only uses information available before each match, and promotes the model that is most trustworthy for a drive-team briefing.</p>
      <p>The winner is Conservative TailGuard Strong RoleV3 because it best balanced accuracy, uncertainty, role/defense reasoning, and caution on hard high-tail events. The important twist is that smarter-sounding ideas were rejected when they failed realistic validation.</p>
      <p>We were not trying to build the fanciest model. We were trying to find the model we would trust before a real match, when future scores are still unknown and a drive team needs an honest estimate.</p>
      <p>We started with simple baselines because they are the most honest place to begin. In one sentence: the baseline model remembers how teams have performed before and uses that memory to estimate the next match. That was useful, but it was too blunt.</p>
      <p>So we moved to an online replay model. The model walks through history match by match, and before each prediction it only sees what would have existed before that match.</p>
      <p>Then we added score distributions, win probabilities, role-aware defense features, and tail-risk checks. SelectiveTailGuard sounded clever, but failed broad confirmation. The later TW=0.22 TailGuard pass won because it gave the best stability-adjusted balance of accuracy, caution, and stability.</p>
    </section>
    <section>
      <h2>Three things to remember</h2>
      <div class="cards">
        <div class="card"><strong>1. Before-match only</strong><p>The replay rule matters: every prediction uses only information that would have existed before that match.</p></div>
        <div class="card"><strong>2. Strategy, not prophecy</strong><p>The model is useful because it gives score ranges, risk, and role/defense context, not just a winner.</p></div>
        <div class="card"><strong>3. Rejected cleverness</strong><p>The winner survived comparison after simpler and smarter-sounding alternatives failed the same no-future discipline.</p></div>
      </div>
    </section>
    <section>
      <h2>What the numbers mean</h2>
      <div class="cards">
        <div class="card"><strong>Score MAE 36.32</strong><p>The model's typical alliance-score miss after weighting the important evaluation slices.</p></div>
        <div class="card"><strong>Margin MAE 49.73</strong><p>The typical miss on the red-versus-blue score gap, which is harder than only predicting one alliance score.</p></div>
        <div class="card"><strong>Brier 0.1648</strong><p>A win-probability honesty score; lower means the probabilities were better calibrated.</p></div>
        <div class="card"><strong>Deployment score 0.126</strong><p>The final lower-is-better selection score combining accuracy, calibration, tail risk, stability, and overfit penalties.</p></div>
      </div>
    </section>
    <section>
      <h2>If a judge pushes back</h2>
      <div class="cards">
        <div class="card"><strong>Is this cheating with future data?</strong><p>No. The promoted validation is a no-future replay: before each historical match, the model only sees evidence that would have existed before that match.</p></div>
        <div class="card"><strong>Why not use something smarter?</strong><p>We tried smarter-sounding branches, but they only count when they survive holdouts. SelectiveTailGuard did not, so we rejected it.</p></div>
        <div class="card"><strong>Is this accurate enough?</strong><p>It is accurate enough for pre-match strategy support, not for replacing scouts or drive-team judgment.</p></div>
      </div>
    </section>
    <section>
      <h2>Safe wording before you present</h2>
      <div class="cards">
        <div class="card"><strong>Say this</strong><p>Current best defended local model.</p></div>
        <div class="card"><strong>Say this</strong><p>No-future replay, not hindsight.</p></div>
        <div class="card"><strong>Say this</strong><p>Strategy support, not replacement for scouts.</p></div>
        <div class="card"><strong>Avoid this</strong><p>Exact-score certainty, live app deployment claims, or certainty about future defense choices.</p></div>
      </div>
    </section>
    <section>
      <h2>The Adventure In Six Turns</h2>
      <div class="cards">
        <div class="card"><strong>1. Simple baselines</strong><p>If a complicated model cannot beat a simple one, it has not earned trust.</p></div>
        <div class="card"><strong>2. Walk-forward replay</strong><p>The model predicts history as if it is living through the season.</p></div>
        <div class="card"><strong>3. Score distributions</strong><p>A drive team needs likely scores, risk, and confidence, not just a win label.</p></div>
        <div class="card"><strong>4. RoleV3</strong><p>Defense was split into suppression, offensive cost, foul exposure, and net swing.</p></div>
        <div class="card"><strong>5. Tail risk</strong><p>TailGuard became the cautious correction for hard high-tail events.</p></div>
        <div class="card"><strong>6. Rejected cleverness</strong><p>SelectiveTailGuard failed confirmation, so documenting the no made the final yes stronger.</p></div>
      </div>
    </section>
    <section class="script">
      <h2>One-Minute Judge Script</h2>
      <p><strong>We built a local FIRST match prediction model that replays history one match at a time.</strong> Before each match, it only uses information that would have existed before that match, so validation acts like a real pre-match prediction instead of a hindsight explanation.</p>
      <p>The winning model is Conservative TailGuard Strong RoleV3. Intuitively, it remembers team strength, separates different kinds of role and defense impact, predicts score distributions instead of only winners, and stays cautious around hard high-tail events.</p>
      <p>The final model is the best defended local model we found: 36.32 weighted score MAE, 49.73 weighted margin MAE, 0.1648 weighted Brier, and 0.126 deployment score.</p>
    </section>
    <section>
      <h2>Next proof steps</h2>
      <div class="proof-links">
        <a class="proof-link" href="index.html#start-here-story"><span>Dashboard</span><strong>Open the proof vault</strong><p>The full visual report, starting at this same story section.</p></a>
        <a class="proof-link" href="FINALIST_COMPARISON.md"><span>Model choice</span><strong>Why this model won</strong><p>The side-by-side finalist comparison and caveats.</p></a>
        <a class="proof-link" href="LEAKAGE_AUDIT.md"><span>Trust</span><strong>No-future audit</strong><p>The validation guard that keeps hindsight out of predictions.</p></a>
        <a class="proof-link" href="FINAL_CHECK_SUMMARY.md"><span>Gate</span><strong>Final check proof</strong><p>The generated pass/fail summary for tests, browser QA, screenshots, and verifier.</p></a>
      </div>
    </section>
    <footer>${buildGeneratedInline(generatedAt)}. Open <code>index.html#start-here-story</code> for the same story inside the full checked dashboard.</footer>
  </main>
</body>
</html>
`;

const judgeStorySpineRows = [
  {
    beat: 'Problem',
    say: 'FRC pre-match modeling is a real-world strategy problem: scores, role choices, uncertainty, and available evidence matter more than a clean classroom answer.',
    proof: 'METHODOLOGY_APPENDIX.md, OPR_EPA_EXPLAINER.md',
    warning: 'Do not reduce the project to winner prediction.'
  },
  {
    beat: 'Rule',
    say: 'Every historical prediction must be made as if we are standing before that match.',
    proof: 'LEAKAGE_AUDIT.md, buildWalkForwardDataset, tests/modeling.test.mjs',
    warning: 'Any future data source must prove timestamp safety before promotion.'
  },
  {
    beat: 'Search',
    say: 'We tried baselines, OPR-style ideas, EPA-style memory, Monte Carlo distributions, residual correction, role/defense features, tail guards, and calibration overlays.',
    proof: 'MODEL_JOURNEY_TIMELINE.md, MODEL_LEADERBOARD_APPENDIX.md',
    warning: 'A smarter-sounding model only matters if it survives holdouts.'
  },
  {
    beat: 'Winner',
    say: 'Conservative TailGuard Strong RoleV3 is the best defended point candidate in the current package.',
    proof: 'FINAL_MODEL_CARD.md, FINALIST_COMPARISON.md',
    warning: 'This is a best-known local model, not proof that no better model exists.'
  },
  {
    beat: 'Why It Won',
    say: 'It balances score error, margin error, Brier, calibration, worst-event risk, near-ties, holdout stability, and overfit penalties.',
    proof: 'DEPLOYMENT_SCORING_RUBRIC.md, buildDeploymentReview',
    warning: 'Do not quote MAE alone as the whole result.'
  },
  {
    beat: 'Strategy Use',
    say: 'The output supports strategy with expected scores, uncertainty, win probability, role clues, and defense opportunity-cost reads.',
    proof: 'STRATEGY_EXAMPLE.md, DEFENSE_ROLE_GUIDE.md, PREDICTION_CASE_STUDIES.md',
    warning: 'The model supports human scouting judgment; it does not replace it.'
  },
  {
    beat: 'Integrity',
    say: 'The final package is generated, verifier-checked, browser-tested, documented with limitations, and fingerprinted for its source/text evidence.',
    proof: 'VERIFICATION_SUMMARY.md, ARTIFACT_FINGERPRINTS.md, LIMITATIONS_AND_RISK_REGISTER.md',
    warning: 'Package verification proves consistency, not model perfection.'
  }
];

const buildJudgeStorySpineTable = () =>
  judgeStorySpineRows
    .map(row => `<tr>${[row.beat, row.say, row.proof, row.warning].map(tableCell).join('')}</tr>`)
    .join('');

const buildJudgeStorySpineMarkdown = (generatedAt: string) => `# Judge Story Spine

This is the clean argument for the project. Use it when the dashboard feels too large and you need the shortest path from problem to evidence to honest limitation.

| Beat | What to say | Proof to open | Watch-out |
| --- | --- | --- | --- |
${judgeStorySpineRows
  .map(row => `| ${markdownCell(row.beat)} | ${markdownCell(row.say)} | ${markdownCell(row.proof)} | ${markdownCell(row.warning)} |`)
  .join('\n')}

## One-Minute Version

We built a local no-future replay system for FRC match strategy, tested many model families, rejected the ones that failed holdouts or overfit diagnostics, and promoted Conservative TailGuard Strong RoleV3 because it is the best defended current balance of score accuracy, margin accuracy, win-probability quality, tail behavior, and stability. It is useful because it gives expected scores, uncertainty, win probability, and role clues before a match. It is honest because it says what it cannot prove.

${buildGeneratedStamp(generatedAt)}
`;

const first90SecondRows = [
  {
    time: '0-10 seconds',
    say: 'This is an offline local modeling project, not a website feature.',
    pointAt: 'ONE_PAGE_JUDGE_STORY.html metric cards; DELIVERABLES.md',
    boundary: 'Do not imply the model is deployed to Firebase or bundled into the scouting app.'
  },
  {
    time: '10-25 seconds',
    say: 'Every historical prediction is a no-future replay: before match N, the model only sees evidence that existed before match N.',
    pointAt: 'LEAKAGE_AUDIT.md; buildWalkForwardDataset',
    boundary: 'Any source without timestamp-safe provenance stays out of the promoted model.'
  },
  {
    time: '25-45 seconds',
    say: 'We did not pick the fanciest model. We tested baselines, OPR-style ideas, EPA-style memory, Monte Carlo uncertainty, residual correction, role/defense features, and TailGuard variants.',
    pointAt: 'MODEL_JOURNEY_TIMELINE.md; MODEL_LEADERBOARD_APPENDIX.md',
    boundary: 'A clever model was rejected if it only looked good on one slice or showed instability.'
  },
  {
    time: '45-65 seconds',
    say: 'Current best: Conservative TailGuard Strong RoleV3, with weighted score MAE 36.32, weighted margin MAE 49.73, weighted Brier 0.1648, and deployment score 0.126.',
    pointAt: 'FINAL_MODEL_CARD.md; FINALIST_COMPARISON.md',
    boundary: 'Say best-known and defensible, not unbeatable.'
  },
  {
    time: '65-80 seconds',
    say: 'The benchmark is deliberately nuanced: it mixes score error, margin error, win-probability quality, calibration, coverage miss, worst-event risk, near-ties, and nonlinear overfit penalties.',
    pointAt: 'DEPLOYMENT_SCORING_RUBRIC.md; buildDeploymentReview',
    boundary: 'Do not quote MAE alone as the whole evaluation.'
  },
  {
    time: '80-90 seconds',
    say: 'The strategy value is pre-match decision support: expected scores, uncertainty, win probability, and role/defense opportunity-cost clues, with humans still making the final call.',
    pointAt: 'STRATEGY_EXAMPLE.md; DEFENSE_ROLE_GUIDE.md',
    boundary: 'The model supports scouting judgment; it does not replace it.'
  }
];

const first90OpenOrderRows = [
  {
    step: '1. Open the story',
    file: 'ONE_PAGE_JUDGE_STORY.html',
    presenterMove:
      'Read the opening card and point at the four current metrics: 36.32 score MAE, 49.73 margin MAE, 0.1648 Brier, and 0.126 deployment score.'
  },
  {
    step: '2. Open the proof',
    file: 'FINAL_CHECK_SUMMARY.md',
    presenterMove:
      'Show that the package passed after the latest edit: dashboard generation, browser QA, typecheck, tests, and verifier runs.'
  },
  {
    step: '3. Open the model card',
    file: 'FINAL_MODEL_CARD.md',
    presenterMove:
      'Name the winner as Conservative TailGuard Strong RoleV3 and say it is the best defended local model, not an oracle.'
  },
  {
    step: '4. Open the caveat',
    file: 'CLAIM_BOUNDARIES.md',
    presenterMove:
      'Close the loop: this supports strategy discussion while scouts, drive team, and match context still own the final decision.'
  }
];

const buildFirst90OpenOrderTable = () =>
  first90OpenOrderRows
    .map(row => `<tr>${[row.step, row.file, row.presenterMove].map(tableCell).join('')}</tr>`)
    .join('');

const buildFirst90SecondTable = () =>
  first90SecondRows
    .map(row => `<tr>${[row.time, row.say, row.pointAt, row.boundary].map(tableCell).join('')}</tr>`)
    .join('');

const first90InterruptionRows = [
  {
    judge: 'Show me proof.',
    pivot: 'Open LEAKAGE_AUDIT.md and FINAL_CHECK_SUMMARY.md, then say the model predicts before each match and the package passed the final gate after the latest edit.'
  },
  {
    judge: 'What did you actually find?',
    pivot: 'Open FINAL_MODEL_CARD.md, then say the current best defended model is Conservative TailGuard Strong RoleV3 with 36.32 score MAE, 49.73 margin MAE, 0.1648 Brier, and 0.126 deployment score.'
  },
  {
    judge: 'Why should strategy care?',
    pivot: 'Open STRATEGY_EXAMPLE.md, then say the model gives expected score, win chance, uncertainty, and role/defense clues before the match.'
  },
  {
    judge: 'What is the caveat?',
    pivot: 'Open CLAIM_BOUNDARIES.md, then say this is the best defended local model found so far, not an oracle and not a replacement for scouts.'
  }
];

const buildFirst90InterruptionTable = () =>
  first90InterruptionRows.map(row => `<tr>${[row.judge, row.pivot].map(tableCell).join('')}</tr>`).join('');

const first90ClosingRows = [
  {
    beat: 'Discipline',
    sentence:
      'We are not selling an oracle; we are showing a disciplined way to turn match history into safer pre-match questions.'
  },
  {
    beat: 'Winner',
    sentence:
      'The current best model is Conservative TailGuard Strong RoleV3, and the package proves both why it won and what it cannot claim.'
  },
  {
    beat: 'Use',
    sentence:
      'That is why the project matters: it gives strategists a checked starting point while humans stay in charge.'
  }
];

const buildFirst90ClosingTable = () =>
  first90ClosingRows.map(row => `<tr>${[row.beat, row.sentence].map(tableCell).join('')}</tr>`).join('');

const buildFirst90SecondMarkdown = (generatedAt: string) => `# First 90 Seconds

Use this when a judge, teacher, or teammate gives you only a minute and a half. It is intentionally compact: what to say, what to open, and what not to overclaim.

Delivery target: Saturday May 23 2026 18:00 CST. If time is short, open \`ONE_PAGE_JUDGE_STORY.html\` first, then open \`index.html#start-here-story\` for proof, and use this file as the spoken route.

## Four-File Opening Card

Never hunt through the folder live. Open these files in this order, then stop when the judge has enough.

| Step | File | Presenter move |
| --- | --- | --- |
${first90OpenOrderRows
  .map(row => `| ${markdownCell(row.step)} | ${markdownCell(row.file)} | ${markdownCell(row.presenterMove)} |`)
  .join('\n')}

## Timed Script

| Time | What to say | Point at | Boundary |
| --- | --- | --- | --- |
${first90SecondRows
  .map(row => `| ${markdownCell(row.time)} | ${markdownCell(row.say)} | ${markdownCell(row.pointAt)} | ${markdownCell(row.boundary)} |`)
  .join('\n')}

## If Interrupted

| Judge says | Pivot |
| --- | --- |
${first90InterruptionRows.map(row => `| ${markdownCell(row.judge)} | ${markdownCell(row.pivot)} |`).join('\n')}

## Final 20-Second Close

Use this when the judge is done listening and you need to land the project cleanly.

| Beat | Sentence |
| --- | --- |
${first90ClosingRows.map(row => `| ${markdownCell(row.beat)} | ${markdownCell(row.sentence)} |`).join('\n')}

## One-Line Close

The model is valuable because it is disciplined before it is ambitious: no-future replay, many rejected alternatives, role-aware strategy output, and honest uncertainty around the current best-known candidate.

${buildGeneratedStamp(generatedAt)}
`;

const finalFreezeAuditRows = [
  {
    check: 'Bounded model claim',
    frozen: 'Current best-known and defensible, not unbeatable and not an oracle.',
    evidence: 'CLAIM_BOUNDARIES.md; FINAL_MODEL_CARD.md; FIRST_90_SECONDS.md',
    failure: 'Saying the model proves no better model exists.'
  },
  {
    check: 'No-future replay discipline',
    frozen: 'Every promoted historical prediction must use only known-before-match evidence.',
    evidence: 'LEAKAGE_AUDIT.md; buildWalkForwardDataset; tests/modeling.test.mjs',
    failure: 'Using final event results, final rankings, or undated external predictions as if they were pre-match inputs.'
  },
  {
    check: 'Model-selection honesty',
    frozen: 'Deployment choice depends on a multi-metric score with nonlinear overfit and stability penalties.',
    evidence: 'DEPLOYMENT_SCORING_RUBRIC.md; FINALIST_COMPARISON.md; MODEL_LEADERBOARD_APPENDIX.md',
    failure: 'Claiming one low MAE number alone justifies the promoted model.'
  },
  {
    check: 'Data-source honesty',
    frozen: 'Scout/PPC enrichment is not claimed for the final promoted model; Statbotics published predictions stay non-promotable without timestamp-safe provenance.',
    evidence: 'LIMITATIONS_AND_RISK_REGISTER.md; METHODOLOGY_APPENDIX.md; JUDGE_QA.md',
    failure: 'Pretending every available API signal was safely usable.'
  },
  {
    check: 'Strategy-use boundary',
    frozen: 'The model supports human pre-match strategy with scores, uncertainty, win probability, and role clues.',
    evidence: 'STRATEGY_EXAMPLE.md; DEFENSE_ROLE_GUIDE.md; PREDICTION_CASE_STUDIES.md',
    failure: 'Presenting the model as an automatic strategy replacement.'
  },
  {
    check: 'Presentation resilience',
    frozen: 'If live browser setup fails, the story can run from generated Markdown and verified screenshots.',
    evidence: 'OPEN_THIS_FIRST.md; LIVE_DEMO_RUNBOOK.md; dashboard-*.png',
    failure: 'Improvising unsupported claims from memory.'
  },
  {
    check: 'Package integrity',
    frozen: 'The package is regenerated, verifier-checked, screenshot-checked, and source/text fingerprints are refreshed after report edits.',
    evidence: 'VERIFICATION_SUMMARY.md; ARTIFACT_FINGERPRINTS.md; artifact-fingerprints.json',
    failure: 'Presenting stale screenshots or stale hash files after changing the package.'
  }
];

const buildFinalFreezeAuditTable = () =>
  finalFreezeAuditRows
    .map(row => `<tr>${[row.check, row.frozen, row.evidence, row.failure].map(tableCell).join('')}</tr>`)
    .join('');

const buildFinalFreezeAuditMarkdown = (generatedAt: string) => `# Final Freeze Audit

This is the pre-presentation guardrail sheet. It records what is safe to say, what file supports it, and what would make the presentation less honest.

| Check | Frozen wording or behavior | Evidence to open | Failure mode to avoid |
| --- | --- | --- | --- |
${finalFreezeAuditRows
  .map(row => `| ${markdownCell(row.check)} | ${markdownCell(row.frozen)} | ${markdownCell(row.evidence)} | ${markdownCell(row.failure)} |`)
  .join('\n')}

## Freeze Decision

The package is ready to present when \`npm run model:final-check\` passes after the latest model and wording change. That command regenerates the dashboard, refreshes browser QA and screenshots, verifies the package, type-checks the modeling code, and runs the tests. The current promoted model is Conservative TailGuard Strong RoleV3 at TW=0.22; this audit locks the updated model claim and presentation safety together.

${buildGeneratedStamp(generatedAt)}
`;

const presentationWordingRows = [
  {
    risky: 'This is the best possible model.',
    safer: 'This is the best-known defensible model from this research cycle.',
    evidence: 'FINAL_FREEZE_AUDIT.md; CLAIM_BOUNDARIES.md',
    reason: 'No finite modeling search can prove no better model exists.'
  },
  {
    risky: 'The model is accurate.',
    safer: 'The model has these measured walk-forward errors and calibration diagnostics.',
    evidence: 'FINAL_MODEL_CARD.md; DEPLOYMENT_SCORING_RUBRIC.md',
    reason: 'Accuracy needs metric, validation split, and uncertainty context.'
  },
  {
    risky: 'We used every API signal.',
    safer: 'We used timestamp-safe official and cached signals; unsafe or unmatched sources stayed out of the promoted model.',
    evidence: 'METHODOLOGY_APPENDIX.md; LIMITATIONS_AND_RISK_REGISTER.md',
    reason: 'More data is not automatically better if it leaks future information.'
  },
  {
    risky: 'We have no scout/PPC data.',
    safer: 'We have 356 matched Firebase scout rows, but they are sparse and concentrated, so they did not justify a new global model.',
    evidence: 'SCOUT_COVERAGE.md; firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md; scoutgate-check/CROSS_RUN_SUMMARY.md',
    reason: 'The old zero-scout-data caveat is superseded; the current limitation is coverage quality, not total absence.'
  },
  {
    risky: 'ScoutGate or RoleGate is the real final model.',
    safer: 'ScoutGate and RoleGate were useful rejected branches: ScoutGate helped dense scout-heavy checks, and RoleGate improved audit discipline, but neither became a confirmed replacement for the promoted model.',
    evidence: 'scoutgate-check/CROSS_RUN_SUMMARY.md; scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md; FINALIST_COMPARISON.md',
    reason: 'Judges may ask why the newest, stricter branch was not promoted; answer with holdout confirmation, not recency.'
  },
  {
    risky: 'The model tells us what strategy to run.',
    safer: 'The model supports strategy discussion with scores, uncertainty, win probability, and role clues.',
    evidence: 'STRATEGY_EXAMPLE.md; DEFENSE_ROLE_GUIDE.md',
    reason: 'Human scouting judgment still owns the final call.'
  },
  {
    risky: 'TailGuard won because its MAE was best.',
    safer: 'TailGuard was promoted because the deployment score balanced MAE, margin, Brier, calibration, tail risk, holdouts, and overfit penalties.',
    evidence: 'FINALIST_COMPARISON.md; DEPLOYMENT_SCORING_RUBRIC.md',
    reason: 'The project’s core defense is multi-objective, not single-number selection.'
  },
  {
    risky: 'An old 41.x score MAE is the current headline.',
    safer: 'Use 36.32 as the current promoted weighted score MAE; older 41.x rows are labeled historical leaderboard evidence.',
    evidence: 'FINAL_MODEL_CARD.md; HOSTILE_JUDGE_CROSS_EXAM.md; MODEL_LEADERBOARD_APPENDIX.md',
    reason: 'The final story should not mix older TailGuard-family metrics into the current headline claim.'
  },
  {
    risky: 'The scouting website has this model.',
    safer: 'The model is a local research artifact and is intentionally not bundled into the scouting website.',
    evidence: 'DELIVERABLES.md; FIRST_90_SECONDS.md',
    reason: 'Deployment scope must be clear for privacy, reliability, and judge honesty.'
  },
  {
    risky: 'Package verification proves the model is correct.',
    safer: 'Package verification proves required files, text, manifest paths, screenshot freshness/dimensions, and source/text fingerprints are internally consistent.',
    evidence: 'VERIFICATION_SUMMARY.md; ARTIFACT_FINGERPRINTS.md',
    reason: 'Artifact integrity and model truth are different claims.'
  }
];

const buildPresentationWordingAuditTable = () =>
  presentationWordingRows
    .map(row => `<tr>${[row.risky, row.safer, row.evidence, row.reason].map(tableCell).join('')}</tr>`)
    .join('');

const buildPresentationWordingAuditMarkdown = (generatedAt: string) => `# Presentation Wording Audit

This is a final stale-wording and overclaim sweep for the judge package. Use it before speaking or editing slides.

| Risky wording | Safer wording | Evidence to open | Why it matters |
| --- | --- | --- | --- |
${presentationWordingRows
  .map(row => `| ${markdownCell(row.risky)} | ${markdownCell(row.safer)} | ${markdownCell(row.evidence)} | ${markdownCell(row.reason)} |`)
  .join('\n')}

## Presentation Rule

Every strong sentence should have a nearby evidence file and a nearby limitation. If it has neither, soften the sentence or remove it.

${buildGeneratedStamp(generatedAt)}
`;

const coldReaderRows = [
  {
    minute: '0-1',
    action: 'Open ONE_PAGE_JUDGE_STORY.html and read the one-page adventure.',
    success: 'You can name the promoted model, the basic reason it won, and the four headline metrics without explaining every chart.',
    skip: 'Do not start in the proof dashboard yet.'
  },
  {
    minute: '1-2',
    action: 'Open index.html#start-here-story, FIRST_90_SECONDS.md, and JUDGE_STORY_SPINE.md.',
    success: 'You can move from the short story to the checked dashboard route without hunting through the folder.',
    skip: 'Do not jump into implementation files yet.'
  },
  {
    minute: '2-3',
    action: 'Open FINAL_FREEZE_AUDIT.md and PRESENTATION_WORDING_AUDIT.md.',
    success: 'You know the safe claims and the phrases to avoid before answering questions.',
    skip: 'Do not say best possible, oracle, or fully deployed.'
  },
  {
    minute: '3-4',
    action: 'Open FINALIST_COMPARISON.md and DEPLOYMENT_SCORING_RUBRIC.md.',
    success: 'You can explain why the chosen model beat alternatives by a multi-metric rule.',
    skip: 'Do not quote MAE alone.'
  },
  {
    minute: '4-5',
    action: 'Open STRATEGY_EXAMPLE.md and DEFENSE_ROLE_GUIDE.md.',
    success: 'You can show how the model supports a pre-match strategy conversation.',
    skip: 'Do not imply the model replaces scouts or drive-team judgment.'
  },
  {
    minute: 'After 5',
    action: 'Use MODEL_SOURCE_MAP.md, LEAKAGE_AUDIT.md, and METHODOLOGY_APPENDIX.md for deeper technical questions.',
    success: 'You can move from story to audit trail without hunting through the folder.',
    skip: 'Do not start here unless the judge asks for code or leakage details.'
  }
];

const buildColdReaderRouteTable = () =>
  coldReaderRows
    .map(row => `<tr>${[row.minute, row.action, row.success, row.skip].map(tableCell).join('')}</tr>`)
    .join('');

const buildColdReaderRouteMarkdown = (generatedAt: string) => `# Cold Reader Route

This is the first-five-minutes route for someone who opens the final package with no context. It is designed to reduce friction, not add another rabbit hole. Start with \`ONE_PAGE_JUDGE_STORY.html\`, then move to \`START_HERE_STORY.html\` or \`index.html#start-here-story\` only when the reader asks for proof.

| Time | Do this | You are ready when | Do not open first |
| --- | --- | --- | --- |
${coldReaderRows
  .map(row => `| ${markdownCell(row.minute)} | ${markdownCell(row.action)} | ${markdownCell(row.success)} | ${markdownCell(row.skip)} |`)
  .join('\n')}

## Cold Reader Rule

The first pass should answer three questions only: what is the model, why is the validation honest, and how would it help strategy? Everything else is backup evidence.

${buildGeneratedStamp(generatedAt)}
`;

const hostileJudgeRows = [
  {
    question: "Isn't this just overfitting to old matches?",
    answer:
      'That is the main failure mode we designed against: no-future replay, event-key holdouts, nonlinear overfit penalties, and rejected attractive variants.',
    evidence: 'LEAKAGE_AUDIT.md; DEPLOYMENT_SCORING_RUBRIC.md; FINALIST_COMPARISON.md',
    doNotSay: 'Overfitting is impossible.'
  },
  {
    question: 'Why did you not just use a neural network?',
    answer:
      'Neural models were allowed but not promoted because simpler models won the defensible validation story; complexity only counts if it survives holdouts and diagnostics.',
    evidence: 'MODEL_LEADERBOARD_APPENDIX.md; MODEL_JOURNEY_TIMELINE.md; CLAIM_BOUNDARIES.md',
    doNotSay: 'Neural networks are bad.'
  },
  {
    question: 'Is a 36.32 score MAE actually useful?',
    answer:
      'It is not an oracle score; it is useful because it gives calibrated expectations, uncertainty, win probability, and role/defense context before a match.',
    evidence: 'FINAL_MODEL_CARD.md; STRATEGY_EXAMPLE.md; PREDICTION_CASE_STUDIES.md',
    doNotSay: 'It predicts exact scores reliably.'
  },
  {
    question: 'Did you use future Statbotics or TBA data by accident?',
    answer:
      'Promoted features are restricted to timestamp-safe known-before-match data; undated Statbotics prediction rows stay non-promotable.',
    evidence: 'LEAKAGE_AUDIT.md; METHODOLOGY_APPENDIX.md; tests/modeling.test.mjs',
    doNotSay: 'Every Statbotics field was safe.'
  },
  {
    question: 'Where is your own scout/PPC data?',
    answer:
      'The pipeline now has 356 matched Firebase scout observations, mostly from 2026mnum. That is useful evidence, but too sparse and concentrated to claim universal scout-driven improvement.',
    evidence: 'LIMITATIONS_AND_RISK_REGISTER.md; JUDGE_QA.md; METHODOLOGY_APPENDIX.md',
    doNotSay: 'Scout data broadly improved the final model.'
  },
  {
    question: 'If ScoutGate and RoleGate are newer, why not promote them?',
    answer:
      'Recency is not the promotion rule. ScoutGate helped dense scout-heavy checks and RoleGate tightened a role-feature audit path, but their holdout evidence did not confirm a replacement for Conservative TailGuard Strong RoleV3.',
    evidence: 'scoutgate-check/CROSS_RUN_SUMMARY.md; scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md; FINALIST_COMPARISON.md',
    doNotSay: 'The newest experiment is automatically the best model.'
  },
  {
    question: 'If the package changed this late, why should judges trust it?',
    answer:
      'The late changes were audited, not hidden: they tightened routes, stale diagnostics, wording guards, and screenshots, and every final edit reran dashboard generation, browser QA, typecheck, tests, and verifier passes.',
    evidence: 'MODELING_RESEARCH_LOG.md; FINAL_CHECK_SUMMARY.md; VERIFICATION_SUMMARY.md; browser-qa-summary.json',
    doNotSay: 'The first finished version was perfect.'
  },
  {
    question: 'Why trust defense/role logic without perfect defense labels?',
    answer:
      'Defense is treated as net swing and uncertainty, not a magic label: opponent suppression, lost offense, foul risk, and confidence stay separate.',
    evidence: 'DEFENSE_ROLE_GUIDE.md; STRATEGY_EXAMPLE.md; MODEL_ANATOMY.md',
    doNotSay: "The model knows a team's exact defensive intent."
  },
  {
    question: 'What would you do next if you had more time?',
    answer:
      'Collect broader timestamped scout/PPC observations, timestamp-safe external snapshots, and more event-specific role evidence; not just add another tiny TailGuard tweak.',
    evidence: 'LIMITATIONS_AND_RISK_REGISTER.md; FINAL_FREEZE_AUDIT.md; MODEL_SOURCE_MAP.md',
    doNotSay: 'Nothing could improve it.'
  }
];

const buildHostileJudgeCrossExamTable = () =>
  hostileJudgeRows
    .map(row => `<tr>${[row.question, row.answer, row.evidence, row.doNotSay].map(tableCell).join('')}</tr>`)
    .join('');

const buildHostileJudgeCrossExamMarkdown = (generatedAt: string) => `# Hostile Judge Cross-Exam

This is the pressure-test sheet for the questions that can make a good modeling project sound weaker if the answer is too defensive, too vague, or too proud.

| Hard question | Concise answer | Evidence to open | Do not say |
| --- | --- | --- | --- |
${hostileJudgeRows
  .map(
    row =>
      `| ${markdownCell(row.question)} | ${markdownCell(row.answer)} | ${markdownCell(row.evidence)} | ${markdownCell(row.doNotSay)} |`
  )
  .join('\n')}

## Cross-Exam Rule

When challenged, answer with evidence and boundaries in the same breath. The strongest version of this project is not "we found the perfect model"; it is "we tested many plausible models, rejected fragile ones, and can show exactly why the current model is the most defensible one we found."

${buildGeneratedStamp(generatedAt)}
`;

const finalCoherenceRows = [
  {
    topic: 'Promoted model name',
    canonical: 'Conservative TailGuard Strong RoleV3 is the current best defended local model from this research cycle.',
    check: 'index.html; FINAL_MODEL_CARD.md; FINALIST_COMPARISON.md; OPEN_THIS_FIRST.md',
    avoid: 'Do not call it the best possible model or an unbeatable final answer.'
  },
  {
    topic: 'Headline dashboard metrics',
    canonical: 'Use the dashboard package metrics together: weighted score MAE 36.32, margin MAE 49.73, Brier 0.1648, deployment score 0.126.',
    check: 'index.html; JUDGE_WALKTHROUGH.md; PRINTABLE_HANDOUT.md; VERIFICATION_SUMMARY.md',
    avoid: 'Do not mix older smoke-run metrics or cross-report deployment scores into the opening claim without context.'
  },
  {
    topic: 'No-future validation rule',
    canonical: 'Every promoted prediction is made before the match updates team memory, residual correction, or TailGuard evidence.',
    check: 'LEAKAGE_AUDIT.md; METHODOLOGY_APPENDIX.md; tests/modeling.test.mjs',
    avoid: 'Do not say every API field was automatically safe or used in the final model.'
  },
  {
    topic: 'Scout/PPC honesty',
    canonical:
      'The pipeline now has 356 matched Firebase scout observations, mostly concentrated in 2026mnum, and the Firebase-enriched replay did not justify changing the final promoted claim.',
    check: 'LIMITATIONS_AND_RISK_REGISTER.md; JUDGE_QA.md; HOSTILE_JUDGE_CROSS_EXAM.md',
    avoid: 'Do not claim scout data broadly improved this final model; cite the sparse-coverage audit and enrichment replay instead.'
  },
  {
    topic: 'Defense and role claim',
    canonical: 'Defense is modeled as expected net swing with uncertainty: suppression value minus lost offense and foul-risk exposure.',
    check: 'DEFENSE_ROLE_GUIDE.md; MODEL_ANATOMY.md; STRATEGY_EXAMPLE.md',
    avoid: 'Do not say the model knows a drive team will choose defense in a future match.'
  },
  {
    topic: 'Model-selection honesty',
    canonical: 'The chosen model wins the current defensible balance of score error, margin error, Brier, stability, and overfit penalties.',
    check: 'FINALIST_COMPARISON.md; DEPLOYMENT_SCORING_RUBRIC.md; MODEL_LEADERBOARD_APPENDIX.md',
    avoid: 'Do not rank models by score MAE alone.'
  },
  {
    topic: 'Package integrity',
    canonical:
      'The generated dashboard, manifest paths, required body/header text, browser-QA freshness, screenshot dimensions, and source/text fingerprints pass the local verifier.',
    check: 'QA_CHECKLIST.md; VERIFICATION_SUMMARY.md; ARTIFACT_FINGERPRINTS.md; artifact-fingerprints.json',
    avoid: 'Do not say package verification proves the model itself is correct.'
  },
  {
    topic: 'Next-work claim',
    canonical: 'Best next data sources are broader timestamped scout/PPC observations and timestamp-safe external snapshots, not another cosmetic TailGuard tweak.',
    check: 'LIMITATIONS_AND_RISK_REGISTER.md; HOSTILE_JUDGE_CROSS_EXAM.md; MODEL_SOURCE_MAP.md',
    avoid: 'Do not say there is nothing left that could improve the model.'
  }
];

const buildFinalCoherenceAuditTable = () =>
  finalCoherenceRows
    .map(row => `<tr>${[row.topic, row.canonical, row.check, row.avoid].map(tableCell).join('')}</tr>`)
    .join('');

const buildFinalCoherenceAuditMarkdown = (generatedAt: string) => `# Final Coherence Audit

This is the final consistency pass for the judge package. It keeps old experiment numbers, dashboard numbers, limitations, hostile answers, and live wording from drifting into different stories.

| Topic | Canonical wording | Files to cross-check | Drift to avoid |
| --- | --- | --- | --- |
${finalCoherenceRows
  .map(
    row =>
      `| ${markdownCell(row.topic)} | ${markdownCell(row.canonical)} | ${markdownCell(row.check)} | ${markdownCell(row.avoid)} |`
  )
  .join('\n')}

## Coherence Rule

The package should sound like one honest project everywhere: current best defended local model, known-before-match replay, useful but imperfect score distributions, explicit scout/PPC limits, strategy support instead of strategy automation, and verification of the package rather than proof of perfection.

${buildGeneratedStamp(generatedAt)}
`;

const finalPresentationLockRows = [
  {
    gate: 'Model claim locked',
    locked: 'Present Conservative TailGuard Strong RoleV3 as the current best defended local model, with score MAE 36.32, margin MAE 49.73, Brier 0.1648, and deployment score 0.126.',
    evidence: 'FINAL_COHERENCE_AUDIT.md; FINAL_MODEL_CARD.md; index.html',
    reopen: 'Only reopen if a new no-future replay plus holdout diagnostics beats the current model without worse overfit evidence.'
  },
  {
    gate: 'Artifact set locked',
    locked:
      'Use the generated dashboard folder as the handoff package: HTML, Markdown evidence files, deliverables manifest, source/text fingerprints, browser QA summary, and screenshots.',
    evidence: 'DELIVERABLES.md; deliverables.json; ARTIFACT_FINGERPRINTS.md',
    reopen: 'Reopen if any generated file, dashboard source, model source, docs source, or screenshot changes.'
  },
  {
    gate: 'Verification gate locked',
    locked: 'The handoff package must pass typecheck, tests, model dashboard generation, the repeatable browser-QA screenshot refresh command, and dashboard verification after the last edit.',
    evidence: 'VERIFICATION_SUMMARY.md; QA_CHECKLIST.md; browser-qa-summary.json',
    reopen: 'Reopen if commands are rerun after edits and any result changes, fails, or becomes stale.'
  },
  {
    gate: 'Screenshots locked',
    locked:
      'Desktop hero, one-page judge story, start-here story, mobile first-screen, print-preview, source-code evidence, final-gate, starred-coverage, story-spine, model-anatomy, accuracy-stats, model-scores, mobile full-page, and desktop full-page screenshots are the visual fallback if the live browser demo fails.',
    evidence:
      'dashboard-hero-screenshot.png; one-page-judge-story-screenshot.png; start-here-story-screenshot.png; dashboard-mobile-hero-screenshot.png; dashboard-print-preview-screenshot.png; dashboard-source-evidence-screenshot.png; dashboard-final-gate-screenshot.png; dashboard-starred-coverage-screenshot.png; dashboard-story-spine-screenshot.png; dashboard-model-anatomy-screenshot.png; dashboard-accuracy-stats-screenshot.png; dashboard-model-scores-screenshot.png; dashboard-mobile-screenshot.png; dashboard-fullpage-screenshot.png',
    reopen: 'Reopen if layout, copy, charts, generated HTML, viewport QA, or screenshot dimensions change.'
  },
  {
    gate: 'Presentation route locked',
    locked:
      'Start at ONE_PAGE_JUDGE_STORY.html, move to START_HERE_STORY.html or index.html#start-here-story for dashboard proof, use FIRST_90_SECONDS.md for the opening, FINAL_COHERENCE_AUDIT.md for consistency, and HOSTILE_JUDGE_CROSS_EXAM.md for hard questions.',
    evidence: 'ONE_PAGE_JUDGE_STORY.html; START_HERE_STORY.html; OPEN_THIS_FIRST.md; FIRST_90_SECONDS.md; FINAL_COHERENCE_AUDIT.md; HOSTILE_JUDGE_CROSS_EXAM.md',
    reopen: 'Reopen if the live presentation order changes or a judge-facing file becomes too long to use under time pressure.'
  },
  {
    gate: 'Story and metric safeguards locked',
    locked:
      'The Judge Decision Trail must stay in the fast story route, and the Current Metric Note must keep older 41.48/57.05/0.1634/0.130 checkpoints labeled as audit history.',
    evidence: 'ONE_PAGE_JUDGE_STORY.md; START_HERE_STORY.md; OPEN_THIS_FIRST.md; MODELING_RESEARCH_LOG.md',
    reopen: 'Reopen if the story route loses the because/revealed/next-move chain or if old headline metrics can be mistaken for the current 36.32/49.73/0.1648/0.126 claim.'
  },
  {
    gate: 'Do-not-claim list locked',
    locked: 'Do not say best possible model, exact-score oracle, scout/PPC improved final model, every API field was safe, or verifier proves model correctness.',
    evidence: 'PRESENTATION_WORDING_AUDIT.md; CLAIM_BOUNDARIES.md; HOSTILE_JUDGE_CROSS_EXAM.md',
    reopen: 'Reopen if any new wording in the package contradicts these boundaries.'
  },
  {
    gate: 'Local-only boundary locked',
    locked: 'The research model is local and judge-facing; it is not deployed inside the scouting website or Firebase hosting bundle.',
    evidence: 'DELIVERABLES.md; README.md; REPRODUCIBILITY_RUNBOOK.md',
    reopen: 'Reopen if the model is promoted into the website, Firebase, or a scouting workflow.'
  }
];

const buildFinalPresentationLockTable = () =>
  finalPresentationLockRows
    .map(row => `<tr>${[row.gate, row.locked, row.evidence, row.reopen].map(tableCell).join('')}</tr>`)
    .join('');

const buildFinalPresentationLockMarkdown = (generatedAt: string) => `# Final Presentation Lock

This is the handoff lock for the judge package. It records what is safe to present now and what would force the package back into regeneration, screenshot refresh, and verification.

| Gate | Locked state | Evidence | Reopen if |
| --- | --- | --- | --- |
${finalPresentationLockRows
  .map(
    row =>
      `| ${markdownCell(row.gate)} | ${markdownCell(row.locked)} | ${markdownCell(row.evidence)} | ${markdownCell(row.reopen)} |`
  )
  .join('\n')}

## Lock Rule

This is not a claim that the model can never improve. It is a presentation lock: if the package changes, regenerate, refresh screenshots, rerun the verifier and tests, then treat the new outputs as the locked handoff.

${buildGeneratedStamp(generatedAt)}
`;

const screenshotProofRows = [
  {
    proof: 'Desktop hero',
    file: 'dashboard-hero-screenshot.png',
    purpose: 'First-screen desktop handoff: verdict, deadline target, final gate, and claim boundary.',
    verifierRule: 'Fresh PNG, at least 1200x700.'
  },
  {
    proof: 'Start-here story',
    file: 'start-here-story-screenshot.png',
    purpose: 'Standalone proof that the plain-English model adventure renders cleanly before the full dashboard.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Mobile first screen',
    file: 'dashboard-mobile-hero-screenshot.png',
    purpose: 'Readable mobile opening fallback, separate from the very tall mobile full-page audit.',
    verifierRule: 'Fresh PNG, at least 700x1000.'
  },
  {
    proof: 'Print preview',
    file: 'dashboard-print-preview-screenshot.png',
    purpose: 'Document-style HTML report proof under the print stylesheet.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Source evidence',
    file: 'dashboard-source-evidence-screenshot.png',
    purpose: 'Focused proof that source-code paths and hash evidence render in the HTML.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Final gate',
    file: 'dashboard-final-gate-screenshot.png',
    purpose: 'Focused proof that human summary, machine summary, second verifier, and checklist render together.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Starred coverage',
    file: 'dashboard-starred-coverage-screenshot.png',
    purpose: 'Focused proof that every starred prompt item is mapped to an HTML section.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Story spine',
    file: 'dashboard-story-spine-screenshot.png',
    purpose: 'Focused proof that the judge-ready narrative and evidence path render cleanly.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Model anatomy',
    file: 'dashboard-model-anatomy-screenshot.png',
    purpose: 'Focused proof of the promoted model visualization and data-flow map.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Accuracy stats',
    file: 'dashboard-accuracy-stats-screenshot.png',
    purpose: 'Focused proof of score-vs-actual and calibration visualizations.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Model scores',
    file: 'dashboard-model-scores-screenshot.png',
    purpose: 'Focused proof that alternative model scores and leaderboard evidence render.',
    verifierRule: 'Fresh PNG, at least 1200x800.'
  },
  {
    proof: 'Mobile full page',
    file: 'dashboard-mobile-screenshot.png',
    purpose: 'Tall mobile viewport fallback and mobile overflow evidence.',
    verifierRule: 'Fresh PNG, at least 700x1600.'
  },
  {
    proof: 'Desktop full page',
    file: 'dashboard-fullpage-screenshot.png',
    purpose: 'Long-form desktop visual fallback for the complete generated report.',
    verifierRule: 'Fresh PNG, at least 1200x3000.'
  }
];

const buildScreenshotProofRows = () =>
  screenshotProofRows
    .map(row => `<tr>${[row.proof, row.file, row.purpose, row.verifierRule].map(tableCell).join('')}</tr>`)
    .join('');

const documentationProofRows = [
  {
    group: 'Long-form journey',
    files: 'modeling/MODELING_RESEARCH_LOG.md; MODEL_JOURNEY_TIMELINE.md',
    proves: 'The project history, checkpoints, rejected branches, and final model path are documented outside the dashboard copy.',
    audit: 'Source/text fingerprints plus copy-quality checks protect the generated narrative files.'
  },
  {
    group: 'Cold handoff',
    files: 'OPEN_THIS_FIRST.md; JUDGE_WALKTHROUGH.md; FIRST_90_SECONDS.md; PRINTABLE_HANDOUT.md',
    proves: 'A teacher, teammate, or judge can understand the package quickly without reading every artifact first.',
    audit: 'The verifier requires the one-command final gate and headline model claim in first-open docs.'
  },
  {
    group: 'Model explanation',
    files: 'FINAL_MODEL_CARD.md; MODEL_ANATOMY.md; MODEL_SOURCE_MAP.md; FINALIST_COMPARISON.md',
    proves: 'The promoted model, pipeline visualization, source-code route, and finalist decision are explained in reusable Markdown.',
    audit: 'Dashboard and verifier require matching model name, metrics, source paths, and bounded model wording.'
  },
  {
    group: 'Scores and metrics',
    files: 'MODEL_LEADERBOARD_APPENDIX.md; METRIC_GLOSSARY.md; DEPLOYMENT_SCORING_RUBRIC.md',
    proves: 'Alternative model scores, metric definitions, and promotion rules are documented beyond a single chart.',
    audit: 'Generated from saved report artifacts and checked for stale or overconfident wording.'
  },
  {
    group: 'Integrity and safety',
    files: 'LEAKAGE_AUDIT.md; CLAIM_BOUNDARIES.md; PRESENTATION_WORDING_AUDIT.md; FINAL_COHERENCE_AUDIT.md',
    proves: 'No-future validation, safe claims, and cross-file consistency are documented explicitly.',
    audit: 'Verifier scans generated Markdown for overclaim language and stale scout/PPC wording.'
  },
  {
    group: 'Presentation defense',
    files: 'HOSTILE_JUDGE_CROSS_EXAM.md; JUDGE_QA.md; JUDGE_RUBRIC_ALIGNMENT.md; MOCK_JUDGE_PANEL_BRIEF.md',
    proves: 'Hard questions, rubric alignment, and judge-personality pressure cases are prepared.',
    audit: 'The final package map and reference audit keep these files visible in the handoff route.'
  },
  {
    group: 'Strategy usefulness',
    files: 'STRATEGY_EXAMPLE.md; PREDICTION_CASE_STUDIES.md; DEFENSE_ROLE_GUIDE.md; FAILURE_MODE_ATLAS.md',
    proves: 'The model is connected to practical match strategy while preserving failure-mode honesty.',
    audit: 'Generated from saved prediction and residual artifacts instead of live improvisation.'
  },
  {
    group: 'Verification and rerun',
    files: 'REPRODUCIBILITY_RUNBOOK.md; QA_CHECKLIST.md; FINAL_READINESS_CHECK.md; FINAL_CHECK_SUMMARY.md',
    proves: 'The package explains how to regenerate, browser-check, verify, and present the final state.',
    audit: 'The final gate writes human and machine proof, then reruns the verifier after the proof exists.'
  },
  {
    group: 'Artifact inventory',
    files: 'DELIVERABLES.md; EVIDENCE_MATRIX.md; REFERENCE_INTEGRITY_AUDIT.md; ARTIFACT_FINGERPRINTS.md',
    proves: 'Claims, files, references, and source/text fingerprints are mapped for audit.',
    audit: 'Manifest coverage and reference-target checks fail if important listed files disappear.'
  }
];

const buildDocumentationProofRows = () =>
  documentationProofRows
    .map(row => `<tr>${[row.group, row.files, row.proves, row.audit].map(tableCell).join('')}</tr>`)
    .join('');

const referenceIntegrityRows = [
  {
    label: 'Best model code',
    target: 'modeling/src/modeling/train.ts',
    why: 'Defines the promoted RoleV3 and TailGuard model candidates.'
  },
  {
    label: 'Walk-forward features',
    target: 'modeling/src/modeling/features.ts',
    why: 'Builds known-before-match feature rows and updates team state after each match.'
  },
  {
    label: 'Dashboard generator',
    target: 'modeling/src/reporting/judgeDashboard.ts',
    why: 'Generates the judge-facing HTML and Markdown package.'
  },
  {
    label: 'Dashboard verifier',
    target: 'modeling/src/reporting/verifyDashboard.ts',
    why: 'Checks required files, visible strings, manifests, reference targets, browser-QA freshness, screenshots, and source/text fingerprints.'
  },
  {
    label: 'Dashboard browser QA command',
    target: 'modeling/src/reporting/browserQaDashboard.ts',
    why: 'Starts a local dashboard server, checks Chrome render output, refreshes browser-qa-summary.json, and writes the fourteen screenshots.'
  },
  {
    label: 'Model tests',
    target: 'tests/modeling.test.mjs',
    why: 'Exercises no-future features, audits, model search, reports, and security hygiene.'
  },
  {
    label: 'Research log',
    target: 'modeling/MODELING_RESEARCH_LOG.md',
    why: 'Records the modeling journey, reflections, rejected branches, and current stance.'
  },
  {
    label: 'Current selective TailGuard evidence',
    target: 'modeling/artifacts/reports/role-v3-selective-tailguard-check/CROSS_RUN_SUMMARY.md',
    why: 'Explains why SelectiveTailGuard was not promoted.'
  },
  {
    label: 'Current TailGuard evidence',
    target: 'modeling/artifacts/reports/role-v3-tailguard-check/CROSS_RUN_SUMMARY.md',
    why: 'Supports the conservative TailGuard deployment-rule point candidate.'
  },
  {
    label: 'TailGuard micro-sensitivity report',
    target: 'modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md',
    why: 'Combines two refreshed full replays and five event-key holdouts for the TW=0.18/TW=0.21/TW=0.22/TW=0.23/TW=0.25 sensitivity pass.'
  },
  {
    label: 'Micro-sensitivity 2026 replay',
    target: 'modeling/artifacts/runs/current-2026-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows TW=0.22 ranked first in the exact 2026 replay before holdout confirmation.'
  },
  {
    label: 'Broad micro-sensitivity replay',
    target: 'modeling/artifacts/runs/current-2024-2026-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows TW=0.22 also ranked first in the 2024-2026 replay.'
  },
  {
    label: 'Micro-sensitivity manifest',
    target: 'modeling/experiments/current-2024-2026-role-v3-tailguard-micro-sensitivity.json',
    why: 'Locks the exact broad candidate list used for the TW=0.22 promotion check.'
  },
  {
    label: 'Micro-sensitivity holdout bucket 0',
    target: 'modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows TW=0.25 beat TW=0.22 in one held-out event-key bucket.'
  },
  {
    label: 'Micro-sensitivity holdout bucket 1',
    target: 'modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows the stronger TW=0.35 challenger and why the final review remains mixed.'
  },
  {
    label: 'Micro-sensitivity holdout bucket 2',
    target: 'modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows another held-out bucket where TW=0.25 led the rank table.'
  },
  {
    label: 'Micro-sensitivity holdout bucket 3',
    target: 'modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Shows the largest held-out bucket in the micro-sensitivity confirmation pass.'
  },
  {
    label: 'Micro-sensitivity holdout bucket 4',
    target: 'modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
    why: 'Keeps the cautionary bucket visible: plain Strong RoleV3 still wins one held-out slice.'
  },
  {
    label: 'Scout coverage audit',
    target: 'modeling/artifacts/audits/scout-coverage/SCOUT_COVERAGE.md',
    why: 'Documents matched Firebase scout coverage and why it remains sparse/concentrated.'
  },
  {
    label: 'Firebase scout enrichment check',
    target: 'modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md',
    why: 'Shows that sparse scout enrichment did not promote a new final point model.'
  },
  {
    label: 'ScoutGate check',
    target: 'modeling/artifacts/reports/scoutgate-check/CROSS_RUN_SUMMARY.md',
    why: 'Shows that coverage-aware scout gating is promising but fragmented across holdouts.'
  },
  {
    label: 'RoleGate check',
    target: 'modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md',
    why: 'Shows that stricter scout-gated role features improve auditability but do not confirm a new final model.'
  },
  {
    label: 'Statbotics provenance audit',
    target: 'modeling/artifacts/audits/statbotics-prediction-provenance/AUDIT.md',
    why: 'Documents why undated public Statbotics prediction rows remain non-promotable.'
  },
  {
    label: 'Final dashboard HTML',
    target: 'modeling/artifacts/reports/final-judge-dashboard/index.html',
    why: 'Primary judge-facing report.'
  },
  {
    label: 'One-page judge story HTML',
    target: 'modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.html',
    why: 'Fastest single-page route for a busy judge before opening the proof dashboard.'
  },
  {
    label: 'One-page judge story Markdown',
    target: 'modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.md',
    why: 'Copyable short story with the final metrics, caveat, and proof route.'
  },
  {
    label: 'Final presentation lock',
    target: 'modeling/artifacts/reports/final-judge-dashboard/FINAL_PRESENTATION_LOCK.md',
    why: 'Defines the locked handoff state and regeneration triggers.'
  },
  {
    label: 'Final coherence audit',
    target: 'modeling/artifacts/reports/final-judge-dashboard/FINAL_COHERENCE_AUDIT.md',
    why: 'Keeps model name, metrics, limitations, and claim boundaries consistent.'
  },
  {
    label: 'Browser QA summary',
    target: 'modeling/artifacts/reports/final-judge-dashboard/browser-qa-summary.json',
    why: 'Records required body/header text, overflow, console, page-error, and screenshot checks from npm run model:qa-dashboard.'
  },
  {
    label: 'Hero screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-hero-screenshot.png',
    why: 'Visual fallback for the dashboard opening.'
  },
  {
    label: 'Mobile first-screen screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-mobile-hero-screenshot.png',
    why: 'Readable mobile opening fallback for presentation and first-screen layout proof.'
  },
  {
    label: 'Print-preview screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-print-preview-screenshot.png',
    why: 'Visual proof that the HTML report renders under the print stylesheet for document-style handoff.'
  },
  {
    label: 'Source evidence screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-source-evidence-screenshot.png',
    why: 'Focused visual proof that the source-code evidence lock renders with the audited source paths and hashes.'
  },
  {
    label: 'Final gate screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-final-gate-screenshot.png',
    why: 'Focused visual proof that the final gate route renders the human and machine proof cards plus the verification checklist.'
  },
  {
    label: 'Starred coverage screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-starred-coverage-screenshot.png',
    why: 'Focused visual proof that every starred prompt deliverable is mapped to an HTML dashboard section.'
  },
  {
    label: 'Story spine screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-story-spine-screenshot.png',
    why: 'Focused visual proof that the judge-ready narrative route renders with proof files and watch-outs beside each claim.'
  },
  {
    label: 'Model anatomy screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-model-anatomy-screenshot.png',
    why: 'Focused visual proof that the promoted model pipeline renders as a best-model visualization in the HTML dashboard.'
  },
  {
    label: 'Accuracy stats screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-accuracy-stats-screenshot.png',
    why: 'Focused visual proof that the score-vs-actual and calibration charts render as the accuracy-and-stats visualization.'
  },
  {
    label: 'Model scores screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-model-scores-screenshot.png',
    why: 'Focused visual proof that the model leaderboard and alternative-model scores render in the HTML dashboard.'
  },
  {
    label: 'Mobile full-page screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-mobile-screenshot.png',
    why: 'Mobile full-page viewport fallback and overflow evidence.'
  },
  {
    label: 'Full-page screenshot',
    target: 'modeling/artifacts/reports/final-judge-dashboard/dashboard-fullpage-screenshot.png',
    why: 'Long-form visual fallback for the generated dashboard.'
  },
  {
    label: 'Deliverables manifest',
    target: 'modeling/artifacts/reports/final-judge-dashboard/deliverables.json',
    why: 'Machine-readable map of final package artifacts.'
  },
  {
    label: 'Artifact fingerprints',
    target: 'modeling/artifacts/reports/final-judge-dashboard/artifact-fingerprints.json',
    why: 'Machine-readable SHA-256 identity map for source and generated text artifacts.'
  }
];

const referenceTargetExists = (target: string) => {
  if (target.includes('*')) {
    const directory = path.resolve(path.dirname(target));
    if (!fs.existsSync(directory)) return false;
    const pattern = new RegExp(`^${path.basename(target).replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
    return fs.readdirSync(directory).some(fileName => pattern.test(fileName));
  }
  return fs.existsSync(path.resolve(target));
};

const buildReferenceIntegrityTable = () =>
  referenceIntegrityRows
    .map(row => `<tr>${[row.label, row.target, referenceTargetExists(row.target) ? 'Present' : 'Missing', row.why].map(tableCell).join('')}</tr>`)
    .join('');

const buildReferenceIntegrityMarkdown = (generatedAt: string) => `# Reference Integrity Audit

This audit lists the local files that the final judge package depends on most heavily. It is intentionally narrow: it checks the references judges are most likely to open, not every phrase in every paragraph.

| Reference | Target | Status at generation | Why it matters |
| --- | --- | --- | --- |
${referenceIntegrityRows
  .map(
    row =>
      `| ${markdownCell(row.label)} | ${markdownCell(row.target)} | ${referenceTargetExists(row.target) ? 'Present' : 'Missing'} | ${markdownCell(row.why)} |`
  )
  .join('\n')}

## Reference Rule

If any target is missing, do not present from memory. Regenerate the package, restore the missing artifact, or remove the claim that points to it.

${buildGeneratedStamp(generatedAt)}
`;

const openThisFirstRows = [
  {
    moment: 'You have 30 seconds',
    open: 'ONE_PAGE_JUDGE_STORY.html, then index.html#start-here-story if they ask for proof.',
    reason: 'The one-page story gives the answer before the proof; the checked dashboard route gives the metrics backup.',
    file: 'ONE_PAGE_JUDGE_STORY.html; index.html#start-here-story'
  },
  {
    moment: 'You have 90 seconds',
    open: 'START_HERE_STORY.md, FIRST_90_SECONDS.md, then JUDGE_STORY_SPINE.md.',
    reason: 'The story gives the human arc, the timed script keeps the live explanation sharp, and the story spine preserves the full argument.',
    file: 'START_HERE_STORY.md; FIRST_90_SECONDS.md; JUDGE_STORY_SPINE.md'
  },
  {
    moment: 'A judge asks what this is',
    open: 'ONE_PAGE_JUDGE_STORY.html, START_HERE_STORY.html, then COLD_READER_ROUTE.md.',
    reason: 'The one-page story gives the human adventure first; the cold-reader route then points to the proof files.',
    file: 'ONE_PAGE_JUDGE_STORY.html; START_HERE_STORY.html; COLD_READER_ROUTE.md'
  },
  {
    moment: 'A judge asks why it is trustworthy',
    open: 'FINAL_FREEZE_AUDIT.md, PRESENTATION_WORDING_AUDIT.md, LEAKAGE_AUDIT.md, CLAIM_BOUNDARIES.md, and FINALIST_COMPARISON.md.',
    reason: 'These show frozen claim boundaries, safe wording, no-future discipline, bounded claims, and why the winner beat alternatives.',
    file: 'FINAL_FREEZE_AUDIT.md; PRESENTATION_WORDING_AUDIT.md; LEAKAGE_AUDIT.md; CLAIM_BOUNDARIES.md; FINALIST_COMPARISON.md'
  },
  {
    moment: 'A judge challenges the project',
    open: 'MOCK_JUDGE_PANEL_BRIEF.md, HOSTILE_JUDGE_CROSS_EXAM.md, then FINAL_COHERENCE_AUDIT.md.',
    reason: 'The panel brief adapts answers to judge type, the cross-exam sheet gives concise pressure-tested answers, and the coherence audit keeps old metrics and claims from drifting.',
    file: 'MOCK_JUDGE_PANEL_BRIEF.md; HOSTILE_JUDGE_CROSS_EXAM.md; FINAL_COHERENCE_AUDIT.md'
  },
  {
    moment: 'You are about to present',
    open: 'FINAL_PRESENTATION_LOCK.md, REFERENCE_INTEGRITY_AUDIT.md, then QA_CHECKLIST.md.',
    reason: 'The lock file states what is safe to present now, and the reference audit catches missing local evidence files.',
    file: 'FINAL_PRESENTATION_LOCK.md; REFERENCE_INTEGRITY_AUDIT.md; QA_CHECKLIST.md'
  },
  {
    moment: 'A judge asks how it works',
    open: 'MODEL_ANATOMY.md, MODEL_SOURCE_MAP.md, and OPR_EPA_EXPLAINER.md.',
    reason: 'These explain the architecture, the source-code audit route, and the OPR/EPA distinction.',
    file: 'MODEL_ANATOMY.md; MODEL_SOURCE_MAP.md; OPR_EPA_EXPLAINER.md'
  },
  {
    moment: 'A judge asks how it helps strategy',
    open: 'STRATEGY_EXAMPLE.md, DEFENSE_ROLE_GUIDE.md, and PREDICTION_CASE_STUDIES.md.',
    reason: 'These show actual pre-match output, defense role logic, and both useful and uncomfortable examples.',
    file: 'STRATEGY_EXAMPLE.md; DEFENSE_ROLE_GUIDE.md; PREDICTION_CASE_STUDIES.md'
  },
  {
    moment: 'Something breaks live',
    open: 'LIVE_DEMO_RUNBOOK.md, DELIVERABLES.md, and the saved screenshots.',
    reason: 'The story can continue from generated Markdown and verified images.',
    file: 'LIVE_DEMO_RUNBOOK.md; DELIVERABLES.md; dashboard-*.png'
  }
];

const buildOpenThisFirstTable = () =>
  openThisFirstRows.map(row => `<tr>${[row.moment, row.open, row.reason, row.file].map(tableCell).join('')}</tr>`).join('');

const buildOpenThisFirstMarkdown = (bestDeployment: DeploymentReviewRow, generatedAt: string) => {
  const displayName = shortModelName(bestDeployment.model);
  return `# Open This First

This is the cover sheet for the final modeling package. If a teammate, teacher, or judge opens the folder cold, start here.

## Handoff Snapshot

- Deadline target: Saturday May 23 2026 18:00 CST
- Promoted model: ${displayName}
- Internal model config: ${bestDeployment.model}
- Weighted score MAE: ${formatNumber(bestDeployment.weightedScoreMae)}
- Weighted margin MAE: ${formatNumber(bestDeployment.weightedMarginMae)}
- Weighted Brier score: ${formatNumber(bestDeployment.weightedBrier, 4)}
- Deployment score: ${formatNumber(bestDeployment.pointDeploymentScore, 3)}
- Claim boundary: best defended local model, not a perfect oracle.
- Fast final gate: \`npm run model:final-check\`

## Latest Quality Receipt

- Communication: the one-page story now has a 30-second script, a three-takeaway memory aid, and a plain-English number key.
- Story: the start-here route now has If You Remember Nothing Else, Judge Answer Finder, Model Family Cheat Sheet, and a Judge Decision Trail.
- Navigation: the answer finder maps the six fastest judge questions directly to proof files.
- Readability: the model-family cheat sheet translates dense leaderboard names before a judge opens the full score appendix.
- Modeling: the final TailGuard micro-sensitivity pass kept TW=0.22 after TW=0.21/TW=0.23 pressure.
- Consistency: the failure atlas now uses current TW=0.22 diagnostics, and historical leaderboard rows are labeled report-local.
- Metric hygiene: the research log now opens with a Current Metric Note, so older 41.48/57.05/0.1634/0.130 checkpoints stay audit history.

## Fastest Route

1. Open \`ONE_PAGE_JUDGE_STORY.html\` for the fastest human adventure.
2. Open \`START_HERE_STORY.html\` if you want the richer story before the proof wall.
3. Open \`index.html#start-here-story\` if you want the same story inside the full dashboard.
4. Read the Current Verdict and Handoff Snapshot.
5. Open \`COLD_READER_ROUTE.md\` if you are new to the package.
6. Open \`LEAKAGE_AUDIT.md\` before making any accuracy claim.
7. Open \`FINALIST_COMPARISON.md\` before explaining why this model won.
8. Open \`STRATEGY_EXAMPLE.md\` before claiming strategy usefulness.

## What To Open When

| Moment | Open | Why | File |
| --- | --- | --- | --- |
${openThisFirstRows.map(row => `| ${markdownCell(row.moment)} | ${markdownCell(row.open)} | ${markdownCell(row.reason)} | ${markdownCell(row.file)} |`).join('\n')}

## One Honest Sentence

The final model is ${displayName}: the strongest defended local model we found under no-future replay, holdout pressure, overfit penalties, and documented rejection of fragile alternatives.

${buildGeneratedStamp(generatedAt)}
`;
};

const claimBoundaryRows = [
  {
    claim: 'Current best known local model',
    safe: 'Conservative TailGuard Strong RoleV3 is the best defended point candidate found in this research cycle.',
    unsafe: 'This is the best possible FRC match model.',
    evidence: 'FINALIST_COMPARISON.md, MODEL_LEADERBOARD_APPENDIX.md, cross-run summaries'
  },
  {
    claim: 'Known-before-match discipline',
    safe: 'Walk-forward replay predicts each match before that match updates team memory or residual correction.',
    unsafe: 'Every external data source is automatically leakage-safe.',
    evidence: 'METHODOLOGY_APPENDIX.md, tests/modeling.test.mjs, modeling/src/modeling/features.ts'
  },
  {
    claim: 'Useful but small improvement',
    safe: 'The promoted model earns its place by balancing score error, margin error, Brier, stability, and overfit penalties.',
    unsafe: 'The promoted model wins by a huge margin.',
    evidence: 'DEPLOYMENT_SCORING_RUBRIC.md, FINALIST_COMPARISON.md'
  },
  {
    claim: 'Defense and role reasoning',
    safe: 'RoleV3 encodes suppression, lost offense, foul exposure, confidence, and net swing separately.',
    unsafe: 'The model proves a team will play defense in a specific future match.',
    evidence: 'MODEL_ANATOMY.md, STRATEGY_EXAMPLE.md'
  },
  {
    claim: 'Dashboard integrity',
    safe:
      'The package verifier checks files, required body/header text, manifest paths, browser-QA freshness, PNG screenshot dimensions, and source/text SHA-256 fingerprints.',
    unsafe: 'The dashboard verifier proves the model is correct.',
    evidence: 'VERIFICATION_SUMMARY.md, ARTIFACT_FINGERPRINTS.md, artifact-fingerprints.json'
  },
  {
    claim: 'Next improvement',
    safe: 'Broader matched scout/PPC rows and timestamp-safe external snapshots are the highest-value next data sources.',
    unsafe: 'More model complexity alone is the obvious next improvement.',
    evidence: 'LIMITATIONS_AND_RISK_REGISTER.md, JUDGE_QA.md'
  }
];

const buildClaimBoundaryTable = () =>
  claimBoundaryRows
    .map(row => `<tr>${[row.claim, row.safe, row.unsafe, row.evidence].map(tableCell).join('')}</tr>`)
    .join('');

const buildClaimBoundariesMarkdown = (generatedAt: string) => `# Claim Boundaries

This page is the guardrail for judge conversations. It says what the final package can defend and what we should avoid saying even if it sounds impressive.

| Topic | Safe claim | Avoid saying | Evidence to open |
| --- | --- | --- | --- |
${claimBoundaryRows.map(row => `| ${row.claim} | ${row.safe} | ${row.unsafe} | ${row.evidence} |`).join('\n')}

## The Core Boundary

The final model is not an oracle and not an unbeatable claim. It is the strongest defended local model found so far under the evidence we actually have: known-before-match replay, holdout pressure, overfit penalties, diagnostics, and documented rejection of fragile variants.

## How To Use This In Judging

When a judge presses on a weakness, answer with the safe claim first, then open the evidence file. Do not defend the model by making the claim bigger. Defend it by showing the validation rule that limited the claim.

${buildGeneratedStamp(generatedAt)}
`;

const leakageAuditRows = [
  {
    guardrail: 'Walk-forward row order',
    whatItBlocks: 'Current-match scores, outcomes, and component totals cannot enter the feature row before prediction.',
    evidence: 'Feature tests assert that rows are emitted before the current match updates team memory.',
    artifact: 'tests/modeling.test.mjs; modeling/src/modeling/features.ts'
  },
  {
    guardrail: 'Online residual correction',
    whatItBlocks: 'The residual layer cannot fit on the match it is trying to predict.',
    evidence: 'Residual corrections are updated only from prior prediction errors during replay.',
    artifact: 'FINAL_MODEL_CARD.md; modeling/src/modeling/train.ts'
  },
  {
    guardrail: 'TailGuard evidence gate',
    whatItBlocks: 'Tail corrections cannot fire just because a future event is known to be high scoring.',
    evidence: 'The promoted TailGuard is conservative and waits for prior event evidence before applying a small correction.',
    artifact: 'MODEL_ANATOMY.md; MODELING_RESEARCH_LOG.md'
  },
  {
    guardrail: 'Deterministic event-key holdouts',
    whatItBlocks: 'Rows from the same event cannot leak across random train/test splits that look independent but are not.',
    evidence: 'Holdout buckets are event-key based, and full-replay winners can be rejected when buckets disagree.',
    artifact: 'FINALIST_COMPARISON.md; MODEL_LEADERBOARD_APPENDIX.md'
  },
  {
    guardrail: 'Statbotics provenance rule',
    whatItBlocks: 'Published predictions without prediction-specific timestamps cannot become promoted features.',
    evidence: 'The provenance audit keeps undated prediction rows non-promotable.',
    artifact: 'modeling/artifacts/audits/statbotics-prediction-provenance/AUDIT.md'
  },
  {
    guardrail: 'Scout/PPC honesty rule',
    whatItBlocks: 'The model cannot pretend to use team scouting labels for events we did not actually scout and match.',
    evidence:
      'The scout coverage audit reports 356 matched Firebase observations out of 528 cached observations, mostly concentrated in 2026mnum, so final claims stay scoped to that coverage.',
    artifact: 'modeling/artifacts/audits/scout-coverage/SCOUT_COVERAGE.md; DEFENSE_ROLE_GUIDE.md'
  },
  {
    guardrail: 'Generated package verification',
    whatItBlocks: 'A stale or hand-edited final report cannot quietly replace generated evidence.',
    evidence:
      'The verifier checks required files, visible dashboard text, manifest paths, PNG dimensions, and source/text fingerprints.',
    artifact: 'VERIFICATION_SUMMARY.md; ARTIFACT_FINGERPRINTS.md'
  }
];

const buildLeakageAuditTable = () =>
  leakageAuditRows
    .map(row => `<tr>${[row.guardrail, row.whatItBlocks, row.evidence, row.artifact].map(tableCell).join('')}</tr>`)
    .join('');

const buildLeakageAuditMarkdown = (generatedAt: string) => `# Leakage Audit

This page explains how the final package tries to prevent the easiest way to fool a sports model: accidentally using information from after the match being predicted.

| Guardrail | What it blocks | Evidence | Artifact to audit |
| --- | --- | --- | --- |
${leakageAuditRows
  .map(row => `| ${markdownCell(row.guardrail)} | ${markdownCell(row.whatItBlocks)} | ${markdownCell(row.evidence)} | ${markdownCell(row.artifact)} |`)
  .join('\n')}

## Core Principle

For every historical prediction, the model must behave as if it is standing before that match. Features are built first, the model predicts, and only then can the match update team memory, residual correction, role evidence, and tail-risk state.

## Presentation Boundary

The audit does not prove that every possible future data source is safe. It proves the current local pipeline has explicit no-future rules and that unsafe sources, especially undated public predictions or unmatched scout records, are not promoted.

${buildGeneratedStamp(generatedAt)}
`;

const rubricAlignmentRows = [
  {
    lens: 'Engineering process',
    evidence: 'The project starts from a real strategy problem, builds local tooling, tests candidate models, rejects weak branches, and keeps an audit trail.',
    artifact: 'MODELING_RESEARCH_LOG.md, MODEL_JOURNEY_TIMELINE.md',
    judgeLine: 'This is not a single model drop; it is an iterative engineering process with documented decisions.'
  },
  {
    lens: 'Mathematical rigor',
    evidence: 'The leaderboard uses score MAE, margin MAE, Brier, calibration, coverage, worst-event behavior, fixed benchmarks, and nonlinear overfit penalties.',
    artifact: 'DEPLOYMENT_SCORING_RUBRIC.md, METRIC_GLOSSARY.md',
    judgeLine: 'The model is evaluated on several failure modes, not just the easiest accuracy number.'
  },
  {
    lens: 'No-leakage validation',
    evidence: 'Walk-forward replay predicts before each match updates state; timestamp-unsafe public predictions stay non-promotable.',
    artifact: 'LEAKAGE_AUDIT.md, METHODOLOGY_APPENDIX.md, OPR_EPA_EXPLAINER.md, tests/modeling.test.mjs',
    judgeLine: 'The validation method tries to simulate what we would actually know before a match.'
  },
  {
    lens: 'Iteration and reflection',
    evidence: 'RoleV2, RoleV3, TailRisk, WinCal, stronger TailGuard, and SelectiveTailGuard branches are recorded with reasons for promotion or rejection.',
    artifact: 'MODEL_LEADERBOARD_APPENDIX.md, FINALIST_COMPARISON.md, MODELING_RESEARCH_LOG.md',
    judgeLine: 'The strongest story is the documented no: several smarter-looking ideas were rejected.'
  },
  {
    lens: 'Real-world usefulness',
    evidence: 'Outputs include score distributions, win probability, uncertainty, role/defense reads, a defense role guide, and a concrete strategy example.',
    artifact: 'DEFENSE_ROLE_GUIDE.md, STRATEGY_EXAMPLE.md, PREDICTION_CASE_STUDIES.md, MODEL_ANATOMY.md',
    judgeLine: 'The model supports human strategy decisions instead of replacing drive-team and scouting judgment.'
  },
  {
    lens: 'Integrity and reproducibility',
    evidence: 'The final package is generated, verified, browser-checked, source/text-fingerprinted, and rerunnable with documented commands.',
    artifact: 'REPRODUCIBILITY_RUNBOOK.md, VERIFICATION_SUMMARY.md, ARTIFACT_FINGERPRINTS.md',
    judgeLine: 'The report is not hand-assembled; it is rebuilt from saved artifacts and checked before presentation.'
  },
  {
    lens: 'Honesty and safety',
    evidence: 'Claim boundaries, risk register, and Q&A explicitly name near-ties, sparse scout rows, timestamp limits, and overuse risk.',
    artifact: 'CLAIM_BOUNDARIES.md, LIMITATIONS_AND_RISK_REGISTER.md, JUDGE_QA.md',
    judgeLine: 'We protect the project by limiting the claim to what the evidence can support.'
  },
  {
    lens: 'Communication',
    evidence: 'The package includes a dashboard, handout, presentation script, walkthrough, model anatomy visual, glossary, and final package map.',
    artifact: 'index.html, PRINTABLE_HANDOUT.md, PRESENTATION_SCRIPT.md, JUDGE_WALKTHROUGH.md',
    judgeLine: 'The technical work is translated into a route judges can inspect quickly.'
  }
];

const buildRubricAlignmentTable = () =>
  rubricAlignmentRows
    .map(row => `<tr>${[row.lens, row.evidence, row.artifact, row.judgeLine].map(tableCell).join('')}</tr>`)
    .join('');

const buildRubricAlignmentMarkdown = (generatedAt: string) => `# Judge Rubric Alignment

This page translates the modeling work into judging language. It is not a separate claim; it is a map from the evidence package to the qualities judges and teachers usually reward.

| Lens | Evidence in this project | Artifact to open | Short judge line |
| --- | --- | --- | --- |
${rubricAlignmentRows.map(row => `| ${row.lens} | ${row.evidence} | ${row.artifact} | ${row.judgeLine} |`).join('\n')}

## Best Framing

The project should be presented as an engineering research journey: build the local data pipeline, define a no-leakage replay rule, test many model ideas, punish overfit symptoms, promote the most defensible current model, and document the limitations clearly enough that another person could rerun or challenge the result.

## What Makes This Judge-Ready

The strongest judge-facing value is not a single metric. It is the combination of a usable model, a validation system that changed decisions, a generated evidence package, and clear boundaries around what the model can and cannot prove.

${buildGeneratedStamp(generatedAt)}
`;

const liveDemoRows = [
  {
    step: '0. Before judges arrive',
    action: 'Run the local server and open ONE_PAGE_JUDGE_STORY.html.',
    say: 'I have a local research dashboard. The model is not deployed inside our scouting website.',
    evidence: 'ONE_PAGE_JUDGE_STORY.html; index.html; REPRODUCIBILITY_RUNBOOK.md'
  },
  {
    step: '1. Story first',
    action: 'Read the one-page adventure, then point at the four metric cards.',
    say: 'Our current best model is Conservative TailGuard Strong RoleV3. It is our best defended model, not an oracle, and it won by surviving realistic validation.',
    evidence: 'ONE_PAGE_JUDGE_STORY.html; FINAL_MODEL_CARD.md'
  },
  {
    step: '2. Proof route',
    action: 'Open index.html#start-here-story, then Leakage Audit and Claim Boundaries before showing the leaderboard.',
    say: 'The important thing is not just the score. It is that the replay only uses what would be known before each match.',
    evidence: 'index.html#start-here-story; LEAKAGE_AUDIT.md; CLAIM_BOUNDARIES.md'
  },
  {
    step: '3. How it thinks',
    action: 'Scroll to Model Anatomy, then Model Source Map, and explain online memory, role features, Monte Carlo uncertainty, residual correction, TailGuard, and where those pieces live in source.',
    say: 'This is closer to an online EPA-style system than a one-shot OPR table.',
    evidence: 'MODEL_ANATOMY.md; MODEL_SOURCE_MAP.md; OPR_EPA_EXPLAINER.md'
  },
  {
    step: '4. Why this model won',
    action: 'Show Finalist Comparison and Model Leaderboard Appendix.',
    say: 'Several smarter-looking ideas were tested and rejected when holdouts or overfit diagnostics did not support them.',
    evidence: 'FINALIST_COMPARISON.md; MODEL_LEADERBOARD_APPENDIX.md'
  },
  {
    step: '5. Strategy usefulness',
    action: 'Show Strategy Example, Prediction Case Studies, and Defense Role Guide.',
    say: 'The model gives expected scores, win probability, uncertainty, and role clues that a strategist can combine with live scouting.',
    evidence: 'STRATEGY_EXAMPLE.md; PREDICTION_CASE_STUDIES.md; DEFENSE_ROLE_GUIDE.md'
  },
  {
    step: '6. Honest ending',
    action: 'Finish with Risk Register, Judge Q&A, and Final Readiness Check.',
    say: 'The strongest claim is that this is the most defensible model we found under honest constraints, not proof no better model exists.',
    evidence: 'LIMITATIONS_AND_RISK_REGISTER.md; JUDGE_QA.md; FINAL_READINESS_CHECK.md'
  },
  {
    step: 'Fallback if the live page fails',
    action: 'Use the screenshots and Markdown files directly from the final package folder.',
    say: 'The presentation can still run from the verified screenshots and generated Markdown evidence if the local browser setup fails.',
    evidence:
      'dashboard-hero-screenshot.png; one-page-judge-story-screenshot.png; start-here-story-screenshot.png; dashboard-mobile-hero-screenshot.png; dashboard-print-preview-screenshot.png; dashboard-source-evidence-screenshot.png; dashboard-final-gate-screenshot.png; dashboard-starred-coverage-screenshot.png; dashboard-story-spine-screenshot.png; dashboard-model-anatomy-screenshot.png; dashboard-accuracy-stats-screenshot.png; dashboard-model-scores-screenshot.png; dashboard-mobile-screenshot.png; dashboard-fullpage-screenshot.png; DELIVERABLES.md'
  }
];

const buildLiveDemoTable = () =>
  liveDemoRows.map(row => `<tr>${[row.step, row.action, row.say, row.evidence].map(tableCell).join('')}</tr>`).join('');

const liveDemoEmergencyRows = [
  {
    step: '1. Open the static story',
    artifact: 'ONE_PAGE_JUDGE_STORY.md',
    line: 'The current best defended local model is Conservative TailGuard Strong RoleV3, not an oracle.'
  },
  {
    step: '2. Show visual proof',
    artifact: 'one-page-judge-story-screenshot.png; start-here-story-screenshot.png',
    line: 'These screenshots were refreshed by browser QA after the latest generated dashboard edit.'
  },
  {
    step: '3. Show the gate',
    artifact: 'FINAL_CHECK_SUMMARY.md; dashboard-final-gate-screenshot.png',
    line: 'The final gate passed after dashboard generation, browser QA, typecheck, tests, and verifier runs.'
  },
  {
    step: '4. Answer caveat',
    artifact: 'CLAIM_BOUNDARIES.md; LIMITATIONS_AND_RISK_REGISTER.md',
    line: 'The model supports strategy discussion; humans still own the final scouting and drive-team decision.'
  }
];

const buildLiveDemoEmergencyTable = () =>
  liveDemoEmergencyRows.map(row => `<tr>${[row.step, row.artifact, row.line].map(tableCell).join('')}</tr>`).join('');

const buildLiveDemoRunbookMarkdown = (generatedAt: string) => `# Live Demo Runbook

This runbook is the exact presentation path for a live judge or teacher demo. It keeps the story short, auditable, and recoverable if the browser setup misbehaves.

## Before The Demo

\`\`\`sh
npm run model:final-check
\`\`\`

That one command runs the full handoff gate. For step-by-step debugging, use:

\`\`\`sh
npm run model:dashboard
npm run model:qa-dashboard
npm run model:verify-dashboard
\`\`\`

The browser-QA command refreshes \`browser-qa-summary.json\` and the saved screenshots before the verifier checks freshness.

## Start Command

\`\`\`sh
python3 -m http.server 4177 --directory modeling/artifacts/reports/final-judge-dashboard
\`\`\`

Open \`http://127.0.0.1:4177/\`.

Fastest live route: open \`http://127.0.0.1:4177/ONE_PAGE_JUDGE_STORY.html\` first, then open \`http://127.0.0.1:4177/index.html#start-here-story\` when the judge asks for proof.

## Demo Path

| Step | Action | What to say | Evidence |
| --- | --- | --- | --- |
${liveDemoRows.map(row => `| ${markdownCell(row.step)} | ${markdownCell(row.action)} | ${markdownCell(row.say)} | ${markdownCell(row.evidence)} |`).join('\n')}

## Emergency 60-Second Fallback

Use this if the local browser, Wi-Fi, or projector path fails. Do not debug live; switch to static files.

| Step | Artifact | Say |
| --- | --- | --- |
${liveDemoEmergencyRows.map(row => `| ${markdownCell(row.step)} | ${markdownCell(row.artifact)} | ${markdownCell(row.line)} |`).join('\n')}

## Timing

- 30 seconds: ONE_PAGE_JUDGE_STORY.html, current verdict, and one honest caveat.
- 90 seconds: add START_HERE_STORY.html, index.html#start-here-story, Leakage Audit, Model Anatomy, Model Source Map, and Finalist Comparison.
- 3 minutes: add Strategy Example, Defense Role Guide, and Risk Register.

## Recovery Rule

If anything visual breaks, do not improvise claims from memory. Open \`START_HERE_STORY.md\`, \`DELIVERABLES.md\`, \`FINAL_MODEL_CARD.md\`, \`LEAKAGE_AUDIT.md\`, \`FINALIST_COMPARISON.md\`, and the screenshots. The package is designed so the story survives without a perfect live browser.

${buildGeneratedStamp(generatedAt)}
`;

const judgeDryRunRows = [
  {
    rehearsalItem: 'Opening claim',
    passStandard: 'Presenter can explain the model in under 90 seconds without saying or implying it is unbeatable.',
    evidence: 'FIRST_90_SECONDS.md; CLAIM_BOUNDARIES.md; FINAL_MODEL_CARD.md',
    failAction: 'Use FIRST_90_SECONDS.md and remove any absolute language such as best possible or proven accurate.'
  },
  {
    rehearsalItem: 'No-future rule',
    passStandard: 'Presenter can explain that each historical prediction only used information available before that match.',
    evidence: 'LEAKAGE_AUDIT.md; MODEL_SOURCE_MAP.md; tests/modeling.test.mjs',
    failAction: 'Open LEAKAGE_AUDIT.md and point to buildWalkForwardDataset plus the no-current-match test.'
  },
  {
    rehearsalItem: 'Why this model won',
    passStandard: 'Presenter can name the promoted model, nearest alternatives, and why SelectiveTailGuard was rejected.',
    evidence: 'FINALIST_COMPARISON.md; MODEL_LEADERBOARD_APPENDIX.md; MODEL_JOURNEY_TIMELINE.md',
    failAction: 'Use the finalist table; do not improvise a cleaner story than the holdouts support.'
  },
  {
    rehearsalItem: 'Strategy usefulness',
    passStandard: 'Presenter can show one saved prediction and explain defense as net point swing, not magic defense detection.',
    evidence: 'STRATEGY_EXAMPLE.md; PREDICTION_CASE_STUDIES.md; DEFENSE_ROLE_GUIDE.md',
    failAction: 'Keep the example bounded: expected points, uncertainty, role clue, and human scouting judgment.'
  },
  {
    rehearsalItem: 'Hard-question handling',
    passStandard: 'Presenter can answer overfit, neural-network, Statbotics, scout/PPC, and defense-noise questions without bluffing.',
    evidence: 'HOSTILE_JUDGE_CROSS_EXAM.md; JUDGE_QA.md; LIMITATIONS_AND_RISK_REGISTER.md',
    failAction: 'Use the prepared answer and say what is not solved yet instead of trying to win every objection.'
  },
  {
    rehearsalItem: 'Package integrity',
    passStandard:
      'Presenter can show that the package is generated, verifier-checked, browser-checked, screenshot-fresh, and source/text-fingerprinted.',
    evidence: 'VERIFICATION_SUMMARY.md; browser-qa-summary.json; ARTIFACT_FINGERPRINTS.md; REFERENCE_INTEGRITY_AUDIT.md',
    failAction: 'Regenerate, refresh browser QA/screenshots, rerun verifier/tests, then reopen the dry-run.'
  },
  {
    rehearsalItem: 'Fallback route',
    passStandard: 'Presenter can continue from Markdown files and screenshots if the live browser fails.',
    evidence:
      'LIVE_DEMO_RUNBOOK.md; DELIVERABLES.md; dashboard-hero-screenshot.png; one-page-judge-story-screenshot.png; start-here-story-screenshot.png; dashboard-mobile-hero-screenshot.png; dashboard-print-preview-screenshot.png; dashboard-source-evidence-screenshot.png; dashboard-final-gate-screenshot.png; dashboard-starred-coverage-screenshot.png; dashboard-story-spine-screenshot.png; dashboard-model-anatomy-screenshot.png; dashboard-accuracy-stats-screenshot.png; dashboard-model-scores-screenshot.png; dashboard-mobile-screenshot.png; dashboard-fullpage-screenshot.png',
    failAction: 'Stop debugging in front of judges; switch to screenshots and the generated Markdown route.'
  }
];

const buildJudgeDryRunTable = () =>
  judgeDryRunRows
    .map(row => `<tr>${[row.rehearsalItem, row.passStandard, row.evidence, row.failAction].map(tableCell).join('')}</tr>`)
    .join('');

const buildJudgeDryRunMarkdown = (generatedAt: string) => `# Judge Dry-Run Scorecard

This scorecard is for one full rehearsal before presenting. It makes the presentation testable: the model package is not ready just because the code passes; the presenter also needs to make bounded claims under pressure.

| Rehearsal item | Pass standard | Evidence to open | If it fails |
| --- | --- | --- | --- |
${judgeDryRunRows
  .map(
    row =>
      `| ${markdownCell(row.rehearsalItem)} | ${markdownCell(row.passStandard)} | ${markdownCell(row.evidence)} | ${markdownCell(
        row.failAction
      )} |`
  )
  .join('\n')}

## Dry-Run Rule

Run this after the package verifier passes. If any row fails, do not patch the story from memory. Open the named artifact, tighten the wording, regenerate the dashboard if generated copy changed, refresh browser QA/screenshots, and rerun the verifier.

${buildGeneratedStamp(generatedAt)}
`;

const mockJudgePanelRows = [
  {
    judgeType: 'Technical modeling judge',
    likelyPush: 'How do you know this is not future leakage or just overfit?',
    bestAnswer:
      'I cannot prove no overfit exists, so I designed the replay to make leakage hard and promotion conservative: walk-forward rows, event-key holdouts, VIF/correlation checks, calibration checks, and rejection of good-looking ideas that failed confirmation.',
    open: 'LEAKAGE_AUDIT.md; DEPLOYMENT_SCORING_RUBRIC.md; MODEL_SOURCE_MAP.md',
    avoid: 'Do not say overfitting is impossible.'
  },
  {
    judgeType: 'Strategy judge',
    likelyPush: 'How would a drive team actually use this before a match?',
    bestAnswer:
      'Use it as decision support: expected red/blue score, win probability, uncertainty, and role clues. Defense is treated as net point swing, so the model can suggest when suppressing opponents may beat extra scoring.',
    open: 'STRATEGY_EXAMPLE.md; DEFENSE_ROLE_GUIDE.md; PREDICTION_CASE_STUDIES.md',
    avoid: 'Do not say the model should replace scouts or drive-team judgment.'
  },
  {
    judgeType: 'Skeptical statistics judge',
    likelyPush: 'The gains look small. Why is this worth presenting?',
    bestAnswer:
      'The small gain is part of the honest story. The project is valuable because model ideas were tested under realistic constraints, near-ties were labeled, unstable variants were rejected, and the final candidate is the best defensible balance we found.',
    open: 'FINALIST_COMPARISON.md; MODEL_LEADERBOARD_APPENDIX.md; LIMITATIONS_AND_RISK_REGISTER.md',
    avoid: 'Do not inflate a near-tie into a blowout.'
  },
  {
    judgeType: 'Software/reproducibility judge',
    likelyPush: 'How do I know this report was not hand-edited to look good?',
    bestAnswer:
      'The dashboard is generated from saved artifacts. The verifier checks required files, manifest paths, reference targets, browser-QA freshness, screenshot dimensions, and source/text SHA-256 fingerprints, then writes a pass/fail summary.',
    open: 'VERIFICATION_SUMMARY.md; ARTIFACT_FINGERPRINTS.md; REFERENCE_INTEGRITY_AUDIT.md',
    avoid: 'Do not imply package verification proves model correctness.'
  },
  {
    judgeType: 'Project-impact judge',
    likelyPush: 'What is the real-world lesson from this research?',
    bestAnswer:
      'The lesson is disciplined decision-making under uncertainty: use all safe pre-match evidence, reject tempting fragile ideas, explain what the model can help with, and keep humans responsible for strategy.',
    open: 'JUDGE_STORY_SPINE.md; PRINTABLE_HANDOUT.md; JUDGE_RUBRIC_ALIGNMENT.md',
    avoid: 'Do not make the story only about a metric.'
  },
  {
    judgeType: 'Data-source judge',
    likelyPush: 'Why did you not just feed every API signal into the model?',
    bestAnswer:
      'Because more data is only useful if it is timestamp-safe and representative. Statbotics prediction rows lacked prediction-specific timestamps, and the 356 matched Firebase scout rows are mostly one-event evidence, so those signals are documented rather than overclaimed.',
    open: 'METHODOLOGY_APPENDIX.md; OPR_EPA_EXPLAINER.md; SCOUT_COVERAGE.md',
    avoid: 'Do not claim sparse scout/PPC rows or unsafe prediction snapshots broadly improved the promoted model.'
  }
];

const buildMockJudgePanelTable = () =>
  mockJudgePanelRows
    .map(row => `<tr>${[row.judgeType, row.likelyPush, row.bestAnswer, row.open, row.avoid].map(tableCell).join('')}</tr>`)
    .join('');

const buildMockJudgePanelMarkdown = (generatedAt: string) => `# Mock Judge Panel Brief

This brief prepares for different judge personalities. It is intentionally direct: each row gives the likely push, the best bounded answer, what to open, and what not to say.

| Judge type | Likely push | Best bounded answer | Open | Avoid |
| --- | --- | --- | --- | --- |
${mockJudgePanelRows
  .map(
    row =>
      `| ${markdownCell(row.judgeType)} | ${markdownCell(row.likelyPush)} | ${markdownCell(row.bestAnswer)} | ${markdownCell(
        row.open
      )} | ${markdownCell(row.avoid)} |`
  )
  .join('\n')}

## Panel Rule

Answer the judge in the style they are using. A technical judge gets leakage controls, a strategy judge gets match-use examples, a skeptical judge gets limitations, and a project-impact judge gets the engineering lesson. In every case, keep the claim bounded.

${buildGeneratedStamp(generatedAt)}
`;

const metricGlossaryRows = [
  {
    metric: 'Score MAE',
    meaning: 'Average absolute error in predicted alliance score.',
    why: 'This is the clearest scoreboard accuracy measure.',
    watchOut: 'It can hide whether the model got the winner or margin wrong.'
  },
  {
    metric: 'Margin MAE',
    meaning: 'Average absolute error in predicted red-blue difference.',
    why: 'It is closer to alliance strength and match-strategy decisions than total score alone.',
    watchOut: 'A model can get total score right while putting the points on the wrong side.'
  },
  {
    metric: 'Brier score',
    meaning: 'Penalty for bad win probabilities; lower is better.',
    why: 'It checks whether a 70% prediction behaves like a real 70% chance over many matches.',
    watchOut: 'It can improve even when exact score prediction does not.'
  },
  {
    metric: 'Calibration error',
    meaning: 'How far predicted probabilities are from observed frequencies.',
    why: 'It keeps confidence honest instead of rewarding overconfident guesses.',
    watchOut: 'Good calibration is not enough if score error or Brier score gets worse.'
  },
  {
    metric: 'Interval coverage',
    meaning: 'How often actual scores land inside the predicted score bands.',
    why: 'It evaluates uncertainty quality, not just point estimates.',
    watchOut: 'Very wide bands can cover more matches while becoming less useful.'
  },
  {
    metric: 'Worst-event MAE',
    meaning: 'The hardest event-level score error after grouping by event.',
    why: 'It punishes models that collapse on one event while looking fine on average.',
    watchOut: 'Improving this can cost average score or margin performance.'
  },
  {
    metric: 'Deployment score',
    meaning: 'Composite score used to choose a practical point model.',
    why: 'It balances score, margin, Brier, calibration, coverage, worst-event risk, rank, and instability.',
    watchOut: 'It is a decision rule for this project, not a universal proof.'
  },
  {
    metric: 'Relative benchmark',
    meaning: 'A model ranking within the exact candidate set for one run.',
    why: 'It answers which model won that experiment under the current comparison rules.',
    watchOut: 'It can overstate tiny differences if all candidates are near-tied.'
  },
  {
    metric: 'Fixed benchmark',
    meaning: 'A stable benchmark used to compare reports that tested different candidate sets.',
    why: 'It helps prevent each experiment from changing the scoreboard in its own favor.',
    watchOut: 'It can disagree with the relative winner, which is useful diagnostic tension.'
  },
  {
    metric: 'Near-tie',
    meaning: 'A label for wins too small to treat as decisive.',
    why: 'It protects the project from overclaiming small numerical differences.',
    watchOut: 'Near-ties still matter, but they need corroborating evidence before promotion.'
  }
];

const modelJourneyTimelineRows = [
  {
    stage: '1. Baselines',
    work: 'Started with prior-score, OPR-style, and EPA-style baselines.',
    lesson: 'OPR is useful as a retrospective linear contribution check; online EPA-style memory fits pre-match replay better.',
    status: 'Kept as reference.'
  },
  {
    stage: '2. Score distributions',
    work: 'Added Monte Carlo score simulation and uncertainty bands.',
    lesson: 'Winner prediction is too thin; expected scores, spread, and asymmetric risk are more useful for strategy.',
    status: 'Kept.'
  },
  {
    stage: '3. Event context',
    work: 'Cached FIRST/TBA/Statbotics event context and built event-archetype features.',
    lesson: 'Metadata helps, but published prediction rows need timestamp proof before they can be promoted.',
    status: 'Kept with provenance limits.'
  },
  {
    stage: '4. Residual correction',
    work: 'Built no-future residual-ridge correction from prior prediction errors.',
    lesson: 'Small online corrections helped more defensibly than a large offline fit.',
    status: 'Became the defended baseline.'
  },
  {
    stage: '5. Role and defense',
    work: 'Tested role features, then separated suppression, foul risk, offense cost, confidence, and net swing in RoleV3.',
    lesson: 'Defense signal exists, but it must be split apart and treated as opportunity cost.',
    status: 'RoleV3 promoted as the leading family.'
  },
  {
    stage: '6. Tail risk',
    work: 'Tried championship-tail, probability calibration, TailRisk, and learned-tail variants.',
    lesson: 'Hard-match tail behavior can improve, but many fixes spend too much margin or stability.',
    status: 'Mostly rejected or downgraded.'
  },
  {
    stage: '7. TailGuard',
    work: 'Added conservative and stronger TailGuard corrections to Strong RoleV3.',
    lesson: 'A small correction can trim hard-event risk without moving average metrics much.',
    status: 'Conservative TailGuard is current point candidate.'
  },
  {
    stage: '8. Selective gate',
    work: 'Tested a smarter-sounding SelectiveTailGuard gate using stricter no-future event evidence.',
    lesson: 'It improved a full replay, then failed broad confirmation slices.',
    status: 'Rejected.'
  },
  {
    stage: '9. Judge package',
    work: 'Generated dashboard, model card, evidence matrix, scripts, glossary, risk register, runbook, and screenshots.',
    lesson: 'The project needs a defensible story, not just a best number.',
    status: 'Delivery polish in progress.'
  }
];

const buildMetricGlossaryTable = () =>
  metricGlossaryRows
    .map(row => `<tr>${tableCell(row.metric)}${tableCell(row.meaning)}${tableCell(row.why)}${tableCell(row.watchOut)}</tr>`)
    .join('');

const buildMetricGlossaryMarkdown = (generatedAt: string) =>
  `# Metric Glossary

These definitions make the leaderboard readable without pretending one number tells the whole story.

| Metric | Plain-English meaning | Why it matters | Watch-out |
| --- | --- | --- | --- |
${metricGlossaryRows.map(row => `| ${row.metric} | ${row.meaning} | ${row.why} | ${row.watchOut} |`).join('\n')}

## How To Use This In Judging

Use Score MAE and Margin MAE to explain scoreboard accuracy, Brier and calibration to explain confidence quality, interval coverage and worst-event MAE to explain uncertainty and tail risk, and deployment score to explain the final practical tradeoff. If two models are marked as a near-tie, say that clearly instead of pretending the smaller number is a decisive win.

${buildGeneratedStamp(generatedAt)}
`;

const fixedBenchmarkRubricRows = [
  ['Score MAE / average score', '16%', '0.28 target ratio', 'Primary exact-score accuracy, normalized by the event score scale.'],
  ['Score RMSE / average score', '8%', '0.36 target ratio', 'Extra pressure on large score misses.'],
  ['Margin MAE / average score', '13%', '0.40 target ratio', 'How well the model separates the two alliances.'],
  ['Season-normalized score MAE', '7%', '0.28 target ratio', 'Prevents one season score scale from dominating.'],
  ['Season-normalized margin MAE', '7%', '0.40 target ratio', 'Season-aware alliance-strength accuracy.'],
  ['Win Brier score', '12%', '0.17 target', 'Win-probability quality.'],
  ['Calibration error', '7%', '0.025 target', 'Confidence honesty.'],
  ['Interval coverage error', '8%', '0.06 target', 'Whether uncertainty bands cover the right amount.'],
  ['Worst-event MAE / average score', '6%', '0.50 target ratio', 'Punishes event-level collapse.'],
  ['Event instability ratio', '5%', '0.45 target ratio', 'Punishes inconsistent event-to-event behavior.'],
  ['Worst-season MAE / average score', '4%', '0.36 target ratio', 'Checks season-level failure modes.'],
  ['Season instability ratio', '3%', '0.25 target ratio', 'Punishes inconsistent season-to-season behavior.'],
  ['Interval width / average score', '4%', '0.75 target ratio', 'Discourages uselessly wide uncertainty bands.']
];

const deploymentRubricRows = [
  ['Score MAE regret', '24%', 'How much worse the model is than the best deployable score MAE in that run.'],
  ['Margin MAE regret', '18%', 'How much worse the model is at predicting red-blue spread.'],
  ['Brier regret', '16%', 'How much worse the model is at win-probability quality.'],
  ['Calibration regret', '8%', 'How much confidence honesty is lost.'],
  ['Coverage-miss regret', '8%', 'How much score-band reliability is lost.'],
  ['Worst-event regret', '12%', 'How much harder-event behavior is lost.'],
  ['Fixed-benchmark regret', '10%', 'Candidate-set-independent check against the fixed rubric.'],
  ['Relative-rank regret', '4%', 'A small penalty for ranking poorly across the blended benchmark.']
];

const overfitPenaltyRows = [
  ['High VIF', 'VIF above 12 is squared after scaling and capped.', 'Collinearity should hurt more as it becomes extreme.'],
  ['High correlation', 'Feature correlations above 0.96 add squared excess penalties.', 'Duplicate signals should not make a model look more certain.'],
  ['Rejection reasons', 'Each rejection reason is squared in count before weighting.', 'Multiple structural warnings should compound.'],
  ['Event instability', 'Event MAE spread above the threshold is squared after scaling.', 'A model that collapses on one event should not win by average MAE alone.'],
  ['Season instability', 'Season MAE spread above the threshold is squared after scaling.', 'Cross-season fragility is treated as real risk.'],
  ['Coverage miss', 'Coverage error is squared relative to the allowed miss.', 'Uncertainty that fails badly is punished nonlinearly.']
];

const buildRubricRows = (rows: string[][]) => rows.map(row => `<tr>${row.map(tableCell).join('')}</tr>`).join('');

const buildDeploymentRubricMarkdown = (generatedAt: string) =>
  `# Deployment Scoring Rubric

The leaderboard is deliberately more nuanced than score MAE or RMSE. The goal is not to reward a model that wins one metric while becoming fragile, overfit, or poorly calibrated.

## Fixed Benchmark Weights

The fixed benchmark is candidate-set independent. For each component, worse-than-target performance is magnified: if a ratio is above target, the extra amount is squared into the component before capping.

| Component | Weight | Target | Why it exists |
| --- | --- | --- | --- |
${fixedBenchmarkRubricRows.map(row => `| ${row.join(' | ')} |`).join('\n')}

## Cross-Run Deployment Score

The point deployment score is lower-is-better. It averages per-run regret against the best deployable model in that run, then adds an instability penalty.

| Component | Weight | What it measures |
| --- | --- | --- |
${deploymentRubricRows.map(row => `| ${row.join(' | ')} |`).join('\n')}

Instability penalty: the final point score adds \`0.25 * weighted standard deviation\` plus \`0.15 * worst-run regret\`. This means a model is punished for being good on average but fragile on one holdout.

## Nonlinear Overfit Penalties

| Signal | Penalty shape | Why it matters |
| --- | --- | --- |
${overfitPenaltyRows.map(row => `| ${row.join(' | ')} |`).join('\n')}

## Promotion Rules

- Relative benchmark promotes within a run by blending rank and robust magnitude.
- Fixed benchmark checks candidate-set-independent quality.
- Promotion is downgraded to \`near_tie\` when another eligible model is within 0.050 relative-benchmark points, within 0.010 fixed-benchmark points, or when the fixed benchmark prefers a different eligible model.
- Leakage-risk and non-promotable inputs receive hard penalties after metric scoring.
- All scores are computed from walk-forward predictions, not in-sample fitted scores.

${buildGeneratedStamp(generatedAt)}
`;

const oprEpaRows = [
  {
    topic: 'Core idea',
    opr: 'Solve a linear system from completed alliance scores to estimate additive team contributions.',
    epa: 'Carry a team rating forward through time and update it after each match based on prediction error.',
    implication: 'EPA-style memory is a better fit for pre-match replay; OPR is a useful retrospective baseline.'
  },
  {
    topic: 'Time behavior',
    opr: 'Usually needs a batch of matches before the matrix is stable.',
    epa: 'Can produce a before-match state, then update after the actual score is known.',
    implication: 'Walk-forward validation naturally matches EPA-style state updates.'
  },
  {
    topic: 'Assumption',
    opr: 'Alliance score is treated as a sum of team contributions.',
    epa: 'Team strength is dynamic and learns from surprise: expected score versus actual score.',
    implication: 'EPA-style models handle changing form better, but still need leakage checks.'
  },
  {
    topic: 'Use in this project',
    opr: 'Used as a baseline and sanity check for linear contribution logic.',
    epa: 'Used as the backbone for the final model family, with Monte Carlo uncertainty, RoleV3, residual correction, and TailGuard.',
    implication: 'The final model is not blindly using EPA; it uses an EPA-like local implementation under a no-future rule.'
  },
  {
    topic: 'Leakage risk',
    opr: 'A full-event OPR can accidentally summarize matches that had not happened yet.',
    epa: 'Published EPA snapshots can also leak if we cannot prove when they were available.',
    implication: 'The pipeline computes local walk-forward state and treats public Statbotics predictions as non-promotable without timestamp proof.'
  },
  {
    topic: 'Defense and roles',
    opr: 'A pure additive matrix struggles with intentional role changes and defense opportunity cost.',
    epa: 'Online state can be combined with role features and residual signals before each match.',
    implication: 'RoleV3 adds suppression, foul risk, offense cost, confidence, and net swing on top of the online backbone.'
  }
];

const buildOprEpaTable = () =>
  oprEpaRows
    .map(row => `<tr>${tableCell(row.topic)}${tableCell(row.opr)}${tableCell(row.epa)}${tableCell(row.implication)}</tr>`)
    .join('');

const buildOprEpaExplainerMarkdown = (generatedAt: string) =>
  `# OPR vs EPA Explainer

This explainer exists because OPR and EPA are often spoken about as if they are interchangeable. They are not. The final model treats them differently on purpose.

| Topic | OPR-style thinking | EPA-style thinking | Modeling implication |
| --- | --- | --- | --- |
${oprEpaRows.map(row => `| ${row.topic} | ${row.opr} | ${row.epa} | ${row.implication} |`).join('\n')}

## How This Affected The Final Model

- OPR-like models stayed in the pipeline as baselines and sanity checks.
- The promoted family uses a local online EPA-style state because it can answer the pre-match question: before this match, what did we know?
- Monte Carlo uncertainty, RoleV3 defense features, residual-ridge correction, and TailGuard sit on top of that online state.
- Public Statbotics prediction rows are not promoted because cached rows lack prediction-specific timestamps.
- The model does not claim that EPA is universally superior. It claims that online memory plus strict walk-forward validation is more defensible for this specific pre-match prediction problem.

${buildGeneratedStamp(generatedAt)}
`;

const buildModelJourneyTimelineHtml = () =>
  modelJourneyTimelineRows
    .map(
      row => `<div class="card step"><strong>${escapeHtml(row.stage)}</strong><p>${escapeHtml(row.work)}</p><p>${escapeHtml(
        row.lesson
      )}</p><p><strong>Status:</strong> ${escapeHtml(row.status)}</p></div>`
    )
    .join('');

const buildModelJourneyTimelineMarkdown = (generatedAt: string) =>
  `# Model Journey Timeline

This is the short narrative arc for judges: what we tried, what we learned, and why the current model is conservative rather than flashy.

| Stage | What changed | What we learned | Status |
| --- | --- | --- | --- |
${modelJourneyTimelineRows.map(row => `| ${row.stage} | ${row.work} | ${row.lesson} | ${row.status} |`).join('\n')}

## Presentation Takeaway

The winning model was not chosen because it sounded the most advanced. It was chosen because each previous branch left evidence: baselines established a floor, online EPA-style memory matched the pre-match problem, residual correction improved errors without future leakage, RoleV3 made defense more honest, TailGuard trimmed hard-event risk, and SelectiveTailGuard showed that smarter-looking ideas can still lose holdout confirmation.

${buildGeneratedStamp(generatedAt)}
`;

const compactInlineSvgLabels = (svg: string) =>
  svg.replace(/>(No-Future [^<]{80,}?)(\s+\([^)]*\))?<\/text>/g, (_match, modelName: string, suffix: string = '') => {
    const compact = `${shortModelName(modelName)}${suffix}`;
    return `>${escapeHtml(compact)}</text>`;
  });

const loadInlineSvg = (filePath: string) => {
  if (!fs.existsSync(filePath)) return '';
  return compactInlineSvgLabels(fs.readFileSync(filePath, 'utf8'));
};

const findFiles = (root: string, fileName: string): string[] => {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return findFiles(fullPath, fileName);
    return entry.isFile() && entry.name === fileName ? [fullPath] : [];
  });
};

const sampleEvenly = <T>(items: T[], maxItems: number) => {
  if (items.length <= maxItems) return items;
  const step = items.length / maxItems;
  const sample: T[] = [];
  for (let index = 0; index < maxItems; index += 1) {
    const item = items[Math.floor(index * step)];
    if (item != null) sample.push(item);
  }
  return sample;
};

const buildPredictionScatterSvg = (predictions: ScorePrediction[]) => {
  const values = predictions.filter(
    prediction => Number.isFinite(prediction.actualScore) && Number.isFinite(prediction.expectedScore)
  );
  const sample = sampleEvenly(values, 850);
  const maxScore = Math.max(120, ...sample.flatMap(prediction => [prediction.actualScore, prediction.expectedScore]));
  const width = 820;
  const height = 430;
  const padding = 56;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const scaleX = (value: number) => padding + (value / maxScore) * plotWidth;
  const scaleY = (value: number) => padding + plotHeight - (value / maxScore) * plotHeight;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(ratio => {
      const value = ratio * maxScore;
      const x = scaleX(value);
      const y = scaleY(value);
      return `<line x1="${x}" y1="${padding}" x2="${x}" y2="${padding + plotHeight}" stroke="#d8dee9" stroke-width="1"/><line x1="${padding}" y1="${y}" x2="${
        padding + plotWidth
      }" y2="${y}" stroke="#d8dee9" stroke-width="1"/><text x="${x}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#516070">${formatNumber(
        value,
        0
      )}</text><text x="44" y="${y + 4}" text-anchor="end" font-size="11" fill="#516070">${formatNumber(value, 0)}</text>`;
    })
    .join('');
  const points = sample
    .map(prediction => {
      const color = prediction.residual >= 0 ? '#d97706' : '#0f766e';
      return `<circle cx="${scaleX(prediction.actualScore)}" cy="${scaleY(prediction.expectedScore)}" r="2.8" fill="${color}" opacity="0.38"/>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Predicted score versus actual score scatter plot">
    <rect width="${width}" height="${height}" rx="18" fill="#ffffff"/>
    ${grid}
    <line x1="${padding}" y1="${padding + plotHeight}" x2="${padding + plotWidth}" y2="${padding}" stroke="#111827" stroke-width="2" stroke-dasharray="6 6"/>
    ${points}
    <text x="${width / 2}" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">Expected Score vs Actual Score</text>
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-size="12" fill="#374151">Actual alliance score</text>
    <text x="16" y="${height / 2}" transform="rotate(-90 16 ${height / 2})" text-anchor="middle" font-size="12" fill="#374151">Model expected score</text>
  </svg>`;
};

const buildCalibrationSvg = (predictions: MatchPrediction[]) => {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    label: `${index * 10}-${(index + 1) * 10}%`,
    total: 0,
    predictedSum: 0,
    actualSum: 0
  }));
  predictions.forEach(prediction => {
    const probability = Math.max(0, Math.min(0.999999, prediction.redWinProbability));
    const bin = bins[Math.floor(probability * bins.length)];
    if (!bin) return;
    bin.total += 1;
    bin.predictedSum += probability;
    bin.actualSum += prediction.actualWinner === 'red' ? 1 : 0;
  });
  const width = 820;
  const height = 360;
  const padding = 54;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const barWidth = plotWidth / bins.length;
  const bars = bins
    .map((bin, index) => {
      const predicted = bin.total > 0 ? bin.predictedSum / bin.total : 0;
      const actual = bin.total > 0 ? bin.actualSum / bin.total : 0;
      const x = padding + index * barWidth;
      const predictedHeight = predicted * plotHeight;
      const actualHeight = actual * plotHeight;
      return `<rect x="${x + 6}" y="${padding + plotHeight - predictedHeight}" width="${barWidth * 0.38}" height="${predictedHeight}" fill="#2563eb" opacity="0.72"/>
        <rect x="${x + 6 + barWidth * 0.4}" y="${padding + plotHeight - actualHeight}" width="${barWidth * 0.38}" height="${actualHeight}" fill="#f97316" opacity="0.78"/>
        <text x="${x + barWidth / 2}" y="${height - 19}" text-anchor="middle" font-size="10" fill="#516070">${escapeHtml(bin.label)}</text>`;
    })
    .join('');
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(ratio => {
      const y = padding + plotHeight - ratio * plotHeight;
      return `<line x1="${padding}" y1="${y}" x2="${padding + plotWidth}" y2="${y}" stroke="#d8dee9" stroke-width="1"/><text x="44" y="${
        y + 4
      }" text-anchor="end" font-size="11" fill="#516070">${formatPercent(ratio, 0)}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Win probability calibration by decile">
    <rect width="${width}" height="${height}" rx="18" fill="#ffffff"/>
    ${grid}
    ${bars}
    <text x="${width / 2}" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">Red Win Probability Calibration</text>
    <rect x="${width - 215}" y="20" width="12" height="12" fill="#2563eb" opacity="0.72"/><text x="${width - 196}" y="31" font-size="12" fill="#374151">Predicted</text>
    <rect x="${width - 125}" y="20" width="12" height="12" fill="#f97316" opacity="0.78"/><text x="${width - 106}" y="31" font-size="12" fill="#374151">Actual</text>
  </svg>`;
};

const buildDeploymentBars = (rows: DeploymentReviewRow[]) => {
  const max = Math.max(...rows.map(row => row.pointDeploymentScore), 1);
  return rows
    .map((row, index) => {
      const width = Math.max(4, (row.pointDeploymentScore / max) * 100);
      const name = shortModelName(row.model);
      return `<div class="bar-row">
        <div class="bar-rank">${index + 1}</div>
        <div class="bar-label"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(modelFamilyLabel(row.model))}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="bar-value">${formatNumber(row.pointDeploymentScore, 3)}</div>
      </div>`;
    })
    .join('');
};

const collectModelJourneyRows = (reportsRoot: string) =>
  findFiles(reportsRoot, 'cross-run-summary.json')
    .flatMap(filePath => {
      try {
        const summary = readJsonFile<Partial<CrossRunSummary>>(filePath);
        const rows = Array.isArray(summary.rows) ? summary.rows : [];
        if (rows.length === 0) return [];
        const reportName = path.basename(path.dirname(filePath));
        const deploymentRows = summary.deploymentReview?.rows ?? [];
        const bestDeployment = deploymentRows[0];
        const relativeEntries = Object.entries(summary.relativeCounts ?? {}).sort((left, right) => right[1] - left[1]);
        const fixedEntries = Object.entries(summary.fixedCounts ?? {}).sort((left, right) => right[1] - left[1]);
        const evaluationMatches = rows.reduce((sum, row) => sum + (Number.isFinite(row.evaluationMatches) ? row.evaluationMatches : 0), 0);
        return [
          {
            reportName,
            reportPath: path.relative(process.cwd(), filePath),
            runCount: rows.length,
            holdoutRuns: rows.filter(row => row.isHoldout).length,
            evaluationMatches,
            status: summary.stabilityReview?.status ?? 'single-check',
            relativeLeader: relativeEntries[0]?.[0] ?? rows[0]?.relativeModel ?? 'n/a',
            relativeLeaderWins: relativeEntries[0]?.[1] ?? 0,
            fixedLeader: fixedEntries[0]?.[0] ?? rows[0]?.fixedModel ?? 'n/a',
            fixedLeaderWins: fixedEntries[0]?.[1] ?? 0,
            bestDeploymentModel: bestDeployment?.model ?? 'n/a',
            pointDeploymentScore: Number.isFinite(bestDeployment?.pointDeploymentScore)
              ? bestDeployment?.pointDeploymentScore ?? null
              : null,
            weightedScoreMae: Number.isFinite(bestDeployment?.weightedScoreMae) ? bestDeployment?.weightedScoreMae ?? null : null,
            weightedMarginMae: Number.isFinite(bestDeployment?.weightedMarginMae) ? bestDeployment?.weightedMarginMae ?? null : null,
            weightedBrier: Number.isFinite(bestDeployment?.weightedBrier) ? bestDeployment?.weightedBrier ?? null : null,
            maxWorstEventScoreMae: Number.isFinite(bestDeployment?.maxWorstEventScoreMae)
              ? bestDeployment?.maxWorstEventScoreMae ?? null
              : null
          } satisfies ModelJourneyRow
        ];
      } catch {
        return [];
      }
    })
    .sort((left, right) => {
      if (left.pointDeploymentScore == null && right.pointDeploymentScore != null) return 1;
      if (left.pointDeploymentScore != null && right.pointDeploymentScore == null) return -1;
      if (left.pointDeploymentScore != null && right.pointDeploymentScore != null) {
        return left.pointDeploymentScore - right.pointDeploymentScore;
      }
      return left.reportName.localeCompare(right.reportName);
    });

const collectModelLeaderboardRows = (reportsRoot: string) =>
  findFiles(reportsRoot, 'cross-run-summary.json')
    .flatMap(filePath => {
      try {
        const summary = readJsonFile<Partial<CrossRunSummary>>(filePath);
        const deploymentRows = summary.deploymentReview?.rows ?? [];
        if (deploymentRows.length === 0) return [];
        const reportName = path.basename(path.dirname(filePath));
        const reportPath = path.relative(process.cwd(), filePath);
        const status = summary.stabilityReview?.status ?? 'single-check';
        return deploymentRows
          .filter(row => Number.isFinite(row.pointDeploymentScore))
          .map(row => ({
            reportName,
            reportPath,
            status,
            model: row.modelShort ?? row.model,
            role: row.role,
            runs: row.runs,
            relativeWins: row.relativeWins,
            fixedWins: row.fixedWins,
            nearTieRuns: row.nearTieRuns,
            weightedScoreMae: row.weightedScoreMae,
            weightedMarginMae: row.weightedMarginMae,
            weightedBrier: row.weightedBrier,
            maxWorstEventScoreMae: row.maxWorstEventScoreMae,
            pointDeploymentScore: row.pointDeploymentScore,
            robustnessScore: row.robustnessScore
          }));
      } catch {
        return [];
      }
    })
    .sort((left, right) => {
      const roleDelta = modelLeaderboardRoleRank(left.role) - modelLeaderboardRoleRank(right.role);
      if (roleDelta !== 0) return roleDelta;
      const scoreDelta = left.pointDeploymentScore - right.pointDeploymentScore;
      if (Math.abs(scoreDelta) > 0.000001) return scoreDelta;
      return left.weightedScoreMae - right.weightedScoreMae;
    });

const modelLeaderboardRoleRank = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes('point default')) return 0;
  if (normalized.includes('average-error alternate')) return 1;
  if (normalized.includes('near-tie')) return 2;
  if (normalized.includes('fixed-score diagnostic')) return 3;
  if (normalized.includes('uncertainty')) return 4;
  return 5;
};

const buildJourneyBars = (rows: ModelJourneyRow[]) => {
  const ranked = rows.filter(row => row.pointDeploymentScore != null).slice(0, 12);
  const max = Math.max(...ranked.map(row => row.pointDeploymentScore ?? 0), 1);
  return ranked
    .map((row, index) => {
      const score = row.pointDeploymentScore ?? max;
      const width = Math.max(4, (score / max) * 100);
      return `<div class="bar-row">
        <div class="bar-rank">${index + 1}</div>
        <div class="bar-label"><strong>${escapeHtml(row.reportName)}</strong><span>${escapeHtml(
          shortModelName(row.bestDeploymentModel)
        )}</span></div>
        <div class="bar-track"><div class="bar-fill alt" style="width:${width}%"></div></div>
        <div class="bar-value">${formatNumber(score, 3)}</div>
      </div>`;
    })
    .join('');
};

const buildJourneyTable = (rows: ModelJourneyRow[]) =>
  rows
    .map(
      row => `<tr>
        ${tableCell(row.reportName)}
        ${tableCell(row.runCount)}
        ${tableCell(row.holdoutRuns)}
        ${tableCell(row.evaluationMatches)}
        ${tableCell(row.status)}
        ${tableCell(`${shortModelName(row.relativeLeader)} (${row.relativeLeaderWins})`)}
        ${tableCell(`${shortModelName(row.fixedLeader)} (${row.fixedLeaderWins})`)}
        ${tableCell(shortModelName(row.bestDeploymentModel))}
        ${tableCell(row.pointDeploymentScore == null ? 'n/a' : formatNumber(row.pointDeploymentScore, 3))}
        ${tableCell(row.weightedScoreMae == null ? 'n/a' : formatNumber(row.weightedScoreMae))}
        ${tableCell(row.weightedBrier == null ? 'n/a' : formatNumber(row.weightedBrier, 4))}
      </tr>`
    )
    .join('');

const buildModelLeaderboardBars = (rows: ModelLeaderboardRow[]) => {
  const ranked = rows.slice(0, 14);
  const max = Math.max(...ranked.map(row => row.pointDeploymentScore), 1);
  return ranked
    .map((row, index) => {
      const width = Math.max(4, (row.pointDeploymentScore / max) * 100);
      return `<div class="bar-row">
        <div class="bar-rank">${index + 1}</div>
        <div class="bar-label"><strong>${escapeHtml(shortModelName(row.model))}</strong><span>${escapeHtml(
          row.reportName
        )} · ${escapeHtml(row.role)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="bar-value">${formatNumber(row.pointDeploymentScore, 3)}</div>
      </div>`;
    })
    .join('');
};

const buildModelLeaderboardTable = (rows: ModelLeaderboardRow[], limit: number | null = 80) =>
  (limit == null ? rows : rows.slice(0, limit))
    .map(
      row => `<tr>
        ${tableCell(row.reportName)}
        ${tableCell(shortModelName(row.model))}
        ${tableCell(row.role)}
        ${tableCell(row.status)}
        ${tableCell(row.runs)}
        ${tableCell(row.relativeWins)}
        ${tableCell(row.fixedWins)}
        ${tableCell(row.nearTieRuns)}
        ${tableCell(formatNumber(row.weightedScoreMae))}
        ${tableCell(formatNumber(row.weightedMarginMae))}
        ${tableCell(formatNumber(row.weightedBrier, 4))}
        ${tableCell(formatNumber(row.maxWorstEventScoreMae))}
        ${tableCell(formatNumber(row.pointDeploymentScore, 3))}
        ${tableCell(formatNumber(row.robustnessScore, 3))}
      </tr>`
    )
    .join('');

const buildModelLeaderboardMarkdown = (rows: ModelLeaderboardRow[], generatedAt: string) => `# Model Leaderboard Appendix

This appendix collects deployment-review rows from every saved \`cross-run-summary.json\` under \`modeling/artifacts/reports\`. Rows are grouped by practical role first, then sorted by deployment score. Lower deployment score is better, but the rows are not treated as one universal proof because each report family tested a different candidate set.

Report-local role note: a row marked \`point default candidate\` was the default inside that historical report family only. The current final promoted model is Conservative TailGuard Strong RoleV3 from \`role-v3-tailguard-micro-sensitivity-check\`; older point-default rows are audit history, not the current handoff claim.

| Rank | Report family | Model | Role | Status | Runs | Relative wins | Fixed wins | Near-tie runs | Score MAE | Margin MAE | Brier | Worst event | Deploy score | Robustness |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows
  .map(
    (row, index) =>
      `| ${index + 1} | ${row.reportName} | ${shortModelName(row.model)} | ${row.role} | ${row.status} | ${row.runs} | ${row.relativeWins} | ${row.fixedWins} | ${row.nearTieRuns} | ${formatNumber(row.weightedScoreMae)} | ${formatNumber(
        row.weightedMarginMae
      )} | ${formatNumber(row.weightedBrier, 4)} | ${formatNumber(row.maxWorstEventScoreMae)} | ${formatNumber(
        row.pointDeploymentScore,
        3
      )} | ${formatNumber(row.robustnessScore, 3)} |`
  )
  .join('\n')}

## How To Use This

Use this as the backup evidence when someone asks, "What else did you try?" The best row is not automatically the final answer by itself; the final answer also depends on leakage eligibility, holdout confirmation, near-tie labels, and whether the report family tested a serious alternative.

${buildGeneratedStamp(generatedAt)}
`;

const buildHoldoutTable = (rows: CrossRunRow[]) =>
  rows
    .map(
      row => `<tr>
        ${tableCell(row.runName)}
        ${tableCell(row.isHoldout ? 'holdout' : 'full replay')}
        ${tableCell(row.evaluationMatches)}
        ${tableCell(shortModelName(row.relativeModelShort ?? row.relativeModel))}
        ${tableCell(formatNumber(row.scoreMae))}
        ${tableCell(formatNumber(row.marginMae))}
        ${tableCell(formatNumber(row.winBrier, 4))}
        ${tableCell(formatNumber(row.worstEventScoreMae))}
      </tr>`
    )
    .join('');

const buildDeploymentTable = (rows: DeploymentReviewRow[]) =>
  rows
    .map(
      row => `<tr>
        ${tableCell(shortModelName(row.modelShort ?? row.model))}
        ${tableCell(row.role)}
        ${tableCell(row.runs)}
        ${tableCell(row.relativeWins)}
        ${tableCell(row.fixedWins)}
        ${tableCell(formatNumber(row.weightedScoreMae))}
        ${tableCell(formatNumber(row.weightedMarginMae))}
        ${tableCell(formatNumber(row.weightedBrier, 4))}
        ${tableCell(formatNumber(row.maxWorstEventScoreMae))}
        ${tableCell(formatNumber(row.pointDeploymentScore, 3))}
        ${tableCell(formatNumber(row.robustnessScore, 3))}
      </tr>`
    )
    .join('');

const findDeploymentRow = (rows: DeploymentReviewRow[], predicate: (row: DeploymentReviewRow) => boolean) =>
  rows.find(predicate) ?? null;

const buildFinalistComparisonRows = (rows: DeploymentReviewRow[]): FinalistComparisonRow[] => [
  {
    label: 'Conservative TailGuard Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('TailGuarded') && row.model.includes('TW=0.22')),
    strength: 'Best current stability-adjusted point candidate after two full replays and five event-key holdouts.',
    caveat: 'The lead is small; the holdout picture is mixed and TW=0.25 wins more holdout ranks.',
    decision: 'Promote as current point model.'
  },
  {
    label: 'TW=0.25 TailGuard Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('TailGuarded') && row.model.includes('TW=0.25')),
    strength: 'Wins three relative holdout ranks and two fixed-score holdout ranks.',
    caveat: 'Higher instability penalty than TW=0.22, so the deployment rule keeps it as an alternate.',
    decision: 'Document as holdout-rank challenger.'
  },
  {
    label: 'TW=0.20 TailGuard Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('TailGuarded') && row.model.includes('TW=0.20')),
    strength: 'Previous defended setting and a useful fixed-score diagnostic.',
    caveat: 'No longer wins the stability-adjusted point deployment score after the micro-sensitivity pass.',
    decision: 'Keep as prior baseline and diagnostic.'
  },
  {
    label: 'Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('Strong RoleV3') && !row.model.includes('TailGuarded')),
    strength: 'Simplest serious finalist and strongest holdout-relative baseline.',
    caveat: 'Slightly weaker stability-adjusted deployment score and tail behavior than conservative TailGuard.',
    decision: 'Keep as explanation baseline.'
  },
  {
    label: 'Stronger TailGuard Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('TailGuarded') && row.model.includes('TW=0.35')),
    strength: 'High-tail specialist; wins multiple hard buckets and trims several worst-event numbers.',
    caveat: 'Less stable as a universal point choice; the easy bucket rejected stronger tail behavior.',
    decision: 'Use as tail-risk comparator, not default.'
  },
  {
    label: 'SelectiveTailGuard Strong RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('SelectiveTailGuarded')),
    strength: 'Good hypothesis: only turn on stronger correction when prior event evidence says the regime is hard.',
    caveat: 'Broad confirmation rejected it on both a failure-mode slice and a supportive slice.',
    decision: 'Rejected, documented, not promoted.'
  },
  {
    label: 'Strong RoleV2',
    row: findDeploymentRow(rows, row => row.model.includes('Strong RoleV2')),
    strength: 'Useful defense/tail comparator with strong fixed-score and role-signal evidence.',
    caveat: 'Does not win the current point deployment rule.',
    decision: 'Keep as role/defense diagnostic comparator.'
  },
  {
    label: 'Moderate RoleV3',
    row: findDeploymentRow(rows, row => row.model.includes('RoleV3') && !row.model.includes('Strong') && !row.model.includes('TailGuarded')),
    strength: 'Safer role-feature alternate in some slices.',
    caveat: 'Lower overall deployment ranking than the Strong RoleV3/TailGuard family.',
    decision: 'Keep as conservative alternate.'
  }
];

const deploymentCell = (row: DeploymentReviewRow | null, value: keyof DeploymentReviewRow, digits = 2) => {
  const raw = row?.[value];
  return typeof raw === 'number' ? formatNumber(raw, digits) : 'n/a';
};

const buildFinalistComparisonTable = (rows: FinalistComparisonRow[]) =>
  rows
    .map(
      finalist => `<tr>
        ${tableCell(finalist.label)}
        ${tableCell(finalist.row?.role ?? 'not in latest deployment review')}
        ${tableCell(deploymentCell(finalist.row, 'weightedScoreMae'))}
        ${tableCell(deploymentCell(finalist.row, 'weightedMarginMae'))}
        ${tableCell(deploymentCell(finalist.row, 'weightedBrier', 4))}
        ${tableCell(deploymentCell(finalist.row, 'maxWorstEventScoreMae'))}
        ${tableCell(deploymentCell(finalist.row, 'pointDeploymentScore', 3))}
        ${tableCell(finalist.strength)}
        ${tableCell(finalist.caveat)}
        ${tableCell(finalist.decision)}
      </tr>`
    )
    .join('');

const buildFinalistComparisonMarkdown = (rows: FinalistComparisonRow[], generatedAt: string) => `# Finalist Comparison

This is the judge-facing answer to: why this model instead of the nearest alternatives?

| Finalist | Role | Score MAE | Margin MAE | Brier | Worst event | Deploy score | Strength | Caveat | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
${rows
  .map(
    finalist =>
      `| ${finalist.label} | ${finalist.row?.role ?? 'not in latest deployment review'} | ${deploymentCell(
        finalist.row,
        'weightedScoreMae'
      )} | ${deploymentCell(finalist.row, 'weightedMarginMae')} | ${deploymentCell(finalist.row, 'weightedBrier', 4)} | ${deploymentCell(
        finalist.row,
        'maxWorstEventScoreMae'
      )} | ${deploymentCell(finalist.row, 'pointDeploymentScore', 3)} | ${finalist.strength} | ${finalist.caveat} | ${finalist.decision} |`
  )
  .join('\n')}

## Summary

The current model wins because it is the best practical balance, not because it dominates every metric. Strong RoleV3 remains the cleanest baseline, stronger TailGuard remains the high-tail specialist, SelectiveTailGuard is a documented rejection, and Strong RoleV2 remains useful for role/defense comparison.

${buildGeneratedStamp(generatedAt)}
`;

const relativeArtifactPath = (filePath: string) => {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath;
};

const buildArtifactFingerprints = (artifacts: ArtifactInput[]): ArtifactFingerprint[] =>
  artifacts.map(artifact => {
    const bytes = fs.readFileSync(artifact.filePath);
    return {
      label: artifact.label,
      path: relativeArtifactPath(artifact.filePath),
      bytes: bytes.byteLength,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });

const buildFingerprintTableRows = (fingerprints: ArtifactFingerprint[]) =>
  fingerprints
    .map(
      fingerprint => `<tr>
        ${tableCell(fingerprint.label)}
        ${tableCell(fingerprint.path)}
        ${tableCell(fingerprint.sha256.slice(0, 20))}
        ${tableCell(String(fingerprint.bytes))}
      </tr>`
    )
    .join('');

const finalCheckSourceEvidenceLabels = [
  'Best model code',
  'Walk-forward features',
  'Model diagnostics',
  'Report scoring code',
  'Training CLI',
  'Research log'
] as const;

const buildSourceEvidenceLockRows = (fingerprints: ArtifactFingerprint[]) => {
  const byLabel = new Map(fingerprints.map(fingerprint => [fingerprint.label, fingerprint]));
  return finalCheckSourceEvidenceLabels
    .map(label => {
      const fingerprint = byLabel.get(label);
      return `<tr>
        ${tableCell(label)}
        ${tableCell(fingerprint?.path ?? 'missing')}
        ${tableCell(fingerprint?.sha256.slice(0, 20) ?? 'missing')}
        ${tableCell(String(fingerprint?.bytes ?? 'missing'))}
      </tr>`;
    })
    .join('');
};

const buildArtifactFingerprintsMarkdown = (fingerprints: ArtifactFingerprint[], generatedAt: string) => `# Artifact Fingerprints

These SHA-256 hashes make the source and generated text package auditable. They are not a security boundary by themselves, but they let us prove which local files were present when the report package was regenerated.

Scope boundary: browser QA, screenshots, and the generated verification summary are checked by freshness, path, and PNG-dimension rules in \`npm run model:verify-dashboard\`; they are intentionally not part of this regeneration-time fingerprint table.

| Artifact | Path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
${fingerprints
  .map(fingerprint => `| ${fingerprint.label} | \`${fingerprint.path}\` | ${fingerprint.bytes} | \`${fingerprint.sha256}\` |`)
  .join('\n')}

## How To Use This

Regenerate the dashboard with \`npm run model:dashboard\`, then compare this file or \`artifact-fingerprints.json\` against the package you are presenting. If the hashes changed, the text package changed; refresh browser QA and screenshots, then rerun \`npm run model:verify-dashboard\`.

${buildGeneratedStamp(generatedAt)}
`;

const modelSourceMapRows = [
  {
    question: 'Where is the promoted model defined?',
    file: 'modeling/src/modeling/train.ts',
    codeArea: 'candidateModelConfigs; the TailGuarded Strong RoleV3 candidate; runModelSearch; buildMonteCarloGroupPredictions; applyResidualCorrection; applyLearnedTailCorrection',
    auditPoint: 'Confirms the current best model is a local training candidate, not a hidden website feature.'
  },
  {
    question: 'Where is known-before-match replay enforced?',
    file: 'modeling/src/modeling/features.ts',
    codeArea: 'buildWalkForwardDataset; buildRow; getSnapshot; updateTeamAfterMatch; summarizeDataset.noFutureCheck',
    auditPoint: 'Confirms feature rows are emitted before the match result updates memory.'
  },
  {
    question: 'Where does RoleV3 defense logic live?',
    file: 'modeling/src/modeling/features.ts',
    codeArea: 'RoleV3Signal; RoleV3Summary; roleV3SignalForSnapshot; chooseRoleV3Summary; addAllianceFeatures role_v3_* fields',
    auditPoint: 'Confirms defense is modeled as opportunity cost and net expected point swing.'
  },
  {
    question: 'Where are OPR/EPA and score features assembled?',
    file: 'modeling/src/modeling/features.ts and modeling/src/modeling/train.ts',
    codeArea: 'addAllianceFeatures; addEventMetadataFeatures; componentBucketsForAlliance; fitOprRatings; createOnlineEpaState; updateOnlineEpa',
    auditPoint: 'Confirms OPR-like baselines and online EPA-style memory are separate concepts.'
  },
  {
    question: 'Where are diagnostics computed?',
    file: 'modeling/src/modeling/diagnostics.ts',
    codeArea: 'buildVifDiagnostics; buildCorrelationDiagnostics; buildFeatureImportance; pearson; fitRidge',
    auditPoint: 'Confirms overfit checks are part of the modeling system rather than presentation text only.'
  },
  {
    question: 'Where is the nuanced leaderboard scored?',
    file: 'modeling/src/reporting/report.ts',
    codeArea: 'buildLeaderboard; buildModelCard; buildStabilityReview; buildDeploymentReview; buildCrossRunSummary; writeCrossRunSummaryArtifacts',
    auditPoint: 'Confirms MAE is only one part of the promotion rule.'
  },
  {
    question: 'Where are judge artifacts generated?',
    file: 'modeling/src/reporting/judgeDashboard.ts',
    codeArea: 'modelSourceMapRows; buildModelSourceMapMarkdown; buildHtml; writeJudgeDashboardArtifacts; buildArtifactFingerprints',
    auditPoint: 'Confirms the final report is generated from saved artifacts, not manually typed after the fact.'
  },
  {
    question: 'Where is the final package verified?',
    file: 'modeling/src/reporting/verifyDashboard.ts',
    codeArea: 'requiredFiles; requiredHtmlStrings; requiredManifestPathKeys; readPngDimensions; checkCopyQuality; verifyJudgeDashboardArtifacts',
    auditPoint: 'Confirms stale or incomplete dashboard packages fail a repeatable local check.'
  },
  {
    question: 'Where is browser QA and screenshot refresh implemented?',
    file: 'modeling/src/reporting/browserQaDashboard.ts',
    codeArea: 'refreshDashboardBrowserQa; createStaticServer; checkViewport; requiredBrowserQaText; forbiddenBrowserQaText',
    auditPoint:
      'Confirms browser proof and the desktop hero, mobile first-screen, print-preview, source-code evidence, final-gate, starred-coverage, story-spine, model-anatomy, accuracy-stats, model-scores, mobile full-page, and desktop full-page screenshots are refreshed by a repeatable local command instead of an ad hoc chat snippet.'
  },
  {
    question: 'Where is the one-command final handoff gate exposed?',
    file: 'package.json',
    codeArea: 'scripts.model:final-check; scripts.model:dashboard; scripts.model:qa-dashboard; scripts.model:verify-dashboard; scripts.model:typecheck; scripts.test',
    auditPoint: 'Confirms the final presentation package can be regenerated, browser-checked, verified, type-checked, and tested from one command.'
  },
  {
    question: 'Where does the final handoff gate write its proof summary?',
    file: 'scripts/model-final-check.mjs',
    codeArea: 'plannedSteps; runCommand; writeSummary; final-check-summary.json; FINAL_CHECK_SUMMARY.md; browserQaHealth; screenshotDimensions; finalVerifier.runsAfterSummaryWrite',
    auditPoint:
      'Confirms the final gate records the promoted model claim, passed pre-verifier steps, no-server cleanup, deliverables coverage, entry-point command checks, browser-QA health, screenshot dimensions, and a verifier pass before the final summary is verified again.'
  },
  {
    question: 'Where are commands exposed?',
    file: 'modeling/src/cli.ts',
    codeArea: 'usage; trainFromStore; resolveModelConfigs; loadExperimentManifest; command === dashboard; command === qa-dashboard; command === verify-dashboard',
    auditPoint: 'Confirms the work can be rerun from local commands instead of only from memory.'
  },
  {
    question: 'Where is the research story preserved?',
    file: 'modeling/MODELING_RESEARCH_LOG.md',
    codeArea: 'iteration notes, model decisions, rejected branches, reflections, and current stance',
    auditPoint: 'Confirms the package documents both the wins and the dead ends.'
  }
];

const buildSourceMapTable = () =>
  modelSourceMapRows
    .map(row => `<tr>${[row.question, row.file, row.codeArea, row.auditPoint].map(tableCell).join('')}</tr>`)
    .join('');

const buildModelSourceMapMarkdown = (generatedAt: string) => `# Model Source Map

This source map ties the judge-facing claims back to the local files that implement them. It is a guide for audit, not a substitute for reading the source and tests.

| Question | File | Code area to inspect | Why it matters |
| --- | --- | --- | --- |
${modelSourceMapRows
  .map(
    row =>
      `| ${markdownCell(row.question)} | \`${markdownCell(row.file)}\` | ${markdownCell(row.codeArea)} | ${markdownCell(row.auditPoint)} |`
  )
  .join('\n')}

## Strongest Audit Route

Start with \`modeling/src/modeling/features.ts\` to verify no-future feature construction, then inspect \`modeling/src/modeling/train.ts\` for the promoted TailGuarded Strong RoleV3 candidate, then inspect \`modeling/src/reporting/report.ts\` for the deployment scoring rule, and finally run \`npm run model:verify-dashboard\` to check that this package matches the generated manifest and fingerprints.

${buildGeneratedStamp(generatedAt)}
`;

const buildModelAnatomySvg = () => `<svg viewBox="0 0 1080 430" role="img" aria-labelledby="model-anatomy-title model-anatomy-desc" xmlns="http://www.w3.org/2000/svg">
  <title id="model-anatomy-title">Conservative TailGuard Strong RoleV3 model anatomy</title>
  <desc id="model-anatomy-desc">A flow diagram showing known-before-match data, online team memory, role and defense features, residual correction, TailGuard, and final score distribution outputs.</desc>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f766e" />
    </marker>
    <linearGradient id="box-accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f766e" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1080" height="430" rx="18" fill="#f8fbfd" />
  <g font-family="Inter, Arial, sans-serif">
    <text x="40" y="44" fill="#111827" font-size="28" font-weight="800">What the promoted model does before a match</text>
    <text x="40" y="74" fill="#475569" font-size="15">Every box is known-before-match. Future score information only enters after the prediction is already saved.</text>
    <g transform="translate(40 110)">
      <rect width="200" height="100" rx="8" fill="#ffffff" stroke="#d8e2ee" />
      <rect width="6" height="100" rx="3" fill="#0f766e" />
      <text x="20" y="30" fill="#0f766e" font-size="14" font-weight="800">Data Layer</text>
      <text x="20" y="56" fill="#111827" font-size="16" font-weight="700">Official history</text>
      <text x="20" y="79" fill="#475569" font-size="13">FIRST/TBA scores, event</text>
      <text x="20" y="96" fill="#475569" font-size="13">context, prior rankings</text>
    </g>
    <g transform="translate(295 110)">
      <rect width="200" height="100" rx="8" fill="#ffffff" stroke="#d8e2ee" />
      <rect width="6" height="100" rx="3" fill="#2563eb" />
      <text x="20" y="30" fill="#2563eb" font-size="14" font-weight="800">Online Memory</text>
      <text x="20" y="56" fill="#111827" font-size="16" font-weight="700">EPA-style updates</text>
      <text x="20" y="79" fill="#475569" font-size="13">Team state refreshes after</text>
      <text x="20" y="96" fill="#475569" font-size="13">each completed match</text>
    </g>
    <g transform="translate(550 110)">
      <rect width="200" height="100" rx="8" fill="#ffffff" stroke="#d8e2ee" />
      <rect width="6" height="100" rx="3" fill="#16a34a" />
      <text x="20" y="30" fill="#15803d" font-size="14" font-weight="800">RoleV3 Features</text>
      <text x="20" y="56" fill="#111827" font-size="16" font-weight="700">Net point swing</text>
      <text x="20" y="79" fill="#475569" font-size="13">Suppression, lost offense,</text>
      <text x="20" y="96" fill="#475569" font-size="13">foul risk, confidence</text>
    </g>
    <g transform="translate(805 110)">
      <rect width="200" height="100" rx="8" fill="#ffffff" stroke="#d8e2ee" />
      <rect width="6" height="100" rx="3" fill="#ea580c" />
      <text x="20" y="30" fill="#c2410c" font-size="14" font-weight="800">Score Engine</text>
      <text x="20" y="56" fill="#111827" font-size="16" font-weight="700">Monte Carlo scores</text>
      <text x="20" y="79" fill="#475569" font-size="13">Red/blue means, bands,</text>
      <text x="20" y="96" fill="#475569" font-size="13">win probability</text>
    </g>
    <path d="M245 160 H288" stroke="#0f766e" stroke-width="3" marker-end="url(#arrow)" />
    <path d="M500 160 H543" stroke="#0f766e" stroke-width="3" marker-end="url(#arrow)" />
    <path d="M755 160 H798" stroke="#0f766e" stroke-width="3" marker-end="url(#arrow)" />
    <g transform="translate(172 270)">
      <rect width="230" height="94" rx="8" fill="#fff7ed" stroke="#fed7aa" />
      <text x="18" y="30" fill="#9a3412" font-size="14" font-weight="800">No-future residual correction</text>
      <text x="18" y="57" fill="#111827" font-size="15" font-weight="700">Learns from prior misses</text>
      <text x="18" y="78" fill="#7c2d12" font-size="13">Small correction, updated online</text>
    </g>
    <g transform="translate(432 270)">
      <rect width="230" height="94" rx="8" fill="#ecfdf5" stroke="#bbf7d0" />
      <text x="18" y="30" fill="#15803d" font-size="14" font-weight="800">Conservative TailGuard</text>
      <text x="18" y="57" fill="#111827" font-size="15" font-weight="700">Protects hard-event tails</text>
      <text x="18" y="78" fill="#166534" font-size="13">Tiny adjustment, broad-confirmed</text>
    </g>
    <g transform="translate(692 270)">
      <rect width="230" height="94" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
      <text x="18" y="30" fill="#1d4ed8" font-size="14" font-weight="800">Deployment decision</text>
      <text x="18" y="57" fill="#111827" font-size="15" font-weight="700">Promote only if stable</text>
      <text x="18" y="78" fill="#1e3a8a" font-size="13">Holdouts, calibration, penalties</text>
    </g>
    <path d="M895 214 C895 245 790 248 790 266" stroke="#64748b" stroke-width="2.5" fill="none" marker-end="url(#arrow)" />
    <path d="M692 318 H670" stroke="#64748b" stroke-width="2.5" marker-end="url(#arrow)" />
    <path d="M432 318 H410" stroke="#64748b" stroke-width="2.5" marker-end="url(#arrow)" />
    <path d="M287 270 C287 242 396 242 396 214" stroke="#64748b" stroke-width="2.5" fill="none" marker-end="url(#arrow)" />
  </g>
</svg>`;

const buildModelAnatomyMarkdown = (generatedAt: string) => `# Model Anatomy

This is the short explanation of what the promoted model does before a match. It is intentionally written for judges and teachers, not just programmers.

## Flow

1. **Data layer:** Load official match history from FIRST/TBA cache, event context, rankings, and local cached evidence that is available before the match.
2. **Online memory:** Maintain EPA-style team state that updates only after each completed match.
3. **RoleV3 features:** Estimate offense, suppression value, lost-offense cost, foul exposure, role confidence, and net point swing.
4. **Score engine:** Produce red and blue score distributions through Monte Carlo-style simulation, not just one winner label.
5. **Residual correction:** Learn small corrections from prior prediction errors only. This is the no-future stacked layer.
6. **Conservative TailGuard:** Apply the broad-confirmed tiny tail correction that improved the stability-adjusted deployment score without promoting the unstable stronger gate.
7. **Deployment decision:** Promote only when the candidate survives walk-forward replay, holdouts, calibration checks, tail-risk checks, and overfit penalties.

## What Makes It Defensible

- The model predicts before the match, then updates after the match.
- It keeps OPR-style thinking as a baseline, but uses EPA-style online memory for real pre-match replay.
- It treats defense as net value: suppression minus lost scoring and foul risk.
- It rejects models that look good on full replay but fail holdout confirmation.
- It exposes uncertainty, caveats, and near-ties instead of pretending to be an oracle.

${buildGeneratedStamp(generatedAt)}
`;

const buildFeatureTable = (bestResult: ModelResult) =>
  bestResult.featureImportance
    .slice(0, 12)
    .map(
      item => `<tr>${tableCell(item.feature)}${tableCell(formatNumber(item.coefficient, 4))}${tableCell(
        formatNumber(item.standardizedMagnitude, 3)
      )}</tr>`
    )
    .join('');

const buildVifTable = (bestResult: ModelResult) =>
  bestResult.vifDiagnostics
    .slice(0, 10)
    .map(item => `<tr>${tableCell(item.feature)}${tableCell(formatNumber(item.vif, 2))}</tr>`)
    .join('');

const buildRoleExamples = (predictions: MatchPrediction[]) =>
  predictions
    .filter(prediction => prediction.redRole?.defenderTeamKey || prediction.blueRole?.defenderTeamKey)
    .sort((left, right) => {
      const leftSwing = Math.max(Math.abs(left.redRole?.netSwing ?? 0), Math.abs(left.blueRole?.netSwing ?? 0));
      const rightSwing = Math.max(Math.abs(right.redRole?.netSwing ?? 0), Math.abs(right.blueRole?.netSwing ?? 0));
      return rightSwing - leftSwing;
    })
    .slice(0, 8)
    .map(prediction => {
      const redRole = prediction.redRole?.defenderTeamKey
        ? `red defender ${prediction.redRole.defenderTeamKey}, net ${formatNumber(prediction.redRole.netSwing)}`
        : 'red all offense';
      const blueRole = prediction.blueRole?.defenderTeamKey
        ? `blue defender ${prediction.blueRole.defenderTeamKey}, net ${formatNumber(prediction.blueRole.netSwing)}`
        : 'blue all offense';
      return `<tr>${tableCell(prediction.matchKey)}${tableCell(redRole)}${tableCell(blueRole)}${tableCell(
        `${formatNumber(prediction.redExpectedScore, 1)}-${formatNumber(prediction.blueExpectedScore, 1)}`
      )}${tableCell(`${prediction.redActualScore}-${prediction.blueActualScore}`)}</tr>`;
    })
    .join('');

const roleGuideRows = [
  {
    topic: 'Decision rule',
    explanation: 'A defensive assignment is attractive only when expected opponent suppression is larger than lost offensive value plus foul risk.',
    judgeLine: 'Defense is not a label; it is a net point-swing calculation.'
  },
  {
    topic: 'Offense cost',
    explanation: 'If a strong scorer defends, the alliance gives up some expected scoring. The model charges that lost offense before calling defense useful.',
    judgeLine: 'A 30-point scorer does not keep those 30 points while defending.'
  },
  {
    topic: 'Suppression value',
    explanation: 'The model looks for prior evidence that opponents underperform when this team is present or when similar role signals appear.',
    judgeLine: 'The model asks whether disrupting the other alliance is worth more than scoring directly.'
  },
  {
    topic: 'Foul risk',
    explanation: 'Foul and tech-foul exposure reduce the defensive value because bad defense can give points back.',
    judgeLine: 'Reckless defense is not modeled as free value.'
  },
  {
    topic: 'Confidence',
    explanation: 'Early-event or low-sample role reads are treated cautiously. The model can show a clue without pretending it is certain.',
    judgeLine: 'A role read is evidence for scouts, not an automatic command.'
  },
  {
    topic: 'Scout/PPC limitation',
    explanation:
      'The current local cache has 356 matched Firebase scout rows, mostly concentrated in 2026mnum, so the guide treats scout labels as sparse supporting evidence rather than a global model driver.',
    judgeLine: 'The model refuses to generalize sparse scout data beyond the events we actually matched.'
  }
];

const buildRoleGuideTable = () =>
  roleGuideRows.map(row => `<tr>${[row.topic, row.explanation, row.judgeLine].map(tableCell).join('')}</tr>`).join('');

const markdownCell = (value: string | number) => String(value).replace(/\|/g, '\\|');

const buildRoleExamplesMarkdown = (predictions: MatchPrediction[]) => {
  const examples = predictions
    .filter(prediction => prediction.redRole?.defenderTeamKey || prediction.blueRole?.defenderTeamKey)
    .sort((left, right) => largestRoleSwing(right) - largestRoleSwing(left))
    .slice(0, 6);
  if (examples.length === 0) return 'No defender role examples were available in the compact artifact.';
  return `| Match | Red role read | Blue role read | Expected score | Actual score |
| --- | --- | --- | --- | --- |
${examples
  .map(prediction => {
    const redRole = prediction.redRole?.defenderTeamKey
      ? `red defender ${prediction.redRole.defenderTeamKey}, net ${formatNumber(prediction.redRole.netSwing)}`
      : 'red all offense';
    const blueRole = prediction.blueRole?.defenderTeamKey
      ? `blue defender ${prediction.blueRole.defenderTeamKey}, net ${formatNumber(prediction.blueRole.netSwing)}`
      : 'blue all offense';
    return `| ${markdownCell(prediction.matchKey)} | ${markdownCell(redRole)} | ${markdownCell(blueRole)} | ${markdownCell(
      `${formatNumber(prediction.redExpectedScore, 1)}-${formatNumber(prediction.blueExpectedScore, 1)}`
    )} | ${markdownCell(`${prediction.redActualScore}-${prediction.blueActualScore}`)} |`;
  })
  .join('\n')}`;
};

const buildDefenseRoleGuideMarkdown = (
  predictions: MatchPrediction[],
  strategyExample: MatchPrediction | null,
  generatedAt: string
) => `# Defense Role Guide

This guide explains the part of the model that answers a strategy question humans actually care about: when might a robot be worth more as a defender than as a scorer?

## Core Formula

Defensive net swing = expected opponent suppression - lost offensive value - foul risk.

The important implication is that defense has an opportunity cost. If a team normally adds 30 points on offense but can plausibly suppress 50 opponent points with low foul risk, defense can be a better role. If the same team suppresses only 15 points, it should probably keep scoring.

## How RoleV3 Keeps This Honest

| Topic | Explanation | Short judge line |
| --- | --- | --- |
${roleGuideRows.map(row => `| ${markdownCell(row.topic)} | ${markdownCell(row.explanation)} | ${markdownCell(row.judgeLine)} |`).join('\n')}

## Saved Role Examples

${buildRoleExamplesMarkdown(predictions)}

## Strategy Example Read

${
  strategyExample
    ? `For \`${strategyExample.matchKey}\`, the saved strategy example says:

- ${roleOptionText('Red', strategyExample)}
- ${roleOptionText('Blue', strategyExample)}
- Predicted score: ${formatNumber(strategyExample.redExpectedScore, 1)}-${formatNumber(strategyExample.blueExpectedScore, 1)}
- Actual score: ${strategyExample.redActualScore}-${strategyExample.blueActualScore}
`
    : 'No saved strategy example with role data was available in the compact artifact.'
}

## Boundary

This is a role clue, not proof of what a drive team will choose. The final decision still needs live scouting, robot condition, alliance goals, driver confidence, and penalty awareness.

${buildGeneratedStamp(generatedAt)}
`;

const predictionTotalError = (prediction: MatchPrediction) =>
  Math.abs(prediction.redExpectedScore + prediction.blueExpectedScore - prediction.redActualScore - prediction.blueActualScore);

const predictionMarginError = (prediction: MatchPrediction) =>
  Math.abs(
    prediction.redExpectedScore -
      prediction.blueExpectedScore -
      (prediction.redActualScore - prediction.blueActualScore)
  );

const largestRoleSwing = (prediction: MatchPrediction) =>
  Math.max(Math.abs(prediction.redRole?.netSwing ?? 0), Math.abs(prediction.blueRole?.netSwing ?? 0));

const chooseStrategyExample = (predictions: MatchPrediction[]) => {
  const candidates = predictions
    .filter(prediction => prediction.redRole?.defenderTeamKey || prediction.blueRole?.defenderTeamKey)
    .filter(prediction => prediction.predictedWinner === prediction.actualWinner)
    .filter(prediction => predictionTotalError(prediction) <= 30 && predictionMarginError(prediction) <= 40)
    .sort((left, right) => {
      const swingDelta = largestRoleSwing(right) - largestRoleSwing(left);
      if (Math.abs(swingDelta) > 0.001) return swingDelta;
      const leftError = predictionTotalError(left) + predictionMarginError(left);
      const rightError = predictionTotalError(right) + predictionMarginError(right);
      return leftError - rightError;
    });
  return candidates[0] ?? predictions.find(prediction => prediction.redRole?.defenderTeamKey || prediction.blueRole?.defenderTeamKey) ?? null;
};

const roleOptionText = (alliance: 'Red' | 'Blue', prediction: MatchPrediction) => {
  const role = alliance === 'Red' ? prediction.redRole : prediction.blueRole;
  if (!role?.defenderTeamKey) return `${alliance}: all offense; no positive defensive net swing selected.`;
  return `${alliance}: ${role.defenderTeamKey} as defender, net +${formatNumber(role.netSwing)} points (${formatNumber(
    role.defenseValue
  )} suppression - ${formatNumber(role.offenseCost)} lost offense - ${formatNumber(role.foulRisk)} foul risk).`;
};

const buildStrategyExampleHtml = (prediction: MatchPrediction | null) => {
  if (!prediction) {
    return '<div class="status-note">No strategy example with role data was available in the compact artifact.</div>';
  }
  const predictedMargin = prediction.redExpectedScore - prediction.blueExpectedScore;
  const actualMargin = prediction.redActualScore - prediction.blueActualScore;
  return `
      <div class="split">
        <div class="card">
          <strong>${escapeHtml(prediction.matchKey)}</strong>
          <p>Before this match, the model expected red ${formatNumber(prediction.redExpectedScore, 1)} and blue ${formatNumber(
            prediction.blueExpectedScore,
            1
          )}. Win probability was red ${formatPercent(prediction.redWinProbability)} and blue ${formatPercent(
            prediction.blueWinProbability
          )}.</p>
          <p>Actual result: red ${formatNumber(prediction.redActualScore, 0)} and blue ${formatNumber(
            prediction.blueActualScore,
            0
          )}. Predicted winner: ${escapeHtml(prediction.predictedWinner)}; actual winner: ${escapeHtml(
            prediction.actualWinner
          )}.</p>
        </div>
        <div class="card">
          <strong>Strategy read</strong>
          <p>${escapeHtml(roleOptionText('Red', prediction))}</p>
          <p>${escapeHtml(roleOptionText('Blue', prediction))}</p>
          <p>Total-score error ${formatNumber(predictionTotalError(prediction), 1)}; margin error ${formatNumber(
            Math.abs(predictedMargin - actualMargin),
            1
          )}. This is an example of decision support, not a claim that every match is this clean.</p>
        </div>
      </div>`;
};

const predictionWinConfidence = (prediction: MatchPrediction) =>
  Math.max(prediction.redWinProbability, prediction.blueWinProbability);

const hasCompleteCaseStudyScore = (prediction: MatchPrediction) =>
  prediction.redActualScore > 0 && prediction.blueActualScore > 0;

const addCaseStudy = (cases: PredictionCaseStudy[], seen: Set<string>, caseStudy: PredictionCaseStudy | null) => {
  if (!caseStudy || seen.has(caseStudy.prediction.matchKey)) return;
  cases.push(caseStudy);
  seen.add(caseStudy.prediction.matchKey);
};

const choosePredictionCaseStudies = (predictions: MatchPrediction[]) => {
  const cases: PredictionCaseStudy[] = [];
  const seen = new Set<string>();
  const completedPredictions = predictions.filter(hasCompleteCaseStudyScore);
  const strategy = chooseStrategyExample(predictions);
  addCaseStudy(
    cases,
    seen,
    strategy
      ? {
          label: 'Role-aware strategy read',
          prediction: strategy,
          why: 'A saved pre-match output where the model gives scores, win probability, and role/defense interpretation together.'
        }
      : null
  );

  const closeCall =
    [...completedPredictions]
      .filter(prediction => Math.abs(prediction.redActualScore - prediction.blueActualScore) <= 12)
      .sort((left, right) => {
        const leftUncertainty = Math.abs(left.redWinProbability - 0.5);
        const rightUncertainty = Math.abs(right.redWinProbability - 0.5);
        if (Math.abs(leftUncertainty - rightUncertainty) > 0.001) return leftUncertainty - rightUncertainty;
        return predictionMarginError(left) - predictionMarginError(right);
      })[0] ?? null;
  addCaseStudy(
    cases,
    seen,
    closeCall
      ? {
          label: 'Close-match uncertainty',
          prediction: closeCall,
          why: 'A tight match where the useful output is not just a winner pick, but uncertainty and margin risk.'
        }
      : null
  );

  const confidentMiss =
    [...completedPredictions]
      .filter(prediction => prediction.predictedWinner !== prediction.actualWinner)
      .sort((left, right) => predictionWinConfidence(right) - predictionWinConfidence(left))[0] ?? null;
  addCaseStudy(
    cases,
    seen,
    confidentMiss
      ? {
          label: 'Confident miss',
          prediction: confidentMiss,
          why: 'A deliberately uncomfortable example: the model was confident and wrong, which is why calibration and risk language matter.'
        }
      : null
  );

  const largestMiss =
    [...completedPredictions].sort(
      (left, right) =>
        predictionTotalError(right) +
        predictionMarginError(right) -
        (predictionTotalError(left) + predictionMarginError(left))
    )[0] ?? null;
  addCaseStudy(
    cases,
    seen,
    largestMiss
      ? {
          label: 'Largest saved miss',
          prediction: largestMiss,
          why: 'A stress case that shows why worst-event behavior and tail risk belong in the leaderboard.'
        }
      : null
  );

  if (cases.length < 4) {
    [...completedPredictions]
      .sort(
        (left, right) =>
          predictionTotalError(left) +
          predictionMarginError(left) -
          (predictionTotalError(right) + predictionMarginError(right))
      )
      .forEach(prediction =>
        addCaseStudy(cases, seen, {
          label: 'Additional representative match',
          prediction,
          why: 'Included to round out the saved case-study set when one specialized category is unavailable.'
        })
      );
  }

  return cases.slice(0, 4);
};

const caseStudyExpectedScore = (prediction: MatchPrediction) =>
  `${formatNumber(prediction.redExpectedScore, 1)}-${formatNumber(prediction.blueExpectedScore, 1)}`;

const caseStudyActualScore = (prediction: MatchPrediction) =>
  `${formatNumber(prediction.redActualScore, 0)}-${formatNumber(prediction.blueActualScore, 0)}`;

const caseStudySummary = (caseStudy: PredictionCaseStudy) => {
  const prediction = caseStudy.prediction;
  return {
    match: prediction.matchKey,
    expected: caseStudyExpectedScore(prediction),
    actual: caseStudyActualScore(prediction),
    winProbability: `red ${formatPercent(prediction.redWinProbability)}, blue ${formatPercent(prediction.blueWinProbability)}`,
    predictedWinner: prediction.predictedWinner,
    actualWinner: prediction.actualWinner,
    totalError: formatNumber(predictionTotalError(prediction), 1),
    marginError: formatNumber(predictionMarginError(prediction), 1)
  };
};

const buildPredictionCaseStudiesHtml = (caseStudies: PredictionCaseStudy[]) => {
  if (caseStudies.length === 0) {
    return '<div class="status-note">No match predictions were available in the compact artifact.</div>';
  }
  return `<div class="cards">${caseStudies
    .map(caseStudy => {
      const summary = caseStudySummary(caseStudy);
      return `<div class="card">
        <strong>${escapeHtml(caseStudy.label)}</strong>
        <p>${escapeHtml(caseStudy.why)}</p>
        <p><strong>${escapeHtml(summary.match)}</strong>: expected ${escapeHtml(summary.expected)}, actual ${escapeHtml(
          summary.actual
        )}. Win probability ${escapeHtml(summary.winProbability)}.</p>
        <p>Predicted ${escapeHtml(summary.predictedWinner)}, actual ${escapeHtml(summary.actualWinner)}. Total error ${escapeHtml(
          summary.totalError
        )}; margin error ${escapeHtml(summary.marginError)}.</p>
      </div>`;
    })
    .join('')}</div>`;
};

const buildPredictionCaseStudiesMarkdown = (caseStudies: PredictionCaseStudy[], generatedAt: string) => {
  if (caseStudies.length === 0) {
    return `# Prediction Case Studies

No match predictions were available in the compact artifact.

${buildGeneratedStamp(generatedAt)}
`;
  }

  return `# Prediction Case Studies

These examples are selected from the saved best-run predictions. They are intentionally mixed: one useful strategic read, one close uncertainty case, one uncomfortable miss when available, and one large-error stress case. This prevents the presentation from cherry-picking only pretty examples.

| Case | Why it is included | Match | Expected | Actual | Win probability | Predicted | Actual | Total error | Margin error |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
${caseStudies
  .map(caseStudy => {
    const summary = caseStudySummary(caseStudy);
    return `| ${caseStudy.label} | ${caseStudy.why} | ${summary.match} | ${summary.expected} | ${summary.actual} | ${summary.winProbability} | ${summary.predictedWinner} | ${summary.actualWinner} | ${summary.totalError} | ${summary.marginError} |`;
  })
  .join('\n')}

## How To Explain This To Judges

The model is not evaluated by one cherry-picked match. These cases show the range: a role-aware strategic read, a close match where uncertainty matters, a miss that keeps calibration honest, and a large-error example that justifies worst-event and tail-risk diagnostics.

${buildGeneratedStamp(generatedAt)}
`;
};

const latestResearchStatus = (researchLog: string) => {
  const marker = '## Current Status';
  const start = researchLog.indexOf(marker);
  if (start < 0) return '';
  const after = researchLog.slice(start + marker.length).trim();
  const firstHeading = after.indexOf('\n## ');
  const section = firstHeading >= 0 ? after.slice(0, firstHeading) : after;
  const paragraph = section
    .split(/\n\s*\n/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(part => part.startsWith('Latest checkpoint'));
  return paragraph ?? section.slice(0, 1200);
};

const buildExecutiveRead = (bestDeployment: DeploymentReviewRow, summary: CrossRunSummary) =>
  `${shortModelName(
    bestDeployment.model
  )} is the current best defensible model, not an unbeatable claim. It won the stability-adjusted deployment rule after the RoleV3, TailGuard, and SelectiveTailGuard confirmation work, with weighted score MAE ${formatNumber(
    bestDeployment.weightedScoreMae
  )}, weighted margin MAE ${formatNumber(bestDeployment.weightedMarginMae)}, weighted Brier ${formatNumber(
    bestDeployment.weightedBrier,
    4
  )}, and deployment score ${formatNumber(
    bestDeployment.pointDeploymentScore,
    3
  )}. The evidence remains honest: the stability review is ${summary.stabilityReview.status}, the lead is small, Strong RoleV3 is still the clean baseline, stronger TailGuard is a high-tail specialist, and SelectiveTailGuard was rejected after broad confirmation. Full details live in the research log, finalist comparison, model card, risk register, and Q&A.`;

const loadFailureModeAtlas = (filePath: string): FailureModeAtlas | null => {
  if (!fs.existsSync(filePath)) return null;
  const report = readJsonFile<ResidualDiagnosticsReport>(filePath);
  if (!Array.isArray(report.diagnostics) || report.diagnostics.length === 0) return null;
  return {
    sourcePath: filePath,
    createdAt: report.createdAt,
    diagnostics: report.diagnostics,
    current2026: report.diagnostics.find(entry => entry.runName.includes('current-2026')),
    broad: report.diagnostics.find(entry => entry.runName.includes('2024-2026'))
  };
};

const failureModeSource = (atlas: FailureModeAtlas) => {
  const source = atlas.broad ?? atlas.current2026 ?? atlas.diagnostics[0];
  if (!source) {
    throw new Error('Failure mode atlas has no diagnostics entries.');
  }
  return source;
};

const residualRows = (rows: ResidualAggregate[] | undefined, limit: number) =>
  (rows ?? [])
    .slice()
    .sort((left, right) => right.scoreMae - left.scoreMae)
    .slice(0, limit);

const residualTableRows = (rows: ResidualAggregate[] | undefined, limit: number) =>
  residualRows(rows, limit)
    .map(
      row =>
        `<tr>${[
          row.key,
          row.matchCount,
          formatNumber(row.signedResidual),
          formatNumber(row.scoreMae),
          formatNumber(row.actualMean),
          formatNumber(row.expectedMean),
          formatPercent(row.coverage),
          formatNumber(row.intervalWidth, 1)
        ]
          .map(tableCell)
          .join('')}</tr>`
    )
    .join('');

const residualMarkdownRows = (rows: ResidualAggregate[] | undefined, limit: number) =>
  residualRows(rows, limit)
    .map(
      row =>
        `| ${row.key} | ${row.matchCount} | ${formatNumber(row.signedResidual)} | ${formatNumber(row.scoreMae)} | ${formatNumber(
          row.actualMean
        )} | ${formatNumber(row.expectedMean)} | ${formatPercent(row.coverage)} | ${formatNumber(row.intervalWidth, 1)} |`
    )
    .join('\n');

const phaseRows = (rows: ResidualAggregate[] | undefined) =>
  (rows ?? [])
    .slice()
    .sort((left, right) => {
      const order: Record<string, number> = { early: 0, middle: 1, late: 2 };
      return (order[left.key] ?? 99) - (order[right.key] ?? 99);
    });

const phaseTableRows = (rows: ResidualAggregate[] | undefined) =>
  phaseRows(rows)
    .map(
      row =>
        `<tr>${[
          row.key,
          row.matchCount,
          formatNumber(row.signedResidual),
          formatNumber(row.scoreMae),
          formatPercent(row.coverage),
          formatNumber(row.actualMean),
          formatNumber(row.expectedMean)
        ]
          .map(tableCell)
          .join('')}</tr>`
    )
    .join('');

const phaseMarkdownRows = (rows: ResidualAggregate[] | undefined) =>
  phaseRows(rows)
    .map(
      row =>
        `| ${row.key} | ${row.matchCount} | ${formatNumber(row.signedResidual)} | ${formatNumber(row.scoreMae)} | ${formatPercent(
          row.coverage
        )} | ${formatNumber(row.actualMean)} | ${formatNumber(row.expectedMean)} |`
    )
    .join('\n');

const calibrationGapRows = (entry: ResidualDiagnosticsEntry | undefined, limit: number) =>
  (entry?.calibrationBuckets ?? [])
    .slice()
    .sort((left, right) => Math.abs(right.predictedWinRate - right.actualWinRate) - Math.abs(left.predictedWinRate - left.actualWinRate))
    .slice(0, limit);

const calibrationGapTableRows = (entry: ResidualDiagnosticsEntry | undefined, limit: number) =>
  calibrationGapRows(entry, limit)
    .map(
      row =>
        `<tr>${[
          row.bucket,
          row.matches,
          formatPercent(row.predictedWinRate),
          formatPercent(row.actualWinRate),
          formatPercent(row.predictedWinRate - row.actualWinRate),
          formatNumber(row.brier, 4)
        ]
          .map(tableCell)
          .join('')}</tr>`
    )
    .join('');

const calibrationGapMarkdownRows = (entry: ResidualDiagnosticsEntry | undefined, limit: number) =>
  calibrationGapRows(entry, limit)
    .map(
      row =>
        `| ${row.bucket} | ${row.matches} | ${formatPercent(row.predictedWinRate)} | ${formatPercent(row.actualWinRate)} | ${formatPercent(
          row.predictedWinRate - row.actualWinRate
        )} | ${formatNumber(row.brier, 4)} |`
    )
    .join('\n');

const buildFailureModeAtlasHtml = (atlas: FailureModeAtlas | null) => {
  if (!atlas) {
    return `<div class="status-note">Current TailGuard residual diagnostics were not available when this dashboard was generated. Rerun <code>npm run model:diagnose -- --run-dirs modeling/artifacts/runs/current-2026-role-v3-tailguard-micro-sensitivity,modeling/artifacts/runs/current-2024-2026-role-v3-tailguard-micro-sensitivity --output-dir modeling/artifacts/reports/current-tailguard-residual-diagnostics</code>, then regenerate the dashboard.</div>`;
  }
  const source = failureModeSource(atlas);
  return `<div class="cards">
        <div class="card"><strong>Source run</strong><p>${escapeHtml(source.runName)}</p></div>
        <div class="card"><strong>Score MAE</strong><p>${formatNumber(source.scoreMae)}</p></div>
        <div class="card"><strong>Worst event MAE</strong><p>${formatNumber(source.worstEventScoreMae)}</p></div>
        <div class="card"><strong>Win Brier</strong><p>${formatNumber(source.winBrier, 4)}</p></div>
      </div>
      <div class="split" style="margin-top:16px;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Worst event</th><th>Matches</th><th>Signed residual</th><th>Score MAE</th><th>Actual mean</th><th>Expected mean</th><th>Coverage</th><th>Width</th></tr></thead>
            <tbody>${residualTableRows(source.eventResiduals, 8)}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Win-prob bucket</th><th>Matches</th><th>Predicted</th><th>Actual</th><th>Gap</th><th>Brier</th></tr></thead>
            <tbody>${calibrationGapTableRows(source, 6)}</tbody>
          </table>
        </div>
      </div>
      <div class="split" style="margin-top:16px;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>All-event phase</th><th>Matches</th><th>Signed residual</th><th>Score MAE</th><th>Coverage</th><th>Actual mean</th><th>Expected mean</th></tr></thead>
            <tbody>${phaseTableRows(source.overallPhaseResiduals)}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Champ-like phase</th><th>Matches</th><th>Signed residual</th><th>Score MAE</th><th>Coverage</th><th>Actual mean</th><th>Expected mean</th></tr></thead>
            <tbody>${phaseTableRows(source.championshipPhaseResiduals)}</tbody>
          </table>
        </div>
      </div>
      <div class="status-note" style="margin-top:16px;">
        This is not an excuse for misses; it is why worst-event MAE and TailGuard exist. The hardest failures cluster in very high-scoring and championship-like contexts, especially where the model underpredicts middle-phase scoring jumps. Late-phase evidence is usually better, which supports online updating, uncertainty bands, and conservative tail control instead of pretending the model sees everything.
      </div>`;
};

const buildFailureModeAtlasMarkdown = (atlas: FailureModeAtlas | null, generatedAt: string) => {
  if (!atlas) {
    return `# Failure Mode Atlas

Current TailGuard residual diagnostics were not available when this file was generated.

${buildGeneratedStamp(generatedAt)}
`;
  }
  const source = failureModeSource(atlas);
  return `# Failure Mode Atlas

This file turns the current TW=0.22 TailGuard residual diagnostics into a judge-facing failure analysis. Positive signed residual means the model underpredicted score; negative signed residual means it overpredicted score.

## Source

- Diagnostics source: \`${path.relative(process.cwd(), atlas.sourcePath)}\`
- Diagnostics generated: ${atlas.createdAt}
- Dashboard generated: ${generatedAt}
- Displayed run: \`${source.runName}\`
- Model: ${shortModelName(source.model)}
- Score MAE: ${formatNumber(source.scoreMae)}
- Margin MAE: ${formatNumber(source.marginMae)}
- Win Brier: ${formatNumber(source.winBrier, 4)}
- Worst-event score MAE: ${formatNumber(source.worstEventScoreMae)}

## Worst Events

| Event | Matches | Signed residual | Score MAE | Actual mean | Expected mean | Coverage | Width |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${residualMarkdownRows(source.eventResiduals, 8)}

## All-Event Phase Residuals

| Phase | Matches | Signed residual | Score MAE | Coverage | Actual mean | Expected mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${phaseMarkdownRows(source.overallPhaseResiduals)}

## Championship-Like Phase Residuals

| Phase | Matches | Signed residual | Score MAE | Coverage | Actual mean | Expected mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${phaseMarkdownRows(source.championshipPhaseResiduals)}

## Largest Win-Probability Calibration Gaps

| Red win-prob bucket | Matches | Predicted red win rate | Actual red win rate | Gap | Brier |
| --- | ---: | ---: | ---: | ---: | ---: |
${calibrationGapMarkdownRows(source, 6)}

## Judge Explanation

- The hardest misses are not random trivia. They cluster around high-scoring events and championship-like settings where score scale and match style move quickly.
- The model usually underpredicts the middle of championship-like events, which suggests that strong-event score inflation arrives faster than conservative prior memory expects.
- Late phases are generally less biased than early and middle phases, which supports the online EPA-style update design.
- Calibration is decent overall, but middle probability buckets are still noisy enough that win probability should be presented as a probability, not a guarantee.
- TailGuard is useful because it acknowledges those tails. It does not erase the tails.

## Do Not Say

- Do not say the model catches every unusual event.
- Do not say TailGuard solves all tail risk.
- Do not say the uncertainty bands are perfect confidence intervals.
- Do not say high-scoring championships are easy after enough historical replay.

${buildGeneratedStamp(generatedAt)}
`;
};

const buildHtml = ({
  summary,
  metricSvg,
  bestRun,
  bestResult,
  modelJourneyRows,
  modelLeaderboardRows,
  criticalFingerprints,
  failureModeAtlas,
  researchStatus,
  generatedAt
}: {
  summary: CrossRunSummary;
  metricSvg: string;
  bestRun: ResearchRun;
  bestResult: ModelResult;
  modelJourneyRows: ModelJourneyRow[];
  modelLeaderboardRows: ModelLeaderboardRow[];
  criticalFingerprints: ArtifactFingerprint[];
  failureModeAtlas: FailureModeAtlas | null;
  researchStatus: string;
  generatedAt: string;
}) => {
  const deploymentRows = summary.deploymentReview.rows;
  const bestDeployment = deploymentRows[0];
  if (!bestDeployment) {
    throw new Error('Cannot build judge dashboard without deployment review rows.');
  }
  const holdoutRows = summary.rows;
  const predictionScatter = buildPredictionScatterSvg(bestResult.scorePredictions);
  const calibration = buildCalibrationSvg(bestResult.matchPredictions);
  const stabilityNotes = summary.stabilityReview.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('');
  const finalistComparisonRows = buildFinalistComparisonRows(deploymentRows);
  const roleExamples = buildRoleExamples(bestResult.matchPredictions);
  const strategyExample = chooseStrategyExample(bestResult.matchPredictions);
  const predictionCaseStudies = choosePredictionCaseStudies(bestResult.matchPredictions);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FIRST Match Modeling Judge Dashboard</title>
  <link rel="icon" href="data:," />
  <style>
    :root {
      color-scheme: light;
      --ink: #101827;
      --muted: #526173;
      --line: #d9e2ec;
      --paper: #f6f8fb;
      --card: #ffffff;
      --blue: #2563eb;
      --teal: #0f766e;
      --orange: #ea580c;
      --gold: #b7791f;
      --green: #15803d;
      --red: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(135deg, #f7fbff 0%, #fff9f2 42%, #f4fbf8 100%);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    header {
      min-height: 88vh;
      display: grid;
      align-items: center;
      padding: 52px clamp(20px, 5vw, 78px);
      border-bottom: 1px solid rgba(16, 24, 39, 0.08);
    }
    .hero {
      max-width: 1180px;
      width: 100%;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 42px;
      align-items: center;
    }
    h1 {
      margin: 0 0 16px;
      font-size: clamp(2.55rem, 5.2vw, 5.8rem);
      line-height: 0.98;
      letter-spacing: 0;
    }
    h2 { margin: 0 0 18px; font-size: clamp(1.8rem, 2.8vw, 2.8rem); line-height: 1.1; letter-spacing: 0; }
    h3 { margin: 0 0 10px; font-size: 1.05rem; letter-spacing: 0; }
    p { margin: 0 0 14px; color: var(--muted); }
    .kicker {
      color: var(--teal);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
      font-size: 0.82rem;
      margin-bottom: 14px;
    }
    .verdict-label {
      display: block;
      color: var(--teal);
      font-weight: 800;
      letter-spacing: 0;
      font-size: 0.92rem;
      margin-bottom: 10px;
    }
    .hero-copy {
      font-size: 1.12rem;
      max-width: 680px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .hero-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      border: 1px solid rgba(16, 24, 39, 0.14);
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      text-decoration: none;
      font-weight: 800;
      padding: 10px 14px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }
    .hero-action.primary {
      background: #101827;
      color: #fff;
      border-color: #101827;
    }
    .hero-action:focus-visible {
      outline: 3px solid rgba(37, 99, 235, 0.35);
      outline-offset: 3px;
    }
    .hero-panel {
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid rgba(16, 24, 39, 0.1);
      border-radius: 8px;
      box-shadow: 0 24px 72px rgba(15, 23, 42, 0.14);
      padding: 26px;
    }
    .verdict {
      display: grid;
      gap: 16px;
    }
    .verdict-main {
      border-left: 5px solid var(--teal);
      padding-left: 16px;
    }
    .verdict-main strong { display: block; font-size: 1.45rem; line-height: 1.15; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 20px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fff;
    }
    .metric span { display: block; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .metric strong { display: block; font-size: 1.45rem; margin-top: 4px; }
    html { scroll-behavior: smooth; }
    main { max-width: 1180px; margin: 0 auto; padding: 34px clamp(18px, 4vw, 42px) 90px; }
    section { margin: 54px 0; }
    .section-head { max-width: 850px; margin-bottom: 22px; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
    }
    .card strong { display: block; font-size: 1.1rem; margin-bottom: 6px; }
    .jump-card {
      display: block;
      color: inherit;
      text-decoration: none;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .jump-card:hover {
      transform: translateY(-2px);
      border-color: rgba(15, 118, 110, 0.45);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
    }
    .jump-card:focus-visible {
      outline: 3px solid rgba(37, 99, 235, 0.35);
      outline-offset: 3px;
    }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .chart-card { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 14px; overflow: hidden; }
    .chart-card svg { width: 100%; height: auto; display: block; }
    .anatomy-card { padding: 18px; }
    .anatomy-card svg { width: 100%; height: auto; display: block; }
    .bar-row {
      display: grid;
      grid-template-columns: 28px 2.2fr 1.4fr 64px;
      gap: 12px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #eef2f7;
    }
    .bar-row:last-child { border-bottom: 0; }
    .bar-rank { color: var(--muted); font-weight: 800; }
    .bar-label span { display: block; color: var(--muted); font-size: 0.82rem; }
    .bar-track { height: 12px; border-radius: 999px; background: #edf2f7; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--teal), var(--orange)); }
    .bar-fill.alt { background: linear-gradient(90deg, var(--blue), var(--green)); }
    .bar-value { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8eef5; text-align: left; vertical-align: top; font-size: 0.9rem; overflow-wrap: anywhere; }
    th { background: #f1f6fb; color: #263446; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:last-child td { border-bottom: 0; }
    .story-spine-table th:first-child, .story-spine-table td:first-child {
      width: 76px;
      min-width: 76px;
      overflow-wrap: normal;
      word-break: normal;
    }
    .story-spine-table td:first-child { font-weight: 500; }
    .table-wrap { max-width: 100%; overflow-x: auto; border-radius: 8px; -webkit-overflow-scrolling: touch; }
    .timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .step { border-top: 4px solid var(--blue); }
    .step:nth-child(2n) { border-top-color: var(--teal); }
    .step:nth-child(3n) { border-top-color: var(--orange); }
    .callout {
      background: #101827;
      color: #f8fafc;
      border-radius: 8px;
      padding: 24px;
    }
    .callout p, .callout li { color: #d9e4ef; }
    .callout strong { color: #fff; }
    .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pill { border: 1px solid rgba(16, 24, 39, 0.12); border-radius: 999px; padding: 7px 11px; background: #fff; font-size: 0.84rem; color: #263446; }
    .hero-snapshot {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      max-width: 760px;
    }
    .hero-snapshot-label {
      grid-column: 1 / -1;
      color: var(--teal);
      font-weight: 800;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .hero-snapshot div:not(.hero-snapshot-label) {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.78);
      padding: 10px 12px;
      min-width: 0;
    }
    .hero-snapshot span {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .hero-snapshot strong {
      display: block;
      margin-top: 3px;
      font-size: 0.94rem;
      line-height: 1.22;
      overflow-wrap: anywhere;
    }
    .status-note {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 16px;
      color: #7c2d12;
    }
    footer { border-top: 1px solid var(--line); padding-top: 28px; color: var(--muted); font-size: 0.9rem; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; overflow-wrap: anywhere; word-break: break-word; }
    @media print {
      @page { margin: 14mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html { scroll-behavior: auto; }
      body { background: #fff; color: #111827; }
      header {
        min-height: auto;
        padding: 16mm 0 12mm;
        border-bottom: 2px solid var(--teal);
      }
      main { max-width: none; padding: 0; }
      section { margin: 14mm 0; }
      .hero, .split, .cards, .timeline, .metric-grid, .hero-snapshot {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .hero-panel, .card, .metric, .chart-card, .table-wrap, .status-note, .callout {
        box-shadow: none;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .section-head, h1, h2, h3, thead {
        break-after: avoid;
        page-break-after: avoid;
      }
      table { font-size: 0.82rem; }
      th, td { padding: 7px 8px; }
      a { color: inherit; text-decoration: none; }
    }
    @media (max-width: 900px) {
      header { min-height: auto; padding-top: 36px; }
      .hero, .split { grid-template-columns: 1fr; }
      .cards, .timeline { grid-template-columns: 1fr; }
      .metric-grid { grid-template-columns: 1fr; }
      .hero-snapshot { grid-template-columns: 1fr; }
      .bar-row { grid-template-columns: 24px 1fr; }
      .bar-track, .bar-value { grid-column: 2; }
      .bar-value { text-align: left; }
    }
  </style>
</head>
<body>
  <header>
    <div class="hero">
      <div>
        <div class="kicker">Offline FIRST Match Modeling</div>
        <h1>How we chose the model we would actually trust</h1>
        <p class="hero-copy">This report summarizes the local research pipeline, the rejected branches, and the current best-known match predictor. It is built from saved walk-forward artifacts, not hand-entered console notes.</p>
        <div class="pill-row">
          <span class="pill">No future leakage</span>
          <span class="pill">Event-key holdouts</span>
          <span class="pill">Role-aware defense features</span>
          <span class="pill">Overfit penalties</span>
        </div>
        <div class="hero-snapshot">
          <div class="hero-snapshot-label">First-screen handoff</div>
          <div><span>Deadline target</span><strong>Saturday May 23 2026 18:00 CST</strong></div>
          <div><span>Fast final gate</span><strong>npm run model:final-check</strong></div>
          <div><span>Claim boundary</span><strong>Best defended local model, not an oracle</strong></div>
        </div>
        <div class="hero-actions" aria-label="Fast opening routes">
          <a class="hero-action primary" href="#start-here-story">Start With The Story</a>
          <a class="hero-action" href="ONE_PAGE_JUDGE_STORY.html">One-Page Story</a>
          <a class="hero-action" href="START_HERE_STORY.html">Standalone Story</a>
        </div>
      </div>
      <div class="hero-panel verdict">
        <div class="verdict-main">
          <span class="verdict-label">Current Verdict</span>
          <strong>${escapeHtml(shortModelName(bestDeployment.model))}</strong>
          <p>${escapeHtml(bestDeployment.role)}. Lower deployment score is better; this candidate won the stability-adjusted point rule after the TailGuard confirmation suite.</p>
        </div>
        <div class="metric-grid">
          <div class="metric"><span>Weighted score MAE</span><strong>${formatNumber(bestDeployment.weightedScoreMae)}</strong></div>
          <div class="metric"><span>Weighted margin MAE</span><strong>${formatNumber(bestDeployment.weightedMarginMae)}</strong></div>
          <div class="metric"><span>Weighted Brier</span><strong>${formatNumber(bestDeployment.weightedBrier, 4)}</strong></div>
          <div class="metric"><span>Deployment score</span><strong>${formatNumber(bestDeployment.pointDeploymentScore, 3)}</strong></div>
        </div>
      </div>
    </div>
  </header>
  <main>
    <section class="quick-jump" aria-label="Quick jump">
      <div class="section-head">
        <h2>Quick Jump</h2>
        <p>Use this short route when time is tight. Each link opens the section a judge is most likely to ask for first.</p>
      </div>
      <div class="cards">
        <a class="card jump-card" href="#start-here-story"><strong>Start Here</strong><p>The plain-English model adventure before the proof vault.</p></a>
        <a class="card jump-card" href="#final-gate-proof"><strong>Final Gate Proof</strong><p>Passed test count, browser QA, manifest coverage, screenshot checks, and second verifier.</p></a>
        <a class="card jump-card" href="#screenshot-proof-index"><strong>Screenshot Proof</strong><p>All fourteen saved visual proof files, their job, and their verifier rule.</p></a>
        <a class="card jump-card" href="#documentation-proof-index"><strong>Docs Proof</strong><p>Markdown story, audits, strategy files, and rerun docs grouped by purpose.</p></a>
        <a class="card jump-card" href="#live-demo-runbook"><strong>Live Demo</strong><p>Presentation order, fallback route, and exact files to open if the live page fails.</p></a>
        <a class="card jump-card" href="#claim-boundaries"><strong>Claim Safety</strong><p>Safe claims, unsafe overclaims, and the evidence to open under judge pressure.</p></a>
        <a class="card jump-card" href="#leakage-audit"><strong>Leakage Guard</strong><p>No-future validation guardrails and the files that prove them.</p></a>
        <a class="card jump-card" href="#hostile-judge-cross-exam"><strong>Cross-Exam</strong><p>Hard questions, concise answers, evidence to open, and phrases to avoid.</p></a>
        <a class="card jump-card" href="#judge-rubric-alignment"><strong>Rubric Fit</strong><p>Process, rigor, validation, usefulness, integrity, honesty, and communication evidence.</p></a>
        <a class="card jump-card" href="#judge-dry-run-scorecard"><strong>Dry Run</strong><p>Presentation rehearsal pass/fail checks for the bounded model claim.</p></a>
        <a class="card jump-card" href="#judge-story-spine"><strong>Story Spine</strong><p>The shortest judge-ready arc from problem to model choice to integrity proof.</p></a>
        <a class="card jump-card" href="#finalist-comparison"><strong>Finalists</strong><p>Why this model beat the nearest alternatives, with caveats beside the scores.</p></a>
        <a class="card jump-card" href="#model-anatomy"><strong>Model Visual</strong><p>The promoted model pipeline, from known-before-match data to score distributions.</p></a>
        <a class="card jump-card" href="#model-source-map"><strong>Source Map</strong><p>Which local files implement each modeling and verification claim.</p></a>
        <a class="card jump-card" href="#prediction-behavior"><strong>Accuracy Stats</strong><p>Score-vs-actual scatter and win-probability calibration charts for the best run.</p></a>
        <a class="card jump-card" href="#strategy-example"><strong>Strategy Use</strong><p>A concrete pre-match prediction with score, win probability, role clues, and error.</p></a>
        <a class="card jump-card" href="#failure-mode-atlas"><strong>Failure Modes</strong><p>Worst events, phase bias, calibration gaps, and known weak spots.</p></a>
        <a class="card jump-card" href="#evidence-matrix"><strong>Evidence Map</strong><p>Claim-by-claim proof table with caveats and audit files.</p></a>
        <a class="card jump-card" href="#risk-register"><strong>Risk Register</strong><p>Known risks, why they matter, mitigations, and current status.</p></a>
        <a class="card jump-card" href="#final-readiness-check"><strong>Ready Check</strong><p>Go/no-go gate for claim, evidence, verification, and presentation boundaries.</p></a>
        <a class="card jump-card" href="#final-package-map"><strong>Final Package Map</strong><p>Every generated handoff file and what it proves.</p></a>
        <a class="card jump-card" href="#model-leaderboard"><strong>Model Scores</strong><p>Promoted model, alternatives, and deployment-score backup.</p></a>
        <a class="card jump-card" href="#what-should-surprise"><strong>Judge Surprises</strong><p>The non-obvious results and rejected smarter-sounding ideas.</p></a>
        <a class="card jump-card" href="#starred-html-coverage"><strong>Starred Coverage</strong><p>Every starred requested dashboard item and where the HTML proves it.</p></a>
        <a class="card jump-card" href="#source-code-evidence-lock"><strong>Code Evidence</strong><p>The exact source paths and hashes locked by the final-check proof.</p></a>
      </div>
    </section>

    <section id="start-here-story">
	      <div class="section-head">
	        <h2>The model adventure in one quick walk</h2>
	        <p>This is the fast human route through the project: why we started simple, why the model changed, what failed, and why ${escapeHtml(shortModelName(bestDeployment.model))} became the final defended answer.</p>
	        <p><strong>Delivery target:</strong> Saturday May 23 2026 18:00 CST.</p>
	      </div>
      <div class="callout">
        <h3>If you only read one screen</h3>
        <p>We began with the simplest honest idea: teams usually carry some scoring memory from match to match. That baseline was a good starting point because any fancier model had to beat it before earning attention.</p>
        <p>Then the baseline hit its limit. It could remember strength, but it could not explain uncertainty, event conditions, role tradeoffs, or defense. So we forced every idea through no-future replay, added score ranges and probability checks, then built RoleV3 to separate normal team strength from defense suppression, offensive cost, foul risk, and net swing.</p>
        <p>The last hard problem was the dangerous tail: fast, high-scoring events where a single confident miss could hurt a drive-team briefing. TailGuard became the cautious correction. We tried smaller weights, a smarter-sounding SelectiveTailGuard branch, and then a micro-sensitivity pass around the final TailGuard weight. The final answer is ${escapeHtml(shortModelName(bestDeployment.model))} with TW=0.22 because it survived the adventure, not because it had the fanciest name.</p>
      </div>
      <div class="cards" style="margin-top:16px;margin-bottom:20px;">
        <div class="card"><strong>Starting point</strong><p>Simple team-strength memory.</p></div>
        <div class="card"><strong>Breakthrough</strong><p>No-future replay plus score distributions and role-aware defense.</p></div>
        <div class="card"><strong>Rejected temptation</strong><p>SelectiveTailGuard and under-tuned TailGuard weights did not beat the defended balance.</p></div>
        <div class="card"><strong>Final claim</strong><p>Best defended local pre-match strategy model, not an oracle.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>If You Remember Nothing Else</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>The question</strong><p>Can match history and scouting context give a drive team a useful pre-match warning?</p></div>
        <div class="card"><strong>The answer</strong><p>Yes, cautiously; the model estimates score, win chance, uncertainty, and role risk before the match.</p></div>
        <div class="card"><strong>The proof idea</strong><p>Every serious candidate was replayed as if standing before each match, then checked by browser QA, screenshots, tests, and verifier rules.</p></div>
        <div class="card"><strong>The boundary</strong><p>This is a disciplined starting point for strategy, not a replacement for scouts, repairs, drivers, or human judgment.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Fast Reading Route</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>1. Answer</strong><p>Read the thirty-second answer and Busy Judge Card.</p></div>
        <div class="card"><strong>2. Loop</strong><p>Read One Match Loop to understand how the model avoids hindsight.</p></div>
        <div class="card"><strong>3. Trust</strong><p>Read Trust Ladder and Final Selection Filter.</p></div>
        <div class="card"><strong>4. Use</strong><p>Read What A Drive Team Gets and When To Trust It.</p></div>
        <div class="card"><strong>5. Proof</strong><p>Read Proof Receipt when a judge asks where the evidence lives.</p></div>
      </div>
      <p class="status-note" style="margin-top:-4px;margin-bottom:20px;"><strong>Stop rule:</strong> Stop after Proof Receipt if time is brutal; everything below is backup proof and script material.</p>
      <div class="section-head" style="margin-top:24px;">
        <h2>What To Ignore Under Time Pressure</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Older metric rows</strong><p>Older 41.x score-MAE rows are audit history, not the current promoted 36.32 claim.</p></div>
        <div class="card"><strong>Report-local labels</strong><p>Report-local point-default labels are historical report roles, not the final model choice.</p></div>
        <div class="card"><strong>Rejected clever branch</strong><p>SelectiveTailGuard is rejected; it sounded clever but failed broad confirmation.</p></div>
        <div class="card"><strong>Useful audit branches</strong><p>ScoutGate and RoleGate are useful audit branches, not the final point model.</p></div>
        <div class="card"><strong>Leaderboard timing</strong><p>Do not start with the full leaderboard unless a judge asks; start with the story, proof receipt, and final check.</p></div>
      </div>
	      <div class="section-head" style="margin-top:24px;">
	        <h2>Busy Judge Card</h2>
	      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Model</strong><p>${escapeHtml(shortModelName(bestDeployment.model))}.</p></div>
        <div class="card"><strong>Model in one sentence</strong><p>It remembers team strength, separates role and defense effects, predicts score ranges, and stays cautious when matches look unusually risky.</p></div>
        <div class="card"><strong>Why believe it</strong><p>Every finalist was judged through no-future replay, holdouts, calibration, tail-risk checks, and overfit penalties.</p></div>
        <div class="card"><strong>Honest caveat</strong><p>It supports pre-match strategy; it does not replace scouts, drive-team judgment, or live robot condition checks.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>So What For Strategy?</h2>
        <p>The model turns a pile of match history into a pre-match briefing, not a command. It is useful because it gives the human strategy group a better first question.</p>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Before a match</strong><p>Use expected score, win chance, uncertainty, and role clues to know what kind of match you are probably entering.</p></div>
        <div class="card"><strong>During strategy talk</strong><p>Compare risk, not just average score; a near-tie with wide uncertainty needs a different plan than a clear favorite.</p></div>
        <div class="card"><strong>For scouting focus</strong><p>Ask humans to verify the specific thing the model is unsure about, such as robot condition, defense tradeoff, or role fit.</p></div>
        <div class="card"><strong>After a miss</strong><p>Use the miss as feedback for model improvement instead of pretending the prediction was always right.</p></div>
        <div class="card"><strong>Human final call</strong><p>Scouts, drive team, and alliance strategy still own the decision.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Judge Answer Finder</h2>
        <p>Use this when someone asks where exactly to look for one claim.</p>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>What won?</strong><p><code>FINAL_MODEL_CARD.md</code>: ${escapeHtml(shortModelName(bestDeployment.model))}, with the current 36.32 / 49.73 / 0.1648 / 0.126 metrics.</p></div>
        <div class="card"><strong>Why trust the validation?</strong><p><code>LEAKAGE_AUDIT.md</code>; <code>FINAL_CHECK_SUMMARY.md</code>: no-future replay plus a clean final gate.</p></div>
        <div class="card"><strong>Why this model over alternatives?</strong><p><code>FINALIST_COMPARISON.md</code>; <code>MODEL_LEADERBOARD_APPENDIX.md</code>: closest contenders, rejected branches, and current-vs-historical labels.</p></div>
        <div class="card"><strong>How does this help strategy?</strong><p><code>STRATEGY_EXAMPLE.md</code>; <code>DEFENSE_ROLE_GUIDE.md</code>: expected score, win chance, uncertainty, and role/defense clues before the match.</p></div>
        <div class="card"><strong>What should we not claim?</strong><p><code>CLAIM_BOUNDARIES.md</code>; <code>LIMITATIONS_AND_RISK_REGISTER.md</code>: best defended local model, not oracle, not deployed, not replacement for scouts.</p></div>
        <div class="card"><strong>Is the package verified?</strong><p><code>VERIFICATION_SUMMARY.md</code>; <code>browser-qa-summary.json</code>: required text, manifests, fingerprints, screenshots, and freshness checks passed.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Model Family Cheat Sheet</h2>
        <p>Use this to translate the model names before opening the full leaderboard.</p>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Baseline</strong><p>Remembers how teams usually score and sets the honest starting line. Useful sanity check, not enough for strategy.</p></div>
        <div class="card"><strong>Residual correction</strong><p>Learns from past misses only after those matches happen. Helpful ingredient, but not the whole answer.</p></div>
        <div class="card"><strong>RoleV3</strong><p>Separates defense into suppression, scoring cost, foul risk, and net swing. Core part of the promoted model.</p></div>
        <div class="card"><strong>TailGuard</strong><p>Adds caution when a match environment looks unusually risky or high-scoring. Promoted with TW=0.22.</p></div>
        <div class="card"><strong>SelectiveTailGuard</strong><p>Tried to apply caution only in selected risky places. Rejected because broad confirmation failed.</p></div>
        <div class="card"><strong>ScoutGate and RoleGate</strong><p>Audit branches that test scout/role signal usefulness. Useful evidence, not the final point model.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Judge Decision Trail</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Baseline because</strong><p>Simple team-strength memory was the honest starting line. It revealed missing uncertainty, context, and defense tradeoffs. Next move: no-future replay.</p></div>
        <div class="card"><strong>No-future replay because</strong><p>The model had to predict before each match, not explain after it. It revealed that strategy needed ranges and calibrated probabilities.</p></div>
        <div class="card"><strong>RoleV3 because</strong><p>Defense needed separate pieces: suppression, own scoring cost, foul risk, confidence, and net swing. It revealed the remaining hard-match tail problem.</p></div>
        <div class="card"><strong>TailGuard because</strong><p>Risky environments needed caution instead of overconfidence. SelectiveTailGuard failed broad confirmation, so the final move was to promote ${escapeHtml(shortModelName(bestDeployment.model))}.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Adventure Map</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>1. Baseline</strong><p>Remember how teams usually score.</p></div>
        <div class="card"><strong>2. No-future replay</strong><p>Make every prediction before seeing that match.</p></div>
        <div class="card"><strong>3. Distributions</strong><p>Show score ranges and confidence, not only winners.</p></div>
        <div class="card"><strong>4. RoleV3</strong><p>Separate team strength from defense suppression, cost, fouls, and net swing.</p></div>
        <div class="card"><strong>5. TailGuard</strong><p>Stay cautious when the match environment looks unusually risky.</p></div>
        <div class="card"><strong>6. Final model</strong><p>Reject clever branches that fail confirmation and keep the most defensible balance.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Plain-English Decoder</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>No-future replay</strong><p>Replay old matches as if we were standing before each match, without using that match's result.</p></div>
        <div class="card"><strong>RoleV3</strong><p>The model's way to separate normal scoring strength from defense effects, role costs, foul risk, and net swing.</p></div>
        <div class="card"><strong>TailGuard</strong><p>A caution layer for unusually risky high-score environments.</p></div>
        <div class="card"><strong>Brier</strong><p>A score for whether win probabilities are honest; lower is better.</p></div>
        <div class="card"><strong>Deployment score</strong><p>The final lower-is-better selection score that blends accuracy, probability quality, tail risk, stability, and overfit penalties.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>One Match Loop</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>1. Before</strong><p>The model only sees history, scout/context signals, and event information that existed before the match.</p></div>
        <div class="card"><strong>2. Predict</strong><p>It outputs an expected score, win chance, uncertainty, and role clue for the drive-team briefing.</p></div>
        <div class="card"><strong>3. Learn</strong><p>After the match is over, the real result updates team and event memory for future matches only.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Trust Ladder</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>No-future replay</strong><p>Blocks hindsight by forcing every prediction to happen before the match result exists.</p></div>
        <div class="card"><strong>Holdouts</strong><p>Punish memorization by checking whether an idea still works away from the slice where it looked good.</p></div>
        <div class="card"><strong>Calibration</strong><p>Checks honesty by asking whether stated win chances behave like real probabilities.</p></div>
        <div class="card"><strong>Tail-risk review</strong><p>Checks the uncomfortable matches instead of hiding behind average accuracy.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Final Selection Filter</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Accuracy first</strong><p>A candidate had to keep score and margin error competitive.</p></div>
        <div class="card"><strong>Probability honesty</strong><p>Win chances had to be calibrated enough for strategy, not just dramatic.</p></div>
        <div class="card"><strong>Tail discipline</strong><p>Hard-match behavior mattered because one ugly miss can damage a drive-team briefing.</p></div>
        <div class="card"><strong>Stability over sparkle</strong><p>A clever branch only counted if it survived holdouts and overfit penalties.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Proof Receipt</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>No-future claim</strong><p>Open <code>LEAKAGE_AUDIT.md</code> to see why the replay does not peek at current-match results.</p></div>
        <div class="card"><strong>Model-choice claim</strong><p>Open <code>FINALIST_COMPARISON.md</code> to see why the promoted model beat the closest alternatives.</p></div>
        <div class="card"><strong>Accuracy claim</strong><p>Open <code>FINAL_CHECK_SUMMARY.md</code> to see the latest tests, browser QA, verifier, screenshots, and deadline proof.</p></div>
        <div class="card"><strong>Visual claim</strong><p>Open <code>index.html#start-here-story</code> and the screenshot files to see the same story rendered and checked.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>What A Drive Team Gets</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Expected score</strong><p>A reasonable pre-match scoring estimate, not an exact promise.</p></div>
        <div class="card"><strong>Win chance</strong><p>A calibrated probability, not a guaranteed winner.</p></div>
        <div class="card"><strong>Uncertainty</strong><p>A warning about how wide the realistic score range is.</p></div>
        <div class="card"><strong>Role clue</strong><p>A hint about whether defense or role tradeoffs may matter.</p></div>
        <div class="card"><strong>Human boundary</strong><p>Scouts and drive teams still check robot condition, alliance plans, and live context.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>When To Trust It</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Trust more</strong><p>Use it with more confidence when the predicted gap is large, uncertainty is narrow, and role warnings do not conflict with scout notes.</p></div>
        <div class="card"><strong>Slow down</strong><p>Treat the output as fragile when the match is near-tie, uncertainty is wide, the event is high-tail, or defense/role signals are unstable.</p></div>
        <div class="card"><strong>Ask humans</strong><p>Robot condition, alliance plan, driver intent, and last-minute mechanical changes can override the model.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>What Surprised Us</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Not flashiest</strong><p>The winner was not the flashiest model. It was the one that stayed useful after leakage checks, holdouts, calibration checks, tail-risk review, and overfit penalties.</p></div>
        <div class="card"><strong>Defense is tradeoffs</strong><p>RoleV3 worked because it split defense into suppression, offensive cost, foul exposure, and net swing instead of treating defense like one magic number.</p></div>
        <div class="card"><strong>Documented no</strong><p>A documented no made the final yes stronger: SelectiveTailGuard sounded clever, but failed broad confirmation.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>TailGuard Micro-Sensitivity Sweep</h2>
      </div>
      <div class="cards" style="margin-bottom:20px;">
        <div class="card"><strong>Question</strong><p>We tested the immediate TailGuard neighborhood after TW=0.20 looked strong: TW=0.18, TW=0.21, TW=0.22, TW=0.23, and TW=0.25 challenged the defended setting.</p></div>
        <div class="card"><strong>2026 result</strong><p>TW=0.22 ranked first in the exact 2026 replay: relative benchmark 0.485, ahead of TW=0.21 at 0.561, TW=0.25 at 0.583, TW=0.20 at 0.647, and TW=0.23 at 0.655.</p></div>
        <div class="card"><strong>Broad result</strong><p>Broad replay agreed on the point candidate: in the 2024-2026 replay, TW=0.22 ranked first at 4.111, ahead of TW=0.23 at 4.130, TW=0.20 at 4.171, TW=0.25 at 4.174, and TW=0.21 at 4.193.</p></div>
        <div class="card"><strong>Holdout result</strong><p>Holdouts were mixed but useful: TW=0.25 led the holdout ranks, bucket 4 still preferred plain Strong RoleV3, and the deployment rule promoted TW=0.22 at 0.126.</p></div>
        <div class="card"><strong>Decision</strong><p>Promote ${escapeHtml(shortModelName(bestDeployment.model))} at TW=0.22 while documenting TW=0.25 as the holdout-rank challenger and TW=0.21/TW=0.23 as last decimal sanity checks.</p></div>
      </div>
      <div class="callout">
        <p><strong>Thirty-second answer:</strong> We built a pre-match scouting model, not an oracle. It replays history one match at a time, only uses information available before each match, and promotes the model that is most trustworthy for a drive-team briefing.</p>
        <p>The winner is ${escapeHtml(shortModelName(bestDeployment.model))} because it best balanced accuracy, uncertainty, role/defense reasoning, and caution on hard high-tail events. The important twist is that smarter-sounding ideas were rejected when they failed realistic validation.</p>
        <p><strong>The 90-Second Walkthrough:</strong> We were not trying to build the fanciest model. We were trying to find the model we would trust before a real match, when future scores are still unknown and a drive team needs an honest estimate.</p>
        <p>We started with simple baselines because they are the most honest place to begin. In one sentence: the baseline model remembers how teams have performed before and uses that memory to estimate the next match. That was useful, but it was too blunt. It could say who looked strong overall, but it did not understand how matches change event by event, how uncertainty matters, or why defense can help one alliance while costing another.</p>
        <p>So we moved to an online replay model. The model walks through history match by match, and before each prediction it only sees what would have existed before that match. This mattered because it turned the project from "can we explain old results?" into "could we have made this prediction at the time?"</p>
        <p>Then we learned that a single expected score was not enough. Strategy does not only ask "who wins?" It asks "what score range is realistic, where can this go wrong, and how confident should we be?" So we added score distributions, win probabilities, and calibration checks. The model became less like a fortune cookie and more like a scouting briefing.</p>
        <p>The next problem was defense. A simple model can accidentally treat defense like magic. We built RoleV3 because defense has several separate parts: suppressing the opponent, losing some of your own scoring, causing foul risk, and creating net swing. In one sentence: RoleV3 tries to separate "a team is good" from "a team changes the shape of the match." That made the model more useful and more honest.</p>
        <p>But the hardest matches still caused trouble. Championship-like events and fast-changing score environments produced bigger misses. So we tested tail-risk ideas. TailGuard was the best of those ideas: instead of pretending the model solved every strange match, it nudges the model to respect risky high-tail situations.</p>
        <p>Then came the tempting idea: SelectiveTailGuard. It sounded smarter because it tried to turn on stronger correction only when prior evidence said an event was hard. But the tests did not support it broadly. It looked good in one view and failed confirmation in others. We rejected it. That rejection is part of the win, because a real modeling project should have documented "no" answers, not just a polished final answer.</p>
        <p>The final winner is ${escapeHtml(shortModelName(bestDeployment.model))} at TW=0.22. It is not a miracle model. It wins because it keeps the strong RoleV3 average accuracy, slightly improves hard-tail behavior, and has the best stability-adjusted deployment score among the finalists.</p>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Three Things To Remember</h2>
      </div>
      <div class="cards">
        <div class="card"><strong>1. Before-match only</strong><p>The replay rule matters: every prediction uses only information that would have existed before that match.</p></div>
        <div class="card"><strong>2. Strategy, not prophecy</strong><p>The model is useful because it gives score ranges, risk, and role/defense context, not just a winner.</p></div>
        <div class="card"><strong>3. Rejected cleverness</strong><p>The winner survived comparison after simpler and smarter-sounding alternatives failed the same no-future discipline.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>What The Numbers Mean</h2>
      </div>
      <div class="cards">
        <div class="card"><strong>Score MAE 36.32</strong><p>The model's typical alliance-score miss after weighting the important evaluation slices.</p></div>
        <div class="card"><strong>Margin MAE 49.73</strong><p>The typical miss on the red-versus-blue score gap, which is harder than only predicting one alliance score.</p></div>
        <div class="card"><strong>Brier 0.1648</strong><p>A win-probability honesty score; lower means the probabilities were better calibrated.</p></div>
        <div class="card"><strong>Deployment score 0.126</strong><p>The final lower-is-better selection score combining accuracy, calibration, tail risk, stability, and overfit penalties.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Scary-Term Decoder</h2>
        <p>Use this when a judge understands the story but wants the math words translated quickly.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>MAE</strong><p>Average absolute miss. If the model predicts 100 and reality is 110, that match misses by 10; lower is better.</p></div>
        <div class="card"><strong>Brier</strong><p>Probability honesty. If the model says 70% often, those teams should win about 70% of the time.</p></div>
        <div class="card"><strong>Holdout</strong><p>A validation slice away from the easiest full replay, used to punish memorization.</p></div>
        <div class="card"><strong>Calibration</strong><p>Confidence honesty: the model should not sound more certain than the replay evidence supports.</p></div>
        <div class="card"><strong>Residual correction</strong><p>Learn from past prediction misses only after they happen, then use that lesson for later matches.</p></div>
        <div class="card"><strong>TW=0.22</strong><p>The TailGuard strength knob; caution is on, but intentionally conservative.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>If A Judge Pushes Back</h2>
      </div>
      <div class="cards">
        <div class="card"><strong>Is this cheating with future data?</strong><p>No. The promoted validation is a no-future replay: before each historical match, the model only sees evidence that would have existed before that match.</p></div>
        <div class="card"><strong>Why not use something smarter?</strong><p>We tried smarter-sounding branches, but they only count when they survive holdouts. SelectiveTailGuard did not, so we rejected it.</p></div>
        <div class="card"><strong>Is this accurate enough?</strong><p>It is accurate enough for pre-match strategy support, not for replacing scouts or drive-team judgment.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Safe Wording Before You Present</h2>
      </div>
      <div class="cards">
        <div class="card"><strong>Say this</strong><p>Current best defended local model.</p></div>
        <div class="card"><strong>Say this</strong><p>No-future replay, not hindsight.</p></div>
        <div class="card"><strong>Say this</strong><p>Strategy support, not replacement for scouts.</p></div>
        <div class="card"><strong>Avoid this</strong><p>Exact-score certainty, live app deployment claims, or certainty about future defense choices.</p></div>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>The Adventure In Six Turns</h2>
      </div>
      <div class="cards">
        <div class="card"><strong>1. Simple baselines</strong><p>If a complicated model cannot beat a simple one, it has not earned trust.</p></div>
        <div class="card"><strong>2. Walk-forward replay</strong><p>The model predicts history as if it is living through the season, never peeking at current-match results.</p></div>
        <div class="card"><strong>3. Score distributions</strong><p>A drive team needs likely scores, risk, and confidence, not just a win label.</p></div>
        <div class="card"><strong>4. RoleV3</strong><p>We separated team strength, defense suppression, offensive cost, foul exposure, and net swing.</p></div>
        <div class="card"><strong>5. Tail risk</strong><p>Championship-like matches and fast score environments created bigger misses, so TailGuard became the cautious correction.</p></div>
        <div class="card"><strong>6. Reject the clever thing</strong><p>SelectiveTailGuard sounded clever, but failed broad confirmation. The documented no made the final yes stronger.</p></div>
      </div>
      <div class="callout" style="margin-top:18px;">
        <h3>One-Minute Judge Script</h3>
        <p>We built a local FIRST match prediction model that replays history one match at a time. Before each match, it only uses information that would have existed before that match, so validation acts like a real pre-match prediction instead of a hindsight explanation.</p>
        <p>We started with simple team-strength baselines, then added online memory, uncertainty, event context, residual correction, role-aware defense features, and tail-risk checks. The winning model is ${escapeHtml(shortModelName(bestDeployment.model))}. Intuitively, it remembers team strength, separates different kinds of role and defense impact, predicts score distributions instead of only winners, and stays cautious around hard high-tail events.</p>
        <p>The important part is not that it is perfect. It is not. The important part is that flashier ideas were tested and rejected when they failed holdouts. The final model is the best defended local model we found: ${formatNumber(bestDeployment.weightedScoreMae)} weighted score MAE, ${formatNumber(bestDeployment.weightedMarginMae)} weighted margin MAE, ${formatNumber(bestDeployment.weightedBrier, 4)} weighted Brier, and ${formatNumber(bestDeployment.pointDeploymentScore, 3)} deployment score.</p>
      </div>
    </section>

    <section id="starred-html-coverage">
      <div class="section-head">
        <h2>Starred HTML Coverage</h2>
        <p>Every starred prompt item is represented inside this HTML dashboard, with exact supporting files in the deadline checklist below.</p>
      </div>
      <div class="cards">
        ${buildStarredHtmlCoverageCards()}
      </div>
    </section>

    <section id="final-readiness-check">
      <div class="section-head">
        <h2>Executive Read</h2>
        <p>${escapeHtml(buildExecutiveRead(bestDeployment, summary))}</p>
      </div>
      <div class="cards">
        <div class="card"><strong>Point candidate</strong><p>Conservative TailGuard keeps the RoleV3 score edge and trims tail risk by a tiny but repeatable amount.</p></div>
        <div class="card"><strong>Simple baseline</strong><p>Strong RoleV3 remains the cleanest model to explain and the strongest holdout relative leader.</p></div>
        <div class="card"><strong>High-tail specialist</strong><p>Stronger TailGuard wins multiple hard buckets, but loses the easy bucket and carries more instability.</p></div>
        <div class="card"><strong>Rejected idea</strong><p>SelectiveTailGuard sounded smarter, then failed both the failure-mode slice and a supportive slice. We documented the no.</p></div>
      </div>
    </section>

    <section id="judge-story-spine">
      <div class="section-head">
        <h2>Judge Story Spine</h2>
        <p>This is the shortest clean argument through the project: problem, no-future rule, search process, winning model, why it won, how it helps strategy, and how the package proves integrity without overclaiming.</p>
      </div>
      <div class="table-wrap">
        <table class="story-spine-table">
          <thead><tr><th>Beat</th><th>What to say</th><th>Proof to open</th><th>Watch-out</th></tr></thead>
          <tbody>${buildJudgeStorySpineTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>First 90 Seconds</h2>
        <p>This is the timed opening script for a short judge conversation. It pairs each claim with the file to open and the boundary that keeps the presentation honest.</p>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Four-File Opening Card</h2>
        <p>Never hunt through the folder live. Open these files in this order, then stop when the judge has enough.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Step</th><th>File</th><th>Presenter move</th></tr></thead>
          <tbody>${buildFirst90OpenOrderTable()}</tbody>
        </table>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Timed Script</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>What to say</th><th>Point at</th><th>Boundary</th></tr></thead>
          <tbody>${buildFirst90SecondTable()}</tbody>
        </table>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>If Interrupted</h2>
        <p>Use these fast pivots when the judge skips ahead to proof, result, strategy value, or caveat.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Judge says</th><th>Pivot</th></tr></thead>
          <tbody>${buildFirst90InterruptionTable()}</tbody>
        </table>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Final 20-Second Close</h2>
        <p>Use this when the judge is done listening and the presenter needs to land the project cleanly.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Beat</th><th>Sentence</th></tr></thead>
          <tbody>${buildFirst90ClosingTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Final Freeze Audit</h2>
        <p>This is the pre-presentation guardrail sheet: what is safe to say, what evidence supports it, and which tempting claims would make the model story less honest.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Check</th><th>Frozen wording or behavior</th><th>Evidence to open</th><th>Failure mode to avoid</th></tr></thead>
          <tbody>${buildFinalFreezeAuditTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Presentation Wording Audit</h2>
        <p>This is the stale-wording and overclaim sweep for live presentation language. Each risky phrase has a safer version tied to evidence.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Risky wording</th><th>Safer wording</th><th>Evidence to open</th><th>Why it matters</th></tr></thead>
          <tbody>${buildPresentationWordingAuditTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Cold Reader Route</h2>
        <p>This is the first-five-minutes path for someone opening the package with no context. It keeps the initial story narrow and pushes deep files into backup evidence.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Do this</th><th>You are ready when</th><th>Do not open first</th></tr></thead>
          <tbody>${buildColdReaderRouteTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="hostile-judge-cross-exam">
      <div class="section-head">
        <h2>Hostile Judge Cross-Exam</h2>
        <p>This is the hard-question pressure test: concise answers, evidence to open, and phrases that would weaken the project if said out loud.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Hard question</th><th>Concise answer</th><th>Evidence to open</th><th>Do not say</th></tr></thead>
          <tbody>${buildHostileJudgeCrossExamTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Final Coherence Audit</h2>
        <p>This is the consistency pass for the final handoff. It keeps the dashboard, scripts, Q&A, model card, limitations, and verifier language tied to one bounded claim.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Topic</th><th>Canonical wording</th><th>Files to cross-check</th><th>Drift to avoid</th></tr></thead>
          <tbody>${buildFinalCoherenceAuditTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Final Presentation Lock</h2>
        <p>This is the handoff lock: what is safe to present now, what evidence proves it, and what kind of later edit forces regeneration and fresh verification.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Gate</th><th>Locked state</th><th>Evidence</th><th>Reopen if</th></tr></thead>
          <tbody>${buildFinalPresentationLockTable()}</tbody>
        </table>
      </div>
      <p class="note">This is not a claim that the model can never improve. It is a presentation lock: if the package changes, regenerate, refresh screenshots, rerun the verifier and tests, then treat the new outputs as the locked handoff.</p>
    </section>

    <section>
      <div class="section-head">
        <h2>Reference Integrity Audit</h2>
        <p>This is the local-file reference check for the judge handoff: source files, audits, dashboard files, browser QA, screenshots, manifests, and fingerprints that the package points people toward.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Target</th><th>Status</th><th>Why it matters</th></tr></thead>
          <tbody>${buildReferenceIntegrityTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Open This First</h2>
        <p>This is the cover-sheet route through the package. If someone opens the folder cold, these are the files to open first and the reason each one exists.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Deadline target</strong><p>Saturday May 23 2026 18:00 CST</p></div>
        <div class="card"><strong>Promoted model</strong><p>${escapeHtml(shortModelName(bestDeployment.model))}</p></div>
        <div class="card"><strong>Headline accuracy</strong><p>${formatNumber(bestDeployment.weightedScoreMae)} score MAE; ${formatNumber(bestDeployment.weightedMarginMae)} margin MAE</p></div>
        <div class="card"><strong>Deployment score</strong><p>${formatNumber(bestDeployment.pointDeploymentScore, 3)} with ${formatNumber(bestDeployment.weightedBrier, 4)} Brier</p></div>
      </div>
      <p class="status-note" style="margin-bottom:16px;"><strong>Handoff Snapshot:</strong> open <code>ONE_PAGE_JUDGE_STORY.html</code> first for the fastest human route, then open <code>index.html#start-here-story</code> for the proof dashboard. The claim is the best defended local model found in this research cycle, not a perfect oracle.</p>
      <p class="status-note" style="margin-bottom:16px;"><strong>Latest Quality Receipt:</strong> the one-page story has a 30-second script, three-takeaway memory aid, and plain-English number key; the start-here route now has If You Remember Nothing Else, Judge Answer Finder, Model Family Cheat Sheet, and Judge Decision Trail; the answer finder maps the six fastest judge questions directly to proof files; TailGuard TW=0.22 survived TW=0.21/TW=0.23 pressure; the failure atlas uses current diagnostics, leaderboard labels point at the current claim instead of stale history, and the research-log Current Metric Note keeps old metric checkpoints labeled audit history.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Moment</th><th>Open</th><th>Why</th><th>File</th></tr></thead>
          <tbody>${buildOpenThisFirstTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Deadline Deliverables Checklist</h2>
        <p>This maps the Saturday May 23 2026 18:00 CST deadline package to the exact local artifacts and dashboard sections, so the final handoff is auditable rather than scattered across memory.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Requested deliverable</th><th>Status</th><th>Where to open</th><th>Caveat</th></tr></thead>
          <tbody>${buildDeadlineDeliverablesTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="claim-boundaries">
      <div class="section-head">
        <h2>Claim Boundaries</h2>
        <p>This is the anti-overclaim section: what we can defend, what we should not say, and which file to open when a judge pushes on the claim.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Topic</th><th>Safe claim</th><th>Avoid saying</th><th>Evidence to open</th></tr></thead>
          <tbody>${buildClaimBoundaryTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="leakage-audit">
      <div class="section-head">
        <h2>Leakage Audit</h2>
        <p>This is the no-future discipline section. It names each guardrail, what it prevents, and exactly where a judge can audit the evidence.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Guardrail</th><th>What it blocks</th><th>Evidence</th><th>Artifact to audit</th></tr></thead>
          <tbody>${buildLeakageAuditTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="judge-rubric-alignment">
      <div class="section-head">
        <h2>Judge Rubric Alignment</h2>
        <p>This translates the technical package into judging language: process, rigor, validation, iteration, usefulness, integrity, honesty, and communication.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Lens</th><th>Evidence in this project</th><th>Artifact to open</th><th>Short judge line</th></tr></thead>
          <tbody>${buildRubricAlignmentTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="live-demo-runbook">
      <div class="section-head">
        <h2>Live Demo Runbook</h2>
        <p>This is the practical presentation path: what to open, what to say, what evidence to show, and how to recover if the live browser is not cooperating.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Step</th><th>Action</th><th>What to say</th><th>Evidence</th></tr></thead>
          <tbody>${buildLiveDemoTable()}</tbody>
        </table>
      </div>
      <div class="section-head" style="margin-top:24px;">
        <h2>Emergency 60-Second Fallback</h2>
        <p>If the browser, Wi-Fi, or projector path fails: Do not debug live; switch to static files.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Step</th><th>Artifact</th><th>Say</th></tr></thead>
          <tbody>${buildLiveDemoEmergencyTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="judge-dry-run-scorecard">
      <div class="section-head">
        <h2>Judge Dry-Run Scorecard</h2>
        <p>This is the rehearsal gate for the presenter: the package is ready only if the bounded model claim survives a timed opening, hard questions, strategy use, and fallback flow.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Rehearsal item</th><th>Pass standard</th><th>Evidence to open</th><th>If it fails</th></tr></thead>
          <tbody>${buildJudgeDryRunTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Mock Judge Panel Brief</h2>
        <p>This is the judge-personality pressure sheet: technical, strategy, skeptical, reproducibility, impact, and data-source questions each get a bounded answer and an artifact to open.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Judge type</th><th>Likely push</th><th>Best bounded answer</th><th>Open</th><th>Avoid</th></tr></thead>
          <tbody>${buildMockJudgePanelTable()}</tbody>
        </table>
      </div>
    </section>

    <section id="finalist-comparison">
      <div class="section-head">
        <h2>Finalist Comparison</h2>
        <p>This is the direct answer to why the current model is promoted over the nearest finalists. It keeps the caveats next to the score so the decision does not sound cleaner than it is.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Finalist</th><th>Role</th><th>Score MAE</th><th>Margin MAE</th><th>Brier</th><th>Worst event</th><th>Deploy</th><th>Strength</th><th>Caveat</th><th>Decision</th></tr></thead>
          <tbody>${buildFinalistComparisonTable(finalistComparisonRows)}</tbody>
        </table>
      </div>
    </section>

    <section id="model-anatomy">
      <div class="section-head">
        <h2>Model Anatomy</h2>
        <p>This is the plain-English map of the promoted model: known-before-match data, online team memory, role/defense features, Monte Carlo score distributions, residual correction, and the conservative TailGuard layer.</p>
      </div>
      <div class="chart-card anatomy-card">
        ${buildModelAnatomySvg()}
      </div>
      <div class="cards" style="margin-top:16px;">
        <div class="card"><strong>Not a one-shot fit</strong><p>The replay updates team memory after matches, which is why it is closer to EPA-style online modeling than retrospective OPR.</p></div>
        <div class="card"><strong>Not future-leaking</strong><p>Residual and TailGuard signals are based on prior errors and prior event evidence only.</p></div>
        <div class="card"><strong>Not just winner prediction</strong><p>The output is expected red/blue score, uncertainty, win probability, role clues, and residual risk.</p></div>
        <div class="card"><strong>Not overclaimed</strong><p>TailGuard is promoted because it survived broad confirmation better than the stronger and selective alternatives.</p></div>
      </div>
    </section>

    <section id="model-source-map">
      <div class="section-head">
        <h2>Model Source Map</h2>
        <p>This table connects the presentation claims to the actual local files that implement the model, diagnostics, scoring rule, dashboard generator, and verifier.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Question</th><th>File</th><th>Code area to inspect</th><th>Why it matters</th></tr></thead>
          <tbody>${buildSourceMapTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Judge Walkthrough</h2>
        <p>If time is short, this is the route through the package: verdict, proof, example, limitations, and audit trail.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>1. Verdict</strong><p>Start with the hero and printable summary: ${escapeHtml(shortModelName(bestDeployment.model))}, with the four headline metrics.</p></div>
        <div class="card"><strong>2. Proof</strong><p>Use the leaderboard, research atlas, and evidence matrix to show that alternatives were tested and rejected carefully. ScoutGate is promising but fragmented, and RoleGate improved audit discipline without becoming the promoted model.</p></div>
        <div class="card"><strong>3. Example</strong><p>Show the strategy example so judges see expected scores, win probability, role reads, and actual outcome together.</p></div>
        <div class="card"><strong>4. Honesty</strong><p>Close with the risk register and reproducibility runbook: what can fail, how we checked it, and how to rerun it. Name sparse and concentrated scout/PPC rows as a limitation, not a missing-data excuse.</p></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Printable One-Page Summary</h2>
        <p>This is the compressed version for someone who has one minute before judging starts. The full dashboard and research log contain the evidence behind each sentence.</p>
      </div>
      <div class="split">
        <div class="card">
          <strong>Current best model</strong>
          <p>${escapeHtml(shortModelName(bestDeployment.model))}: an online EPA-style, RoleV3, residual-ridge, Monte Carlo uncertainty model with conservative TailGuard.</p>
        </div>
        <div class="card">
          <strong>Why we trust it</strong>
          <p>It survived walk-forward replay, deterministic event-key holdouts, fixed and relative benchmarks, overfit penalties, and rejection of more exciting but fragile variants.</p>
        </div>
      </div>
      <div class="metric-grid" style="margin-top:16px;">
        <div class="metric"><span>Score MAE</span><strong>${formatNumber(bestDeployment.weightedScoreMae)}</strong></div>
        <div class="metric"><span>Margin MAE</span><strong>${formatNumber(bestDeployment.weightedMarginMae)}</strong></div>
        <div class="metric"><span>Brier</span><strong>${formatNumber(bestDeployment.weightedBrier, 4)}</strong></div>
        <div class="metric"><span>Deploy score</span><strong>${formatNumber(bestDeployment.pointDeploymentScore, 3)}</strong></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Presentation Flow</h2>
        <p>This is the spoken path I would use at the table: start with the hard constraint, then show the model, then show why rejected ideas matter.</p>
      </div>
      <div class="timeline">
        <div class="card step"><strong>1. Problem</strong><p>FRC match prediction is not just winner prediction. We need scores, uncertainty, role choices, and no future leakage.</p></div>
        <div class="card step"><strong>2. Method</strong><p>Replay history match by match. Train only from what existed before the predicted match.</p></div>
        <div class="card step"><strong>3. Model</strong><p>Use online EPA-style memory, Monte Carlo uncertainty, RoleV3 defense signals, residual-ridge correction, and conservative TailGuard.</p></div>
        <div class="card step"><strong>4. Evidence</strong><p>Use walk-forward metrics, event-key holdouts, calibration, Brier score, worst-event behavior, and overfit penalties.</p></div>
        <div class="card step"><strong>5. Honesty</strong><p>Reject smart-sounding ideas that fail holdouts. Do not fake scout/PPC data we do not have.</p></div>
        <div class="card step"><strong>6. Use</strong><p>Treat the output as strategy support: expected scores, risk, win probability, and defense clues for human decision-making.</p></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Model Journey Timeline</h2>
        <p>This is the short arc of the research: each model branch either became part of the final system, became a comparator, or was rejected because the holdouts said no.</p>
      </div>
      <div class="timeline">
        ${buildModelJourneyTimelineHtml()}
      </div>
    </section>

    <section>
      <div class="callout">
        <h2>One-Minute Judge Story</h2>
        <p><strong>We built this as a local research model, not a website feature.</strong> Every prediction is a replay of history: before match N, the model only sees information that would have existed before match N.</p>
        <p>We started with OPR-like and EPA-like baselines, then added Monte Carlo score distributions, event metadata, no-future residual correction, and finally role-aware defense features. The winning family is conservative because the more exciting ideas only counted when holdout buckets confirmed them.</p>
        <p>The current best model is ${escapeHtml(shortModelName(bestDeployment.model))}. It is not perfect, and the evidence is intentionally honest: the improvement is small, but it is the most defensible balance of score accuracy, win calibration, tail behavior, and overfit control we have found so far.</p>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Final Model Card</h2>
        <p>This is the short technical card judges should remember. The full details are in <code>modeling/MODELING_RESEARCH_LOG.md</code> and the generated per-run model cards.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>Model type</strong><p>Online EPA-style score model with Monte Carlo uncertainty, event archetype scaling, RoleV3 defense features, residual-ridge correction, and conservative TailGuard.</p></div>
        <div class="card"><strong>Prediction target</strong><p>Red and blue expected scores, score bands, win probability, role clues, and calibration diagnostics for pre-match decision support.</p></div>
        <div class="card"><strong>Validation rule</strong><p>Walk-forward replay plus event-key holdout buckets. Future match results never enter the feature row being predicted.</p></div>
        <div class="card"><strong>Known weakness</strong><p>FRC scores have large early-event and championship-tail uncertainty. Scout/PPC enrichment is now available, but only 356 matched Firebase rows are usable and most are concentrated in 2026mnum.</p></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Metric Glossary</h2>
        <p>These definitions make the leaderboard readable without pretending one number tells the whole story. The model is judged by accuracy, confidence, uncertainty, tail behavior, and stability together.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Metric</th><th>Plain-English meaning</th><th>Why it matters</th><th>Watch-out</th></tr></thead>
          <tbody>${buildMetricGlossaryTable()}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Deployment Scoring Rubric</h2>
        <p>The leaderboard is intentionally not just MAE. The tables below show the fixed benchmark components, deployment components, and overfit signals. The rubric uses fixed targets, cross-run regret, near-tie labels, and nonlinear overfit penalties so a fragile model cannot win just by looking good on one slice.</p>
      </div>
      <div class="split">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fixed benchmark component</th><th>Weight</th><th>Target</th><th>Why it exists</th></tr></thead>
            <tbody>${buildRubricRows(fixedBenchmarkRubricRows)}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Deployment component</th><th>Weight</th><th>What it measures</th></tr></thead>
            <tbody>${buildRubricRows(deploymentRubricRows)}</tbody>
          </table>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:16px;">
        <table>
          <thead><tr><th>Overfit signal</th><th>Penalty shape</th><th>Why it matters</th></tr></thead>
          <tbody>${buildRubricRows(overfitPenaltyRows)}</tbody>
        </table>
      </div>
      <div class="status-note" style="margin-top:16px;">
        The fixed benchmark magnifies worse-than-target ratios, and overfit risk uses squared excess for VIF, high correlation, rejection count, slice instability, season instability, and coverage miss. The cross-run deployment score then adds an instability penalty from weighted standard deviation and worst-run regret.
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>OPR vs EPA</h2>
        <p>OPR and EPA are not interchangeable. This table contrasts OPR-style thinking with EPA-style thinking, and explains why the final model keeps OPR as a baseline but promotes an online EPA-style local state for pre-match replay.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Topic</th><th>OPR-style thinking</th><th>EPA-style thinking</th><th>Modeling implication</th></tr></thead>
          <tbody>${buildOprEpaTable()}</tbody>
        </table>
      </div>
      <div class="status-note" style="margin-top:16px;">
        Public Statbotics context can still be useful, but published prediction rows are not promoted unless timestamp provenance proves they existed before the match. The final model uses local walk-forward state instead of trusting a future-leaking snapshot.
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Judge Q&A</h2>
        <p>These are the short answers I would want ready at the table. The theme is simple: we built a useful model, but we did not fake certainty.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>Why not a neural network?</strong><p>Neural models were allowed, but the best defended result came from an interpretable online EPA/residual family. In this data regime, leakage control and holdout stability mattered more than model glamour.</p></div>
        <div class="card"><strong>How do you prevent future leakage?</strong><p>Every prediction is emitted before the current match updates team state. Residual and tail corrections only learn from prior prediction errors.</p></div>
        <div class="card"><strong>What does defense mean here?</strong><p>Defense is modeled as net point swing: opponent suppression minus lost offense and foul risk. The model estimates when a team may be more valuable disrupting than scoring.</p></div>
        <div class="card"><strong>What was the biggest surprise?</strong><p>The smarter selective tail gate lost. It improved a full replay, then failed broad holdouts, so it was rejected.</p></div>
        <div class="card"><strong>Why not promote ScoutGate or RoleGate?</strong><p>ScoutGate helped dense scout-heavy checks and RoleGate improved audit discipline, but their holdout evidence did not confirm a replacement for Conservative TailGuard Strong RoleV3.</p></div>
        <div class="card"><strong>Could this still improve?</strong><p>Yes. The current gains are near-tie and honest. Broader timestamped scout/PPC coverage would be the most valuable next signal.</p></div>
        <div class="card"><strong>How should teams use it?</strong><p>Use it as decision support: expected score, uncertainty, win probability, role clues, and warning signs. It should not replace human scouting judgment.</p></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Hard Questions Judges May Ask</h2>
        <p>This is the defensive layer of the presentation: the answers that keep the project credible when a judge presses on weakness, causality, or overfitting.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Question</th><th>Best short answer</th><th>Evidence to open</th></tr></thead>
          <tbody>
            <tr>${tableCell('What if your model is just memorizing 2026?')}${tableCell('That is why the promoted claim depends on event-key holdouts, fixed benchmarks, near-tie labels, and rejection of full-replay winners that failed confirmation.')}${tableCell('DEPLOYMENT_SCORING_RUBRIC.md, EVIDENCE_MATRIX.md, cross-run summaries')}</tr>
            <tr>${tableCell('Why trust a small improvement?')}${tableCell('We do not oversell it. The improvement is small, so the claim is that this is the best defended model found so far, not that it is unbeatable.')}${tableCell('FINALIST_COMPARISON.md, LIMITATIONS_AND_RISK_REGISTER.md')}</tr>
            <tr>${tableCell('Could a neural network beat this?')}${tableCell('Possibly, but the current data and validation rewarded leakage-safe online structure more than complexity. A neural model would need to beat this under the same walk-forward and holdout rules.')}${tableCell('MODEL_JOURNEY_TIMELINE.md, MODEL_LEADERBOARD_APPENDIX.md')}</tr>
            <tr>${tableCell('How do you know defense is real?')}${tableCell('The model treats defense as net swing, not a magic label: suppression value minus lost offense and foul risk. Sparse scout/PPC coverage is disclosed rather than stretched beyond the matched rows.')}${tableCell('MODEL_ANATOMY.md, STRATEGY_EXAMPLE.md, METHODOLOGY_APPENDIX.md')}</tr>
            <tr>${tableCell('Why not promote ScoutGate or RoleGate?')}${tableCell('ScoutGate and RoleGate were useful audit branches, but neither confirmed a replacement for Conservative TailGuard Strong RoleV3 under holdout review.')}${tableCell('scoutgate-check/CROSS_RUN_SUMMARY.md, scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md, FINALIST_COMPARISON.md')}</tr>
            <tr>${tableCell('Why exclude Statbotics predictions if they are useful?')}${tableCell('Because usefulness is not enough. Without prediction-specific timestamps, public prediction rows are context only, not promotable model inputs.')}${tableCell('OPR_EPA_EXPLAINER.md, EVIDENCE_MATRIX.md')}</tr>
            <tr>${tableCell('What would improve the model most next?')}${tableCell('Broader matched scout/PPC data and timestamp-safe external snapshots would matter more than another small tweak to the current TailGuard family.')}${tableCell('LIMITATIONS_AND_RISK_REGISTER.md, FINAL_MODEL_CARD.md')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Leaderboard</h2>
        <p>The deployment score combines exact-score error, margin error, Brier score, calibration, coverage, worst-event behavior, fixed benchmark quality, rank, and an instability penalty. The penalty intentionally magnifies overfit symptoms.</p>
      </div>
      <div class="split">
        <div class="chart-card">
          <h3>Deployment Score By Candidate</h3>
          ${buildDeploymentBars(deploymentRows.slice(0, 9))}
        </div>
        <div class="chart-card">
          <h3>Generated Cross-Run Metric Chart</h3>
          ${metricSvg || '<p>No metric SVG was available.</p>'}
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Model Scores</h2>
        <p>These are the models considered in the latest deployment review. The near-tie count matters: the differences are real, but small enough that the honest answer is a defended candidate, not a victory lap.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Model</th><th>Role</th><th>Runs</th><th>Relative wins</th><th>Fixed wins</th><th>Score MAE</th><th>Margin MAE</th><th>Brier</th><th>Worst event</th><th>Deploy score</th><th>Robustness</th></tr></thead>
          <tbody>${buildDeploymentTable(deploymentRows)}</tbody>
        </table>
      </div>
    </section>

    <section id="prediction-behavior">
      <div class="section-head">
        <h2>Prediction Behavior</h2>
        <p>The best run artifact is <code>${escapeHtml(bestRun.runId)}</code>. The scatter shows score prediction difficulty directly: early-event and championship-tail matches are the hardest areas.</p>
      </div>
      <div class="split">
        <div class="chart-card">${predictionScatter}</div>
        <div class="chart-card">${calibration}</div>
      </div>
    </section>

    <section id="failure-mode-atlas">
      <div class="section-head">
        <h2>Failure Mode Atlas</h2>
        <p>This section explains where the promoted model still struggles. It uses the fresh current TW=0.22 TailGuard residual diagnostics, so the judge story includes the weak spots, not only the winner.</p>
      </div>
      ${buildFailureModeAtlasHtml(failureModeAtlas)}
    </section>

    <section>
      <div class="section-head">
        <h2>Holdout Evidence</h2>
        <p>Full replays are useful, but holdout buckets decide whether a model is robust. The latest stability review is <strong>${escapeHtml(
          summary.stabilityReview.status
        )}</strong>, which is exactly why the final choice is conservative.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Run</th><th>Type</th><th>Matches</th><th>Relative winner</th><th>Score MAE</th><th>Margin MAE</th><th>Brier</th><th>Worst event</th></tr></thead>
          <tbody>${buildHoldoutTable(holdoutRows)}</tbody>
        </table>
      </div>
      <div class="status-note" style="margin-top:16px;">
        <strong>Stability notes:</strong>
        <ul>${stabilityNotes}</ul>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>How The Model Works</h2>
        <p>The winning family is not a neural network. The evidence favors an online EPA-style system with Monte Carlo score uncertainty, event archetype scaling, role-aware defense features, and a no-future residual correction layer. Simpler won because it survived harder tests.</p>
      </div>
      <div class="timeline">
        <div class="card step"><strong>1. Start with known-before-match state</strong><p>Teams carry online form, event form, volatility, component scoring, and event metadata. Every row is emitted before the current match updates the state.</p></div>
        <div class="card step"><strong>2. Add role-aware defense</strong><p>RoleV3 separates suppression, foul risk, offense cost, consistency, and role-choice confidence instead of using one noisy defense number.</p></div>
        <div class="card step"><strong>3. Simulate score distributions</strong><p>Monte Carlo adds asymmetric score bands and win probabilities, so the output is a distribution rather than only one score.</p></div>
        <div class="card step"><strong>4. Correct residuals safely</strong><p>Residual-ridge learns from past prediction errors during replay. It cannot use the match it is predicting.</p></div>
        <div class="card step"><strong>5. Guard the tail</strong><p>TailGuard only makes a small mean correction after enough prior event evidence exists. It is intentionally conservative.</p></div>
        <div class="card step"><strong>6. Reject fragile ideas</strong><p>Selective gates, probability-only overlays, and stronger tail corrections were kept only when holdouts supported them. Several did not.</p></div>
      </div>
    </section>

    <section id="strategy-example">
      <div class="section-head">
        <h2>Strategy Example</h2>
        <p>This is one saved walk-forward prediction from the best run. It shows how the model would turn pre-match evidence into scores, win probability, and role/defense clues.</p>
      </div>
      ${buildStrategyExampleHtml(strategyExample)}
    </section>

    <section>
      <div class="section-head">
        <h2>Prediction Case Studies</h2>
        <p>These examples are selected from the saved best-run predictions to show the model's range: a strategic read, uncertainty in a close match, an uncomfortable miss, and a large-error stress case.</p>
      </div>
      ${buildPredictionCaseStudiesHtml(predictionCaseStudies)}
    </section>

    <section>
      <div class="section-head">
        <h2>Methodology And Provenance</h2>
        <p>The final model is only as credible as its data rules. This section is deliberately plain because judges should be able to audit the logic without reading the whole codebase.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>Official scores</strong><p>TBA and FIRST Events data are treated as canonical for match scores, teams, events, and official breakdowns where available.</p></div>
        <div class="card"><strong>Statbotics context</strong><p>Statbotics event/team context is useful, but published match predictions are not promoted without prediction-specific timestamps.</p></div>
        <div class="card"><strong>Scout data honesty</strong><p>Firebase and backup scouting data are used only where cached and matched. Current scout/PPC enrichment has 356 matched Firebase rows, so the model says both the new availability and the sparse coverage openly.</p></div>
        <div class="card"><strong>OPR versus EPA</strong><p>OPR solves a linear contribution system after matches exist. EPA-style state updates after each match and is better suited to pre-match replay.</p></div>
        <div class="card"><strong>Monte Carlo role</strong><p>Simulation provides uncertainty and win probabilities. It is not allowed to hide weak point predictions behind wide intervals.</p></div>
        <div class="card"><strong>Benchmark rule</strong><p>MAE matters, but calibration, coverage, Brier score, worst-event behavior, holdout stability, and overfit penalties also count.</p></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Research Atlas</h2>
        <p>This table pulls every generated cross-run summary I could find under <code>modeling/artifacts/reports</code>. Scores are not treated as one universal leaderboard because each report has a different candidate set, but it shows the breadth of branches we tried and whether they survived holdouts.</p>
      </div>
      <div class="chart-card" style="margin-bottom:18px;">
        <h3>Best Deployment Reviews Across Report Families</h3>
        ${buildJourneyBars(modelJourneyRows) || '<p>No cross-run report family scores were available.</p>'}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Report family</th><th>Runs</th><th>Holdouts</th><th>Eval matches</th><th>Status</th><th>Relative leader</th><th>Fixed leader</th><th>Best deployment row</th><th>Deploy score</th><th>Score MAE</th><th>Brier</th></tr></thead>
          <tbody>${buildJourneyTable(modelJourneyRows)}</tbody>
        </table>
      </div>
    </section>

    <section id="model-leaderboard">
      <div class="section-head">
        <h2>Model Leaderboard Appendix</h2>
        <p>This is the backup scoreboard: deployment-review rows from every saved cross-run report family, grouped by practical role and then sorted by deployment score. It is a map of what we tried, not a claim that all rows came from identical experiments.</p>
      </div>
      <p class="status-note"><strong>Report-local role note:</strong> a row marked <code>point default candidate</code> was the default inside that historical report family only. The current final promoted model is Conservative TailGuard Strong RoleV3 from <code>role-v3-tailguard-micro-sensitivity-check</code>; older point-default rows are audit history, not the current handoff claim.</p>
      <div class="chart-card" style="margin-bottom:18px;">
        <h3>Top Deployment Rows Across Saved Reports</h3>
        ${buildModelLeaderboardBars(modelLeaderboardRows) || '<p>No deployment-review rows were available.</p>'}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Model</th><th>Role</th><th>Status</th><th>Runs</th><th>Relative wins</th><th>Fixed wins</th><th>Near-ties</th><th>Score MAE</th><th>Margin MAE</th><th>Brier</th><th>Worst event</th><th>Deploy</th><th>Robust</th></tr></thead>
          <tbody>${buildModelLeaderboardTable(modelLeaderboardRows, 60)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Diagnostics</h2>
        <p>We checked collinearity and feature importance because a model that looks good by memorizing overlapping signals is not judge-worthy.</p>
      </div>
      <div class="split">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>Coefficient</th><th>Standardized magnitude</th></tr></thead>
            <tbody>${buildFeatureTable(bestResult) || '<tr><td colspan="3">No coefficient diagnostics available.</td></tr>'}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Feature</th><th>VIF</th></tr></thead>
            <tbody>${buildVifTable(bestResult) || '<tr><td colspan="2">No VIF diagnostics available.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Defense Role Guide</h2>
        <p>Scout/PPC enrichment is no longer blocked, but the current local cache has only 356 matched Firebase scout rows and they are mostly concentrated in 2026mnum. The defense layer therefore treats scout labels as sparse supporting evidence alongside official-match residual evidence, foul exposure, and role-choice proxies.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Core formula</strong><p>Defensive net swing equals expected opponent suppression minus lost offense and foul risk.</p></div>
        <div class="card"><strong>Opportunity cost</strong><p>A team that can score 30 does not keep those 30 points while defending, so defense only wins when suppression is larger.</p></div>
        <div class="card"><strong>Human decision</strong><p>The role read is evidence for strategy discussion, not an automatic command to drivers.</p></div>
      </div>
      <div class="table-wrap" style="margin-bottom:16px;">
        <table>
          <thead><tr><th>Topic</th><th>Explanation</th><th>Short judge line</th></tr></thead>
          <tbody>${buildRoleGuideTable()}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Match</th><th>Red role read</th><th>Blue role read</th><th>Expected score</th><th>Actual score</th></tr></thead>
          <tbody>${roleExamples || '<tr><td colspan="5">No defender role examples were available in the compact artifact.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section id="what-should-surprise">
      <div class="callout">
        <h2>What Should Surprise Judges</h2>
        <ul>
          <li><strong>The smarter-sounding gate lost.</strong> SelectiveTailGuard improved the full 2026 replay, then failed the broad confirmation slices. We rejected it.</li>
          <li><strong>The stricter RoleGate also did not win.</strong> It closed a scout-gating audit path in role features, but the holdouts did not confirm a new promoted model. Better integrity did not automatically mean better score predictions.</li>
          <li><strong>Scout data became real evidence, not magic.</strong> The pipeline now matches 356 Firebase scout rows, and ScoutGate improved dense scout-heavy checks, but sparse coverage still limits global promotion.</li>
          <li><strong>EPA and OPR are treated differently.</strong> OPR-like matrix models are useful baselines, while EPA-style memory is better suited to pre-match walk-forward updating.</li>
          <li><strong>Statbotics predictions stayed non-promotable.</strong> Cached public predictions lacked prediction-specific timestamps, so we refused to use them as a promoted input.</li>
          <li><strong>Defense is modeled as opportunity cost.</strong> A defender only helps if expected suppression beats lost offense plus foul risk.</li>
          <li><strong>The best answer is modest.</strong> This model is better than earlier candidates, but the near-ties prove the problem is hard and that overclaiming would be dishonest.</li>
        </ul>
      </div>
    </section>

    <section id="evidence-matrix">
      <div class="section-head">
        <h2>Evidence Matrix</h2>
        <p>This is the fastest way to audit the story. Every important claim has a supporting artifact and a caveat so the presentation stays honest.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Claim</th><th>Evidence</th><th>Caveat</th><th>Where to audit</th></tr></thead>
          <tbody>
            <tr>${tableCell('Current best model')}${tableCell('Conservative TailGuard TW=0.22 has the best stability-adjusted point deployment score in the completed micro-sensitivity report.')}${tableCell('The lead is small and the holdout picture remains mixed.')}${tableCell('FINAL_MODEL_CARD.md and role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md')}</tr>
            <tr>${tableCell('No future leakage')}${tableCell('Walk-forward tests verify feature rows are emitted before current-match state updates, and the leakage audit names each guardrail.')}${tableCell('This protects the local pipeline, not any future external data source added later.')}${tableCell('LEAKAGE_AUDIT.md, tests/**/*.test.mjs, and METHODOLOGY_APPENDIX.md')}</tr>
            <tr>${tableCell('Role/defense value is modeled')}${tableCell('RoleV3 separates suppression, offense cost, foul exposure, confidence, and net swing features. RoleGate then checked that stricter scout-gated role features did not justify a new promotion.')}${tableCell('Scout/PPC enrichment has 356 matched Firebase rows, but the coverage is sparse and concentrated.')}${tableCell('modeling/src/modeling/train.ts, SCOUT_COVERAGE.md, firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md, and scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md')}</tr>
            <tr>${tableCell('Overfit control changed decisions')}${tableCell('SelectiveTailGuard improved a full replay but failed broad holdouts, so it was rejected.')}${tableCell('A better future gate might still exist; this one did not confirm.')}${tableCell('MODELING_RESEARCH_LOG.md and role-v3-selective-tailguard-check/CROSS_RUN_SUMMARY.md')}</tr>
            <tr>${tableCell('Hard questions are pre-answered')}${tableCell('The judge Q&A names the strongest objections: small gains, possible neural alternatives, leakage, defense noise, Statbotics provenance, and next-step data needs.')}${tableCell('Prepared answers are still only as strong as the artifacts behind them.')}${tableCell('JUDGE_QA.md and index.html')}</tr>
            <tr>${tableCell('Dashboard is generated')}${tableCell('The HTML, handout, model card, runbook, and manifest are rebuilt by npm run model:dashboard.')}${tableCell('Screenshots must be refreshed after visual edits.')}${tableCell('REPRODUCIBILITY_RUNBOOK.md and QA_CHECKLIST.md')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="risk-register">
      <div class="section-head">
        <h2>Risk Register</h2>
        <p>The model is most useful when its failure modes are visible. These are the risks I would name before using the predictions for real match strategy.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Risk</th><th>Why it matters</th><th>Current mitigation</th><th>Status</th></tr></thead>
          <tbody>
            <tr>${tableCell('Near-tie model selection')}${tableCell('Several candidates differ by small margins, so one metric can exaggerate confidence.')}${tableCell('Use deployment scoring, holdouts, fixed/relative benchmarks, and explicit near-tie labels.')}${tableCell('Managed, not eliminated.')}</tr>
            <tr>${tableCell('Early-event uncertainty')}${tableCell('Teams have little current-season evidence before enough matches are played.')}${tableCell('Use uncertainty bands, online updates, and avoid overconfident early-match claims.')}${tableCell('Known weakness.')}</tr>
            <tr>${tableCell('Championship-tail errors')}${tableCell('High-score and unusual event phases remain harder than ordinary qualification matches.')}${tableCell('TailGuard trims risk conservatively without promoting unstable stronger gates.')}${tableCell('Improved slightly; still hard.')}</tr>
            <tr>${tableCell('Sparse scout/PPC rows')}${tableCell('The model has 356 matched Firebase observations, but most are from 2026mnum and do not cover broad history.')}${tableCell('Do not generalize one-event scout evidence into a universal model improvement.')}${tableCell('Available but not broadly promotable yet.')}</tr>
            <tr>${tableCell('Timestamp provenance')}${tableCell('Public predictions can leak future knowledge if we cannot prove when they were available.')}${tableCell('Statbotics published predictions remain non-promotable without prediction-specific timestamps.')}${tableCell('Controlled by exclusion.')}</tr>
            <tr>${tableCell('Strategy overuse')}${tableCell('A model can support decisions, but drive-team condition and live scouting can override it.')}${tableCell('Present outputs as evidence for humans, not automatic match plans.')}${tableCell('Presentation rule.')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Audit Trail And Reproducibility</h2>
        <p>The final package is meant to be rerunnable, not just pretty. These are the commands and artifacts I would use if a judge asked how to audit the claim.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>1. Run final gate</strong><p><code>npm run model:final-check</code> regenerates the dashboard, refreshes browser QA and screenshots, records the promoted-model claim, no-server, deliverables-coverage, body/header browser-health, and screenshot-dimension checks, verifies the package, type-checks modeling code, and runs the tests.</p></div>
        <div class="card"><strong>2. Regenerate report</strong><p><code>npm run model:dashboard</code> rebuilds this HTML, walkthrough, model card, handout, script, journey timeline, model anatomy, finalist comparison, strategy example, metric glossary, evidence matrix, risk register, runbook, readiness check, and deliverables map from saved artifacts.</p></div>
        <div class="card"><strong>3. Refresh browser QA</strong><p><code>npm run model:qa-dashboard</code> starts a local dashboard server, checks Chrome render output, refreshes <code>browser-qa-summary.json</code>, and writes desktop hero, mobile first-screen, print-preview, source-code evidence, final-gate, starred-coverage, story-spine, model-anatomy, accuracy-stats, model-scores, mobile full-page, and desktop full-page screenshots.</p></div>
        <div class="card"><strong>4. Verify package</strong><p><code>npm run model:verify-dashboard</code> checks required files, dashboard text, manifest keys, reference paths, browser-QA freshness, screenshots, and source/text artifact hashes.</p></div>
        <div class="card"><strong>5. Verify code</strong><p><code>npm run model:typecheck</code> and <code>npm run test</code> are included in the final gate and can be run separately while debugging.</p></div>
        <div class="card"><strong>6. Inspect locally</strong><p><code>python3 -m http.server 4177 --directory modeling/artifacts/reports/final-judge-dashboard</code>, then open <code>http://127.0.0.1:4177/</code> for the live demo route.</p></div>
        <div class="card"><strong>7. Check fingerprints</strong><p><code>ARTIFACT_FINGERPRINTS.md</code> and <code>artifact-fingerprints.json</code> record hashes for the source and generated text evidence package.</p></div>
        <div class="card"><strong>8. Keep claims bounded</strong><p>Announce the current best model, the rejected alternatives, and the known weaknesses together. The honesty is part of the method.</p></div>
      </div>
    </section>

    <section id="final-gate-proof">
      <div class="section-head">
        <h2>Final Gate Proof Route</h2>
        <p>This is the fastest route from the dashboard to the final passed handoff proof. Use it when a judge or teacher asks whether the package was actually regenerated, browser-checked, tested, and verified after the latest edit.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Human proof</strong><p><code>FINAL_CHECK_SUMMARY.md</code> is the readable proof: result, promoted model claim, command steps, test count, post-checks, browser QA, screenshot dimensions, and final verifier status.</p></div>
        <div class="card"><strong>Machine proof</strong><p><code>final-check-summary.json</code> is the machine-readable digest with <code>testSuiteHealth</code>, <code>browserQaHealth</code>, <code>screenshotDimensions</code>, <code>deliverablesCoverage</code>, and <code>finalVerifier</code>.</p></div>
        <div class="card"><strong>Second verifier</strong><p>The final gate writes a passed summary, then runs <code>npm run model:verify-dashboard</code> again so the final summary is itself checked. Look for <code>Final summary verified by second run: yes</code>.</p></div>
        <div class="card"><strong>Boundary</strong><p>This route proves the local handoff package is internally consistent after the latest edit. It does not prove the model is perfect, and that distinction is part of the presentation.</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Question</th><th>Open</th><th>What to check</th></tr></thead>
          <tbody>
            <tr>${tableCell('Did tests pass?')}${tableCell('FINAL_CHECK_SUMMARY.md or final-check-summary.json')}${tableCell('Test suite status is passed; tests passed equals total tests; fail and cancelled counts are zero.')}</tr>
            <tr>${tableCell('Did the browser render correctly?')}${tableCell('browser-qa-summary.json and screenshots')}${tableCell('Body/header required text, stale forbidden wording, overflow, console issues, and page errors are all clean.')}</tr>
            <tr>${tableCell('Is every generated file manifested?')}${tableCell('final-check-summary.json and deliverables.json')}${tableCell('Deliverables coverage has equal file and manifest-path counts, with no missing files on either side.')}</tr>
            <tr>${tableCell('Was the proof verified after it existed?')}${tableCell('FINAL_CHECK_SUMMARY.md and VERIFICATION_SUMMARY.md')}${tableCell('Final summary verified by second run: yes, and the verifier summary says PASS.')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="screenshot-proof-index">
      <div class="section-head">
        <h2>Screenshot Proof Index</h2>
        <p>Every screenshot has a job. This index turns the saved visual fallback files into an auditable checklist instead of a pile of PNGs.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Fourteen proof files</strong><p>The browser-QA command writes the one-page story, start-here story, targeted section screenshots, plus desktop and mobile full-page fallbacks after the dashboard is regenerated.</p></div>
        <div class="card"><strong>Freshness guard</strong><p>The verifier fails if browser QA or any required screenshot is older than <code>index.html</code>, so stale visuals cannot quietly survive a report edit.</p></div>
        <div class="card"><strong>Dimension guard</strong><p>The verifier reads PNG headers and fails undersized images, which blocks zero-byte files, thumbnails, and broken captures.</p></div>
        <div class="card"><strong>Presentation fallback</strong><p>If the live browser route fails, these files carry the opening, model visual, stats, scores, story, final gate, and full-page report.</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Proof</th><th>File</th><th>Purpose</th><th>Verifier rule</th></tr></thead>
          <tbody>${buildScreenshotProofRows()}</tbody>
        </table>
      </div>
    </section>

    <section id="documentation-proof-index">
      <div class="section-head">
        <h2>Documentation Proof Index</h2>
        <p>This is the short route through the Markdown documentation. It shows which files carry the story, model explanation, safety boundaries, strategy use, and verification proof.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Markdown is part of the package</strong><p>The final dashboard folder includes reusable Markdown for the judge story, model card, audits, risk register, runbooks, and evidence maps.</p></div>
        <div class="card"><strong>Generated, not improvised</strong><p>The docs are generated from saved modeling artifacts and dashboard source, then listed in <code>deliverables.json</code>.</p></div>
        <div class="card"><strong>Copy-quality guard</strong><p>The verifier scans generated Markdown for placeholders, stale scout/PPC claims, and unsafe overclaims.</p></div>
        <div class="card"><strong>Cold-reader route</strong><p>A judge can start with <code>OPEN_THIS_FIRST.md</code>, then use this table to choose the right proof file.</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Documentation group</th><th>Files</th><th>What it proves</th><th>Audit guard</th></tr></thead>
          <tbody>${buildDocumentationProofRows()}</tbody>
        </table>
      </div>
    </section>

    <section id="source-code-evidence-lock">
      <div class="section-head">
        <h2>Source Code Evidence Lock</h2>
        <p>These are the exact six source paths that <code>npm run model:final-check</code> writes into <code>final-check-summary.json</code> as <code>sourceCodeEvidence</code>. The verifier fails if any file is missing or if these hashes no longer match <code>artifact-fingerprints.json</code>.</p>
      </div>
      <div class="cards" style="margin-bottom:16px;">
        <div class="card"><strong>Why this matters</strong><p>The HTML report now points at the same source-code evidence set that the final gate independently checks, so the best-model code claim is visible and machine-audited.</p></div>
        <div class="card"><strong>What it proves</strong><p>The files existed at regeneration time and their SHA-256 values matched the fingerprint manifest. It proves package identity, not model perfection.</p></div>
        <div class="card"><strong>Where to audit</strong><p>Open <code>FINAL_CHECK_SUMMARY.md</code> for the readable source-code table, or <code>final-check-summary.json</code> for the machine digest.</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Locked source</th><th>Path</th><th>SHA-256 prefix</th><th>Bytes</th></tr></thead>
          <tbody>${buildSourceEvidenceLockRows(criticalFingerprints)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Integrity Fingerprints</h2>
        <p>These are SHA-256 fingerprints for the core code and evidence files behind the dashboard. The full source and generated text package fingerprints are written to <code>ARTIFACT_FINGERPRINTS.md</code> and <code>artifact-fingerprints.json</code>; browser QA, screenshots, and the verifier summary are checked separately for freshness, paths, and dimensions.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Artifact</th><th>Path</th><th>SHA-256 prefix</th><th>Bytes</th></tr></thead>
          <tbody>${buildFingerprintTableRows(criticalFingerprints)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Final Readiness Check</h2>
        <p>This is the go/no-go gate for presenting the package. The model story is ready only if the evidence, caveats, and generated files all agree.</p>
      </div>
      <div class="cards">
        <div class="card"><strong>Model claim</strong><p>Announce ${escapeHtml(shortModelName(bestDeployment.model))} as the best defensible model, not as proof that no better model can exist.</p></div>
        <div class="card"><strong>Evidence included</strong><p>Open the model card, evidence matrix, strategy example, risk register, and research log when asked for support.</p></div>
        <div class="card"><strong>Verification gate</strong><p>Pass typecheck, tests, dashboard regeneration, desktop browser QA, mobile browser QA, and screenshot refresh after every report edit.</p></div>
        <div class="card"><strong>Presentation boundary</strong><p>Say clearly that scout/PPC enrichment is sparse and concentrated, Statbotics predictions are not promoted, and the model supports humans rather than replacing them.</p></div>
      </div>
    </section>

    <section id="final-package-map">
      <div class="section-head">
        <h2>Final Package Map</h2>
        <p>These are the artifacts to open when presenting the project. The model itself stays local; the scouting website does not ship this research model.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Artifact</th><th>Path</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr>${tableCell('Best model code')}${tableCell('modeling/src/modeling/train.ts')}${tableCell('Candidate model definitions, including RoleV3 and TailGuard variants.')}</tr>
            <tr>${tableCell('Final handoff check')}${tableCell('package.json')}${tableCell('One-command final gate: npm run model:final-check regenerates, browser-checks, verifies, type-checks, and tests the package.')}</tr>
            <tr>${tableCell('Final check runner')}${tableCell('scripts/model-final-check.mjs')}${tableCell('Runs the final gate and writes final-check-summary.json plus FINAL_CHECK_SUMMARY.md with the promoted claim, command statuses, no-server cleanup, manifest coverage, entry-point checks, body/header browser-health counts, screenshot dimensions, and verifier result before verifying that final summary again.')}</tr>
            <tr>${tableCell('Training CLI')}${tableCell('modeling/src/cli.ts')}${tableCell('Local commands for ingestion, training, reports, diagnostics, and dashboard generation.')}</tr>
            <tr>${tableCell('Browser QA command')}${tableCell('modeling/src/reporting/browserQaDashboard.ts')}${tableCell('Repeatable local Chrome QA and screenshot refresh command used by npm run model:qa-dashboard.')}</tr>
            <tr>${tableCell('Research log')}${tableCell('modeling/MODELING_RESEARCH_LOG.md')}${tableCell('The full modeling journey, reflections, rejected branches, and current stance.')}</tr>
            <tr>${tableCell('One-page judge story HTML')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.html')}${tableCell('Single-page adventure route for a busy judge before opening the fuller story or dashboard.')}</tr>
            <tr>${tableCell('One-page judge story Markdown')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.md')}${tableCell('Copyable one-page story with the model intuition, final numbers, and proof route.')}</tr>
            <tr>${tableCell('Start-here story HTML')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.html')}${tableCell('Fast plain-English adventure page to open before the full evidence dashboard.')}</tr>
            <tr>${tableCell('Start-here story Markdown')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.md')}${tableCell('Copyable version of the short model adventure and one-minute judge script.')}</tr>
            <tr>${tableCell('Final model cross-run evidence')}${tableCell('modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md')}${tableCell('Two full replays and five event-key holdouts behind the final promoted stance.')}</tr>
            <tr>${tableCell('Latest scout-enrichment evidence')}${tableCell('modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md')}${tableCell('Latest Firebase scout import check showing real but sparse scout coverage did not promote a new global model.')}</tr>
            <tr>${tableCell('RoleGate audit evidence')}${tableCell('modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md')}${tableCell('Stricter scout-gated role-feature follow-up: useful audit improvement, not a confirmed replacement for the final model.')}</tr>
            <tr>${tableCell('Package README')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/README.md')}${tableCell('Top-level generated package metadata: source folders, model names, deadline target, and first-open file.')}</tr>
            <tr>${tableCell('Deliverables map')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/DELIVERABLES.md')}${tableCell('Human-readable inventory of every final report, code, documentation, visualization, and verification artifact.')}</tr>
            <tr>${tableCell('Deliverables manifest')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/deliverables.json')}${tableCell('Machine-readable artifact map with deadline, promoted model, headline metrics, screenshots, and local paths.')}</tr>
            <tr>${tableCell('Open this first')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/OPEN_THIS_FIRST.md')}${tableCell('Cover sheet for a cold handoff: first files, first claims, and fallback route.')}</tr>
            <tr>${tableCell('Judge walkthrough')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_WALKTHROUGH.md')}${tableCell('Fast route through the final package for a live judge conversation.')}</tr>
            <tr>${tableCell('Judge story spine')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_STORY_SPINE.md')}${tableCell('Shortest clean argument through the project: problem, rule, search, winner, evidence, strategy use, and integrity.')}</tr>
            <tr>${tableCell('First 90 seconds')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FIRST_90_SECONDS.md')}${tableCell('Timed opening script with evidence pointers and boundaries for a short judge conversation.')}</tr>
            <tr>${tableCell('Final freeze audit')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_FREEZE_AUDIT.md')}${tableCell('Pre-presentation guardrail sheet for frozen claims, evidence, and overclaim failure modes.')}</tr>
            <tr>${tableCell('Presentation wording audit')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/PRESENTATION_WORDING_AUDIT.md')}${tableCell('Stale-wording and overclaim sweep with safer phrasing tied to evidence files.')}</tr>
            <tr>${tableCell('Cold reader route')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/COLD_READER_ROUTE.md')}${tableCell('First-five-minutes route that tells a new reader what to open and what to ignore at first.')}</tr>
            <tr>${tableCell('Hostile judge cross-exam')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/HOSTILE_JUDGE_CROSS_EXAM.md')}${tableCell('Pressure-tested answers to adversarial judge questions, with evidence files and phrases to avoid.')}</tr>
            <tr>${tableCell('Final coherence audit')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_COHERENCE_AUDIT.md')}${tableCell('Single-source consistency check for model name, metrics, boundaries, limitations, and package integrity wording.')}</tr>
            <tr>${tableCell('Final presentation lock')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_PRESENTATION_LOCK.md')}${tableCell('Handoff lock stating what is safe to present now and what changes force regeneration, screenshots, and verification.')}</tr>
            <tr>${tableCell('Reference integrity audit')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/REFERENCE_INTEGRITY_AUDIT.md')}${tableCell('Local-file reference audit for source, evidence, browser QA, screenshots, manifests, and fingerprints.')}</tr>
            <tr>${tableCell('Deadline deliverables checklist')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/DEADLINE_DELIVERABLES_CHECKLIST.md')}${tableCell('Maps each requested final deliverable to the exact artifact or dashboard section that satisfies it.')}</tr>
            <tr>${tableCell('Claim boundaries')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/CLAIM_BOUNDARIES.md')}${tableCell('Safe claims, unsafe overclaims, and evidence files for judge pressure.')}</tr>
            <tr>${tableCell('Leakage audit')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/LEAKAGE_AUDIT.md')}${tableCell('No-future guardrails, what each blocks, and the exact artifact to audit.')}</tr>
            <tr>${tableCell('Judge rubric alignment')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_RUBRIC_ALIGNMENT.md')}${tableCell('Maps the work to process, rigor, validation, usefulness, integrity, honesty, and communication.')}</tr>
            <tr>${tableCell('Printable handout')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/PRINTABLE_HANDOUT.md')}${tableCell('One-page summary for quick presentation prep.')}</tr>
            <tr>${tableCell('Presentation script')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/PRESENTATION_SCRIPT.md')}${tableCell('30-second, 90-second, and 3-minute spoken versions.')}</tr>
            <tr>${tableCell('Live demo runbook')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/LIVE_DEMO_RUNBOOK.md')}${tableCell('Exact presentation path, evidence order, timing, and fallback plan.')}</tr>
            <tr>${tableCell('Judge dry-run scorecard')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_DRY_RUN_SCORECARD.md')}${tableCell('Rehearsal gate for defending the bounded model claim under judge pressure.')}</tr>
            <tr>${tableCell('Mock judge panel brief')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/MOCK_JUDGE_PANEL_BRIEF.md')}${tableCell('Judge-personality pressure sheet for technical, strategy, skeptical, reproducibility, impact, and data-source questions.')}</tr>
            <tr>${tableCell('Model journey timeline')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/MODEL_JOURNEY_TIMELINE.md')}${tableCell('Short narrative arc from baselines to the final model and rejected branches.')}</tr>
            <tr>${tableCell('Finalist comparison')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINALIST_COMPARISON.md')}${tableCell('Side-by-side decision table for the promoted, baseline, high-tail, rejected, and diagnostic finalists.')}</tr>
            <tr>${tableCell('Model anatomy')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/MODEL_ANATOMY.md')}${tableCell('Plain-English map of the promoted model architecture and data flow.')}</tr>
            <tr>${tableCell('Model source map')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/MODEL_SOURCE_MAP.md')}${tableCell('Audit route from judge-facing claims back to the source files that implement the model, diagnostics, scoring rule, and verifier.')}</tr>
            <tr>${tableCell('Defense role guide')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/DEFENSE_ROLE_GUIDE.md')}${tableCell('Net-swing formula, opportunity cost, foul-risk penalty, and saved role examples.')}</tr>
            <tr>${tableCell('Model leaderboard appendix')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/MODEL_LEADERBOARD_APPENDIX.md')}${tableCell('Deployment-review rows across saved report families for backup model-score evidence.')}</tr>
            <tr>${tableCell('Strategy example')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/STRATEGY_EXAMPLE.md')}${tableCell('One concrete saved pre-match prediction with role/defense interpretation.')}</tr>
            <tr>${tableCell('Prediction case studies')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/PREDICTION_CASE_STUDIES.md')}${tableCell('Representative saved predictions: good read, close uncertainty, miss, and stress case.')}</tr>
            <tr>${tableCell('Failure mode atlas')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FAILURE_MODE_ATLAS.md')}${tableCell('Current TW=0.22 TailGuard residual failure analysis: worst events, phase bias, calibration gaps, and what not to overclaim.')}</tr>
            <tr>${tableCell('Final model card')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_MODEL_CARD.md')}${tableCell('Concise technical model card for judges and teachers.')}</tr>
            <tr>${tableCell('Judge brief')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_BRIEF.md')}${tableCell('One-minute presentation story and likely questions.')}</tr>
            <tr>${tableCell('Judge Q&A')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/JUDGE_QA.md')}${tableCell('Hard questions and concise answers for overfit, defense, Statbotics, and next-step challenges.')}</tr>
            <tr>${tableCell('Methodology appendix')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/METHODOLOGY_APPENDIX.md')}${tableCell('Data provenance, OPR/EPA explanation, validation, and benchmark rules.')}</tr>
            <tr>${tableCell('OPR vs EPA explainer')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/OPR_EPA_EXPLAINER.md')}${tableCell('Plain-English distinction between retrospective OPR and online EPA-style replay.')}</tr>
            <tr>${tableCell('Metric glossary')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/METRIC_GLOSSARY.md')}${tableCell('Plain-English explanation of scoring metrics and benchmark terms.')}</tr>
            <tr>${tableCell('Deployment scoring rubric')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/DEPLOYMENT_SCORING_RUBRIC.md')}${tableCell('Weights, fixed targets, nonlinear overfit penalties, and near-tie rules.')}</tr>
            <tr>${tableCell('Evidence matrix')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/EVIDENCE_MATRIX.md')}${tableCell('Claim-by-claim audit map for judges and teachers.')}</tr>
            <tr>${tableCell('Risk register')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/LIMITATIONS_AND_RISK_REGISTER.md')}${tableCell('Known limitations, mitigations, and presentation boundaries.')}</tr>
            <tr>${tableCell('Reproducibility runbook')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/REPRODUCIBILITY_RUNBOOK.md')}${tableCell('Exact rerun, audit, and presentation-verification procedure.')}</tr>
            <tr>${tableCell('Final readiness check')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_READINESS_CHECK.md')}${tableCell('Go/no-go checklist for presenting the final model package.')}</tr>
            <tr>${tableCell('QA checklist')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/QA_CHECKLIST.md')}${tableCell('Commands and browser checks used before presenting.')}</tr>
            <tr>${tableCell('Verification summary')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/VERIFICATION_SUMMARY.md')}${tableCell('Generated result from npm run model:verify-dashboard.')}</tr>
            <tr>${tableCell('Final check summary')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/final-check-summary.json')}${tableCell('Machine-readable summary written by npm run model:final-check with the promoted model claim, post-checks, browser QA, screenshot dimensions, and verifier result; the runner verifies this final summary again.')}</tr>
            <tr>${tableCell('Human-readable final check summary')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/FINAL_CHECK_SUMMARY.md')}${tableCell('Readable version of the final gate result for judges and teachers who should not have to inspect JSON to understand the proof.')}</tr>
            <tr>${tableCell('Browser QA summary')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/browser-qa-summary.json')}${tableCell('Machine-readable local-browser render check: required body/header text, stale wording guards, overflow, console/page errors, and screenshot paths.')}</tr>
            <tr>${tableCell('Artifact fingerprints')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/ARTIFACT_FINGERPRINTS.md')}${tableCell('SHA-256 hashes for source and generated text artifacts; browser QA and screenshots are verified separately.')}</tr>
            <tr>${tableCell('Fingerprint manifest')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/artifact-fingerprints.json')}${tableCell('Machine-readable SHA-256 fingerprint manifest for source and generated text artifacts used by the verifier.')}</tr>
            <tr>${tableCell('HTML dashboard')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/index.html')}${tableCell('This judge-facing report with visuals, scores, story, and diagnostics.')}</tr>
            <tr>${tableCell('Verification screenshots')}${tableCell('modeling/artifacts/reports/final-judge-dashboard/*.png')}${tableCell('Desktop hero, one-page story, start-here story, mobile first-screen, print-preview, source-code evidence, final-gate, starred-coverage, story-spine, model-anatomy, accuracy-stats, model-scores, mobile full-page, and desktop full-page screenshots from local browser QA.')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <footer>
      <p>${escapeHtml(buildGeneratedInline(generatedAt))} from <code>${escapeHtml(DEFAULT_SUMMARY_DIR)}</code> and <code>${escapeHtml(
        DEFAULT_BEST_RUN_DIR
      )}</code>. Source summary generated ${escapeHtml(summary.createdAt)}.</p>
      <p>Primary documentation: <code>modeling/MODELING_RESEARCH_LOG.md</code>. Final model evidence: <code>modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md</code>. Latest scout-enrichment check: <code>modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md</code>.</p>
    </footer>
  </main>
</body>
</html>`;
};

export const writeJudgeDashboardArtifacts = (options: JudgeDashboardOptions = {}) => {
  const summaryDir = path.resolve(options.summaryDir ?? DEFAULT_SUMMARY_DIR);
  const bestRunDir = path.resolve(options.bestRunDir ?? DEFAULT_BEST_RUN_DIR);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const researchLogPath = path.resolve(options.researchLogPath ?? DEFAULT_RESEARCH_LOG_PATH);
  const summary = readJsonFile<CrossRunSummary>(path.join(summaryDir, 'cross-run-summary.json'));
  const bestRun = readJsonFile<ResearchRun>(path.join(bestRunDir, 'run.json'));
  const metricSvg = loadInlineSvg(path.join(summaryDir, 'leaderboard-metrics.svg'));
  const researchLog = fs.existsSync(researchLogPath) ? fs.readFileSync(researchLogPath, 'utf8') : '';
  const reportsRoot = path.resolve(options.reportsRoot ?? DEFAULT_REPORTS_ROOT);
  const residualDiagnosticsPath = path.resolve(options.residualDiagnosticsPath ?? DEFAULT_RESIDUAL_DIAGNOSTICS_PATH);
  const failureModeAtlas = loadFailureModeAtlas(residualDiagnosticsPath);
  const modelJourneyRows = collectModelJourneyRows(reportsRoot);
  const modelLeaderboardRows = collectModelLeaderboardRows(reportsRoot);
  const deploymentWinner = summary.deploymentReview.rows[0]?.model;
  const bestResult =
    bestRun.modelResults.find(result => result.config.name === deploymentWinner) ??
    bestRun.modelResults.find(result => result.promoted) ??
    bestRun.modelResults[0];
  if (!bestResult) {
    throw new Error(`No model results found in ${bestRunDir}`);
  }
  const bestDeployment = summary.deploymentReview.rows[0];
  if (!bestDeployment) {
    throw new Error('Cannot write judge dashboard without deployment review rows.');
  }

  const generatedAt = new Date().toISOString();
  const finalistComparisonRows = buildFinalistComparisonRows(summary.deploymentReview.rows);
  const criticalFingerprints = buildArtifactFingerprints([
    { label: 'Best model code', filePath: path.resolve('modeling/src/modeling/train.ts') },
    { label: 'Walk-forward features', filePath: path.resolve('modeling/src/modeling/features.ts') },
    { label: 'Model diagnostics', filePath: path.resolve('modeling/src/modeling/diagnostics.ts') },
    { label: 'Report scoring code', filePath: path.resolve('modeling/src/reporting/report.ts') },
    { label: 'Training CLI', filePath: path.resolve('modeling/src/cli.ts') },
    { label: 'Dashboard generator', filePath: path.resolve('modeling/src/reporting/judgeDashboard.ts') },
    { label: 'Dashboard browser QA', filePath: path.resolve('modeling/src/reporting/browserQaDashboard.ts') },
    { label: 'Dashboard verifier', filePath: path.resolve('modeling/src/reporting/verifyDashboard.ts') },
    { label: 'Final check runner', filePath: path.resolve('scripts/model-final-check.mjs') },
    { label: 'Research log', filePath: researchLogPath },
    { label: 'Current cross-run JSON', filePath: path.join(summaryDir, 'cross-run-summary.json') },
    { label: 'Current cross-run Markdown', filePath: path.join(summaryDir, 'CROSS_RUN_SUMMARY.md') },
    ...(fs.existsSync(residualDiagnosticsPath) ? [{ label: 'Current residual diagnostics', filePath: residualDiagnosticsPath }] : []),
    { label: 'Best run JSON', filePath: path.join(bestRunDir, 'run.json') },
    { label: 'Modeling package config', filePath: path.resolve('package.json') }
  ]);
  const strategyExample = chooseStrategyExample(bestResult.matchPredictions);
  const predictionCaseStudies = choosePredictionCaseStudies(bestResult.matchPredictions);
  const html = buildHtml({
    summary,
    metricSvg,
    bestRun,
    bestResult,
    modelJourneyRows,
    modelLeaderboardRows,
    criticalFingerprints,
    failureModeAtlas,
    researchStatus: latestResearchStatus(researchLog),
    generatedAt
  });
  writeTextFile(path.join(outputDir, 'index.html'), html);
  writeTextFile(
    path.join(outputDir, 'README.md'),
    `# FIRST Match Modeling Judge Dashboard

Open \`ONE_PAGE_JUDGE_STORY.html\` first if time is brutal. Open \`START_HERE_STORY.html\` for the richer quick story. For the full checked dashboard proof, open \`index.html#start-here-story\` locally or serve this directory with a static file server.

${buildGeneratedStamp(generatedAt)}
- Summary source: ${summaryDir}
- Best-run source: ${bestRunDir}
- Best displayed model: ${bestResult.config.name}
- Best displayed model short name: ${shortModelName(bestResult.config.name)}
- Deadline target: Saturday May 23 2026 18:00 CST
- First file to open if you are unsure: \`ONE_PAGE_JUDGE_STORY.html\`
- Richer standalone story: \`START_HERE_STORY.html\`
- One-page Markdown story: \`ONE_PAGE_JUDGE_STORY.md\`
- Shortest Markdown story: \`START_HERE_STORY.md\`
- Fast final gate before presenting: \`npm run model:final-check\`
`
  );
  writeTextFile(
    path.join(outputDir, 'DELIVERABLES.md'),
    `# Final Modeling Package

- One-command final handoff gate: \`npm run model:final-check\`
- Best model code: \`modeling/src/modeling/train.ts\`
- Final handoff check script: \`package.json\`
- Final handoff check runner: \`scripts/model-final-check.mjs\`
- Final handoff check summary: \`modeling/artifacts/reports/final-judge-dashboard/final-check-summary.json\`
- Human-readable final handoff check summary: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_CHECK_SUMMARY.md\`
- Training/report CLI: \`modeling/src/cli.ts\`
- Research log: \`modeling/MODELING_RESEARCH_LOG.md\`
- Final model cross-run evidence: \`modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md\`
- Latest scout-enrichment evidence: \`modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md\`
- RoleGate audit evidence: \`modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md\`
- One-page judge story HTML: \`modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.html\`
- One-page judge story Markdown: \`modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.md\`
- Start-here story HTML: \`modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.html\`
- Start-here story Markdown: \`modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.md\`
- Open this first: \`modeling/artifacts/reports/final-judge-dashboard/OPEN_THIS_FIRST.md\`
- Judge walkthrough: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_WALKTHROUGH.md\`
- Judge story spine: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_STORY_SPINE.md\`
- First 90 seconds: \`modeling/artifacts/reports/final-judge-dashboard/FIRST_90_SECONDS.md\`
- Final freeze audit: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_FREEZE_AUDIT.md\`
- Presentation wording audit: \`modeling/artifacts/reports/final-judge-dashboard/PRESENTATION_WORDING_AUDIT.md\`
- Cold reader route: \`modeling/artifacts/reports/final-judge-dashboard/COLD_READER_ROUTE.md\`
- Hostile judge cross-exam: \`modeling/artifacts/reports/final-judge-dashboard/HOSTILE_JUDGE_CROSS_EXAM.md\`
- Final coherence audit: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_COHERENCE_AUDIT.md\`
- Final presentation lock: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_PRESENTATION_LOCK.md\`
- Reference integrity audit: \`modeling/artifacts/reports/final-judge-dashboard/REFERENCE_INTEGRITY_AUDIT.md\`
- Deadline deliverables checklist: \`modeling/artifacts/reports/final-judge-dashboard/DEADLINE_DELIVERABLES_CHECKLIST.md\`
- Claim boundaries: \`modeling/artifacts/reports/final-judge-dashboard/CLAIM_BOUNDARIES.md\`
- Leakage audit: \`modeling/artifacts/reports/final-judge-dashboard/LEAKAGE_AUDIT.md\`
- Judge rubric alignment: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_RUBRIC_ALIGNMENT.md\`
- Printable handout: \`modeling/artifacts/reports/final-judge-dashboard/PRINTABLE_HANDOUT.md\`
- Presentation script: \`modeling/artifacts/reports/final-judge-dashboard/PRESENTATION_SCRIPT.md\`
- Live demo runbook: \`modeling/artifacts/reports/final-judge-dashboard/LIVE_DEMO_RUNBOOK.md\`
- Judge dry-run scorecard: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_DRY_RUN_SCORECARD.md\`
- Mock judge panel brief: \`modeling/artifacts/reports/final-judge-dashboard/MOCK_JUDGE_PANEL_BRIEF.md\`
- Finalist comparison: \`modeling/artifacts/reports/final-judge-dashboard/FINALIST_COMPARISON.md\`
- Model anatomy: \`modeling/artifacts/reports/final-judge-dashboard/MODEL_ANATOMY.md\`
- Model source map: \`modeling/artifacts/reports/final-judge-dashboard/MODEL_SOURCE_MAP.md\`
- Defense role guide: \`modeling/artifacts/reports/final-judge-dashboard/DEFENSE_ROLE_GUIDE.md\`
- Model journey timeline: \`modeling/artifacts/reports/final-judge-dashboard/MODEL_JOURNEY_TIMELINE.md\`
- Model leaderboard appendix: \`modeling/artifacts/reports/final-judge-dashboard/MODEL_LEADERBOARD_APPENDIX.md\`
- Strategy example: \`modeling/artifacts/reports/final-judge-dashboard/STRATEGY_EXAMPLE.md\`
- Prediction case studies: \`modeling/artifacts/reports/final-judge-dashboard/PREDICTION_CASE_STUDIES.md\`
- Failure mode atlas: \`modeling/artifacts/reports/final-judge-dashboard/FAILURE_MODE_ATLAS.md\`
- Final model card: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_MODEL_CARD.md\`
- Judge brief: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_BRIEF.md\`
- Judge Q&A: \`modeling/artifacts/reports/final-judge-dashboard/JUDGE_QA.md\`
- Methodology appendix: \`modeling/artifacts/reports/final-judge-dashboard/METHODOLOGY_APPENDIX.md\`
- OPR vs EPA explainer: \`modeling/artifacts/reports/final-judge-dashboard/OPR_EPA_EXPLAINER.md\`
- Metric glossary: \`modeling/artifacts/reports/final-judge-dashboard/METRIC_GLOSSARY.md\`
- Deployment scoring rubric: \`modeling/artifacts/reports/final-judge-dashboard/DEPLOYMENT_SCORING_RUBRIC.md\`
- Evidence matrix: \`modeling/artifacts/reports/final-judge-dashboard/EVIDENCE_MATRIX.md\`
- Risk register: \`modeling/artifacts/reports/final-judge-dashboard/LIMITATIONS_AND_RISK_REGISTER.md\`
- Reproducibility runbook: \`modeling/artifacts/reports/final-judge-dashboard/REPRODUCIBILITY_RUNBOOK.md\`
- Final readiness check: \`modeling/artifacts/reports/final-judge-dashboard/FINAL_READINESS_CHECK.md\`
- QA checklist: \`modeling/artifacts/reports/final-judge-dashboard/QA_CHECKLIST.md\`
- Verification summary: \`modeling/artifacts/reports/final-judge-dashboard/VERIFICATION_SUMMARY.md\`
- Artifact fingerprints: \`modeling/artifacts/reports/final-judge-dashboard/ARTIFACT_FINGERPRINTS.md\`
- Artifact fingerprint JSON: \`modeling/artifacts/reports/final-judge-dashboard/artifact-fingerprints.json\`
- HTML dashboard: \`modeling/artifacts/reports/final-judge-dashboard/index.html\`
- Screenshots: \`modeling/artifacts/reports/final-judge-dashboard/dashboard-*.png\`

Deadline target: Saturday May 23 2026 18:00 CST
Current displayed model short name: ${shortModelName(bestResult.config.name)}
Current displayed model full name: ${bestResult.config.name}
${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'JUDGE_WALKTHROUGH.md'),
    `# Judge Walkthrough

This is the fastest route through the final package when presentation time is tight.

## 1. Verdict

Start with \`ONE_PAGE_JUDGE_STORY.html\` if time is brutal. Use \`START_HERE_STORY.html\` for the richer story, then move to \`index.html#start-here-story\` and the printable summary if the judge asks for proof.

- Current best model: ${shortModelName(bestResult.config.name)}
- Weighted score MAE: ${formatNumber(bestDeployment.weightedScoreMae)}
- Weighted margin MAE: ${formatNumber(bestDeployment.weightedMarginMae)}
- Weighted Brier score: ${formatNumber(bestDeployment.weightedBrier, 4)}
- Deployment score: ${formatNumber(bestDeployment.pointDeploymentScore, 3)}

## 2. Proof

Open the leaderboard, research atlas, and evidence matrix. The key point is that we did not pick a model because it sounded advanced. We picked the most defensible model after walk-forward replay, event-key holdouts, overfit penalties, and rejection of fragile variants.

The latest scout-data lesson belongs here too: Firebase scouting is now real evidence with 356 matched rows, ScoutGate is promising but fragmented, and RoleGate improved audit discipline without becoming the promoted model.

## 3. Strategy Example

Open \`STRATEGY_EXAMPLE.md\` or the Strategy Example section in \`index.html\`. This gives judges a concrete pre-match output: expected score, win probability, role/defense read, actual result, and error.

## 4. Honesty

Open \`CLAIM_BOUNDARIES.md\`, \`LEAKAGE_AUDIT.md\`, \`JUDGE_RUBRIC_ALIGNMENT.md\`, \`LIMITATIONS_AND_RISK_REGISTER.md\`, and \`REPRODUCIBILITY_RUNBOOK.md\`. Name the limitations directly: near-tie model selection, early-event uncertainty, championship-tail errors, sparse and concentrated scout/PPC rows, timestamp provenance, and strategy overuse.

## One-Sentence Ending

The final model is useful because it is disciplined: it predicts before the match using only known-before-match evidence, rejects good-looking ideas that fail holdouts, and keeps human strategy judgment in the loop.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.md'), buildOnePageJudgeStoryMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.html'), buildOnePageJudgeStoryHtml(generatedAt));
  writeTextFile(path.join(outputDir, 'START_HERE_STORY.md'), buildStartHereStoryMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'START_HERE_STORY.html'), buildStartHereStoryHtml(generatedAt));
  writeTextFile(path.join(outputDir, 'OPEN_THIS_FIRST.md'), buildOpenThisFirstMarkdown(bestDeployment, generatedAt));
  writeTextFile(path.join(outputDir, 'JUDGE_STORY_SPINE.md'), buildJudgeStorySpineMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'FIRST_90_SECONDS.md'), buildFirst90SecondMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'FINAL_FREEZE_AUDIT.md'), buildFinalFreezeAuditMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'PRESENTATION_WORDING_AUDIT.md'), buildPresentationWordingAuditMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'COLD_READER_ROUTE.md'), buildColdReaderRouteMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'HOSTILE_JUDGE_CROSS_EXAM.md'), buildHostileJudgeCrossExamMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'FINAL_COHERENCE_AUDIT.md'), buildFinalCoherenceAuditMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'FINAL_PRESENTATION_LOCK.md'), buildFinalPresentationLockMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'REFERENCE_INTEGRITY_AUDIT.md'), buildReferenceIntegrityMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'DEADLINE_DELIVERABLES_CHECKLIST.md'), buildDeadlineDeliverablesMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'CLAIM_BOUNDARIES.md'), buildClaimBoundariesMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'LEAKAGE_AUDIT.md'), buildLeakageAuditMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'JUDGE_RUBRIC_ALIGNMENT.md'), buildRubricAlignmentMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'LIVE_DEMO_RUNBOOK.md'), buildLiveDemoRunbookMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'JUDGE_DRY_RUN_SCORECARD.md'), buildJudgeDryRunMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'MOCK_JUDGE_PANEL_BRIEF.md'), buildMockJudgePanelMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'FINALIST_COMPARISON.md'), buildFinalistComparisonMarkdown(finalistComparisonRows, generatedAt));
  writeTextFile(path.join(outputDir, 'MODEL_ANATOMY.md'), buildModelAnatomyMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'MODEL_SOURCE_MAP.md'), buildModelSourceMapMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'DEFENSE_ROLE_GUIDE.md'), buildDefenseRoleGuideMarkdown(bestResult.matchPredictions, strategyExample, generatedAt));
  writeTextFile(path.join(outputDir, 'MODEL_JOURNEY_TIMELINE.md'), buildModelJourneyTimelineMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'MODEL_LEADERBOARD_APPENDIX.md'), buildModelLeaderboardMarkdown(modelLeaderboardRows, generatedAt));
  writeTextFile(
    path.join(outputDir, 'STRATEGY_EXAMPLE.md'),
    strategyExample
      ? `# Strategy Example

This is one saved walk-forward prediction from the current best run. It is included to show what the model would actually say before a match, not to imply every match is this clean.

## Match

- Match key: \`${strategyExample.matchKey}\`
- Event key: \`${strategyExample.eventKey}\`
- Season: ${strategyExample.season}

## Pre-Match Prediction

- Expected red score: ${formatNumber(strategyExample.redExpectedScore, 1)}
- Expected blue score: ${formatNumber(strategyExample.blueExpectedScore, 1)}
- Red win probability: ${formatPercent(strategyExample.redWinProbability)}
- Blue win probability: ${formatPercent(strategyExample.blueWinProbability)}
- Predicted winner: ${strategyExample.predictedWinner}

## Role And Defense Read

- ${roleOptionText('Red', strategyExample)}
- ${roleOptionText('Blue', strategyExample)}

## What Happened

- Actual red score: ${formatNumber(strategyExample.redActualScore, 0)}
- Actual blue score: ${formatNumber(strategyExample.blueActualScore, 0)}
- Actual winner: ${strategyExample.actualWinner}
- Total-score error: ${formatNumber(predictionTotalError(strategyExample), 1)}
- Margin error: ${formatNumber(predictionMarginError(strategyExample), 1)}

## How To Explain It

This example shows the intended use case: the model gives a pre-match score distribution, a win-probability read, and a role/defense clue. A strategist should use that as evidence, then combine it with live scouting, robot condition, drive-team observations, and alliance priorities.

${buildGeneratedStamp(generatedAt)}
`
      : `# Strategy Example

No strategy example with role data was available in the compact artifact.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(path.join(outputDir, 'PREDICTION_CASE_STUDIES.md'), buildPredictionCaseStudiesMarkdown(predictionCaseStudies, generatedAt));
  writeTextFile(path.join(outputDir, 'FAILURE_MODE_ATLAS.md'), buildFailureModeAtlasMarkdown(failureModeAtlas, generatedAt));
  writeTextFile(
    path.join(outputDir, 'REPRODUCIBILITY_RUNBOOK.md'),
    `# Reproducibility Runbook

This runbook is the audit path for the final modeling package. It is intentionally local: the research model is not shipped in the scouting website and does not upload artifacts to Firebase.

## Current Best Model To Reproduce

${bestResult.config.name}

Short name: ${shortModelName(bestResult.config.name)}

## Required Local Checks

\`\`\`sh
npm run model:final-check
\`\`\`

For debugging, the same gate can be run step by step:

\`\`\`sh
npm run model:typecheck
npm run test
npm run model:dashboard
npm run model:qa-dashboard
npm run model:verify-dashboard
\`\`\`

Expected result:

- TypeScript modeling code type-checks with no errors.
- The test suite passes, including leakage, role-feature, residual-correction, dashboard-report, and security hygiene tests.
- The dashboard generator rewrites \`modeling/artifacts/reports/final-judge-dashboard/\`.
- The browser-QA command starts a local dashboard server, checks Chrome render output, refreshes \`browser-qa-summary.json\`, and writes the desktop hero, mobile first-screen, print-preview, source-code evidence, final-gate, starred-coverage, story-spine, model-anatomy, accuracy-stats, model-scores, mobile full-page, and desktop full-page screenshots.
- The dashboard verifier writes \`VERIFICATION_SUMMARY.md\` and fails if required files, text, manifest entries, reference targets, browser-QA freshness, PNG screenshot dimensions, or source/text fingerprints are missing or inconsistent.

## Manual Browser Verification

\`\`\`sh
python3 -m http.server 4177 --directory modeling/artifacts/reports/final-judge-dashboard
\`\`\`

Then open \`http://127.0.0.1:4177/\` and verify:

- The title is \`FIRST Match Modeling Judge Dashboard\`.
- The page contains Current Verdict, Quick Jump, Judge Story Spine, First 90 Seconds, Final Freeze Audit, Presentation Wording Audit, Cold Reader Route, Hostile Judge Cross-Exam, Final Coherence Audit, Final Presentation Lock, Reference Integrity Audit, Open This First, Judge Walkthrough, Deadline Deliverables Checklist, Claim Boundaries, Leakage Audit, Judge Rubric Alignment, Live Demo Runbook, Judge Dry-Run Scorecard, Mock Judge Panel Brief, Presentation Flow, Model Journey Timeline, Finalist Comparison, Model Anatomy, Model Source Map, Defense Role Guide, Model Leaderboard Appendix, Strategy Example, Prediction Case Studies, Failure Mode Atlas, Evidence Matrix, Risk Register, Audit Trail And Reproducibility, Source Code Evidence Lock, Integrity Fingerprints, Final Readiness Check, Final Model Card, Research Atlas, What Should Surprise Judges, and Final Package Map.
- The page contains Metric Glossary and explains Score MAE, Margin MAE, Brier, calibration, interval coverage, worst-event MAE, deployment score, relative benchmark, fixed benchmark, and near-ties.
- The page contains Deployment Scoring Rubric and shows fixed benchmark weights, deployment weights, and nonlinear overfit penalties.
- The page contains OPR vs EPA and explains why OPR-style baselines are not the same as online EPA-style pre-match replay.
- The page contains no visible \`undefined\` or \`NaN\`.
- The mobile viewport around 390 px has no page-level horizontal overflow outside intentionally scrollable tables.
- Screenshots are refreshed after any wording or layout change.

## Evidence Files To Open

- HTML dashboard: \`index.html\`
- Research log: \`modeling/MODELING_RESEARCH_LOG.md\`
- Open this first: \`OPEN_THIS_FIRST.md\`
- Judge walkthrough: \`JUDGE_WALKTHROUGH.md\`
- Judge story spine: \`JUDGE_STORY_SPINE.md\`
- First 90 seconds: \`FIRST_90_SECONDS.md\`
- Final freeze audit: \`FINAL_FREEZE_AUDIT.md\`
- Presentation wording audit: \`PRESENTATION_WORDING_AUDIT.md\`
- Cold reader route: \`COLD_READER_ROUTE.md\`
- Hostile judge cross-exam: \`HOSTILE_JUDGE_CROSS_EXAM.md\`
- Final coherence audit: \`FINAL_COHERENCE_AUDIT.md\`
- Final presentation lock: \`FINAL_PRESENTATION_LOCK.md\`
- Reference integrity audit: \`REFERENCE_INTEGRITY_AUDIT.md\`
- Deadline deliverables checklist: \`DEADLINE_DELIVERABLES_CHECKLIST.md\`
- Claim boundaries: \`CLAIM_BOUNDARIES.md\`
- Leakage audit: \`LEAKAGE_AUDIT.md\`
- Judge rubric alignment: \`JUDGE_RUBRIC_ALIGNMENT.md\`
- Live demo runbook: \`LIVE_DEMO_RUNBOOK.md\`
- Final model card: \`FINAL_MODEL_CARD.md\`
- Model journey timeline: \`MODEL_JOURNEY_TIMELINE.md\`
- Finalist comparison: \`FINALIST_COMPARISON.md\`
- Model anatomy: \`MODEL_ANATOMY.md\`
- Model source map: \`MODEL_SOURCE_MAP.md\`
- Defense role guide: \`DEFENSE_ROLE_GUIDE.md\`
- Model leaderboard appendix: \`MODEL_LEADERBOARD_APPENDIX.md\`
- Judge Q&A: \`JUDGE_QA.md\`
- Strategy example: \`STRATEGY_EXAMPLE.md\`
- Prediction case studies: \`PREDICTION_CASE_STUDIES.md\`
- Methodology appendix: \`METHODOLOGY_APPENDIX.md\`
- OPR vs EPA explainer: \`OPR_EPA_EXPLAINER.md\`
- Metric glossary: \`METRIC_GLOSSARY.md\`
- Deployment scoring rubric: \`DEPLOYMENT_SCORING_RUBRIC.md\`
- Presentation script: \`PRESENTATION_SCRIPT.md\`
- Verification summary: \`VERIFICATION_SUMMARY.md\`
- Artifact fingerprints: \`ARTIFACT_FINGERPRINTS.md\`
- Cross-run evidence: \`modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md\`
- Model source: \`modeling/src/modeling/train.ts\`
- CLI source: \`modeling/src/cli.ts\`

## What Not To Claim

- Do not claim this proves no better model exists.
- Do not claim scout/PPC enrichment broadly helped the final model; the current cache has 356 matched Firebase rows, mostly concentrated in 2026mnum.
- Do not claim Statbotics published match predictions were promoted; cached prediction rows lacked prediction-specific timestamps.
- Do not claim SelectiveTailGuard won; it improved a full replay but failed broad holdouts.

## Strongest Defensible Claim

The final model is the most defensible known local model from this research cycle because it balances walk-forward score accuracy, margin error, win-probability calibration, tail behavior, event-key holdout stability, and overfit penalties without using future information.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'EVIDENCE_MATRIX.md'),
    `# Evidence Matrix

This matrix maps the judge-facing claims to the artifacts that support them. It is designed to make the presentation auditable instead of rhetorical.

| Claim | Evidence | Caveat | Audit artifact |
| --- | --- | --- | --- |
| Current best model is ${shortModelName(bestResult.config.name)} | Conservative TailGuard TW=0.22 has the best stability-adjusted point deployment score in the completed micro-sensitivity report. | The lead is small and the holdout picture remains mixed. | \`FINAL_MODEL_CARD.md\`; \`modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md\` |
| The model avoids future leakage | Walk-forward tests verify feature rows are built before current-match state updates, and the leakage audit names each guardrail. | Any future external data source must pass the same timestamp/provenance check. | \`LEAKAGE_AUDIT.md\`; \`tests/**/*.test.mjs\`; \`METHODOLOGY_APPENDIX.md\` |
| Role and defense are modeled as net value | RoleV3 separates suppression, offense cost, foul exposure, confidence, and net swing features. | Scout/PPC enrichment has 356 matched Firebase rows, but coverage is sparse and concentrated, so official-match residual evidence still carries the broad branch. | \`modeling/src/modeling/train.ts\`; \`modeling/artifacts/audits/scout-coverage/SCOUT_COVERAGE.md\`; \`modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md\` |
| Defense role choices are explainable | The defense role guide documents the net-swing formula, opportunity cost, foul-risk penalty, and saved role examples. | It is a strategy clue, not proof of what a drive team will choose. | \`DEFENSE_ROLE_GUIDE.md\`; \`STRATEGY_EXAMPLE.md\`; \`index.html\` |
| Strategy output is concrete | The dashboard includes one saved walk-forward prediction with expected scores, win probability, role read, actual result, and error. | One example explains the workflow but does not represent every match. | \`STRATEGY_EXAMPLE.md\`; \`index.html\` |
| The model is not cherry-picked | Prediction case studies include a role-aware read, a close uncertainty case, an uncomfortable miss, and a large-error stress case. | Four examples still do not replace aggregate validation metrics. | \`PREDICTION_CASE_STUDIES.md\`; \`index.html\` |
| Finalist choice is explained | The finalist comparison shows the promoted model next to Strong RoleV3, stronger TailGuard, SelectiveTailGuard, Strong RoleV2, and Moderate RoleV3. | It explains current evidence, not proof no future model can beat them. | \`FINALIST_COMPARISON.md\`; \`index.html\` |
| Model architecture is explainable | The model anatomy section shows the known-before-match data flow from official history through online memory, role features, residual correction, TailGuard, and score distributions. | The visual is a conceptual map; implementation details still live in source code and tests. | \`MODEL_ANATOMY.md\`; \`modeling/src/modeling/train.ts\`; \`index.html\` |
| Model code is auditable | The source map ties claims to the exact local files for candidate definitions, walk-forward features, RoleV3 logic, diagnostics, deployment scoring, dashboard generation, and verification. | It is an audit route, not a replacement for source review. | \`MODEL_SOURCE_MAP.md\`; \`modeling/src/modeling/train.ts\`; \`modeling/src/modeling/features.ts\`; \`modeling/src/reporting/report.ts\` |
| Other model scores are visible | The model leaderboard appendix collects deployment-review rows from every saved cross-run report family. | Report families are not identical experiments, so this is an audit map rather than one universal leaderboard. | \`MODEL_LEADERBOARD_APPENDIX.md\`; \`index.html\` |
| Leaderboard metrics are explainable | The metric glossary defines accuracy, confidence, uncertainty, tail-risk, benchmark, and near-tie terms in plain English. | The glossary explains the scoring language; it does not make the metrics universal truth. | \`METRIC_GLOSSARY.md\`; \`index.html\` |
| The leaderboard penalizes overfit symptoms | The scoring rubric documents fixed weights, regret weights, nonlinear squared excess penalties, instability penalty, and near-tie thresholds. | This is a defensible project decision rule, not a mathematical proof of optimality. | \`DEPLOYMENT_SCORING_RUBRIC.md\`; \`modeling/src/modeling/train.ts\`; \`modeling/src/reporting/report.ts\`; \`index.html\` |
| The package can be fingerprinted | The dashboard and generated fingerprint files record SHA-256 hashes for source code and generated text evidence/report files. | Hashes prove file identity at generation time; browser QA and screenshots are checked separately and hashes do not prove the model is correct. | \`ARTIFACT_FINGERPRINTS.md\`; \`artifact-fingerprints.json\`; \`index.html\` |
| OPR and EPA are treated differently | The OPR/EPA explainer states that OPR is a retrospective linear contribution baseline while EPA-style memory updates after each match. | Public EPA snapshots still need timestamp proof before promotion. | \`OPR_EPA_EXPLAINER.md\`; \`METHODOLOGY_APPENDIX.md\`; \`index.html\` |
| The model story is traceable | The model journey timeline shows how baselines, Monte Carlo, event context, residual correction, RoleV3, TailGuard, and rejected gates led to the final stance. | A short timeline compresses details; the research log remains the long-form evidence. | \`MODEL_JOURNEY_TIMELINE.md\`; \`modeling/MODELING_RESEARCH_LOG.md\`; \`index.html\` |
| Overfit controls changed decisions | SelectiveTailGuard improved a full replay but failed broad holdouts, so it was rejected. | A better future gate may exist; this specific gate did not confirm. | \`modeling/MODELING_RESEARCH_LOG.md\`; \`modeling/artifacts/reports/role-v3-selective-tailguard-check/CROSS_RUN_SUMMARY.md\` |
| Statbotics predictions were not blindly promoted | The provenance audit found cached public prediction rows without prediction-specific timestamps. | Statbotics team context can still be useful if it is made timestamp-safe. | \`modeling/artifacts/audits/statbotics-prediction-provenance/AUDIT.md\` |
| Known limitations are explicit | The risk register names near-ties, early-event uncertainty, championship-tail errors, sparse scout rows, timestamp provenance, and strategy overuse. | A risk register does not solve the risks; it keeps decisions honest. | \`LIMITATIONS_AND_RISK_REGISTER.md\`; \`index.html\` |
| Hard questions are pre-answered | The judge Q&A and cross-exam sheet name the strongest objections: small gains, possible neural alternatives, leakage, defense noise, Statbotics provenance, scout/PPC gaps, and next-step data needs. | Prepared answers are still only as strong as the artifacts behind them. | \`HOSTILE_JUDGE_CROSS_EXAM.md\`; \`JUDGE_QA.md\`; \`index.html\` |
| Final claims stay coherent | The coherence audit pins the model name, headline metrics, no-future rule, scout/PPC limitation, defense boundary, model-selection rule, package integrity claim, and next-work claim to specific files. | It prevents drift; it does not add new validation data. | \`FINAL_COHERENCE_AUDIT.md\`; \`OPEN_THIS_FIRST.md\`; \`FINAL_MODEL_CARD.md\`; \`HOSTILE_JUDGE_CROSS_EXAM.md\` |
| The handoff package has a lock rule | The presentation lock states the safe-to-present model claim, artifact set, verification gate, screenshots, route, do-not-claim list, and local-only boundary. | It is a presentation control, not evidence that future models cannot improve. | \`FINAL_PRESENTATION_LOCK.md\`; \`QA_CHECKLIST.md\`; \`browser-qa-summary.json\`; \`ARTIFACT_FINGERPRINTS.md\` |
| The presenter has a rehearsal gate | The dry-run scorecard checks the opening claim, no-future rule, model-selection story, strategy example, hard questions, package integrity, and fallback route. | It tests communication readiness, not model accuracy. | \`JUDGE_DRY_RUN_SCORECARD.md\`; \`FIRST_90_SECONDS.md\`; \`HOSTILE_JUDGE_CROSS_EXAM.md\`; \`LIVE_DEMO_RUNBOOK.md\` |
| The presenter can adapt to judge style | The mock panel brief maps technical, strategy, skeptical, software, impact, and data-source questions to bounded answers and evidence files. | It is rehearsal guidance, not new model evidence. | \`MOCK_JUDGE_PANEL_BRIEF.md\`; \`JUDGE_QA.md\`; \`JUDGE_RUBRIC_ALIGNMENT.md\` |
| Local evidence references resolve | The reference integrity audit lists critical source, evidence, screenshot, manifest, fingerprint, and browser-QA targets and the verifier checks those targets exist. | It covers the important handoff references, not every prose mention. | \`REFERENCE_INTEGRITY_AUDIT.md\`; \`VERIFICATION_SUMMARY.md\`; \`deliverables.json\`; \`artifact-fingerprints.json\` |
| Browser evidence is fresh | \`browser-qa-summary.json\` and the saved screenshots must be newer than the generated dashboard, so a stale visual proof cannot quietly pass after a report edit. | File timestamps are a local packaging control; they do not measure model accuracy. | \`browser-qa-summary.json\`; \`dashboard-hero-screenshot.png\`; \`dashboard-mobile-hero-screenshot.png\`; \`dashboard-print-preview-screenshot.png\`; \`dashboard-source-evidence-screenshot.png\`; \`dashboard-final-gate-screenshot.png\`; \`dashboard-starred-coverage-screenshot.png\`; \`dashboard-story-spine-screenshot.png\`; \`dashboard-model-anatomy-screenshot.png\`; \`dashboard-accuracy-stats-screenshot.png\`; \`dashboard-model-scores-screenshot.png\`; \`dashboard-mobile-screenshot.png\`; \`dashboard-fullpage-screenshot.png\`; \`VERIFICATION_SUMMARY.md\` |
| The final package is generated, verified, and rerunnable | \`npm run model:final-check\` rebuilds the package, refreshes browser QA and screenshots, verifies required files/text/manifest/reference targets/freshness/dimensions/fingerprints, type-checks modeling code, and runs tests. | It proves the local handoff package is internally consistent; it does not prove the model is perfect. | \`package.json\`; \`REPRODUCIBILITY_RUNBOOK.md\`; \`FINAL_READINESS_CHECK.md\`; \`QA_CHECKLIST.md\`; \`VERIFICATION_SUMMARY.md\`; \`deliverables.json\` |

## Strongest Honest Summary

The project is strongest when presented as a disciplined model-selection process: many plausible ideas were tested, only confirmed gains survived, and known weaknesses are shown next to the model's strengths.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'LIMITATIONS_AND_RISK_REGISTER.md'),
    `# Limitations And Risk Register

This register is intentionally included in the final package. The model is more credible when its risks are visible and tied to mitigations.

| Risk | Why it matters | Current mitigation | Status |
| --- | --- | --- | --- |
| Near-tie model selection | Several candidates differ by small margins, so one metric can exaggerate confidence. | Use deployment scoring, holdouts, fixed/relative benchmarks, and explicit near-tie labels. | Managed, not eliminated. |
| Early-event uncertainty | Teams have little current-season evidence before enough matches are played. | Use uncertainty bands, online updates, and avoid overconfident early-match claims. | Known weakness. |
| Championship-tail errors | High-score and unusual event phases remain harder than ordinary qualification matches. | TailGuard trims risk conservatively without promoting unstable stronger gates. | Improved slightly; still hard. |
| Sparse scout/PPC rows | The model has 356 matched Firebase observations, mostly from 2026mnum, which is too concentrated to claim broad scout-driven improvement. | Use the scout-enriched replay as scoped evidence, not a universal promotion. | Available but not broadly promotable yet. |
| Timestamp provenance | Public predictions can leak future knowledge if we cannot prove when they were available. | Statbotics published predictions remain non-promotable without prediction-specific timestamps. | Controlled by exclusion. |
| Strategy overuse | A model can support decisions, but drive-team condition and live scouting can override it. | Present outputs as evidence for humans, not automatic match plans. | Presentation rule. |

## Best Way To Say This To Judges

We did not try to make the model look perfect. We tried to make it useful under honest constraints. The current best model is the most defensible balance we found, and this register shows the places where human strategy judgment still matters.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'FINAL_READINESS_CHECK.md'),
    `# Final Readiness Check

This is the go/no-go checklist for presenting the final modeling package.

## Model Claim

- Present ${shortModelName(bestResult.config.name)} as the current best defensible model.
- Do not claim it proves no better model exists.
- Use the headline metrics only with the validation context: walk-forward replay, event-key holdouts, near-tie labeling, and overfit penalties.

## Evidence Package

These files should be ready to open during judging:

- \`index.html\`
- \`JUDGE_WALKTHROUGH.md\`
- \`JUDGE_STORY_SPINE.md\`
- \`FIRST_90_SECONDS.md\`
- \`FINAL_FREEZE_AUDIT.md\`
- \`PRESENTATION_WORDING_AUDIT.md\`
- \`COLD_READER_ROUTE.md\`
- \`HOSTILE_JUDGE_CROSS_EXAM.md\`
- \`FINAL_COHERENCE_AUDIT.md\`
- \`FINAL_PRESENTATION_LOCK.md\`
- \`REFERENCE_INTEGRITY_AUDIT.md\`
- \`DEADLINE_DELIVERABLES_CHECKLIST.md\`
- \`CLAIM_BOUNDARIES.md\`
- \`LEAKAGE_AUDIT.md\`
- \`JUDGE_RUBRIC_ALIGNMENT.md\`
- \`JUDGE_DRY_RUN_SCORECARD.md\`
- \`MOCK_JUDGE_PANEL_BRIEF.md\`
- \`FINAL_MODEL_CARD.md\`
- \`MODEL_ANATOMY.md\`
- \`MODEL_SOURCE_MAP.md\`
- \`DEFENSE_ROLE_GUIDE.md\`
- \`MODEL_JOURNEY_TIMELINE.md\`
- \`FINALIST_COMPARISON.md\`
- \`MODEL_LEADERBOARD_APPENDIX.md\`
- \`JUDGE_QA.md\`
- \`OPR_EPA_EXPLAINER.md\`
- \`PREDICTION_CASE_STUDIES.md\`
- \`METRIC_GLOSSARY.md\`
- \`DEPLOYMENT_SCORING_RUBRIC.md\`
- \`EVIDENCE_MATRIX.md\`
- \`STRATEGY_EXAMPLE.md\`
- \`LIMITATIONS_AND_RISK_REGISTER.md\`
- \`REPRODUCIBILITY_RUNBOOK.md\`
- \`VERIFICATION_SUMMARY.md\`
- \`ARTIFACT_FINGERPRINTS.md\`
- \`modeling/MODELING_RESEARCH_LOG.md\`

## Verification Gate

Run before presenting:

\`\`\`sh
npm run model:final-check
\`\`\`

Equivalent step-by-step commands:

\`\`\`sh
npm run model:typecheck
npm run test
npm run model:dashboard
npm run model:qa-dashboard
npm run model:verify-dashboard
\`\`\`

Then verify:

- Desktop dashboard contains all required sections.
- Mobile dashboard has no page-level horizontal overflow.
- No visible \`undefined\` or \`NaN\`.
- Screenshots are refreshed after the latest HTML change.
- Local server is stopped after QA.

## Presentation Boundary

- Scout/PPC enrichment has 356 matched Firebase observations, but coverage is sparse and concentrated.
- Statbotics public predictions are not promoted because timestamp provenance is insufficient.
- SelectiveTailGuard is rejected, not promoted.
- The model supports human strategy decisions; it does not replace scouting judgment.

## Go/No-Go

Go when the verification gate passes and the presenter can explain both the strongest claim and the known weaknesses without overclaiming.

Use \`JUDGE_DRY_RUN_SCORECARD.md\` for one rehearsal before presenting, then use \`MOCK_JUDGE_PANEL_BRIEF.md\` to pressure-test different judge personalities. If any row fails, tighten the wording or evidence route before calling the package ready.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'PRINTABLE_HANDOUT.md'),
    `# FIRST Match Modeling One-Page Handout

Delivery target: Saturday May 23 2026 18:00 CST. Open \`ONE_PAGE_JUDGE_STORY.html\` first for the fastest adventure, then open \`index.html#start-here-story\` for the proof dashboard and visual backup. Use this handout as the fastest printable summary.

## Current Best Model

${shortModelName(bestResult.config.name)}

Full model name: ${bestResult.config.name}

## Fastest Handoff

- Open \`ONE_PAGE_JUDGE_STORY.html\` first: it gives the judge the adventure without the proof wall.
- Then open \`START_HERE_STORY.html\` or \`index.html#start-here-story\` for the richer story and dashboard proof.
- Use \`index.html\` for evidence, screenshots, source fingerprints, and final gate proof.

## What It Does

- Predicts red and blue alliance scores before a match.
- Produces uncertainty bands and win probabilities.
- Gives role/defense clues, especially whether defense may be worth more than extra offense.
- Stays local and is not shipped inside the scouting website.

## Why This Model Won

- It uses walk-forward replay, so the model only sees information available before the match being predicted.
- It combines online EPA-style memory, Monte Carlo uncertainty, event context, RoleV3 defense features, no-future residual correction, and conservative TailGuard.
- It beat or survived the strongest alternatives after event-key holdout checks.
- More aggressive or smarter-looking variants were rejected when holdouts did not confirm them.
- ScoutGate and RoleGate were useful audit/research branches, but neither confirmed a replacement for the promoted model.

## Safe Claim Boundaries

- Before-match only: every prediction is built as if the match has not happened yet.
- Strategy support, not replacement for scouts: it informs discussion, but people still decide.
- Avoid exact-score certainty: 36.32 score MAE means the model is useful, not magical.
- Avoid live-app deployment claims: this is local modeling research, not shipped scouting-site code.

## Headline Metrics

- Weighted score MAE: ${formatNumber(bestDeployment.weightedScoreMae)}
- Weighted margin MAE: ${formatNumber(bestDeployment.weightedMarginMae)}
- Weighted Brier score: ${formatNumber(bestDeployment.weightedBrier, 4)}
- Point deployment score: ${formatNumber(bestDeployment.pointDeploymentScore, 3)}
- Max worst-event score MAE: ${formatNumber(bestDeployment.maxWorstEventScoreMae)}

## Strongest Judge Talking Point

The model is not impressive because it is complicated. It is impressive because it is disciplined: no future leakage, no fake scout data, no pretending near-ties are blowouts, and no promotion of ideas that fail holdout confirmation.

## Biggest Honest Weakness

The gains are real but small. Early-event and championship-tail matches remain hard, and real scout/PPC enrichment is still sparse: 356 matched Firebase observations, mostly concentrated in 2026mnum.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'PRESENTATION_SCRIPT.md'),
    `# Presentation Script

Delivery target: Saturday May 23 2026 18:00 CST. This script is the spoken companion to \`ONE_PAGE_JUDGE_STORY.html\`, \`START_HERE_STORY.html\`, \`index.html#start-here-story\`, \`OPEN_THIS_FIRST.md\`, and \`FIRST_90_SECONDS.md\`.

## Open First

Start with \`ONE_PAGE_JUDGE_STORY.html\` so the judge gets the answer and adventure before the proof wall. Move to \`START_HERE_STORY.html\` for the richer route or \`index.html#start-here-story\` when they ask for the checked dashboard route.

## 30-Second Version

We built an offline FIRST match model that replays history one match at a time. Before each match, it only uses information that would have existed before that match. Our best current model is ${shortModelName(
      bestResult.config.name
    )}: an online EPA-style model with Monte Carlo uncertainty, RoleV3 defense features, residual correction, and conservative TailGuard. The important part is not that it is flashy; it is that we rejected models that looked good but failed holdout checks.

## 90-Second Version

FRC match prediction is hard because there is no perfect answer. We are not just predicting who wins; we care about expected red and blue scores, uncertainty, win probability, and whether a team may be more valuable playing defense than scoring.

The pipeline is local and not deployed in the scouting website. It pulls official match history, event context, and any real scout data we actually have. Then it replays matches chronologically. For match N, the model only sees what would have been known before match N.

We tried OPR-style baselines, EPA-style online memory, Monte Carlo simulation, event metadata, residual correction, role-aware defense features, probability calibration, and tail-risk corrections. The current best model is conservative because it survived walk-forward replay and event-key holdouts better than more aggressive variants. SelectiveTailGuard sounded smarter, but failed confirmation, so we rejected it. ScoutGate and RoleGate improved the audit story around sparse scout data, but did not confirm a better final point model.

The honest bottom line: this is a strong decision-support model, not an oracle. Its strength is disciplined validation: no future leakage, no fake scout data, no overclaiming near-ties.

## 3-Minute Version

The goal was to build a serious offline modeling system for FRC match strategy. We did not put it inside the website, because this is research code and should not make the scouting app heavier or risk deploying unfinished model artifacts.

The first rule is no future leakage. Every match is treated as a historical pre-match prediction. We build the feature row, predict the score distribution, then update team state only after that match is over. That means residual correction, role features, and tail correction can only learn from prior evidence.

We compared many model families. OPR-like models are useful because they explain alliance scores as linear team contributions, but they are naturally retrospective. EPA-style models are better for this task because they update memory after each match. We then added Monte Carlo simulation for uncertainty, event metadata for context, residual-ridge correction for systematic prior errors, and RoleV3 defense features that separate suppression value, offense cost, foul risk, and confidence.

The winning family is ${shortModelName(bestResult.config.name)}. It has weighted score MAE ${formatNumber(
      bestDeployment.weightedScoreMae
    )}, weighted margin MAE ${formatNumber(bestDeployment.weightedMarginMae)}, weighted Brier ${formatNumber(
      bestDeployment.weightedBrier,
      4
    )}, and deployment score ${formatNumber(bestDeployment.pointDeploymentScore, 3)} in the latest deployment review.

We also documented what failed. Stronger tail corrections helped hard buckets but were less stable. Probability-only overlays helped some diagnostics but did not become the point model. SelectiveTailGuard improved a full replay, then failed the broad holdouts. ScoutGate helped dense scout-heavy checks but stayed fragmented, and RoleGate improved audit discipline without becoming the promoted model. Statbotics published predictions were not promoted because our cache could not prove prediction-specific timestamps. Scout/PPC enrichment is not faked; now that 356 Firebase rows match official slots, the model says they are real but too sparse and concentrated to promote a scout-driven global model.

The final answer is intentionally modest. It is the most defensible model we have found so far, not proof that no better model exists. That honesty is the core of the project.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'METHODOLOGY_APPENDIX.md'),
    `# Methodology Appendix

## Data Provenance

- TBA and FIRST Events are used as official score and schedule sources.
- Event metadata is cached locally and used only as known-before-match context.
- Statbotics team/event context can help describe team strength, but cached public match predictions are not promotable unless prediction-specific timestamps prove they existed before the predicted match.
- Firebase and local backup scout data are allowed only when they are actually present and matched to official match/team rows.
- Current scout/PPC enrichment has 356 matched Firebase observations, mostly concentrated in 2026mnum, so the final model does not pretend those labels cover unscouted events.

## Why OPR And EPA Are Different

OPR-style models solve a linear system from completed match scores. They are useful baselines, but they assume alliance scores can be decomposed into stable team contributions and are naturally retrospective.

EPA-style models carry memory. A team state is updated after each match, so the model can replay an event in chronological order and ask: before this match, what did we know? That is why the promoted family is closer to online EPA plus residual correction than to pure OPR.

## Prediction Design

- Predict alliance scores first.
- Derive margin and win probability from the score distribution.
- Use Monte Carlo simulation for uncertainty, not for hiding poor point estimates.
- Add role-aware features only when they can be computed from prior evidence.
- Treat defense as net expected swing: opponent suppression minus lost offense and foul risk.

## Benchmark Design

The leaderboard is intentionally not just MAE. The deployment score includes:

- score MAE and RMSE,
- margin MAE,
- win-probability Brier score,
- calibration error,
- interval coverage error,
- worst-event score MAE,
- event and season instability,
- interval width,
- fixed benchmark quality,
- leakage/eligibility penalties,
- overfit and instability penalties.

The point is to avoid rewarding a model that wins one metric while becoming fragile, overfit, or badly calibrated.

## Validation Design

- Walk-forward replay is the core validation rule.
- Event-key holdout buckets test whether full-replay winners generalize.
- Full replay winners that fail holdout confirmation are rejected or downgraded.
- Near-tie results are labeled as near-ties.
- Generated dashboards and model cards are built from saved run artifacts, not hand-entered scoreboard notes.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(path.join(outputDir, 'METRIC_GLOSSARY.md'), buildMetricGlossaryMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'DEPLOYMENT_SCORING_RUBRIC.md'), buildDeploymentRubricMarkdown(generatedAt));
  writeTextFile(path.join(outputDir, 'OPR_EPA_EXPLAINER.md'), buildOprEpaExplainerMarkdown(generatedAt));
  writeTextFile(
    path.join(outputDir, 'FINAL_MODEL_CARD.md'),
    `# Final Model Card

## Current Best Model

${bestResult.config.name}

Short name: ${shortModelName(bestResult.config.name)}

Status: ${bestDeployment.role}

## What It Predicts

- Expected red and blue scores.
- Red and blue score uncertainty bands.
- Red and blue win probabilities.
- Role/defense clues based on expected suppression, lost offense, foul risk, and prior reliability.

## Why This Model

The model family survived walk-forward replay and event-key holdout checks better than the rejected alternatives. The final choice is intentionally conservative: it optimizes not only average score error, but also margin error, Brier score, calibration, interval coverage, worst-event behavior, fixed benchmark quality, and instability penalties.

## Current Metrics

- Weighted score MAE: ${formatNumber(bestDeployment.weightedScoreMae)}
- Weighted margin MAE: ${formatNumber(bestDeployment.weightedMarginMae)}
- Weighted Brier score: ${formatNumber(bestDeployment.weightedBrier, 4)}
- Max worst-event score MAE: ${formatNumber(bestDeployment.maxWorstEventScoreMae)}
- Point deployment score: ${formatNumber(bestDeployment.pointDeploymentScore, 3)}
- Robustness score: ${formatNumber(bestDeployment.robustnessScore, 3)}

## Leakage Controls

- Training and evaluation use walk-forward replay.
- Feature rows are emitted before the current match updates team state.
- Residual corrections learn only from prior prediction errors.
- Public Statbotics predictions remain non-promotable because cached rows lack prediction-specific timestamps.
- Holdout buckets are deterministic event-key buckets, not random alliance rows from the same events.

## Overfit Controls

- VIF and correlation diagnostics are generated for ridge-style models.
- Deployment scoring magnifies instability and overfit symptoms.
- Full-replay winners are rejected when they fail holdout confirmation.
- Near-tie results are labeled as near-ties instead of overclaimed as decisive wins.

## Known Weaknesses

- The gains are real but small.
- Early-event and championship-tail matches remain hard.
- Scout/PPC enrichment has 356 matched Firebase observations, but coverage remains sparse and concentrated.
- The model should support human strategy decisions, not replace scouting judgment.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'QA_CHECKLIST.md'),
    `# Dashboard QA Checklist

Run these checks before presenting the final package.

## Commands

\`\`\`sh
npm run model:final-check
\`\`\`

Step-by-step equivalent:

\`\`\`sh
npm run model:typecheck
npm run test
npm run model:dashboard
npm run model:qa-dashboard
npm run model:verify-dashboard
\`\`\`

## Browser Checks

- \`npm run model:qa-dashboard\` starts \`http://127.0.0.1:4177/\` internally, checks the page title, required body/header text, stale forbidden wording, desktop/mobile overflow, console errors, page errors, and screenshot paths.
- It refreshes screenshots after any dashboard wording or layout change.
- For a live human demo after QA, run \`python3 -m http.server 4177 --directory modeling/artifacts/reports/final-judge-dashboard\` and open \`http://127.0.0.1:4177/\`.

## Expected Screenshot Outputs

- \`dashboard-hero-screenshot.png\`
- \`one-page-judge-story-screenshot.png\`
- \`start-here-story-screenshot.png\`
- \`dashboard-mobile-hero-screenshot.png\`
- \`dashboard-print-preview-screenshot.png\`
- \`dashboard-source-evidence-screenshot.png\`
- \`dashboard-final-gate-screenshot.png\`
- \`dashboard-starred-coverage-screenshot.png\`
- \`dashboard-story-spine-screenshot.png\`
- \`dashboard-model-anatomy-screenshot.png\`
- \`dashboard-accuracy-stats-screenshot.png\`
- \`dashboard-model-scores-screenshot.png\`
- \`dashboard-mobile-screenshot.png\`
- \`dashboard-fullpage-screenshot.png\`

The dashboard verifier checks that these screenshots are valid PNG files, meet minimum hero/one-page/story/print/source-evidence/final-gate/starred-coverage/story-spine/model-anatomy/accuracy-stats/model-scores/mobile/full-page dimensions, and are fresh relative to the generated dashboard, so a stale zero-byte, stale, or thumbnail screenshot cannot quietly pass.

## Current Model To Announce

${shortModelName(bestResult.config.name)}

## Current Story And Metric Safeguards

- The fast story route must include the Judge Decision Trail so a busy judge sees the baseline, no-future replay, RoleV3, and TailGuard pivots as a because/revealed/next-move chain.
- The research log must open with the Current Metric Note so older 41.48/57.05/0.1634/0.130 checkpoints stay audit history, not the current 36.32/49.73/0.1648/0.126 promoted claim.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'JUDGE_BRIEF.md'),
    `# Judge Brief

Delivery target: Saturday May 23 2026 18:00 CST. Use this brief when a judge or teacher wants the model story without opening the full dashboard. First open \`ONE_PAGE_JUDGE_STORY.html\`, then use \`START_HERE_STORY.html\` or \`index.html#start-here-story\` only when they ask for proof.

## One-Minute Story

We built a local offline model that replays FIRST history one match at a time. Before each match, it only uses information that would have existed before that match. We tried OPR-style baselines, EPA-style online models, Monte Carlo score distributions, event metadata, residual correction, role-aware defense modeling, probability calibration, and tail-risk ideas.

The best current answer is ${shortModelName(bestResult.config.name)}. It is not a giant black-box neural network; simpler won because the holdouts punished fragile ideas. The model predicts scores, uncertainty, win probability, and role clues. We chose it because it gave the best stability-adjusted point deployment score while keeping overfit risk controlled.

## What We Tried And Rejected

- SelectiveTailGuard sounded better than the conservative gate, but failed broad confirmation.
- Probability-only TailRisk overlays improved some diagnostics but did not become the point model.
- Stronger tail corrections helped hard buckets but lost stability on easier slices.
- ScoutGate was promising on dense scout-heavy checks, but its holdout review stayed fragmented.
- RoleGate closed a stricter scout-gated role-feature audit path, but did not confirm a better final model.
- Published Statbotics predictions were kept as context only, because the cache could not prove prediction timestamps.
- Scout/PPC enrichment is not faked. If we did not scout an event, the model does not pretend we did.

## Strong Answer To "How Do You Know It Is Not Overfit?"

We do not claim proof. Instead, we used walk-forward replay, event-key holdouts, fixed and relative benchmarks, VIF checks, correlation checks, calibration checks, interval coverage checks, and a deployment score that punishes instability. When a good-looking model failed holdouts, we rejected it.

## Fast Q&A

- Why not neural network? Because the interpretable online EPA/residual family beat the more complicated ideas after leakage and holdout checks.
- How is defense modeled? As net point swing: suppression value minus lost offense and foul risk.
- What is the biggest weakness? Early-event and championship-tail matches are still uncertain, and scout/PPC enrichment has only 356 matched Firebase rows, mostly concentrated in 2026mnum.
- What is the biggest strength? The model is honest about uncertainty and rejects good-looking ideas that do not hold up.

## Current Honest Bottom Line

This is a strong, defensible research model for FRC strategy analysis, but not an oracle. Its value is not just the final score number; it is the disciplined process: no future leakage, no fake scout data, and no overclaiming near-tie wins.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'JUDGE_QA.md'),
    `# Judge Q&A

These are the questions I would prepare for if a judge pushes past the polished story.

## Why not a neural network?

Neural networks were allowed, but the best defended result came from an interpretable online EPA/residual family. With this data regime, leakage control, walk-forward replay, event-key holdouts, and stability mattered more than model glamour. A neural model would need to beat this candidate under the same rules before it deserved promotion.

## What if the improvement is too small to matter?

That is a fair concern, and the package says so. The claim is not that the promoted model is unbeatable. The claim is that Conservative TailGuard Strong RoleV3 is the best defensible point candidate found so far because it balances score error, margin error, Brier score, calibration, worst-event behavior, holdout stability, and overfit penalties.

## How do you prevent future leakage?

Every match is predicted before the current match updates team state. Residual correction and TailGuard can only learn from prior prediction errors. Public predictions are not promoted unless timestamp provenance proves they existed before the match being predicted.

## How do you know defense is not just noise?

We do not treat defense as a magic label. RoleV3 separates expected opponent suppression, lost offensive contribution, foul exposure, confidence, and net swing. The model is also honest about sparse scout/PPC rows: it uses the 356 matched Firebase observations only where they apply, and still leans on official-match residual role evidence for broad-history claims.

## Why not promote ScoutGate or RoleGate?

Because recency is not the promotion rule. ScoutGate proved the pipeline can shrink sparse scout data safely and improve dense scout-heavy checks, while RoleGate tightened a subtle scout-gated role-feature audit path. Both were useful, but neither produced holdout-confirmed evidence strong enough to replace Conservative TailGuard Strong RoleV3.

## Why exclude Statbotics published predictions?

Because useful data can still be unsafe for validation. Cached public prediction rows lacked prediction-specific timestamps, so they remain non-promotable. Statbotics context can still inform analysis when it is timestamp-safe, but the final model does not rely on future-looking snapshots.

## Why should judges trust the dashboard?

The dashboard is generated from saved artifacts, not hand-entered notes. The verifier checks required files, dashboard text, manifest keys, reference targets, browser-QA freshness, screenshot dimensions, and source/text SHA-256 fingerprints. That proves package consistency, not model perfection, and the distinction is important.

## What would improve the model most next?

Broader timestamped scout/PPC observations and timestamp-safe external snapshots would probably help more than another tiny TailGuard variant. ScoutGate proved the pipeline can shrink sparse scout data safely and improve scout-heavy ridge on dense 2026mnum, but its full-bucket stability review is fragmented. The current model is already near the limit of what the available official-history plus sparse-scout signal can defend.

## What is the single most honest sentence?

This is the most defensible local model we found, not an oracle: it is useful because it predicts with known-before-match evidence, rejects fragile ideas, and keeps human scouting judgment in the loop.

${buildGeneratedStamp(generatedAt)}
`
  );
  writeTextFile(
    path.join(outputDir, 'deliverables.json'),
    `${JSON.stringify(
      {
        generatedAt,
        deadlineTarget: 'Saturday May 23 2026 18:00 CST',
        currentDisplayedModelShortName: shortModelName(bestResult.config.name),
        currentDisplayedModel: bestResult.config.name,
        headlineMetrics: {
          weightedScoreMae: formatNumber(bestDeployment.weightedScoreMae),
          weightedMarginMae: formatNumber(bestDeployment.weightedMarginMae),
          weightedBrier: formatNumber(bestDeployment.weightedBrier, 4),
          deploymentScore: formatNumber(bestDeployment.pointDeploymentScore, 3)
        },
        dashboard: path.join(outputDir, 'index.html'),
        readme: path.join(outputDir, 'README.md'),
        deliverablesMap: path.join(outputDir, 'DELIVERABLES.md'),
        deliverablesManifest: path.join(outputDir, 'deliverables.json'),
        finalCheckCommand: path.resolve('package.json'),
        finalCheckRunner: path.resolve('scripts/model-final-check.mjs'),
        finalCheckSummary: path.join(outputDir, 'final-check-summary.json'),
        finalCheckHumanSummary: path.join(outputDir, 'FINAL_CHECK_SUMMARY.md'),
        onePageJudgeStoryHtml: path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.html'),
        onePageJudgeStory: path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.md'),
        startHereStoryHtml: path.join(outputDir, 'START_HERE_STORY.html'),
        startHereStory: path.join(outputDir, 'START_HERE_STORY.md'),
        bestModelCode: path.resolve('modeling/src/modeling/train.ts'),
        trainingCli: path.resolve('modeling/src/cli.ts'),
        browserQaCommand: path.resolve('modeling/src/reporting/browserQaDashboard.ts'),
        researchLog: path.resolve('modeling/MODELING_RESEARCH_LOG.md'),
        latestCrossRunSummary: path.resolve('modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md'),
        firebaseScoutEnrichmentSummary: path.resolve(
          'modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md'
        ),
        scoutGateSummary: path.resolve('modeling/artifacts/reports/scoutgate-check/CROSS_RUN_SUMMARY.md'),
        roleGateSummary: path.resolve('modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md'),
        openThisFirst: path.join(outputDir, 'OPEN_THIS_FIRST.md'),
        judgeWalkthrough: path.join(outputDir, 'JUDGE_WALKTHROUGH.md'),
        judgeStorySpine: path.join(outputDir, 'JUDGE_STORY_SPINE.md'),
        first90Seconds: path.join(outputDir, 'FIRST_90_SECONDS.md'),
        finalFreezeAudit: path.join(outputDir, 'FINAL_FREEZE_AUDIT.md'),
        presentationWordingAudit: path.join(outputDir, 'PRESENTATION_WORDING_AUDIT.md'),
        coldReaderRoute: path.join(outputDir, 'COLD_READER_ROUTE.md'),
        hostileJudgeCrossExam: path.join(outputDir, 'HOSTILE_JUDGE_CROSS_EXAM.md'),
        finalCoherenceAudit: path.join(outputDir, 'FINAL_COHERENCE_AUDIT.md'),
        finalPresentationLock: path.join(outputDir, 'FINAL_PRESENTATION_LOCK.md'),
        referenceIntegrityAudit: path.join(outputDir, 'REFERENCE_INTEGRITY_AUDIT.md'),
        deadlineDeliverablesChecklist: path.join(outputDir, 'DEADLINE_DELIVERABLES_CHECKLIST.md'),
        claimBoundaries: path.join(outputDir, 'CLAIM_BOUNDARIES.md'),
        leakageAudit: path.join(outputDir, 'LEAKAGE_AUDIT.md'),
        judgeRubricAlignment: path.join(outputDir, 'JUDGE_RUBRIC_ALIGNMENT.md'),
        printableHandout: path.join(outputDir, 'PRINTABLE_HANDOUT.md'),
        presentationScript: path.join(outputDir, 'PRESENTATION_SCRIPT.md'),
        liveDemoRunbook: path.join(outputDir, 'LIVE_DEMO_RUNBOOK.md'),
        judgeDryRunScorecard: path.join(outputDir, 'JUDGE_DRY_RUN_SCORECARD.md'),
        mockJudgePanelBrief: path.join(outputDir, 'MOCK_JUDGE_PANEL_BRIEF.md'),
        modelJourneyTimeline: path.join(outputDir, 'MODEL_JOURNEY_TIMELINE.md'),
        finalistComparison: path.join(outputDir, 'FINALIST_COMPARISON.md'),
        modelAnatomy: path.join(outputDir, 'MODEL_ANATOMY.md'),
        modelSourceMap: path.join(outputDir, 'MODEL_SOURCE_MAP.md'),
        defenseRoleGuide: path.join(outputDir, 'DEFENSE_ROLE_GUIDE.md'),
        modelLeaderboardAppendix: path.join(outputDir, 'MODEL_LEADERBOARD_APPENDIX.md'),
        strategyExample: path.join(outputDir, 'STRATEGY_EXAMPLE.md'),
        predictionCaseStudies: path.join(outputDir, 'PREDICTION_CASE_STUDIES.md'),
        failureModeAtlas: path.join(outputDir, 'FAILURE_MODE_ATLAS.md'),
        finalModelCard: path.join(outputDir, 'FINAL_MODEL_CARD.md'),
        judgeBrief: path.join(outputDir, 'JUDGE_BRIEF.md'),
        judgeQa: path.join(outputDir, 'JUDGE_QA.md'),
        methodologyAppendix: path.join(outputDir, 'METHODOLOGY_APPENDIX.md'),
        oprEpaExplainer: path.join(outputDir, 'OPR_EPA_EXPLAINER.md'),
        metricGlossary: path.join(outputDir, 'METRIC_GLOSSARY.md'),
        deploymentScoringRubric: path.join(outputDir, 'DEPLOYMENT_SCORING_RUBRIC.md'),
        evidenceMatrix: path.join(outputDir, 'EVIDENCE_MATRIX.md'),
        limitationsAndRiskRegister: path.join(outputDir, 'LIMITATIONS_AND_RISK_REGISTER.md'),
        reproducibilityRunbook: path.join(outputDir, 'REPRODUCIBILITY_RUNBOOK.md'),
        finalReadinessCheck: path.join(outputDir, 'FINAL_READINESS_CHECK.md'),
        qaChecklist: path.join(outputDir, 'QA_CHECKLIST.md'),
        verificationSummary: path.join(outputDir, 'VERIFICATION_SUMMARY.md'),
        artifactFingerprints: path.join(outputDir, 'ARTIFACT_FINGERPRINTS.md'),
        artifactFingerprintsJson: path.join(outputDir, 'artifact-fingerprints.json'),
        browserQaSummary: path.join(outputDir, 'browser-qa-summary.json'),
        screenshots: {
          hero: path.join(outputDir, 'dashboard-hero-screenshot.png'),
          onePageJudgeStory: path.join(outputDir, 'one-page-judge-story-screenshot.png'),
          startHereStory: path.join(outputDir, 'start-here-story-screenshot.png'),
          mobileHero: path.join(outputDir, 'dashboard-mobile-hero-screenshot.png'),
          printPreview: path.join(outputDir, 'dashboard-print-preview-screenshot.png'),
          sourceEvidence: path.join(outputDir, 'dashboard-source-evidence-screenshot.png'),
          finalGate: path.join(outputDir, 'dashboard-final-gate-screenshot.png'),
          starredCoverage: path.join(outputDir, 'dashboard-starred-coverage-screenshot.png'),
          storySpine: path.join(outputDir, 'dashboard-story-spine-screenshot.png'),
          modelAnatomy: path.join(outputDir, 'dashboard-model-anatomy-screenshot.png'),
          accuracyStats: path.join(outputDir, 'dashboard-accuracy-stats-screenshot.png'),
          modelScores: path.join(outputDir, 'dashboard-model-scores-screenshot.png'),
          mobile: path.join(outputDir, 'dashboard-mobile-screenshot.png'),
          fullPage: path.join(outputDir, 'dashboard-fullpage-screenshot.png')
        }
      },
      null,
      2
    )}\n`
  );
  const packageFingerprints = buildArtifactFingerprints([
    ...criticalFingerprints.map(fingerprint => ({ label: fingerprint.label, filePath: path.resolve(fingerprint.path) })),
    { label: 'HTML dashboard', filePath: path.join(outputDir, 'index.html') },
    { label: 'Dashboard README', filePath: path.join(outputDir, 'README.md') },
    { label: 'Open this first', filePath: path.join(outputDir, 'OPEN_THIS_FIRST.md') },
    { label: 'Deliverables map', filePath: path.join(outputDir, 'DELIVERABLES.md') },
    { label: 'Deliverables JSON', filePath: path.join(outputDir, 'deliverables.json') },
    { label: 'One-page judge story HTML', filePath: path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.html') },
    { label: 'One-page judge story Markdown', filePath: path.join(outputDir, 'ONE_PAGE_JUDGE_STORY.md') },
    { label: 'Start here story HTML', filePath: path.join(outputDir, 'START_HERE_STORY.html') },
    { label: 'Start here story Markdown', filePath: path.join(outputDir, 'START_HERE_STORY.md') },
    { label: 'Judge walkthrough', filePath: path.join(outputDir, 'JUDGE_WALKTHROUGH.md') },
    { label: 'Judge story spine', filePath: path.join(outputDir, 'JUDGE_STORY_SPINE.md') },
    { label: 'First 90 seconds', filePath: path.join(outputDir, 'FIRST_90_SECONDS.md') },
    { label: 'Final freeze audit', filePath: path.join(outputDir, 'FINAL_FREEZE_AUDIT.md') },
    { label: 'Presentation wording audit', filePath: path.join(outputDir, 'PRESENTATION_WORDING_AUDIT.md') },
    { label: 'Cold reader route', filePath: path.join(outputDir, 'COLD_READER_ROUTE.md') },
    { label: 'Hostile judge cross-exam', filePath: path.join(outputDir, 'HOSTILE_JUDGE_CROSS_EXAM.md') },
    { label: 'Final coherence audit', filePath: path.join(outputDir, 'FINAL_COHERENCE_AUDIT.md') },
    { label: 'Final presentation lock', filePath: path.join(outputDir, 'FINAL_PRESENTATION_LOCK.md') },
    { label: 'Reference integrity audit', filePath: path.join(outputDir, 'REFERENCE_INTEGRITY_AUDIT.md') },
    { label: 'Deadline deliverables checklist', filePath: path.join(outputDir, 'DEADLINE_DELIVERABLES_CHECKLIST.md') },
    { label: 'Claim boundaries', filePath: path.join(outputDir, 'CLAIM_BOUNDARIES.md') },
    { label: 'Leakage audit', filePath: path.join(outputDir, 'LEAKAGE_AUDIT.md') },
    { label: 'Judge rubric alignment', filePath: path.join(outputDir, 'JUDGE_RUBRIC_ALIGNMENT.md') },
    { label: 'Printable handout', filePath: path.join(outputDir, 'PRINTABLE_HANDOUT.md') },
    { label: 'Presentation script', filePath: path.join(outputDir, 'PRESENTATION_SCRIPT.md') },
    { label: 'Live demo runbook', filePath: path.join(outputDir, 'LIVE_DEMO_RUNBOOK.md') },
    { label: 'Judge dry-run scorecard', filePath: path.join(outputDir, 'JUDGE_DRY_RUN_SCORECARD.md') },
    { label: 'Mock judge panel brief', filePath: path.join(outputDir, 'MOCK_JUDGE_PANEL_BRIEF.md') },
    { label: 'Finalist comparison', filePath: path.join(outputDir, 'FINALIST_COMPARISON.md') },
    { label: 'Model anatomy', filePath: path.join(outputDir, 'MODEL_ANATOMY.md') },
    { label: 'Model source map', filePath: path.join(outputDir, 'MODEL_SOURCE_MAP.md') },
    { label: 'Defense role guide', filePath: path.join(outputDir, 'DEFENSE_ROLE_GUIDE.md') },
    { label: 'Model journey timeline', filePath: path.join(outputDir, 'MODEL_JOURNEY_TIMELINE.md') },
    { label: 'Model leaderboard appendix', filePath: path.join(outputDir, 'MODEL_LEADERBOARD_APPENDIX.md') },
    { label: 'Strategy example', filePath: path.join(outputDir, 'STRATEGY_EXAMPLE.md') },
    { label: 'Prediction case studies', filePath: path.join(outputDir, 'PREDICTION_CASE_STUDIES.md') },
    { label: 'Failure mode atlas', filePath: path.join(outputDir, 'FAILURE_MODE_ATLAS.md') },
    { label: 'Final model card', filePath: path.join(outputDir, 'FINAL_MODEL_CARD.md') },
    { label: 'Judge brief', filePath: path.join(outputDir, 'JUDGE_BRIEF.md') },
    { label: 'Judge Q&A', filePath: path.join(outputDir, 'JUDGE_QA.md') },
    { label: 'Methodology appendix', filePath: path.join(outputDir, 'METHODOLOGY_APPENDIX.md') },
    { label: 'OPR vs EPA explainer', filePath: path.join(outputDir, 'OPR_EPA_EXPLAINER.md') },
    { label: 'Metric glossary', filePath: path.join(outputDir, 'METRIC_GLOSSARY.md') },
    { label: 'Deployment scoring rubric', filePath: path.join(outputDir, 'DEPLOYMENT_SCORING_RUBRIC.md') },
    { label: 'Evidence matrix', filePath: path.join(outputDir, 'EVIDENCE_MATRIX.md') },
    { label: 'Limitations and risk register', filePath: path.join(outputDir, 'LIMITATIONS_AND_RISK_REGISTER.md') },
    { label: 'Reproducibility runbook', filePath: path.join(outputDir, 'REPRODUCIBILITY_RUNBOOK.md') },
    { label: 'Final readiness check', filePath: path.join(outputDir, 'FINAL_READINESS_CHECK.md') },
    { label: 'QA checklist', filePath: path.join(outputDir, 'QA_CHECKLIST.md') }
  ]);
  writeTextFile(path.join(outputDir, 'ARTIFACT_FINGERPRINTS.md'), buildArtifactFingerprintsMarkdown(packageFingerprints, generatedAt));
  writeTextFile(
    path.join(outputDir, 'artifact-fingerprints.json'),
    `${JSON.stringify({ generatedAt, artifacts: packageFingerprints }, null, 2)}\n`
  );
  return outputDir;
};
