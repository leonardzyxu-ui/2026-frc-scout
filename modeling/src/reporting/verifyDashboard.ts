import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeTextFile } from '../util.ts';

interface FingerprintEntry {
  label: string;
  path: string;
  bytes: number;
  sha256: string;
}

interface FingerprintManifest {
  generatedAt: string;
  artifacts: FingerprintEntry[];
}

interface VerifyIssue {
  severity: 'error' | 'warning';
  message: string;
}

interface ScreenshotRequirement {
  fileName: string;
  minWidth: number;
  minHeight: number;
}

interface BrowserQaViewportCheck {
  page?: {
    url?: unknown;
    viewport?: {
      width?: unknown;
      height?: unknown;
    };
  };
  title?: string;
  missingText?: unknown;
  missingHeaderText?: unknown;
  hasForbiddenText?: unknown;
  pageOverflow?: unknown;
  outsideTableOffenders?: unknown;
  width?: unknown;
  scrollWidth?: unknown;
  scrollHeight?: unknown;
}

interface BrowserQaSummary {
  checkedAt?: string;
  requiredBodyText?: unknown;
  desktopCheck?: BrowserQaViewportCheck;
  mobileCheck?: BrowserQaViewportCheck;
  consoleIssues?: unknown;
  pageErrors?: unknown;
  screenshots?: unknown;
}

interface FinalCheckSummary {
  generatedAt?: string;
  generatedAtLocal?: string;
  deadlineProof?: {
    target?: unknown;
    deadlineLocal?: unknown;
    generatedBeforeDeadline?: unknown;
  };
  status?: string;
  steps?: unknown;
  postChecks?: {
    status?: unknown;
    port4177Closed?: unknown;
    deliverablesCoverage?: {
      files?: unknown;
      manifestPaths?: unknown;
      missingFromDeliverables?: unknown;
      missingOnDisk?: unknown;
    };
    handoffClaimDigest?: {
      status?: unknown;
      deadlineTarget?: unknown;
      currentDisplayedModelShortName?: unknown;
      currentDisplayedModel?: unknown;
      headlineMetrics?: unknown;
    };
    entryPointFinalCheckText?: unknown;
    testSuiteHealth?: {
      status?: unknown;
      command?: unknown;
      exitCode?: unknown;
      durationMs?: unknown;
      tests?: unknown;
      pass?: unknown;
      fail?: unknown;
      cancelled?: unknown;
      skipped?: unknown;
      todo?: unknown;
    };
    navigationAnchors?: {
      status?: unknown;
      requiredTargets?: unknown;
      targets?: unknown;
      missingTargets?: unknown;
      missingTargetIds?: unknown;
    };
    sourceCodeEvidence?: {
      status?: unknown;
      requiredPaths?: unknown;
      entries?: unknown;
      missingFiles?: unknown;
      mismatchedFingerprints?: unknown;
    };
    browserQaHealth?: {
      status?: unknown;
      requiredBodyText?: unknown;
      consoleIssues?: unknown;
      pageErrors?: unknown;
      desktop?: Record<string, unknown>;
      mobile?: Record<string, unknown>;
    };
    screenshotDimensions?: {
      status?: unknown;
      screenshots?: Record<string, unknown>;
    };
  };
  finalVerifier?: {
    command?: unknown;
    runsAfterSummaryWrite?: unknown;
    status?: unknown;
    exitCode?: unknown;
    durationMs?: unknown;
    verifiedFinalSummaryWithSecondRun?: unknown;
  };
}

interface PngDimensions {
  width: number;
  height: number;
}

export interface DashboardVerificationResult {
  outputDir: string;
  checkedFiles: number;
  checkedStrings: number;
  checkedMarkdownFiles: number;
  checkedManifestPaths: number;
  checkedReferencePaths: number;
  checkedAnchorTargets: number;
  checkedAnchorTargetNames: string[];
  checkedBrowserQaSummaries: number;
  checkedFreshnessRules: number;
  checkedFingerprints: number;
  checkedScreenshots: number;
  checkedScreenshotDimensions: number;
  issues: VerifyIssue[];
  summaryPath: string;
}

const DEFAULT_OUTPUT_DIR = 'modeling/artifacts/reports/final-judge-dashboard';
const MINIMUM_FINAL_CHECK_TESTS = 38;

const requiredFiles = [
  'index.html',
  'ONE_PAGE_JUDGE_STORY.html',
  'ONE_PAGE_JUDGE_STORY.md',
  'START_HERE_STORY.html',
  'START_HERE_STORY.md',
  'README.md',
  'OPEN_THIS_FIRST.md',
  'DELIVERABLES.md',
  'JUDGE_WALKTHROUGH.md',
  'JUDGE_STORY_SPINE.md',
  'FIRST_90_SECONDS.md',
  'FINAL_FREEZE_AUDIT.md',
  'PRESENTATION_WORDING_AUDIT.md',
  'COLD_READER_ROUTE.md',
  'HOSTILE_JUDGE_CROSS_EXAM.md',
  'FINAL_COHERENCE_AUDIT.md',
  'FINAL_PRESENTATION_LOCK.md',
  'REFERENCE_INTEGRITY_AUDIT.md',
  'DEADLINE_DELIVERABLES_CHECKLIST.md',
  'CLAIM_BOUNDARIES.md',
  'LEAKAGE_AUDIT.md',
  'JUDGE_RUBRIC_ALIGNMENT.md',
  'PRINTABLE_HANDOUT.md',
  'PRESENTATION_SCRIPT.md',
  'LIVE_DEMO_RUNBOOK.md',
  'JUDGE_DRY_RUN_SCORECARD.md',
  'MOCK_JUDGE_PANEL_BRIEF.md',
  'FINALIST_COMPARISON.md',
  'MODEL_ANATOMY.md',
  'MODEL_SOURCE_MAP.md',
  'DEFENSE_ROLE_GUIDE.md',
  'MODEL_JOURNEY_TIMELINE.md',
  'MODEL_LEADERBOARD_APPENDIX.md',
  'STRATEGY_EXAMPLE.md',
  'PREDICTION_CASE_STUDIES.md',
  'FAILURE_MODE_ATLAS.md',
  'FINAL_MODEL_CARD.md',
  'JUDGE_BRIEF.md',
  'JUDGE_QA.md',
  'METHODOLOGY_APPENDIX.md',
  'OPR_EPA_EXPLAINER.md',
  'METRIC_GLOSSARY.md',
  'DEPLOYMENT_SCORING_RUBRIC.md',
  'EVIDENCE_MATRIX.md',
  'LIMITATIONS_AND_RISK_REGISTER.md',
  'REPRODUCIBILITY_RUNBOOK.md',
  'FINAL_READINESS_CHECK.md',
  'QA_CHECKLIST.md',
  'ARTIFACT_FINGERPRINTS.md',
  'deliverables.json',
  'artifact-fingerprints.json',
  'browser-qa-summary.json',
  'final-check-summary.json',
  'FINAL_CHECK_SUMMARY.md'
];

const requiredHtmlStrings = [
  'FIRST Match Modeling Judge Dashboard',
  'Current Verdict',
  'Conservative TailGuard Strong RoleV3',
  'First-screen handoff',
  'not an unbeatable claim',
  'Open This First',
  'Latest Quality Receipt',
  'three-takeaway memory aid',
  'TailGuard TW=0.22 survived TW=0.21/TW=0.23 pressure',
  'leaderboard labels point at the current claim',
  'Story and metric safeguards locked',
  'because/revealed/next-move chain',
  'If Interrupted',
  'Show me proof.',
  'What did you actually find?',
  'Why should strategy care?',
  'What is the caveat?',
  'Emergency 60-Second Fallback',
  'Do not debug live; switch to static files.',
  'Start Here',
  'Start With The Story',
  'One-Page Story',
  'Standalone Story',
  'The model adventure in one quick walk',
  'If you only read one screen',
  'Starting point',
  'Rejected temptation',
  'Fast Reading Route',
  'Read One Match Loop',
  'where the evidence lives',
  'Stop after Proof Receipt if time is brutal',
  'TailGuard Micro-Sensitivity Sweep',
  'TW=0.22 ranked first',
  'Holdouts were mixed but useful',
  'Thirty-second answer',
  'Busy Judge Card',
  'Model in one sentence',
  'Honest caveat',
  'Judge Decision Trail',
  'Baseline because',
  'Next move: no-future replay',
  'RoleV3 because',
  'TailGuard because',
  'promote Conservative TailGuard Strong RoleV3',
  'Adventure Map',
  'No-future replay',
  'Final model',
  'Plain-English Decoder',
  'Replay old matches as if we were standing before each match',
  'MAE',
  'Average absolute miss',
  'Margin MAE',
  'Holdout',
  'A validation slice away from the easiest full replay',
  '70% of the time',
  'Calibration',
  'Residual correction',
  'TW=0.22',
  'win probabilities are honest',
  'One Match Loop',
  'The model only sees history',
  'future matches only',
  'Trust Ladder',
  'Blocks hindsight',
  'Tail-risk review',
  'Final Selection Filter',
  'Accuracy first',
  'Stability over sparkle',
  'Proof Receipt',
  'No-future claim',
  'Model-choice claim',
  'FINAL_CHECK_SUMMARY.md',
  'What A Drive Team Gets',
  'Expected score',
  'Human boundary',
  'When To Trust It',
  'Scary-Term Decoder',
  'Use this when a judge understands the story but wants the math words translated quickly.',
  'Probability honesty',
  'Confidence honesty',
  'The TailGuard strength knob',
  'Trust more',
  'Ask humans',
  'What Surprised Us',
  'The winner was not the flashiest model',
  'A documented no made the final yes stronger',
  'The 90-Second Walkthrough',
  'Generated (CST / Asia-Shanghai)',
  'Three Things To Remember',
  'Strategy, not prophecy',
  'What The Numbers Mean',
  'Score MAE 36.32',
  'Brier 0.1648',
  'overfit penalties',
  'If A Judge Pushes Back',
  'Is this cheating with future data?',
  'Why not use something smarter?',
  'Safe Wording Before You Present',
  'Current best defended local model',
  'Use 36.32 as the current promoted weighted score MAE',
  'older 41.x rows are labeled historical leaderboard evidence',
  'Strategy support, not replacement for scouts',
  'The Adventure In Six Turns',
  'One-Minute Judge Script',
  'Handoff Snapshot',
  'Deadline target',
  'Headline accuracy',
  'Judge Story Spine',
  'First 90 Seconds',
  'Final Freeze Audit',
  'Presentation Wording Audit',
  'Cold Reader Route',
  'Hostile Judge Cross-Exam',
  'Final Coherence Audit',
  'Final Presentation Lock',
  'Reference Integrity Audit',
  'Deadline Deliverables Checklist',
  'Claim Boundaries',
  'Leakage Audit',
  'Quick Jump',
  'Final Gate Proof',
  'Screenshot Proof',
  'Screenshot Proof Index',
  'Every screenshot has a job',
  'Fourteen proof files',
  'Freshness guard',
  'Dimension guard',
  'Docs Proof',
  'Documentation Proof Index',
  'Markdown is part of the package',
  'Generated, not improvised',
  'Copy-quality guard',
  'Live Demo',
  'Claim Safety',
  'Leakage Guard',
  'Rubric Fit',
  'If the package changed this late, why should judges trust it?',
  'The late changes were audited, not hidden',
  'Dry Run',
  'Story Spine',
  'Finalists',
  'Model Visual',
  'Source Map',
  'Accuracy Stats',
  'Strategy Use',
  'Failure Modes',
  'Evidence Map',
  'Ready Check',
  'Model Scores',
  'Judge Surprises',
  'Starred Coverage',
  'Code Evidence',
  'Starred HTML Coverage',
  'Every starred prompt item is represented inside this HTML dashboard',
  'Best model visualization in HTML',
  'Other models and scores visualized',
  'Refined journey story in HTML',
  'Accuracy and stats visualization',
  'Document-style HTML report',
  'Judge notes and surprises',
  '@media print',
  'print-color-adjust',
  '@page { margin: 14mm; }',
  'Judge Rubric Alignment',
  'Live Demo Runbook',
  'Judge Dry-Run Scorecard',
  'Mock Judge Panel Brief',
  'Finalist Comparison',
  'Model Anatomy',
  'Model Source Map',
  'buildWalkForwardDataset',
  'buildDeploymentReview',
  'verifyJudgeDashboardArtifacts',
  'Defense Role Guide',
  'What the promoted model does before a match',
  'Model Leaderboard Appendix',
  'Report-local role note',
  'older point-default rows are audit history',
  'Strategy Example',
  'Prediction Case Studies',
  'Failure Mode Atlas',
  'OPR vs EPA',
  'What Should Surprise Judges',
  'Deployment Scoring Rubric',
  'Hard Questions Judges May Ask',
  'Evidence Matrix',
  'Risk Register',
  'Final Readiness Check',
  'Audit Trail And Reproducibility',
  'Final Gate Proof Route',
  'testSuiteHealth',
  'Final summary verified by second run: yes',
  'Source Code Evidence Lock',
  'sourceCodeEvidence',
  'Integrity Fingerprints',
  'Final Package Map',
  'npm run model:qa-dashboard',
  'npm run model:final-check',
  'Package README',
  'One-page judge story HTML',
  'One-page judge story Markdown',
  'Deliverables manifest',
  'Final check summary',
  'Human-readable final check summary',
  'FINAL_CHECK_SUMMARY.md',
  'Browser QA summary',
  'Fingerprint manifest',
  'source and generated text evidence package',
  'browser QA, screenshots, and the verifier summary are checked separately'
];

const requiredStartHereStoryHtmlStrings = [
  'Delivery target: Saturday May 23 2026 18:00 CST',
  'Generated (CST / Asia-Shanghai)',
  'Fast Reading Route',
  'Read One Match Loop',
  'where the evidence lives',
  'Thirty-second answer',
  'Busy Judge Card',
  'Model in one sentence',
  'Honest caveat',
  'Adventure Map',
  'No-future replay',
  'Final model',
  'Plain-English Decoder',
  'Replay old matches as if we were standing before each match',
  'win probabilities are honest',
  'One Match Loop',
  'The model only sees history',
  'future matches only',
  'Trust Ladder',
  'Blocks hindsight',
  'Tail-risk review',
  'Final Selection Filter',
  'Accuracy first',
  'Stability over sparkle',
  'Proof Receipt',
  'No-future claim',
  'Model-choice claim',
  'FINAL_CHECK_SUMMARY.md',
  'What A Drive Team Gets',
  'Expected score',
  'Human boundary',
  'When To Trust It',
  'Trust more',
  'last-minute mechanical changes',
  'What surprised us',
  'The winner was not the flashiest model',
  'A documented no made the final yes stronger',
  'Three things to remember',
  'Before-match only',
  'Strategy, not prophecy',
  'Rejected cleverness',
  'What the numbers mean',
  'Score MAE 36.32',
  'Margin MAE 49.73',
  'Brier 0.1648',
  'Deployment score 0.126',
  'lower-is-better selection score',
  'If a judge pushes back',
  'Is this cheating with future data?',
  'Why not use something smarter?',
  'Is this accurate enough?',
  'pre-match strategy support',
  'Safe wording before you present',
  'Current best defended local model',
  'No-future replay, not hindsight',
  'Strategy support, not replacement for scouts',
  'Exact-score certainty',
  'Next proof steps',
  'href="index.html#start-here-story"',
  'href="FINALIST_COMPARISON.md"',
  'href="LEAKAGE_AUDIT.md"',
  'href="FINAL_CHECK_SUMMARY.md"',
  'Open the proof vault',
  'Why this model won',
  'No-future audit',
  'Final check proof'
];

const requiredManifestKeys = [
  'deadlineTarget',
  'currentDisplayedModelShortName',
  'currentDisplayedModel',
  'headlineMetrics',
  'dashboard',
  'readme',
  'deliverablesMap',
  'deliverablesManifest',
  'finalCheckCommand',
  'finalCheckRunner',
  'finalCheckSummary',
  'finalCheckHumanSummary',
  'onePageJudgeStoryHtml',
  'onePageJudgeStory',
  'startHereStoryHtml',
  'startHereStory',
  'bestModelCode',
  'trainingCli',
  'browserQaCommand',
  'researchLog',
  'latestCrossRunSummary',
  'firebaseScoutEnrichmentSummary',
  'scoutGateSummary',
  'roleGateSummary',
  'openThisFirst',
  'judgeWalkthrough',
  'judgeStorySpine',
  'first90Seconds',
  'finalFreezeAudit',
  'presentationWordingAudit',
  'coldReaderRoute',
  'hostileJudgeCrossExam',
  'finalCoherenceAudit',
  'finalPresentationLock',
  'referenceIntegrityAudit',
  'deadlineDeliverablesChecklist',
  'claimBoundaries',
  'leakageAudit',
  'judgeRubricAlignment',
  'printableHandout',
  'presentationScript',
  'liveDemoRunbook',
  'judgeDryRunScorecard',
  'mockJudgePanelBrief',
  'modelJourneyTimeline',
  'finalistComparison',
  'modelAnatomy',
  'modelSourceMap',
  'defenseRoleGuide',
  'modelLeaderboardAppendix',
  'strategyExample',
  'predictionCaseStudies',
  'failureModeAtlas',
  'finalModelCard',
  'judgeBrief',
  'judgeQa',
  'methodologyAppendix',
  'oprEpaExplainer',
  'metricGlossary',
  'deploymentScoringRubric',
  'evidenceMatrix',
  'limitationsAndRiskRegister',
  'reproducibilityRunbook',
  'finalReadinessCheck',
  'qaChecklist',
  'verificationSummary',
  'artifactFingerprints',
  'artifactFingerprintsJson',
  'browserQaSummary',
  'finalCheckSummary',
  'finalCheckHumanSummary',
  'screenshots'
];

const requiredManifestPathKeys = [
  'dashboard',
  'readme',
  'deliverablesMap',
  'deliverablesManifest',
  'finalCheckCommand',
  'finalCheckRunner',
  'finalCheckSummary',
  'finalCheckHumanSummary',
  'onePageJudgeStoryHtml',
  'onePageJudgeStory',
  'startHereStoryHtml',
  'startHereStory',
  'bestModelCode',
  'trainingCli',
  'browserQaCommand',
  'researchLog',
  'latestCrossRunSummary',
  'firebaseScoutEnrichmentSummary',
  'scoutGateSummary',
  'roleGateSummary',
  'openThisFirst',
  'judgeWalkthrough',
  'judgeStorySpine',
  'first90Seconds',
  'finalFreezeAudit',
  'presentationWordingAudit',
  'coldReaderRoute',
  'hostileJudgeCrossExam',
  'finalCoherenceAudit',
  'finalPresentationLock',
  'referenceIntegrityAudit',
  'deadlineDeliverablesChecklist',
  'claimBoundaries',
  'leakageAudit',
  'judgeRubricAlignment',
  'printableHandout',
  'presentationScript',
  'liveDemoRunbook',
  'judgeDryRunScorecard',
  'mockJudgePanelBrief',
  'modelJourneyTimeline',
  'finalistComparison',
  'modelAnatomy',
  'modelSourceMap',
  'defenseRoleGuide',
  'modelLeaderboardAppendix',
  'strategyExample',
  'predictionCaseStudies',
  'failureModeAtlas',
  'finalModelCard',
  'judgeBrief',
  'judgeQa',
  'methodologyAppendix',
  'oprEpaExplainer',
  'metricGlossary',
  'deploymentScoringRubric',
  'evidenceMatrix',
  'limitationsAndRiskRegister',
  'reproducibilityRunbook',
  'finalReadinessCheck',
  'qaChecklist',
  'artifactFingerprints',
  'artifactFingerprintsJson',
  'browserQaSummary',
  'finalCheckSummary',
  'finalCheckHumanSummary'
];

const requiredManifestScreenshotKeys = [
  'hero',
  'onePageJudgeStory',
  'startHereStory',
  'mobileHero',
  'printPreview',
  'sourceEvidence',
  'finalGate',
  'starredCoverage',
  'storySpine',
  'modelAnatomy',
  'accuracyStats',
  'modelScores',
  'mobile',
  'fullPage'
];

const requiredDeadlineTarget = 'Saturday May 23 2026 18:00 CST';
const requiredDeadlineLocal = '2026-05-23 18:00:00 CST (Asia/Shanghai, UTC+08:00)';
const requiredDeadlineMs = Date.parse('2026-05-23T18:00:00+08:00');

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

const requiredShortModelName = 'Conservative TailGuard Strong RoleV3';
const requiredHeadlineMetrics: Record<string, string> = {
  weightedScoreMae: '36.32',
  weightedMarginMae: '49.73',
  weightedBrier: '0.1648',
  deploymentScore: '0.126'
};

const requiredOpenThisFirstStrings = [
  'Handoff Snapshot',
  `Deadline target: ${requiredDeadlineTarget}`,
  `Promoted model: ${requiredShortModelName}`,
  `Weighted score MAE: ${requiredHeadlineMetrics.weightedScoreMae}`,
  `Weighted margin MAE: ${requiredHeadlineMetrics.weightedMarginMae}`,
  `Weighted Brier score: ${requiredHeadlineMetrics.weightedBrier}`,
  `Deployment score: ${requiredHeadlineMetrics.deploymentScore}`,
  'Claim boundary: best defended local model, not a perfect oracle.',
  'Latest Quality Receipt',
  'the one-page story now has a 30-second script',
  'If You Remember Nothing Else',
  'Judge Answer Finder',
  'Model Family Cheat Sheet',
  'answer finder maps the six fastest judge questions directly to proof files',
  'model-family cheat sheet translates dense leaderboard names',
  'Judge Decision Trail',
  'TailGuard micro-sensitivity pass kept TW=0.22',
  'historical leaderboard rows are labeled report-local',
  'research log now opens with a Current Metric Note',
  'older 41.48/57.05/0.1634/0.130 checkpoints stay audit history',
  'ONE_PAGE_JUDGE_STORY.html',
  'START_HERE_STORY.html',
  'index.html#start-here-story',
  '| You have 30 seconds | ONE_PAGE_JUDGE_STORY.html',
  'npm run model:final-check'
];

const requiredPrintableHandoutStrings = [
  'Open `ONE_PAGE_JUDGE_STORY.html` first',
  'then open `index.html#start-here-story` for the proof dashboard',
  'index.html#start-here-story',
  'Before-match only',
  'Strategy support, not replacement for scouts',
  'Avoid exact-score certainty',
  'Avoid live-app deployment claims'
];

const requiredQaChecklistStrings = [
  'Current Story And Metric Safeguards',
  'Judge Decision Trail',
  'because/revealed/next-move chain',
  'older 41.48/57.05/0.1634/0.130 checkpoints stay audit history',
  'current 36.32/49.73/0.1648/0.126 promoted claim'
];

const requiredStoryFirstRouteStrings: Record<string, string[]> = {
  'README.md': [
    'Open `ONE_PAGE_JUDGE_STORY.html` first if time is brutal',
    'Open `START_HERE_STORY.html` for the richer quick story',
    'open `index.html#start-here-story` locally',
    'First file to open if you are unsure: `ONE_PAGE_JUDGE_STORY.html`'
  ],
  'ONE_PAGE_JUDGE_STORY.md': [
    'One-Page Judge Story',
    'Use this when the reader has almost no time',
    'The Adventure In One Page',
    'Model In One Sentence',
    'Weighted score MAE: 36.32',
    'Weighted margin MAE: 49.73',
    'Weighted Brier: 0.1648',
    'Deployment score: 0.126',
    'Plain-English Number Key',
    'typical alliance-score miss',
    'stability-adjusted selection score',
    'Stop rule: if the judge has only one minute',
    '30-Second Script',
    'We built a no-future pre-match model',
    'Three Takeaways',
    'Reason it won: it stayed strongest after no-future replay',
    'Safe use: treat it as a pre-match score, win-chance, uncertainty, and role-risk briefing',
    'Judge Decision Trail',
    'Next move: no-future replay',
    'Next move: promote Conservative TailGuard Strong RoleV3',
    'No-future replay blocks hindsight',
    'Why The Extra Time Mattered',
    'TW=0.21/TW=0.23 sanity checks tried to dislodge TW=0.22 and failed',
    'failure-mode atlas was refreshed from the current TW=0.22 diagnostics',
    'older defaults cannot impersonate the final claim',
    'What To Say Out Loud',
    'Proof Route',
    'FINAL_CHECK_SUMMARY.md'
  ],
  'START_HERE_STORY.md': [
    'Delivery target: Saturday May 23 2026 18:00 CST',
    'If You Only Read One Screen',
    'Starting point: simple team-strength memory',
    'Rejected temptation: SelectiveTailGuard',
    'If You Remember Nothing Else',
    'Can match history and scouting context give a drive team a useful pre-match warning?',
    'Yes, cautiously',
    'Every serious candidate was replayed as if standing before each match',
    'disciplined starting point for strategy',
    'Fast Reading Route',
    'Read One Match Loop',
    'where the evidence lives',
    'Stop after Proof Receipt if time is brutal',
    'What To Ignore Under Time Pressure',
    'Older 41.x score-MAE rows are audit history',
    'Report-local point-default labels are historical report roles',
    'SelectiveTailGuard is rejected',
    'ScoutGate and RoleGate are useful audit branches',
    'Do not start with the full leaderboard unless a judge asks',
    'Busy Judge Card',
    'Model in one sentence',
    'Honest caveat',
    'So What For Strategy?',
    'The model turns a pile of match history into a pre-match briefing',
    'Before a match',
    'During strategy talk',
    'For scouting focus',
    'After a miss',
    'Human final call',
    'Judge Answer Finder',
    'where exactly to look for one claim',
    'What won?',
    'Why trust the validation?',
    'Why this model over alternatives?',
    'How does this help strategy?',
    'What should we not claim?',
    'Is the package verified?',
    'FINAL_MODEL_CARD.md',
    'VERIFICATION_SUMMARY.md',
    'browser-qa-summary.json',
    'Model Family Cheat Sheet',
    'translate the model names before opening the full leaderboard',
    'Residual correction',
    'Learns from past misses only after those matches happen',
    'Core part of the promoted model',
    'Promoted with TW=0.22',
    'Rejected because broad confirmation failed',
    'Useful evidence, not the final point model',
    'Judge Decision Trail',
    'Next move: no-future replay',
    'Next move: promote Conservative TailGuard Strong RoleV3',
    'Adventure Map',
    'No-future replay',
    'Final model',
    'Plain-English Decoder',
    'MAE: average absolute miss',
    'Margin MAE: the same miss idea',
    'Holdout: a validation slice',
    '70% of the time',
    'Calibration: the same honesty idea',
    'Residual correction: learning from past prediction misses',
    'TW=0.22: the TailGuard strength knob',
    'win probabilities are honest',
    'One Match Loop',
    'The model only sees history',
    'future matches only',
    'Trust Ladder',
    'No-future replay blocks hindsight',
    'Tail-risk review checks the uncomfortable matches',
    'Final Selection Filter',
    'Accuracy first',
    'Stability over sparkle',
    'Proof Receipt',
    'No-future claim',
    'FINAL_CHECK_SUMMARY.md',
    'What A Drive Team Gets',
    'Expected score',
    'Human boundary',
    'When To Trust It',
    'Trust more',
    'last-minute mechanical changes',
    'What Surprised Us',
    'The winner was not the flashiest model',
    'A documented no made the final yes stronger',
    'TailGuard Micro-Sensitivity Sweep',
    'TW=0.18, TW=0.21, TW=0.22, TW=0.23, and TW=0.25',
    'TW=0.21/TW=0.23',
    'TW=0.22 ranked first',
    'Holdouts were mixed but useful',
    'The 90-Second Walkthrough'
  ],
  'FAILURE_MODE_ATLAS.md': [
    'current TW=0.22 TailGuard residual diagnostics',
    'Displayed run: `current-2024-2026-role-v3-tailguard-micro-sensitivity`',
    'Model: Conservative TailGuard Strong RoleV3',
    'Worst-event score MAE: 103.84',
    'TailGuard is useful because it acknowledges those tails'
  ],
  'MODEL_LEADERBOARD_APPENDIX.md': [
    'Report-local role note',
    'point default candidate',
    'historical report family only',
    'older point-default rows are audit history',
    'role-v3-tailguard-micro-sensitivity-check'
  ],
  'FIRST_90_SECONDS.md': [
    'open `ONE_PAGE_JUDGE_STORY.html` first',
    'then open `index.html#start-here-story` for proof',
    'Four-File Opening Card',
    'Never hunt through the folder live.',
    'FINAL_CHECK_SUMMARY.md',
    'FINAL_MODEL_CARD.md',
    'CLAIM_BOUNDARIES.md',
    'Timed Script',
    'ONE_PAGE_JUDGE_STORY.html metric cards',
    'If Interrupted',
    'Show me proof.',
    'What did you actually find?',
    'Why should strategy care?',
    'What is the caveat?',
    'Open LEAKAGE_AUDIT.md and FINAL_CHECK_SUMMARY.md',
    'Open CLAIM_BOUNDARIES.md',
    'Final 20-Second Close',
    'We are not selling an oracle',
    'both why it won and what it cannot claim',
    'humans stay in charge'
  ],
  'COLD_READER_ROUTE.md': [
    'Start with `ONE_PAGE_JUDGE_STORY.html`',
    'move to `START_HERE_STORY.html` or `index.html#start-here-story`',
    'Open ONE_PAGE_JUDGE_STORY.html and read the one-page adventure',
    'Do not start in the proof dashboard yet'
  ],
  'LIVE_DEMO_RUNBOOK.md': [
    'open `http://127.0.0.1:4177/ONE_PAGE_JUDGE_STORY.html` first',
    'then open `http://127.0.0.1:4177/index.html#start-here-story`',
    'Run the local server and open ONE_PAGE_JUDGE_STORY.html',
    'START_HERE_STORY.md',
    'Emergency 60-Second Fallback',
    'Do not debug live; switch to static files.',
    'one-page-judge-story-screenshot.png; start-here-story-screenshot.png',
    'FINAL_CHECK_SUMMARY.md; dashboard-final-gate-screenshot.png',
    'humans still own the final scouting and drive-team decision'
  ],
  'PRESENTATION_SCRIPT.md': [
    'spoken companion to `ONE_PAGE_JUDGE_STORY.html`',
    'Start with `ONE_PAGE_JUDGE_STORY.html`',
    'Move to `START_HERE_STORY.html`'
  ],
  'JUDGE_BRIEF.md': [
    'First open `ONE_PAGE_JUDGE_STORY.html`',
    'then use `START_HERE_STORY.html` or `index.html#start-here-story` only when they ask for proof'
  ],
  'FINAL_PRESENTATION_LOCK.md': [
    'Start at ONE_PAGE_JUDGE_STORY.html',
    'move to START_HERE_STORY.html or index.html#start-here-story for dashboard proof',
    'ONE_PAGE_JUDGE_STORY.html; START_HERE_STORY.html; OPEN_THIS_FIRST.md',
    'Story and metric safeguards locked',
    'The Judge Decision Trail must stay in the fast story route',
    'older 41.48/57.05/0.1634/0.130 checkpoints labeled as audit history',
    'current 36.32/49.73/0.1648/0.126 claim'
  ],
  'JUDGE_WALKTHROUGH.md': [
    'Start with `ONE_PAGE_JUDGE_STORY.html` if time is brutal',
    'Use `START_HERE_STORY.html` for the richer story',
    'then move to `index.html#start-here-story`',
    'printable summary if the judge asks for proof'
  ],
  'DEADLINE_DELIVERABLES_CHECKLIST.md': [
    'Open `ONE_PAGE_JUDGE_STORY.html` for the one-page adventure',
    'Open `START_HERE_STORY.html` if the judge wants a richer walk-through',
    'Open `index.html#start-here-story` for the full visual dashboard route'
  ],
  'HOSTILE_JUDGE_CROSS_EXAM.md': [
    'Is a 36.32 score MAE actually useful?',
    'If the package changed this late, why should judges trust it?',
    'The late changes were audited, not hidden',
    'browser QA, typecheck, tests, and verifier passes',
    'The first finished version was perfect'
  ]
};

const requiredShortRouteDeadlineFiles = [
  'PRINTABLE_HANDOUT.md',
  'JUDGE_BRIEF.md',
  'PRESENTATION_SCRIPT.md',
  'FIRST_90_SECONDS.md'
];

const requiredArtifactFingerprintStrings = [
  'Scope boundary: browser QA, screenshots, and the generated verification summary are checked by freshness',
  'If the hashes changed, the text package changed; refresh browser QA and screenshots'
];

const requiredSourceDigestPaths = [
  'modeling/src/modeling/train.ts',
  'modeling/src/modeling/features.ts',
  'modeling/src/modeling/diagnostics.ts',
  'modeling/src/reporting/report.ts',
  'modeling/src/cli.ts',
  'modeling/MODELING_RESEARCH_LOG.md'
];

const requiredResearchLogStrings = [
  '## Deadline Correction Note',
  'Active deadline: Saturday May 23 2026 18:00 CST (Asia/Shanghai).',
  'Historical entries before May 22 2026 22:15 CST may mention the earlier Friday May 22 2026 18:00 CST target',
  'not current delivery instructions',
  '## Current Metric Note',
  'Current promoted headline metrics: weighted score MAE 36.32, weighted margin MAE 49.73, weighted Brier 0.1648, and deployment score 0.126.',
  'older TailGuard-family headline metrics such as 41.48 score MAE, 57.05 margin MAE, 0.1634 Brier, or 0.130 deployment score',
  'not the current promoted claim'
];

const FRESHNESS_TOLERANCE_MS = 2000;

const requiredReferenceTargets = [
  'package.json',
  'scripts/model-final-check.mjs',
  'modeling/src/modeling/train.ts',
  'modeling/src/modeling/features.ts',
  'modeling/src/reporting/judgeDashboard.ts',
  'modeling/src/reporting/browserQaDashboard.ts',
  'modeling/src/reporting/verifyDashboard.ts',
  'tests/modeling.test.mjs',
  'modeling/MODELING_RESEARCH_LOG.md',
  'modeling/artifacts/reports/role-v3-selective-tailguard-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/reports/role-v3-tailguard-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/reports/role-v3-tailguard-micro-sensitivity-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/runs/current-2026-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/current-2024-2026-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/holdout-2024-2026-bucket0-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/holdout-2024-2026-bucket1-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/holdout-2024-2026-bucket2-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/holdout-2024-2026-bucket3-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/artifacts/runs/holdout-2024-2026-bucket4-role-v3-tailguard-micro-sensitivity/MODEL_CARD.md',
  'modeling/experiments/current-2026-role-v3-tailguard-micro-sensitivity.json',
  'modeling/experiments/current-2024-2026-role-v3-tailguard-micro-sensitivity.json',
  'modeling/artifacts/reports/firebase-scout-enrichment-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/reports/scoutgate-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/reports/scoutgate-rolegate-check/CROSS_RUN_SUMMARY.md',
  'modeling/artifacts/reports/current-tailguard-residual-diagnostics/residual-diagnostics.json',
  'modeling/artifacts/audits/scout-coverage/SCOUT_COVERAGE.md',
  'modeling/artifacts/audits/statbotics-prediction-provenance/AUDIT.md',
  'modeling/artifacts/reports/final-judge-dashboard/index.html',
  'modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.html',
  'modeling/artifacts/reports/final-judge-dashboard/ONE_PAGE_JUDGE_STORY.md',
  'modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.html',
  'modeling/artifacts/reports/final-judge-dashboard/START_HERE_STORY.md',
  'modeling/artifacts/reports/final-judge-dashboard/FINAL_PRESENTATION_LOCK.md',
  'modeling/artifacts/reports/final-judge-dashboard/FINAL_COHERENCE_AUDIT.md',
  'modeling/artifacts/reports/final-judge-dashboard/FINAL_CHECK_SUMMARY.md',
  'modeling/artifacts/reports/final-judge-dashboard/browser-qa-summary.json',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-hero-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/one-page-judge-story-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/start-here-story-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-mobile-hero-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-print-preview-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-source-evidence-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-final-gate-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-starred-coverage-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-story-spine-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-model-anatomy-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-accuracy-stats-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-model-scores-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-mobile-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/dashboard-fullpage-screenshot.png',
  'modeling/artifacts/reports/final-judge-dashboard/deliverables.json',
  'modeling/artifacts/reports/final-judge-dashboard/artifact-fingerprints.json'
];

export const requiredBrowserQaText = [
  'Conservative TailGuard Strong RoleV3',
  '36.32',
  '49.73',
  '0.1648',
  '0.126',
  'Saturday May 23 2026 18:00 CST',
  'Start Here',
  'Start With The Story',
  'One-Page Story',
  'Standalone Story',
  'The model adventure in one quick walk',
  'If you only read one screen',
  'Starting point',
  'Rejected temptation',
  'If You Remember Nothing Else',
  'Can match history and scouting context give a drive team a useful pre-match warning?',
  'Yes, cautiously',
  'Every serious candidate was replayed as if standing before each match',
  'disciplined starting point for strategy',
  'Fast Reading Route',
  'Read One Match Loop',
  'where the evidence lives',
  'Stop after Proof Receipt if time is brutal',
  'What To Ignore Under Time Pressure',
  'Older metric rows',
  'Report-local labels',
  'Rejected clever branch',
  'Useful audit branches',
  'Leaderboard timing',
  'TailGuard Micro-Sensitivity Sweep',
  'TW=0.22 ranked first',
  'Holdouts were mixed but useful',
  'Thirty-second answer',
  'Busy Judge Card',
  'Model in one sentence',
  'Honest caveat',
  'So What For Strategy?',
  'The model turns a pile of match history into a pre-match briefing',
  'Before a match',
  'During strategy talk',
  'For scouting focus',
  'After a miss',
  'Human final call',
  'Judge Answer Finder',
  'where exactly to look for one claim',
  'What won?',
  'Why trust the validation?',
  'Why this model over alternatives?',
  'How does this help strategy?',
  'What should we not claim?',
  'Is the package verified?',
  'Model Family Cheat Sheet',
  'translate the model names before opening the full leaderboard',
  'Residual correction',
  'Learns from past misses only after those matches happen',
  'Core part of the promoted model',
  'Promoted with TW=0.22',
  'Useful evidence, not the final point model',
  'Judge Decision Trail',
  'Baseline because',
  'Next move: no-future replay',
  'RoleV3 because',
  'TailGuard because',
  'promote Conservative TailGuard Strong RoleV3',
  'Adventure Map',
  'No-future replay',
  'Final model',
  'Plain-English Decoder',
  'Replay old matches as if we were standing before each match',
  'win probabilities are honest',
  'One Match Loop',
  'The model only sees history',
  'future matches only',
  'Trust Ladder',
  'Blocks hindsight',
  'Tail-risk review',
  'Final Selection Filter',
  'Accuracy first',
  'Stability over sparkle',
  'Proof Receipt',
  'No-future claim',
  'Model-choice claim',
  'FINAL_CHECK_SUMMARY.md',
  'What A Drive Team Gets',
  'Expected score',
  'Human boundary',
  'When To Trust It',
  'Trust more',
  'Ask humans',
  'What Surprised Us',
  'The winner was not the flashiest model',
  'A documented no made the final yes stronger',
  'TailGuard Micro-Sensitivity Sweep',
  'TW=0.18, TW=0.21, TW=0.22, TW=0.23, and TW=0.25',
  'TW=0.21/TW=0.23',
  'TW=0.22 ranked first',
  'Holdouts were mixed but useful',
  'The 90-Second Walkthrough',
  'Generated (CST / Asia-Shanghai)',
  'The Adventure In Six Turns',
  'One-Minute Judge Script',
  'Four-File Opening Card',
  'Never hunt through the folder live.',
  'Open these files in this order',
  'Timed Script',
  'Handoff Snapshot',
  'Latest Quality Receipt',
  'the start-here route now has If You Remember Nothing Else, Judge Answer Finder, Model Family Cheat Sheet, and Judge Decision Trail',
  'the answer finder maps the six fastest judge questions directly to proof files',
  'Judge Decision Trail',
  'research-log Current Metric Note',
  'current claim instead of stale history',
  'Story and metric safeguards locked',
  'because/revealed/next-move chain',
  'If Interrupted',
  'Show me proof.',
  'What did you actually find?',
  'Why should strategy care?',
  'What is the caveat?',
  'Final 20-Second Close',
  'We are not selling an oracle',
  'both why it won and what it cannot claim',
  'humans stay in charge',
  'Emergency 60-Second Fallback',
  'Do not debug live; switch to static files.',
  'then open index.html#start-here-story for the proof dashboard',
  'three-takeaway memory aid',
  'TailGuard TW=0.22 survived TW=0.21/TW=0.23 pressure',
  'leaderboard labels point at the current claim',
  'Deadline target',
  'Headline accuracy',
  'Quick Jump',
  'Final Gate Proof',
  'Screenshot Proof',
  'Screenshot Proof Index',
  'Every screenshot has a job',
  'Docs Proof',
  'Documentation Proof Index',
  'Live Demo',
  'Claim Safety',
  'Leakage Guard',
  'Rubric Fit',
  'If the package changed this late, why should judges trust it?',
  'The late changes were audited, not hidden',
  'Dry Run',
  'Story Spine',
  'Finalists',
  'Model Visual',
  'Source Map',
  'Accuracy Stats',
  'Strategy Use',
  'Failure Modes',
  'Evidence Map',
  'Ready Check',
  'Model Scores',
  'Report-local role note',
  'older point-default rows are audit history',
  'Judge Surprises',
  'Starred Coverage',
  'Code Evidence',
  'Starred HTML Coverage',
  'Every starred prompt item is represented inside this HTML dashboard',
  'Final Presentation Lock',
  'Reference Integrity Audit',
  'Judge Dry-Run Scorecard',
  'Mock Judge Panel Brief',
  'Failure Mode Atlas',
  'Firebase scout enrichment',
  '356 matched',
  'ScoutGate',
  'RoleGate',
  'fragmented',
  'sparse and concentrated scout/PPC rows',
  'Why not promote ScoutGate or RoleGate?',
  'Broader timestamped scout/PPC coverage',
  'RoleGate improved audit discipline',
  'Final Package Map',
  'npm run model:qa-dashboard',
  'npm run model:final-check',
  'Package README',
  'Deliverables manifest',
  'Final check summary',
  'FINAL_CHECK_SUMMARY.md',
  'testSuiteHealth',
  'Final summary verified by second run: yes',
  'Source Code Evidence Lock',
  'sourceCodeEvidence',
  'Browser QA summary',
  'Fingerprint manifest',
  'source and generated text evidence package',
  'browser QA, screenshots, and the verifier summary are checked separately'
];

export const requiredHeroQaText = [
  'Current Verdict',
  'Conservative TailGuard Strong RoleV3',
  'First-screen handoff',
  'Deadline target',
  'Saturday May 23 2026 18:00 CST',
  'Fast final gate',
  'npm run model:final-check',
  'Claim boundary',
  'Best defended local model'
];

export const forbiddenBrowserQaText = [
  'undefined',
  'NaN',
  'Friday May 22 2026 18:00 CST',
  'May 22 2026 18:00 CST',
  '2026-05-22T18:00:00+08:00',
  'missing scout/PPC rows',
  '0 cached scout rows',
  'Firebase scout ingest is currently blocked',
  'Current official-data benchmarks contain 0 scout-enriched rows',
  'Real scout/PPC data would be the most valuable next signal',
  'Matched scout/PPC data and timestamp-safe external snapshots would matter',
  'then open index.html for the proof dashboard'
];

const requiredScreenshots: ScreenshotRequirement[] = [
  { fileName: 'dashboard-hero-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'one-page-judge-story-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'start-here-story-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-mobile-hero-screenshot.png', minWidth: 700, minHeight: 1000 },
  { fileName: 'dashboard-print-preview-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-source-evidence-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-final-gate-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-starred-coverage-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-story-spine-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-model-anatomy-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-accuracy-stats-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-model-scores-screenshot.png', minWidth: 1200, minHeight: 800 },
  { fileName: 'dashboard-mobile-screenshot.png', minWidth: 700, minHeight: 1600 },
  { fileName: 'dashboard-fullpage-screenshot.png', minWidth: 1200, minHeight: 3000 }
];

const copyQualityPatterns = [
  {
    pattern: /\b(TODO|TBD)\b/i,
    message: 'contains unfinished placeholder language'
  },
  {
    pattern: /missing scout\/PPC rows/i,
    message: 'contains stale scout/PPC absence wording; current wording should say sparse and concentrated scout/PPC rows'
  },
  {
    pattern: /Friday May 22 2026 18:00 CST/i,
    message: 'contains the superseded May 22 deadline; generated handoff artifacts must use the corrected May 23 CST deadline'
  },
  {
    pattern: /\bMay 22 2026 18:00 CST\b/i,
    message: 'contains the superseded May 22 deadline; generated handoff artifacts must use the corrected May 23 CST deadline'
  },
  {
    pattern: /2026-05-22T18:00:00\+08:00/i,
    message: 'contains the superseded May 22 deadline timestamp; generated handoff artifacts must use the corrected May 23 CST deadline'
  },
  {
    pattern: /\b0 cached scout rows\b/i,
    message: 'contains stale zero-scout-cache wording; current wording should cite the superseding 356 matched Firebase scout rows'
  },
  {
    pattern: /Firebase scout ingest is currently blocked/i,
    message: 'contains stale Firebase-ingest-blocked wording; current wording should cite the completed Firebase scout import'
  },
  {
    pattern: /Current official-data benchmarks contain 0 scout-enriched rows/i,
    message: 'contains stale zero-scout-enrichment wording; current wording should cite sparse usable scout enrichment'
  },
  {
    pattern: /Real scout\/PPC data would be the most valuable next signal/i,
    message: 'contains ambiguous scout/PPC next-step wording; current wording should ask for broader timestamped scout/PPC coverage'
  },
  {
    pattern: /Matched scout\/PPC data and timestamp-safe external snapshots would matter/,
    message: 'contains ambiguous scout/PPC next-step wording; current wording should ask for broader matched scout/PPC data'
  },
  {
    pattern: /then open\s+`?index\.html`?\s+for the proof dashboard/i,
    message: 'contains generic dashboard proof routing; use index.html#start-here-story so a rushed reader lands on the story proof'
  },
  {
    pattern: /then open\s+<code>index\.html<\/code>\s+for the proof dashboard/i,
    message: 'contains generic dashboard proof routing; use index.html#start-here-story so a rushed reader lands on the story proof'
  },
  {
    pattern: /41-point score MAE/i,
    message: 'contains stale cross-exam metric wording; current promoted score MAE is 36.32'
  },
  {
    pattern: /generated verification summary,\s+and\s+a hard-question/i,
    message: 'contains awkward duplicate-conjunction wording around the judge Q&A artifact'
  }
];

const overclaimWordingPatterns = [
  {
    pattern: /\bbest possible model\b/i,
    message: 'uses "best possible model" outside an explicit warning context'
  },
  {
    pattern: /\bexact-score oracle\b/i,
    message: 'uses "exact-score oracle" outside an explicit warning context'
  },
  {
    pattern: /\bunbeatable(?: final answer| claim)?\b/i,
    message: 'uses unbeatable-model wording outside an explicit warning context'
  },
  {
    pattern: /\bmodel is accurate\b/i,
    message: 'uses broad accuracy wording outside an explicit warning context'
  },
  {
    pattern: /\b(?:verifier|verification|package verification|dashboard verifier)\s+proves?\s+(?:the\s+)?model(?:\s+itself)?\s+(?:is\s+)?correct\b/i,
    message: 'claims verification proves model correctness outside an explicit warning context'
  },
  {
    pattern: /\bno better model exists\b/i,
    message: 'claims no better model exists outside an explicit warning context'
  },
  {
    pattern: /\bguarantee(?:d|s)?\s+(?:win|victory|correct|accuracy|model|prediction)\b/i,
    message: 'uses guarantee wording outside an explicit warning context'
  },
  {
    pattern: /\bwill win\b/i,
    message: 'uses win-guarantee wording outside an explicit warning context'
  }
];

const allowedOverclaimContextPattern =
  /\b(do not|does not|did not|cannot|can't|not|without|unsafe|risky|avoid|overclaim|safer wording|drift to avoid|warning|failure mode|claim boundary|would be dishonest|no finite modeling search)\b/i;

const overclaimAuditContextFiles = new Set([
  'index.html',
  'PRESENTATION_WORDING_AUDIT.md',
  'CLAIM_BOUNDARIES.md'
]);

export const findOverclaimWordingIssues = (label: string, content: string) => {
  if (overclaimAuditContextFiles.has(label)) return [];

  const issues: string[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    overclaimWordingPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line) && !allowedOverclaimContextPattern.test(line)) {
        issues.push(`${label}:${index + 1} ${message}: ${line.trim().slice(0, 160)}`);
      }
    });
  });
  return issues;
};

const sha256File = (filePath: string) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const fileSize = (filePath: string) => fs.statSync(filePath).size;

const fileModifiedAtMs = (filePath: string) => fs.statSync(filePath).mtimeMs;

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const addIssue = (issues: VerifyIssue[], severity: VerifyIssue['severity'], message: string) => {
  issues.push({ severity, message });
};

const asArray = (value: unknown): unknown[] | null => (Array.isArray(value) ? value : null);

const toDisplayPath = (filePath: string) => {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath;
};

const resolveManifestPath = (filePath: string) => (path.isAbsolute(filePath) ? filePath : path.resolve(filePath));

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const requiredInPageAnchorTargets = [
  'start-here-story',
  'final-gate-proof',
  'screenshot-proof-index',
  'documentation-proof-index',
  'live-demo-runbook',
  'claim-boundaries',
  'leakage-audit',
  'hostile-judge-cross-exam',
  'judge-rubric-alignment',
  'judge-dry-run-scorecard',
  'judge-story-spine',
  'finalist-comparison',
  'model-anatomy',
  'model-source-map',
  'prediction-behavior',
  'strategy-example',
  'failure-mode-atlas',
  'evidence-matrix',
  'risk-register',
  'final-readiness-check',
  'final-package-map',
  'model-leaderboard',
  'what-should-surprise',
  'starred-html-coverage',
  'source-code-evidence-lock'
];

export const findInPageAnchorIssues = (html: string) => {
  const issues: string[] = [];
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]).filter(Boolean));
  const targets = [...new Set([...html.matchAll(/href=["']#([^"']+)["']/g)].map(match => match[1]).filter(Boolean))];
  targets.forEach(target => {
    if (!ids.has(target)) {
      issues.push(`Dashboard HTML has in-page link with no matching section id: #${target}`);
    }
  });
  if (targets.length < requiredInPageAnchorTargets.length) {
    issues.push(
      `Dashboard HTML should expose at least ${requiredInPageAnchorTargets.length} checked in-page jump links; found ${targets.length}.`
    );
  }
  requiredInPageAnchorTargets.forEach(target => {
    if (!targets.includes(target)) {
      issues.push(`Dashboard HTML is missing required Quick Jump target: #${target}`);
    }
  });
  return issues;
};

const getInPageAnchorTargets = (html: string) =>
  [
    ...new Set(
      [...html.matchAll(/href=["']#([^"']+)["']/g)]
        .map(match => match[1])
        .filter((target): target is string => typeof target === 'string' && target.length > 0)
    )
  ];

const checkInPageAnchors = (issues: VerifyIssue[], html: string) => {
  findInPageAnchorIssues(html).forEach(message => addIssue(issues, 'error', message));
  return getInPageAnchorTargets(html);
};

const validateEmptyArray = (issues: VerifyIssue[], label: string, value: unknown) => {
  const array = asArray(value);
  if (!array) {
    addIssue(issues, 'error', `${label} is not an array in browser-qa-summary.json.`);
    return;
  }
  if (array.length > 0) {
    addIssue(issues, 'error', `${label} is not empty in browser-qa-summary.json: ${JSON.stringify(array).slice(0, 300)}`);
  }
};

const validateFalse = (issues: VerifyIssue[], label: string, value: unknown) => {
  if (value !== false) addIssue(issues, 'error', `${label} is not false in browser-qa-summary.json.`);
};

const validateViewportMetadata = (
  issues: VerifyIssue[],
  label: string,
  check: BrowserQaViewportCheck | undefined,
  expectedWidth: number,
  expectedHeight: number
) => {
  if (!check?.page || typeof check.page.url !== 'string' || !check.page.url.startsWith('http://127.0.0.1:')) {
    addIssue(issues, 'error', `${label}.page.url is missing or does not point to the local dashboard server.`);
  }
  if (check?.page?.viewport?.width !== expectedWidth || check?.page?.viewport?.height !== expectedHeight) {
    addIssue(issues, 'error', `${label}.page.viewport does not match the expected ${expectedWidth}x${expectedHeight} browser QA viewport.`);
  }
};

const validateFreshAfter = (issues: VerifyIssue[], label: string, candidateMs: number, baselinePath: string) => {
  if (!fs.existsSync(baselinePath)) return;
  const baselineMs = fileModifiedAtMs(baselinePath);
  if (candidateMs + FRESHNESS_TOLERANCE_MS < baselineMs) {
    addIssue(issues, 'error', `${label} is older than index.html; refresh browser QA and screenshots after regenerating the dashboard.`);
  }
};

const validateBrowserQaSummary = (issues: VerifyIssue[], filePath: string, baselinePath: string) => {
  let summary: BrowserQaSummary;
  try {
    summary = readJson<BrowserQaSummary>(filePath);
  } catch (error) {
    addIssue(issues, 'error', `browser-qa-summary.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const checkedAtMs = summary.checkedAt ? Date.parse(summary.checkedAt) : Number.NaN;
  if (!summary.checkedAt || Number.isNaN(checkedAtMs)) {
    addIssue(issues, 'error', 'browser-qa-summary.json checkedAt is missing or invalid.');
  } else {
    validateFreshAfter(issues, 'browser-qa-summary.json checkedAt', checkedAtMs, baselinePath);
  }
  validateFreshAfter(issues, 'browser-qa-summary.json file', fileModifiedAtMs(filePath), baselinePath);

  const requiredBodyText = asArray(summary.requiredBodyText);
  if (!requiredBodyText || !requiredBodyText.every(value => typeof value === 'string')) {
    addIssue(issues, 'error', 'browser-qa-summary.json requiredBodyText must be an array of strings.');
  } else {
    requiredBrowserQaText.forEach(required => {
      if (!requiredBodyText.includes(required)) {
        addIssue(issues, 'error', `browser-qa-summary.json requiredBodyText missing required text: ${required}`);
      }
    });
  }

  if (summary.desktopCheck?.title !== 'FIRST Match Modeling Judge Dashboard') {
    addIssue(issues, 'error', 'browser-qa-summary.json desktop title does not match the dashboard title.');
  }
  validateViewportMetadata(issues, 'desktopCheck', summary.desktopCheck, 1440, 1100);
  validateViewportMetadata(issues, 'mobileCheck', summary.mobileCheck, 780, 1200);
  validateEmptyArray(issues, 'desktopCheck.missingText', summary.desktopCheck?.missingText);
  validateEmptyArray(issues, 'desktopCheck.missingHeaderText', summary.desktopCheck?.missingHeaderText);
  validateFalse(issues, 'desktopCheck.hasForbiddenText', summary.desktopCheck?.hasForbiddenText);
  validateFalse(issues, 'desktopCheck.pageOverflow', summary.desktopCheck?.pageOverflow);
  validateEmptyArray(issues, 'desktopCheck.outsideTableOffenders', summary.desktopCheck?.outsideTableOffenders);
  validateEmptyArray(issues, 'mobileCheck.missingHeaderText', summary.mobileCheck?.missingHeaderText);
  validateFalse(issues, 'mobileCheck.pageOverflow', summary.mobileCheck?.pageOverflow);
  validateEmptyArray(issues, 'mobileCheck.outsideTableOffenders', summary.mobileCheck?.outsideTableOffenders);
  validateEmptyArray(issues, 'consoleIssues', summary.consoleIssues);
  validateEmptyArray(issues, 'pageErrors', summary.pageErrors);

  const screenshots = asArray(summary.screenshots);
  if (!screenshots || !screenshots.every(value => typeof value === 'string')) {
    addIssue(issues, 'error', 'browser-qa-summary.json screenshots must be an array of path strings.');
    return;
  }
  requiredScreenshots.forEach(({ fileName }) => {
    const match = screenshots.find(value => typeof value === 'string' && value.endsWith(fileName));
    if (!match) {
      addIssue(issues, 'error', `browser-qa-summary.json screenshots missing ${fileName}.`);
      return;
    }
    if (!fs.existsSync(resolveManifestPath(match as string))) {
      addIssue(issues, 'error', `browser-qa-summary.json screenshot path is missing: ${match}`);
      return;
    }
    validateFreshAfter(issues, `Screenshot ${fileName}`, fileModifiedAtMs(resolveManifestPath(match as string)), baselinePath);
  });
};

const validateFinalCheckSummary = (issues: VerifyIssue[], filePath: string, baselinePath: string) => {
  let summary: FinalCheckSummary;
  try {
    summary = readJson<FinalCheckSummary>(filePath);
  } catch (error) {
    addIssue(issues, 'error', `final-check-summary.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const generatedAtMs = summary.generatedAt ? Date.parse(summary.generatedAt) : Number.NaN;
  if (!summary.generatedAt || Number.isNaN(generatedAtMs)) {
    addIssue(issues, 'error', 'final-check-summary.json generatedAt is missing or invalid.');
  } else {
    validateFreshAfter(issues, 'final-check-summary.json generatedAt', generatedAtMs, baselinePath);
    if (generatedAtMs > requiredDeadlineMs) {
      addIssue(issues, 'error', 'final-check-summary.json generatedAt is after the Saturday May 23 2026 18:00 CST deadline.');
    }
  }
  if (
    typeof summary.generatedAtLocal !== 'string' ||
    !summary.generatedAtLocal.endsWith('CST (Asia/Shanghai, UTC+08:00)')
  ) {
    addIssue(issues, 'error', 'final-check-summary.json generatedAtLocal must use CST (Asia/Shanghai, UTC+08:00).');
  }
  if (
    summary.deadlineProof?.target !== requiredDeadlineTarget ||
    summary.deadlineProof?.deadlineLocal !== requiredDeadlineLocal ||
    summary.deadlineProof?.generatedBeforeDeadline !== true
  ) {
    addIssue(issues, 'error', 'final-check-summary.json deadlineProof must confirm this run was generated before the Saturday May 23 2026 18:00 CST deadline.');
  }
  validateFreshAfter(issues, 'final-check-summary.json file', fileModifiedAtMs(filePath), baselinePath);

  if (summary.status !== 'awaiting_verifier' && summary.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json status must be awaiting_verifier or passed.');
  }
  if (
    summary.finalVerifier?.command !== 'npm run model:verify-dashboard' ||
    summary.finalVerifier?.runsAfterSummaryWrite !== true
  ) {
    addIssue(issues, 'error', 'final-check-summary.json must state that npm run model:verify-dashboard runs after the summary is written.');
  }
  if (summary.status === 'passed') {
    if (
      summary.finalVerifier?.status !== 'passed' ||
      summary.finalVerifier?.exitCode !== 0 ||
      typeof summary.finalVerifier?.durationMs !== 'number' ||
      summary.finalVerifier?.verifiedFinalSummaryWithSecondRun !== true
    ) {
      addIssue(issues, 'error', 'final-check-summary.json passed status must include a passed verifier result and second-run validation marker.');
    }
  }
  if (summary.postChecks?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json postChecks.status must be passed.');
  }
  if (summary.postChecks?.port4177Closed !== true) {
    addIssue(issues, 'error', 'final-check-summary.json must confirm port 4177 closed after browser QA.');
  }

  const coverage = summary.postChecks?.deliverablesCoverage;
  if (
    typeof coverage?.files !== 'number' ||
    typeof coverage?.manifestPaths !== 'number' ||
    coverage.files < 50 ||
    coverage.files !== coverage.manifestPaths
  ) {
    addIssue(issues, 'error', 'final-check-summary.json deliverables coverage counts are missing or inconsistent.');
  }
  const missingFromDeliverables = asArray(coverage?.missingFromDeliverables);
  const missingOnDisk = asArray(coverage?.missingOnDisk);
  if (!missingFromDeliverables || missingFromDeliverables.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json deliverables coverage has files missing from deliverables.json.');
  }
  if (!missingOnDisk || missingOnDisk.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json deliverables coverage has manifest paths missing on disk.');
  }

  const handoffClaimDigest = summary.postChecks?.handoffClaimDigest;
  if (handoffClaimDigest?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json handoffClaimDigest.status must be passed.');
  }
  if (handoffClaimDigest?.deadlineTarget !== requiredDeadlineTarget) {
    addIssue(issues, 'error', `final-check-summary.json deadlineTarget must be ${requiredDeadlineTarget}.`);
  }
  if (handoffClaimDigest?.currentDisplayedModelShortName !== requiredShortModelName) {
    addIssue(issues, 'error', `final-check-summary.json currentDisplayedModelShortName must be ${requiredShortModelName}.`);
  }
  const digestMetrics = handoffClaimDigest?.headlineMetrics;
  if (!digestMetrics || typeof digestMetrics !== 'object' || Array.isArray(digestMetrics)) {
    addIssue(issues, 'error', 'final-check-summary.json headlineMetrics must be an object.');
  } else {
    const metricMap = digestMetrics as Record<string, unknown>;
    Object.entries(requiredHeadlineMetrics).forEach(([key, expected]) => {
      if (metricMap[key] !== expected) {
        addIssue(issues, 'error', `final-check-summary.json headlineMetrics.${key} must be ${expected}.`);
      }
    });
  }

  const entryPointText = summary.postChecks?.entryPointFinalCheckText;
  if (!entryPointText || typeof entryPointText !== 'object' || Array.isArray(entryPointText)) {
    addIssue(issues, 'error', 'final-check-summary.json entryPointFinalCheckText must be an object.');
  } else {
    ['README.md', 'OPEN_THIS_FIRST.md', 'DELIVERABLES.md', 'EVIDENCE_MATRIX.md'].forEach(fileName => {
      if ((entryPointText as Record<string, unknown>)[fileName] !== true) {
        addIssue(issues, 'error', `final-check-summary.json entry-point text check failed for ${fileName}.`);
      }
    });
  }

  const testSuiteHealth = summary.postChecks?.testSuiteHealth;
  if (testSuiteHealth?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json testSuiteHealth.status must be passed.');
  }
  if (
    testSuiteHealth?.command !== 'npm run test' ||
    testSuiteHealth?.exitCode !== 0 ||
    typeof testSuiteHealth?.tests !== 'number' ||
    testSuiteHealth.tests < MINIMUM_FINAL_CHECK_TESTS ||
    testSuiteHealth?.pass !== testSuiteHealth?.tests ||
    testSuiteHealth?.fail !== 0 ||
    testSuiteHealth?.cancelled !== 0
  ) {
    addIssue(
      issues,
      'error',
      `final-check-summary.json test-suite digest counts are missing or inconsistent; expected at least ${MINIMUM_FINAL_CHECK_TESTS} tests.`
    );
  }

  const navigationAnchors = summary.postChecks?.navigationAnchors;
  if (navigationAnchors?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json navigationAnchors.status must be passed.');
  }
  const navigationRequiredTargets = asArray(navigationAnchors?.requiredTargets);
  const navigationTargets = asArray(navigationAnchors?.targets);
  const navigationMissingTargets = asArray(navigationAnchors?.missingTargets);
  const navigationMissingTargetIds = asArray(navigationAnchors?.missingTargetIds);
  if (
    !navigationRequiredTargets ||
    !navigationTargets ||
    !navigationRequiredTargets.every(value => typeof value === 'string') ||
    !navigationTargets.every(value => typeof value === 'string') ||
    requiredInPageAnchorTargets.some((target, index) => navigationRequiredTargets[index] !== target) ||
    requiredInPageAnchorTargets.some(target => !navigationTargets.includes(target))
  ) {
    addIssue(issues, 'error', 'final-check-summary.json navigation anchor digest must include all required Quick Jump targets.');
  }
  if (!navigationMissingTargets || navigationMissingTargets.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json navigation anchor digest has missing required targets.');
  }
  if (!navigationMissingTargetIds || navigationMissingTargetIds.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json navigation anchor digest has targets with missing section ids.');
  }

  const sourceCodeEvidence = summary.postChecks?.sourceCodeEvidence;
  if (sourceCodeEvidence?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json sourceCodeEvidence.status must be passed.');
  }
  const sourceRequiredPaths = asArray(sourceCodeEvidence?.requiredPaths);
  const sourceEntries = asArray(sourceCodeEvidence?.entries);
  const sourceMissingFiles = asArray(sourceCodeEvidence?.missingFiles);
  const sourceMismatchedFingerprints = asArray(sourceCodeEvidence?.mismatchedFingerprints);
  if (
    !sourceRequiredPaths ||
    !sourceEntries ||
    !sourceRequiredPaths.every(value => typeof value === 'string') ||
    requiredSourceDigestPaths.some((target, index) => sourceRequiredPaths[index] !== target) ||
    sourceEntries.length !== requiredSourceDigestPaths.length
  ) {
    addIssue(issues, 'error', 'final-check-summary.json source-code digest must include the required model source paths.');
  } else {
    requiredSourceDigestPaths.forEach(target => {
      const entry = sourceEntries.find(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return (value as Record<string, unknown>).path === target;
      });
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        addIssue(issues, 'error', `final-check-summary.json source-code digest missing entry for ${target}.`);
        return;
      }
      const row = entry as Record<string, unknown>;
      if (
        row.exists !== true ||
        row.manifestMatches !== true ||
        typeof row.bytes !== 'number' ||
        row.bytes <= 0 ||
        typeof row.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(row.sha256)
      ) {
        addIssue(issues, 'error', `final-check-summary.json source-code digest is invalid for ${target}.`);
      }
    });
  }
  if (!sourceMissingFiles || sourceMissingFiles.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json source-code digest has missing files.');
  }
  if (!sourceMismatchedFingerprints || sourceMismatchedFingerprints.length > 0) {
    addIssue(issues, 'error', 'final-check-summary.json source-code digest has mismatched fingerprints.');
  }
  const researchLogPath = resolveManifestPath('modeling/MODELING_RESEARCH_LOG.md');
  if (!fs.existsSync(researchLogPath)) {
    addIssue(issues, 'error', 'MODELING_RESEARCH_LOG.md is missing from the workspace.');
  } else {
    const researchLog = fs.readFileSync(researchLogPath, 'utf8');
    requiredResearchLogStrings.forEach(required => {
      if (!researchLog.includes(required)) addIssue(issues, 'error', `MODELING_RESEARCH_LOG.md missing deadline correction text: ${required}`);
    });
  }

  const browserQaHealth = summary.postChecks?.browserQaHealth;
  if (browserQaHealth?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json browserQaHealth.status must be passed.');
  }
  if (
    browserQaHealth?.requiredBodyText !== requiredBrowserQaText.length ||
    browserQaHealth?.consoleIssues !== 0 ||
    browserQaHealth?.pageErrors !== 0
  ) {
    addIssue(issues, 'error', 'final-check-summary.json browser QA digest counts are missing or inconsistent.');
  }
  ['desktop', 'mobile'].forEach(viewportName => {
    const viewport = browserQaHealth?.[viewportName as 'desktop' | 'mobile'];
    if (
      viewport?.missingText !== 0 ||
      viewport?.missingHeaderText !== 0 ||
      viewport?.forbiddenMatches !== 0 ||
      viewport?.pageOverflow !== false ||
      viewport?.outsideTableOffenders !== 0
    ) {
      addIssue(issues, 'error', `final-check-summary.json browser QA digest failed for ${viewportName}.`);
    }
  });

  const screenshotDimensions = summary.postChecks?.screenshotDimensions;
  if (screenshotDimensions?.status !== 'passed') {
    addIssue(issues, 'error', 'final-check-summary.json screenshotDimensions.status must be passed.');
  }
  const screenshotMap = screenshotDimensions?.screenshots;
  const screenshotRequirements: Record<string, ScreenshotRequirement> = {
    hero: { fileName: 'dashboard-hero-screenshot.png', minWidth: 1200, minHeight: 700 },
    onePageJudgeStory: { fileName: 'one-page-judge-story-screenshot.png', minWidth: 1200, minHeight: 800 },
    startHereStory: { fileName: 'start-here-story-screenshot.png', minWidth: 1200, minHeight: 800 },
    mobileHero: { fileName: 'dashboard-mobile-hero-screenshot.png', minWidth: 700, minHeight: 1000 },
    printPreview: { fileName: 'dashboard-print-preview-screenshot.png', minWidth: 1200, minHeight: 800 },
    sourceEvidence: { fileName: 'dashboard-source-evidence-screenshot.png', minWidth: 1200, minHeight: 800 },
    finalGate: { fileName: 'dashboard-final-gate-screenshot.png', minWidth: 1200, minHeight: 800 },
    starredCoverage: { fileName: 'dashboard-starred-coverage-screenshot.png', minWidth: 1200, minHeight: 800 },
    storySpine: { fileName: 'dashboard-story-spine-screenshot.png', minWidth: 1200, minHeight: 800 },
    modelAnatomy: { fileName: 'dashboard-model-anatomy-screenshot.png', minWidth: 1200, minHeight: 800 },
    accuracyStats: { fileName: 'dashboard-accuracy-stats-screenshot.png', minWidth: 1200, minHeight: 800 },
    modelScores: { fileName: 'dashboard-model-scores-screenshot.png', minWidth: 1200, minHeight: 800 },
    mobile: { fileName: 'dashboard-mobile-screenshot.png', minWidth: 700, minHeight: 1000 },
    fullPage: { fileName: 'dashboard-fullpage-screenshot.png', minWidth: 1200, minHeight: 1000 }
  };
  Object.entries(screenshotRequirements).forEach(([key, requirement]) => {
    const dimensions = screenshotMap?.[key];
    if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
      addIssue(issues, 'error', `final-check-summary.json missing screenshot dimension digest for ${key}.`);
      return;
    }
    const row = dimensions as Record<string, unknown>;
    if (
      typeof row.width !== 'number' ||
      typeof row.height !== 'number' ||
      row.width < requirement.minWidth ||
      row.height < requirement.minHeight
    ) {
      addIssue(issues, 'error', `final-check-summary.json screenshot dimensions too small for ${key}.`);
    }
  });

  const steps = asArray(summary.steps);
  if (!steps) {
    addIssue(issues, 'error', 'final-check-summary.json steps must be an array.');
    return;
  }
  ['npm run model:dashboard', 'npm run model:qa-dashboard', 'npm run model:typecheck', 'npm run test'].forEach(command => {
    const step = steps.find(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const row = value as Record<string, unknown>;
      return row.command === command && row.status === 'passed' && row.exitCode === 0;
    });
    if (!step) addIssue(issues, 'error', `final-check-summary.json missing passed step: ${command}`);
  });
};

const validateFinalCheckHumanSummary = (issues: VerifyIssue[], filePath: string, baselinePath: string) => {
  const content = fs.readFileSync(filePath, 'utf8');
  validateFreshAfter(issues, 'FINAL_CHECK_SUMMARY.md file', fileModifiedAtMs(filePath), baselinePath);
  [
    '# Final Check Summary',
    '## Result',
    'Conservative TailGuard Strong RoleV3',
    'Weighted score MAE: 36.32',
    'Test suite status: passed',
    'Quick Jump anchor status: passed',
    'Quick Jump anchor targets: #start-here-story, #final-gate-proof, #screenshot-proof-index, #documentation-proof-index, #live-demo-runbook, #claim-boundaries, #leakage-audit, #hostile-judge-cross-exam, #judge-rubric-alignment, #judge-dry-run-scorecard, #judge-story-spine, #finalist-comparison, #model-anatomy, #model-source-map, #prediction-behavior, #strategy-example, #failure-mode-atlas, #evidence-matrix, #risk-register, #final-readiness-check, #final-package-map, #model-leaderboard, #what-should-surprise, #starred-html-coverage, #source-code-evidence-lock',
    'Source code evidence status: passed',
    'Source Code Evidence',
    'modeling/src/modeling/train.ts',
    'Browser QA status: passed',
    'Desktop checks: body 0, header 0',
    'Mobile checks: body 0, header 0',
    'This file proves the local handoff gate ran'
  ].forEach(required => {
    if (!content.includes(required)) addIssue(issues, 'error', `FINAL_CHECK_SUMMARY.md missing required text: ${required}`);
  });
  if (!/Tests passed: \d+\/\d+/.test(content)) {
    addIssue(issues, 'error', 'FINAL_CHECK_SUMMARY.md missing test pass-count line.');
  }
  if (!content.includes('PASSED') && !content.includes('AWAITING_VERIFIER')) {
    addIssue(issues, 'error', 'FINAL_CHECK_SUMMARY.md result must be PASSED or AWAITING_VERIFIER.');
  }
  if (content.includes('PASSED') && !content.includes('Final summary verified by second run: yes')) {
    addIssue(issues, 'error', 'FINAL_CHECK_SUMMARY.md passed result must include the second-run verifier marker.');
  }
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const readPngDimensions = (filePath: string): PngDimensions | null => {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  if (header.length < 24 || !header.subarray(0, 8).equals(pngSignature)) return null;
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20)
  };
};

const checkCopyQuality = (issues: VerifyIssue[], label: string, content: string, checkDuplicateLines = true) => {
  copyQualityPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(content)) addIssue(issues, 'error', `${label} ${message}.`);
  });

  findOverclaimWordingIssues(label, content).forEach(message => addIssue(issues, 'error', message));

  if (!checkDuplicateLines) return;

  const lines = content.split(/\r?\n/).map(line => line.trim());
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];
    if (!current || current.length < 16 || current.startsWith('| ---')) continue;
    if (current === previous) {
      addIssue(issues, 'error', `${label} repeats a consecutive line: ${current.slice(0, 120)}`);
      return;
    }
  }
};

const writeVerificationSummary = (result: Omit<DashboardVerificationResult, 'summaryPath'>, summaryPath: string) => {
  const errors = result.issues.filter(issue => issue.severity === 'error');
  const warnings = result.issues.filter(issue => issue.severity === 'warning');
  const generatedAt = new Date();
  writeTextFile(
    summaryPath,
    `# Dashboard Verification Summary

Generated (UTC): ${generatedAt.toISOString()}
Generated (CST / Asia-Shanghai): ${formatShanghaiTimestamp(generatedAt)}

## Result

${errors.length === 0 ? 'PASS' : 'FAIL'}

## Checks

- Files checked: ${result.checkedFiles}
- Required dashboard strings checked: ${result.checkedStrings}
- Markdown copy files checked: ${result.checkedMarkdownFiles}
- Manifest paths checked: ${result.checkedManifestPaths}
- Reference paths checked: ${result.checkedReferencePaths}
- In-page anchor targets checked: ${result.checkedAnchorTargets}
- In-page anchor target names: ${result.checkedAnchorTargetNames.map(target => `#${target}`).join(', ')}
- Browser QA summaries checked: ${result.checkedBrowserQaSummaries}
- Freshness rules checked: ${result.checkedFreshnessRules}
- Fingerprints checked: ${result.checkedFingerprints}
- Screenshots checked: ${result.checkedScreenshots}
- Screenshot dimensions checked: ${result.checkedScreenshotDimensions}
- Errors: ${errors.length}
- Warnings: ${warnings.length}

## Errors

${errors.length === 0 ? '- None' : errors.map(issue => `- ${issue.message}`).join('\n')}

## Warnings

${warnings.length === 0 ? '- None' : warnings.map(issue => `- ${issue.message}`).join('\n')}

## What This Means

This verifier confirms that the local judge dashboard package contains the expected documents, visible sections, manifest entries, reference targets, checked in-page navigation anchors, browser-QA summary, fresh browser screenshots, screenshot files with valid PNG dimensions, and source/text SHA-256 fingerprints. It does not prove the model is perfect; it proves the presentation package is internally consistent enough to present.
`
  );
};

export const verifyJudgeDashboardArtifacts = (outputDir = DEFAULT_OUTPUT_DIR): DashboardVerificationResult => {
  const resolvedOutputDir = path.resolve(outputDir);
  const summaryPath = path.join(resolvedOutputDir, 'VERIFICATION_SUMMARY.md');
  const issues: VerifyIssue[] = [];

  requiredFiles.forEach(fileName => {
    const filePath = path.join(resolvedOutputDir, fileName);
    if (!fs.existsSync(filePath)) {
      addIssue(issues, 'error', `Missing required file: ${fileName}`);
      return;
    }
    if (fileSize(filePath) === 0) {
      addIssue(issues, 'error', `Required file is empty: ${fileName}`);
    }
  });

  const htmlPath = path.join(resolvedOutputDir, 'index.html');
  let checkedAnchorTargetNames: string[] = [];
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    requiredHtmlStrings.forEach(required => {
      if (!html.includes(required)) addIssue(issues, 'error', `Dashboard HTML missing required text: ${required}`);
    });
    checkCopyQuality(issues, 'index.html', html, false);
    checkedAnchorTargetNames = checkInPageAnchors(issues, html);
    const badTokenMatch = html.match(/\b(undefined|NaN)\b/);
    if (badTokenMatch) {
      addIssue(issues, 'error', `Dashboard HTML contains bad token: ${badTokenMatch[0]}`);
    }
    const executiveReadMatch = html.match(/<h2>Executive Read<\/h2>\s*<p>(.*?)<\/p>/s);
    if (!executiveReadMatch) {
      addIssue(issues, 'error', 'Dashboard HTML missing Executive Read paragraph.');
    } else {
      const executiveReadLength = stripHtml(executiveReadMatch[1] ?? '').length;
      if (executiveReadLength > 1000) {
        addIssue(issues, 'error', `Executive Read is too long for judge presentation: ${executiveReadLength} characters.`);
      }
    }
  }

  const startHereStoryHtmlPath = path.join(resolvedOutputDir, 'START_HERE_STORY.html');
  if (fs.existsSync(startHereStoryHtmlPath)) {
    const storyHtml = fs.readFileSync(startHereStoryHtmlPath, 'utf8');
    requiredStartHereStoryHtmlStrings.forEach(required => {
      if (!storyHtml.includes(required)) addIssue(issues, 'error', `START_HERE_STORY.html missing required proof-link text: ${required}`);
    });
    checkCopyQuality(issues, 'START_HERE_STORY.html', storyHtml, false);
  }

  let checkedMarkdownFiles = 0;
  requiredFiles
    .filter(fileName => fileName.endsWith('.md'))
    .forEach(fileName => {
      const filePath = path.join(resolvedOutputDir, fileName);
      if (!fs.existsSync(filePath)) return;
      checkedMarkdownFiles += 1;
      const content = fs.readFileSync(filePath, 'utf8');
      checkCopyQuality(issues, fileName, content);
      if (fileName === 'OPEN_THIS_FIRST.md') {
        requiredOpenThisFirstStrings.forEach(required => {
          if (!content.includes(required)) addIssue(issues, 'error', `OPEN_THIS_FIRST.md missing required handoff text: ${required}`);
        });
      }
      if (fileName === 'PRINTABLE_HANDOUT.md') {
        requiredPrintableHandoutStrings.forEach(required => {
          if (!content.includes(required)) addIssue(issues, 'error', `PRINTABLE_HANDOUT.md missing required handoff text: ${required}`);
        });
      }
      if (fileName === 'QA_CHECKLIST.md') {
        requiredQaChecklistStrings.forEach(required => {
          if (!content.includes(required)) addIssue(issues, 'error', `QA_CHECKLIST.md missing required safeguard text: ${required}`);
        });
      }
      const storyFirstStrings = requiredStoryFirstRouteStrings[fileName];
      if (storyFirstStrings) {
        storyFirstStrings.forEach(required => {
          if (!content.includes(required)) addIssue(issues, 'error', `${fileName} missing story-first route text: ${required}`);
        });
      }
      if (requiredShortRouteDeadlineFiles.includes(fileName) && !content.includes(`Delivery target: ${requiredDeadlineTarget}`)) {
        addIssue(issues, 'error', `${fileName} missing short-route delivery target: ${requiredDeadlineTarget}`);
      }
      if (content.includes('Generated (UTC):') && !content.includes('Generated (CST / Asia-Shanghai):')) {
        addIssue(issues, 'error', `${fileName} has UTC generated time without local CST generated time.`);
      }
      if (content.includes('Generated: 2026-') && !content.includes('Generated (CST / Asia-Shanghai):')) {
        addIssue(issues, 'error', `${fileName} still uses UTC-only generated time wording.`);
      }
      if (fileName === 'ARTIFACT_FINGERPRINTS.md') {
        requiredArtifactFingerprintStrings.forEach(required => {
          if (!content.includes(required)) addIssue(issues, 'error', `ARTIFACT_FINGERPRINTS.md missing fingerprint scope text: ${required}`);
        });
      }
      if (fileName === 'FINAL_CHECK_SUMMARY.md' && !content.includes('Generated (CST / Asia-Shanghai):')) {
        addIssue(issues, 'error', 'FINAL_CHECK_SUMMARY.md missing local CST generated time.');
      }
      if (fileName === 'FINAL_CHECK_SUMMARY.md' && !content.includes('Generated before deadline: yes')) {
        addIssue(issues, 'error', 'FINAL_CHECK_SUMMARY.md missing successful deadline proof.');
      }
    });

  let checkedManifestPaths = 0;
  const deliverablesPath = path.join(resolvedOutputDir, 'deliverables.json');
  if (fs.existsSync(deliverablesPath)) {
    const deliverables = readJson<Record<string, unknown>>(deliverablesPath);
    requiredManifestKeys.forEach(key => {
      if (!(key in deliverables)) addIssue(issues, 'error', `deliverables.json missing key: ${key}`);
    });
    if (deliverables.deadlineTarget !== requiredDeadlineTarget) {
      addIssue(issues, 'error', `deliverables.json deadlineTarget must be ${requiredDeadlineTarget}.`);
    }
    if (deliverables.currentDisplayedModelShortName !== requiredShortModelName) {
      addIssue(issues, 'error', `deliverables.json currentDisplayedModelShortName must be ${requiredShortModelName}.`);
    }
    const headlineMetrics = deliverables.headlineMetrics;
    if (!headlineMetrics || typeof headlineMetrics !== 'object' || Array.isArray(headlineMetrics)) {
      addIssue(issues, 'error', 'deliverables.json headlineMetrics key is not an object.');
    } else {
      const metricMap = headlineMetrics as Record<string, unknown>;
      Object.entries(requiredHeadlineMetrics).forEach(([key, expected]) => {
        if (metricMap[key] !== expected) {
          addIssue(issues, 'error', `deliverables.json headlineMetrics.${key} must be ${expected}.`);
        }
      });
    }
    requiredManifestPathKeys.forEach(key => {
      const value = deliverables[key];
      if (typeof value !== 'string') {
        addIssue(issues, 'error', `deliverables.json key is not a path string: ${key}`);
        return;
      }
      checkedManifestPaths += 1;
      if (!fs.existsSync(resolveManifestPath(value))) addIssue(issues, 'error', `deliverables.json path is missing for ${key}: ${value}`);
    });
    const verificationSummaryValue = deliverables.verificationSummary;
    if (typeof verificationSummaryValue !== 'string') {
      addIssue(issues, 'error', 'deliverables.json key is not a path string: verificationSummary');
    } else {
      checkedManifestPaths += 1;
      const verificationSummaryPath = resolveManifestPath(verificationSummaryValue);
      if (verificationSummaryPath !== summaryPath) {
        addIssue(issues, 'error', `deliverables.json verificationSummary path is not the generated verifier output: ${verificationSummaryValue}`);
      }
    }
    const screenshots = deliverables.screenshots;
    if (!screenshots || typeof screenshots !== 'object' || Array.isArray(screenshots)) {
      addIssue(issues, 'error', 'deliverables.json screenshots key is not an object.');
    } else {
      const screenshotMap = screenshots as Record<string, unknown>;
      requiredManifestScreenshotKeys.forEach(key => {
        const value = screenshotMap[key];
        if (typeof value !== 'string') {
          addIssue(issues, 'error', `deliverables.json screenshots.${key} is not a path string.`);
          return;
        }
        checkedManifestPaths += 1;
        if (!fs.existsSync(resolveManifestPath(value))) addIssue(issues, 'error', `deliverables.json screenshot path is missing for ${key}: ${value}`);
      });
    }
  }

  let checkedReferencePaths = 0;
  requiredReferenceTargets.forEach(target => {
    checkedReferencePaths += 1;
    const targetPath = path.resolve(target);
    if (!fs.existsSync(targetPath)) addIssue(issues, 'error', `Reference target is missing: ${target}`);
  });

  let checkedBrowserQaSummaries = 0;
  const browserQaSummaryPath = path.join(resolvedOutputDir, 'browser-qa-summary.json');
  if (fs.existsSync(browserQaSummaryPath)) {
    checkedBrowserQaSummaries += 1;
    validateBrowserQaSummary(issues, browserQaSummaryPath, htmlPath);
  }
  const finalCheckSummaryPath = path.join(resolvedOutputDir, 'final-check-summary.json');
  if (fs.existsSync(finalCheckSummaryPath)) {
    validateFinalCheckSummary(issues, finalCheckSummaryPath, htmlPath);
  }
  const finalCheckHumanSummaryPath = path.join(resolvedOutputDir, 'FINAL_CHECK_SUMMARY.md');
  if (fs.existsSync(finalCheckHumanSummaryPath)) {
    validateFinalCheckHumanSummary(issues, finalCheckHumanSummaryPath, htmlPath);
  }
  const checkedFreshnessRules = checkedBrowserQaSummaries > 0 ? requiredScreenshots.length + 1 : 0;

  let checkedFingerprints = 0;
  const fingerprintsPath = path.join(resolvedOutputDir, 'artifact-fingerprints.json');
  if (fs.existsSync(fingerprintsPath)) {
    const manifest = readJson<FingerprintManifest>(fingerprintsPath);
    if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
      addIssue(issues, 'error', 'artifact-fingerprints.json has no artifacts array.');
    } else {
      manifest.artifacts.forEach(entry => {
        checkedFingerprints += 1;
        const artifactPath = path.resolve(entry.path);
        if (!fs.existsSync(artifactPath)) {
          addIssue(issues, 'error', `Fingerprint target missing: ${entry.path}`);
          return;
        }
        const actualBytes = fileSize(artifactPath);
        const actualHash = sha256File(artifactPath);
        if (actualBytes !== entry.bytes) {
          addIssue(issues, 'error', `Fingerprint byte mismatch for ${entry.path}: expected ${entry.bytes}, got ${actualBytes}`);
        }
        if (actualHash !== entry.sha256) {
          addIssue(issues, 'error', `Fingerprint hash mismatch for ${entry.path}`);
        }
      });
    }
  }

  let checkedScreenshots = 0;
  let checkedScreenshotDimensions = 0;
  requiredScreenshots.forEach(({ fileName, minWidth, minHeight }) => {
    const screenshotPath = path.join(resolvedOutputDir, fileName);
    if (!fs.existsSync(screenshotPath)) {
      addIssue(issues, 'warning', `Missing screenshot: ${fileName}`);
      return;
    }
    checkedScreenshots += 1;
    if (fileSize(screenshotPath) < 1024) {
      addIssue(issues, 'warning', `Screenshot is suspiciously small: ${fileName}`);
    }
    const dimensions = readPngDimensions(screenshotPath);
    if (!dimensions) {
      addIssue(issues, 'error', `Screenshot is not a valid PNG file: ${fileName}`);
      return;
    }
    checkedScreenshotDimensions += 1;
    if (dimensions.width < minWidth || dimensions.height < minHeight) {
      addIssue(
        issues,
        'error',
        `Screenshot dimensions are too small for ${fileName}: expected at least ${minWidth}x${minHeight}, got ${dimensions.width}x${dimensions.height}`
      );
    }
  });

  const resultWithoutSummary = {
    outputDir: resolvedOutputDir,
    checkedFiles: requiredFiles.length,
    checkedStrings:
      requiredHtmlStrings.length +
      requiredStartHereStoryHtmlStrings.length +
      requiredOpenThisFirstStrings.length +
      requiredPrintableHandoutStrings.length +
      Object.values(requiredStoryFirstRouteStrings).reduce((total, strings) => total + strings.length, 0) +
      requiredResearchLogStrings.length,
    checkedMarkdownFiles,
    checkedManifestPaths,
    checkedReferencePaths,
    checkedAnchorTargets: checkedAnchorTargetNames.length,
    checkedAnchorTargetNames,
    checkedBrowserQaSummaries,
    checkedFreshnessRules,
    checkedFingerprints,
    checkedScreenshots,
    checkedScreenshotDimensions,
    issues
  };
  writeVerificationSummary(resultWithoutSummary, summaryPath);

  return {
    ...resultWithoutSummary,
    outputDir: toDisplayPath(resolvedOutputDir),
    summaryPath: toDisplayPath(summaryPath)
  };
};
