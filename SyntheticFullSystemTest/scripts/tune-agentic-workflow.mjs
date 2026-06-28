#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasFlag = name => args.includes(name);

const season = Number(getArg('--season', '2026'));
const eventCount = Number(getArg('--events', '1'));
const maxPasses = Number(getArg('--max-passes', '3'));
const minMatches = Number(getArg('--min-matches', '30'));
const seed = Number(getArg('--seed', '20260628'));
const eventKeysArg = getArg('--event-keys', '');
const tuningRoot = path.resolve(getArg('--tuning-root', 'SyntheticFullSystemTest/tuning'));
const artifactRoot = path.resolve(getArg('--artifact-root', 'SyntheticFullSystemTest/artifacts'));
const eventListUrl = getArg('--events-url', `https://www.thebluealliance.com/events/${season}`);
const replayScript = path.resolve('SyntheticFullSystemTest/scripts/real-event-replay.mjs');

const independentVariables = {
  priorWeight: {
    default: 1,
    min: 0.55,
    max: 1.45,
    step: 0.12,
    minStep: 0.015,
    selected: true,
    reason: 'Controls early-event dependence on pre-scout/public prior strength.'
  },
  liveEvidenceWeight: {
    default: 0.32,
    min: 0.12,
    max: 0.72,
    step: 0.08,
    minStep: 0.01,
    selected: true,
    reason: 'Controls how strongly match scout evidence updates team ratings.'
  },
  recencyHalfLifeMatches: {
    default: 2,
    min: 0.75,
    max: 8,
    step: 0.8,
    minStep: 0.1,
    selected: true,
    reason: 'Controls how quickly recent match evidence outweighs old evidence.'
  },
  marginConfidenceScale: {
    default: 42,
    min: 22,
    max: 74,
    step: 7,
    minStep: 0.75,
    selected: true,
    reason: 'Controls conversion from predicted margin to win probability.'
  },
  scoreScaleCorrection: {
    default: 1,
    min: 0.72,
    max: 1.28,
    step: 0.06,
    minStep: 0.008,
    selected: true,
    reason: 'Controls global correction for predicted red and blue scores.'
  },
  defenseImpactWeight: {
    default: 0.6,
    min: 0.15,
    max: 1.4,
    step: 0.16,
    minStep: 0.02,
    selected: true,
    reason: 'Controls how much opponent defense suppresses projected scoring.'
  },
  reliabilityWeight: {
    default: 18,
    min: 4,
    max: 38,
    step: 4,
    minStep: 0.5,
    selected: true,
    reason: 'Controls how much robot reliability lifts projected alliance score.'
  },
  foulPenaltyWeight: {
    default: 2,
    min: 0,
    max: 9,
    step: 1,
    minStep: 0.25,
    selected: false,
    reason: 'Future harsh-mode variable for how much foul concern lowers team value.'
  },
  scoutNoisePenalty: {
    default: 0,
    min: 0,
    max: 0.9,
    step: 0.12,
    minStep: 0.02,
    selected: true,
    reason: 'Controls discounting of low-confidence or reliability-questionable scout data.'
  },
  pitClaimTrustWeight: {
    default: 0,
    min: 0,
    max: 0.45,
    step: 0.08,
    minStep: 0.01,
    selected: false,
    reason: 'Future variable for trusting subjective pit claims before match evidence.'
  },
  upsetSensitivity: {
    default: 0,
    min: 0,
    max: 1,
    step: 0.14,
    minStep: 0.02,
    selected: true,
    reason: 'Controls how quickly the model reacts when results contradict priors.'
  },
  playoffAdaptationWeight: {
    default: 1,
    min: 0.65,
    max: 1.55,
    step: 0.12,
    minStep: 0.02,
    selected: false,
    reason: 'Future variable for late-event/playoff-specific adaptation.'
  },
  scoreConsistencyStrictness: {
    default: 1,
    min: 0.5,
    max: 1.5,
    step: 0.1,
    minStep: 0.02,
    selected: false,
    reason: 'Audit strictness variable; inactive while score-consistent rows are mandatory.'
  },
  missingScoutRowPenalty: {
    default: 0,
    min: 0,
    max: 1,
    step: 0.15,
    minStep: 0.02,
    selected: false,
    reason: 'Future harsh-mode variable for missing scout rows or upload delays.'
  },
  confidenceFloor: {
    default: 0.025,
    min: 0.005,
    max: 0.15,
    step: 0.02,
    minStep: 0.005,
    selected: false,
    reason: 'Future calibration bound preventing impossible certainty.'
  },
  confidenceCeiling: {
    default: 0.975,
    min: 0.85,
    max: 0.995,
    step: 0.02,
    minStep: 0.005,
    selected: false,
    reason: 'Future calibration bound preventing impossible certainty.'
  }
};

const dependentVariables = {
  winnerAccuracy: 'Correct winner rate across decisive matches. Higher is better.',
  qualificationWinnerAccuracy: 'Correct winner rate in qualification matches. Higher is better.',
  playoffWinnerAccuracy: 'Correct winner rate in playoff matches. Higher is better.',
  brierScore: 'Probability calibration error for red alliance win probability. Lower is better.',
  scoreMae: 'Mean absolute error of red/blue predicted scores. Lower is better.',
  marginMae: 'Mean absolute error of predicted score margin. Lower is better.',
  earlyEventAccuracy: 'Winner accuracy in the first quarter of the event. Higher is better.',
  lateEventAccuracy: 'Winner accuracy after more event evidence exists. Higher is better.',
  overconfidenceRate: 'Share of confident predictions that were wrong. Lower is better.',
  calibrationError: 'Average binned probability calibration gap. Lower is better.',
  upsetMissRate: 'Share of underdog wins the model failed to anticipate. Lower is better.',
  objectiveLoss: 'Weighted combined loss used by the tuner. Lower is better.'
};

if (hasFlag('--print-contract')) {
  console.log(JSON.stringify({ independentVariables, dependentVariables }, null, 2));
  process.exit(0);
}

mkdirSync(tuningRoot, { recursive: true });
mkdirSync(path.join(tuningRoot, 'ledgers'), { recursive: true });
mkdirSync(path.join(tuningRoot, 'runs'), { recursive: true });
mkdirSync(artifactRoot, { recursive: true });

const stableHash = value => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = initialSeed => {
  let state = initialSeed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const round = (value, digits = 6) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mean = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const decodeHtml = value =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
const stripTags = value => decodeHtml(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

const fetchText = url =>
  new Promise((resolve, reject) => {
    https
      .get(url, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          resolve(fetchText(new URL(response.headers.location, url).toString()));
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`GET ${url} failed with HTTP ${response.statusCode}`));
          return;
        }
        response.setEncoding('utf8');
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      })
      .on('error', reject);
  });

const fetchWithCurl = url =>
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--max-time', '30', url], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024
  });

const proxyConfigured = () =>
  Boolean(process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY || process.env.all_proxy || process.env.ALL_PROXY);

const loadText = async url => {
  if (proxyConfigured()) return fetchWithCurl(url);
  try {
    return await fetchText(url);
  } catch (error) {
    if (error?.code !== 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') throw error;
    return fetchWithCurl(url);
  }
};

const parseEvents = html => {
  const links = [...html.matchAll(/href="\/event\/(20\d{2}[a-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(match => ({
      eventKey: match[1],
      eventName: stripTags(match[2]),
      sourceUrl: `https://www.thebluealliance.com/event/${match[1]}`
    }))
    .filter(event => event.eventKey.startsWith(String(season)));
  return [...new Map(links.map(event => [event.eventKey, event])).values()];
};

const readJsonIfExists = filePath => {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const readLinesIfExists = filePath => (existsSync(filePath) ? readFileSync(filePath, 'utf8').split('\n').filter(Boolean) : []);

const csvEscape = value => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const appendCsv = (filePath, header, row) => {
  if (!existsSync(filePath)) appendFileSync(filePath, `${header.map(csvEscape).join(',')}\n`);
  appendFileSync(filePath, `${row.map(csvEscape).join(',')}\n`);
};

const appendJsonl = (filePath, value) => {
  appendFileSync(filePath, `${JSON.stringify(value)}\n`);
};

const ledgerPath = path.join(tuningRoot, 'tuning-ledger.md');
const runsJsonlPath = path.join(tuningRoot, 'tuning-runs.jsonl');
const eventResultsPath = path.join(tuningRoot, 'event-results.csv');
const parameterHistoryPath = path.join(tuningRoot, 'parameter-history.csv');

if (!existsSync(ledgerPath)) {
  writeFileSync(
    ledgerPath,
    `# Synthetic Full System Test Tuning Ledger\n\nThis text ledger records every replay/tuning cycle, selected variables, metric changes, convergence decisions, and GitHub sync status.\n\n`
  );
}

const previouslyTunedEvents = new Set(
  readLinesIfExists(runsJsonlPath)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(row => row.kind === 'event-final')
    .map(row => row.eventKey)
);

const existingAgenticEvents = () => {
  const summary = readJsonIfExists(path.join(artifactRoot, 'agentic-event-replay-catalog-summary.json'));
  return new Set((summary?.successfulEvents ?? []).map(event => event.eventKey));
};

const manifestFor = (event, params, name) => ({
  schemaVersion: 1,
  simulation: {
    name,
    mode: 'public-real-event',
    scoutMode: 'agentic-score-consistent',
    seed: stableHash(`tuning:${season}:${event.eventKey}:${seed}`),
    description: `Tuning replay for ${event.eventName || event.eventKey}.`
  },
  tuningParameters: params,
  fixture: {
    eventKey: event.eventKey,
    season,
    eventName: event.eventName || event.eventKey,
    sourceUrl: event.sourceUrl,
    excludedTeamKeys: [],
    pretendOwnTeamPolicy: { strategy: 'seeded-random-participant', seed: stableHash(`own:${event.eventKey}`) }
  },
  dataSources: {
    tbaPublicPage: { mode: 'public-html', required: true, url: event.sourceUrl },
    tbaApi: { mode: 'disabled-no-key', required: false },
    statbotics: { mode: 'disabled-public-page-replay', required: false },
    firebase: { mode: 'disabled-local-replay', required: false }
  },
  phases: [
    { id: 'pre_scout', startsAt: 'T_MINUS_7_DAYS' },
    { id: 'pit_scout', startsAt: 'PIT_SCOUT_WINDOW' },
    { id: 'qualification_replay', startsAt: 'MATCH_1_POSTED' },
    { id: 'playoff_replay', startsAt: 'PLAYOFF_MATCH_1_POSTED' },
    { id: 'alliance_selection', startsAt: 'ALLIANCE_SELECTION_PREP' }
  ],
  agentPlan: {
    defaultPolicy: 'agentic-score-consistent-scout-personas',
    spawnAgentsByDefault: false,
    requiredReportsWhenAgentsUsed: ['codex_swarm.md', 'codex_agent_reports/<agent>.md']
  },
  bridges: {
    modelCore: { mode: 'real-event-ledger-runner', commands: ['node SyntheticFullSystemTest/scripts/real-event-replay.mjs --manifest <generated-manifest>'] },
    webApp: { mode: 'build-and-artifact-ready', routes: ['/adminv2', '/adminv2/prediction-vs-actual', '/adminv4'] },
    firebase: { mode: 'disabled-local-replay', productionWrites: false },
    powerScout: { mode: 'swiftpm', commands: ['cd PowerScout && ./script/build_and_run.sh --verify'] }
  },
  gates: {
    noFutureLeakage: 'required',
    minMatches,
    minScoutRowsPerMatch: 6,
    maxUncoveredMatches: 0,
    requiredArtifacts: [
      'run-summary.json',
      'source-page-metadata.json',
      'replay-event.json',
      'scout-observations.json',
      'prediction-ledger.json',
      'model-metrics.json',
      'metric-definitions.json',
      'team-metric-timeline.json',
      'future-prediction-snapshots.json',
      'scout-agent-ledger.json',
      'match-scout-v4-records.json',
      'score-reconciliation-ledger.json',
      'alliance-score-residual-buckets.json',
      'score-consistency-audit.json',
      'no-future-leakage-audit.json',
      'scout-coverage-audit.json',
      'alliance-selection-replay.json',
      'app-bridge-summary.json',
      'event-history-index.json',
      'morning-report.html'
    ]
  },
  artifacts: {
    root: 'SyntheticFullSystemTest/artifacts',
    keepGeneratedOutOfGit: true
  }
});

const tuningRunId = `sft-tune-${season}-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${seed}`;
const runRoot = path.join(tuningRoot, 'runs', tuningRunId);
const runArtifactRoot = path.join(artifactRoot, tuningRunId);
const generatedManifestRoot = path.join(runArtifactRoot, '_generated-manifests');
const sourcePageRoot = path.join(runArtifactRoot, '_source-pages');
mkdirSync(runRoot, { recursive: true });
mkdirSync(runArtifactRoot, { recursive: true });
mkdirSync(generatedManifestRoot, { recursive: true });
mkdirSync(sourcePageRoot, { recursive: true });

const selectedVariableNames = Object.entries(independentVariables)
  .filter(([, variable]) => variable.selected)
  .map(([name]) => name);

const defaultParams = Object.fromEntries(Object.entries(independentVariables).map(([name, variable]) => [name, variable.default]));
const variableState = Object.fromEntries(
  selectedVariableNames.map(name => [
    name,
    {
      status: 'active',
      step: independentVariables[name].step,
      noChangeRounds: 0,
      values: [defaultParams[name]]
    }
  ])
);

const evaluatePredictionLedger = outputDir => {
  const modelMetrics = JSON.parse(readFileSync(path.join(outputDir, 'model-metrics.json'), 'utf8'));
  const predictionLedger = JSON.parse(readFileSync(path.join(outputDir, 'prediction-ledger.json'), 'utf8'));
  const entries = predictionLedger.entries.filter(entry => entry.actualWinner !== 'tie');
  const decisive = entries.filter(entry => entry.predictedWinner !== 'tie');
  const firstQuarterLimit = Math.ceil(entries.length * 0.25);
  const early = decisive.filter(entry => entry.matchIndex < firstQuarterLimit);
  const late = decisive.filter(entry => entry.matchIndex >= firstQuarterLimit);
  const overconfident = entries.filter(entry => {
    if (entry.redWinProbability >= 0.75) return entry.actualWinner !== 'red';
    if (entry.redWinProbability <= 0.25) return entry.actualWinner !== 'blue';
    return false;
  });
  const upsetCandidates = entries.filter(entry => {
    const actualRed = entry.actualWinner === 'red';
    return (actualRed && entry.redWinProbability < 0.4) || (!actualRed && entry.redWinProbability > 0.6);
  });
  const bins = new Map();
  for (const entry of entries) {
    const bucket = Math.round(entry.redWinProbability * 10) / 10;
    const item = bins.get(bucket) ?? { predicted: [], actual: [] };
    item.predicted.push(entry.redWinProbability);
    item.actual.push(entry.actualWinner === 'red' ? 1 : 0);
    bins.set(bucket, item);
  }
  const calibrationError = mean(
    [...bins.values()].map(bin => Math.abs(mean(bin.predicted) - mean(bin.actual)))
  );
  const metrics = {
    winnerAccuracy: modelMetrics.winnerAccuracy,
    qualificationWinnerAccuracy: modelMetrics.qualificationWinnerAccuracy,
    playoffWinnerAccuracy: modelMetrics.playoffWinnerAccuracy,
    brierScore: modelMetrics.brierScore,
    scoreMae: modelMetrics.scoreMae,
    marginMae: modelMetrics.marginMae,
    earlyEventAccuracy: mean(early.map(entry => (entry.winnerCorrect ? 1 : 0))),
    lateEventAccuracy: mean(late.map(entry => (entry.winnerCorrect ? 1 : 0))),
    overconfidenceRate: entries.length ? overconfident.length / entries.length : 0,
    calibrationError,
    upsetMissRate: entries.length ? upsetCandidates.length / entries.length : 0
  };
  metrics.objectiveLoss = round(
    (1 - metrics.winnerAccuracy) * 55 +
      metrics.brierScore * 120 +
      metrics.scoreMae * 0.07 +
      metrics.marginMae * 0.08 +
      (1 - metrics.earlyEventAccuracy) * 12 +
      metrics.overconfidenceRate * 22 +
      metrics.calibrationError * 30 +
      metrics.upsetMissRate * 10,
    6
  );
  return metrics;
};

const runReplay = (event, params, label) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const manifestPath = path.join(generatedManifestRoot, `${event.eventKey}-${safeLabel}.json`);
  const outputDir = path.join(runArtifactRoot, `${event.eventKey}-${safeLabel}`);
  writeFileSync(manifestPath, `${JSON.stringify(manifestFor(event, params, `${event.eventKey}-${safeLabel}`), null, 2)}\n`);
  const stdout = execFileSync(process.execPath, [replayScript, '--manifest', manifestPath, '--output', outputDir, '--force'], {
    encoding: 'utf8',
    maxBuffer: 90 * 1024 * 1024
  });
  const summary = JSON.parse(stdout);
  const metrics = evaluatePredictionLedger(outputDir);
  return {
    eventKey: event.eventKey,
    eventName: summary.eventName,
    label,
    outputDir,
    runId: summary.runId,
    params: { ...params },
    counts: summary.counts,
    gates: summary.gates,
    metrics
  };
};

const objectiveImproved = (candidate, current) => candidate.metrics.objectiveLoss < current.metrics.objectiveLoss - 0.025;

const detectOscillation = values => {
  if (values.length < 4) return null;
  const last = values.slice(-4).map(value => round(value, 4));
  if (last[0] === last[2] && last[1] === last[3] && last[0] !== last[1]) return round(mean(last), 6);
  const range = Math.max(...last) - Math.min(...last);
  if (range <= 0.01) return round(mean(last), 6);
  return null;
};

const cachedEventHtmlPath = async event => {
  const htmlPath = path.join(sourcePageRoot, `${event.eventKey}.html`);
  if (!existsSync(htmlPath)) {
    writeFileSync(htmlPath, await loadText(event.sourceUrl));
  }
  return htmlPath;
};

const appendRunArtifacts = (event, record) => {
  appendJsonl(runsJsonlPath, { recordedAt: new Date().toISOString(), tuningRunId, ...record });
  appendCsv(
    eventResultsPath,
    [
      'tuningRunId',
      'eventKey',
      'eventName',
      'kind',
      'label',
      'objectiveLoss',
      'winnerAccuracy',
      'brierScore',
      'scoreMae',
      'marginMae',
      'earlyEventAccuracy',
      'overconfidenceRate',
      'calibrationError',
      'upsetMissRate',
      'outputDir'
    ],
    [
      tuningRunId,
      event.eventKey,
      event.eventName,
      record.kind,
      record.result?.label ?? '',
      record.result?.metrics?.objectiveLoss ?? '',
      record.result?.metrics?.winnerAccuracy ?? '',
      record.result?.metrics?.brierScore ?? '',
      record.result?.metrics?.scoreMae ?? '',
      record.result?.metrics?.marginMae ?? '',
      record.result?.metrics?.earlyEventAccuracy ?? '',
      record.result?.metrics?.overconfidenceRate ?? '',
      record.result?.metrics?.calibrationError ?? '',
      record.result?.metrics?.upsetMissRate ?? '',
      record.result?.outputDir ?? ''
    ]
  );
};

const appendParameterHistory = (event, pass, variable, oldValue, newValue, status, reason, result) => {
  appendCsv(
    parameterHistoryPath,
    ['tuningRunId', 'eventKey', 'pass', 'variable', 'oldValue', 'newValue', 'status', 'reason', 'objectiveLoss', 'winnerAccuracy', 'brierScore'],
    [
      tuningRunId,
      event.eventKey,
      pass,
      variable,
      oldValue,
      newValue,
      status,
      reason,
      result?.metrics?.objectiveLoss ?? '',
      result?.metrics?.winnerAccuracy ?? '',
      result?.metrics?.brierScore ?? ''
    ]
  );
};

const chooseEvents = async () => {
  const explicit = eventKeysArg.split(',').map(value => value.trim()).filter(Boolean);
  if (explicit.length) {
    return explicit.map(eventKey => ({ eventKey, eventName: eventKey, sourceUrl: `https://www.thebluealliance.com/event/${eventKey}` }));
  }
  const discovered = parseEvents(await loadText(eventListUrl));
  const alreadyAgentic = existingAgenticEvents();
  const candidates = discovered.filter(event => !previouslyTunedEvents.has(event.eventKey) && !alreadyAgentic.has(event.eventKey));
  const random = seededRandom(seed);
  return candidates
    .map(event => ({ event, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map(item => item.event);
};

const tuneEvent = async event => {
  const htmlPath = await cachedEventHtmlPath(event);
  const runReplayWithCachedHtml = (params, label) => {
    const safeLabel = label.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const manifestPath = path.join(generatedManifestRoot, `${event.eventKey}-${safeLabel}.json`);
    const outputDir = path.join(runArtifactRoot, `${event.eventKey}-${safeLabel}`);
    writeFileSync(manifestPath, `${JSON.stringify(manifestFor(event, params, `${event.eventKey}-${safeLabel}`), null, 2)}\n`);
    const stdout = execFileSync(process.execPath, [replayScript, '--manifest', manifestPath, '--output', outputDir, '--html-file', htmlPath, '--force'], {
      encoding: 'utf8',
      maxBuffer: 90 * 1024 * 1024
    });
    const summary = JSON.parse(stdout);
    const metrics = evaluatePredictionLedger(outputDir);
    return {
      eventKey: event.eventKey,
      eventName: summary.eventName,
      label,
      outputDir,
      runId: summary.runId,
      params: { ...params },
      counts: summary.counts,
      gates: summary.gates,
      metrics
    };
  };
  appendFileSync(
    ledgerPath,
    `\n## ${new Date().toISOString()} - ${tuningRunId} - ${event.eventKey}\n\n` +
      `Event: ${event.eventName}\n\n` +
      `Selected variables: ${selectedVariableNames.join(', ')}\n\n`
  );
  const params = { ...defaultParams };
  let current = runReplayWithCachedHtml(params, 'baseline');
  appendRunArtifacts(event, { kind: 'baseline', result: current });
  appendFileSync(
    ledgerPath,
    `- Baseline objective ${current.metrics.objectiveLoss}, winner ${current.metrics.winnerAccuracy}, Brier ${current.metrics.brierScore}, score MAE ${current.metrics.scoreMae}, margin MAE ${current.metrics.marginMae}.\n`
  );

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    let changedThisPass = false;
    for (const variableName of selectedVariableNames) {
      const state = variableState[variableName];
      const def = independentVariables[variableName];
      if (state.status !== 'active') continue;
      const oldValue = params[variableName];
      const candidates = [
        clamp(oldValue - state.step, def.min, def.max),
        clamp(oldValue + state.step, def.min, def.max)
      ]
        .map(value => round(value))
        .filter((value, index, values) => value !== oldValue && values.indexOf(value) === index);

      let best = current;
      let bestValue = oldValue;
      for (const value of candidates) {
        const candidateParams = { ...params, [variableName]: value };
        const candidate = runReplayWithCachedHtml(candidateParams, `p${pass}-${variableName}-${value}`);
        appendRunArtifacts(event, { kind: 'candidate', variableName, oldValue, newValue: value, result: candidate });
        if (candidate.metrics.objectiveLoss < best.metrics.objectiveLoss) {
          best = candidate;
          bestValue = value;
        }
      }

      if (bestValue !== oldValue && objectiveImproved(best, current)) {
        params[variableName] = bestValue;
        current = best;
        state.values.push(bestValue);
        state.noChangeRounds = 0;
        changedThisPass = true;
        appendParameterHistory(event, pass, variableName, oldValue, bestValue, 'changed', 'objective-improved', current);
        appendFileSync(ledgerPath, `- Pass ${pass}: ${variableName} changed ${oldValue} -> ${bestValue}; objective ${current.metrics.objectiveLoss}.\n`);
      } else {
        state.noChangeRounds += 1;
        state.step = round(state.step / 2);
        state.values.push(oldValue);
        appendParameterHistory(event, pass, variableName, oldValue, oldValue, 'held', 'no-objective-improvement', current);
        appendFileSync(ledgerPath, `- Pass ${pass}: ${variableName} held at ${oldValue}; step now ${state.step}.\n`);
      }

      const stabilizedValue = detectOscillation(state.values);
      if (stabilizedValue !== null) {
        params[variableName] = clamp(stabilizedValue, def.min, def.max);
        state.status = 'stabilized';
        appendParameterHistory(event, pass, variableName, oldValue, params[variableName], 'stabilized', 'oscillation-or-tight-range', current);
      } else if (state.step <= def.minStep || state.noChangeRounds >= 2) {
        state.status = 'converged';
        appendParameterHistory(event, pass, variableName, oldValue, params[variableName], 'converged', 'step-or-no-change-threshold', current);
      }
    }
    if (!changedThisPass && selectedVariableNames.every(name => variableState[name].status !== 'active')) break;
  }

  const final = runReplayWithCachedHtml(params, 'final');
  appendRunArtifacts(event, { kind: 'event-final', result: final, variableState, finalParameters: params });
  appendFileSync(
    ledgerPath,
    `- Final objective ${final.metrics.objectiveLoss}, winner ${final.metrics.winnerAccuracy}, Brier ${final.metrics.brierScore}, score MAE ${final.metrics.scoreMae}, margin MAE ${final.metrics.marginMae}.\n` +
      `- Final parameters: ${JSON.stringify(params)}\n` +
      `- Variable status: ${JSON.stringify(Object.fromEntries(selectedVariableNames.map(name => [name, variableState[name].status])))}\n`
  );
  return { event, final, params };
};

const contractPath = path.join(tuningRoot, 'variable-contract.md');
writeFileSync(
  contractPath,
  `# SFT Tuning Variable Contract\n\n## Independent Variables\n\n${Object.entries(independentVariables)
    .map(([name, variable]) => `- \`${name}\`: default \`${variable.default}\`, range \`${variable.min}-${variable.max}\`, selected \`${variable.selected}\`. ${variable.reason}`)
    .join('\n')}\n\n## Dependent Variables\n\n${Object.entries(dependentVariables)
    .map(([name, description]) => `- \`${name}\`: ${description}`)
    .join('\n')}\n`
);

const events = await chooseEvents();
const completed = [];
for (const event of events) {
  if (completed.length >= eventCount) break;
  try {
    completed.push(await tuneEvent(event));
  } catch (error) {
    appendJsonl(runsJsonlPath, {
      recordedAt: new Date().toISOString(),
      tuningRunId,
      kind: 'event-failed',
      eventKey: event.eventKey,
      eventName: event.eventName,
      error: String(error?.message ?? error).slice(0, 1000)
    });
    appendFileSync(ledgerPath, `- Event ${event.eventKey} failed: ${String(error?.message ?? error).slice(0, 300)}\n`);
  }
}

const allVariableStatuses = Object.fromEntries(selectedVariableNames.map(name => [name, variableState[name].status]));
const summary = {
  tuningRunId,
  season,
  selectedVariables: selectedVariableNames,
  allIndependentVariables: Object.keys(independentVariables),
  dependentVariables: Object.keys(dependentVariables),
  completedEvents: completed.map(item => ({
    eventKey: item.event.eventKey,
    eventName: item.final.eventName,
    outputDir: item.final.outputDir,
    objectiveLoss: item.final.metrics.objectiveLoss,
    winnerAccuracy: item.final.metrics.winnerAccuracy,
    brierScore: item.final.metrics.brierScore,
    finalParameters: item.params
  })),
  variableStatuses: allVariableStatuses,
  converged: selectedVariableNames.every(name => ['converged', 'stabilized'].includes(variableState[name].status)),
  ledgers: {
    tuningLedger: ledgerPath,
    tuningRunsJsonl: runsJsonlPath,
    eventResultsCsv: eventResultsPath,
    parameterHistoryCsv: parameterHistoryPath,
    variableContract: contractPath
  },
  githubSync: {
    status: 'ready-but-not-pushed',
    reason: 'Pushing to GitHub exports data outside this workspace and requires fresh authorization.'
  }
};

writeFileSync(path.join(runRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(
  path.join(runRoot, 'summary.md'),
  `# ${tuningRunId}\n\nCompleted events: ${summary.completedEvents.map(event => event.eventKey).join(', ')}\n\nConverged: ${summary.converged}\n\nVariable statuses:\n${Object.entries(allVariableStatuses)
    .map(([name, status]) => `- ${name}: ${status}`)
    .join('\n')}\n\nGitHub sync: ${summary.githubSync.status} - ${summary.githubSync.reason}\n`
);

console.log(JSON.stringify(summary, null, 2));
