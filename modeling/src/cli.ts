import path from 'node:path';
import dotenv from 'dotenv';
import { auditEventMetadataCoverage } from './audits/eventMetadataCoverage.ts';
import { auditLocalBackupInventory } from './audits/localBackupInventory.ts';
import { auditScoutCoverage } from './audits/scoutCoverage.ts';
import { auditStatboticsPredictionProvenance } from './audits/statboticsPredictionProvenance.ts';
import { ResearchStore, DEFAULT_MODELING_DB_PATH } from './data/store.ts';
import {
  importLocalBackup,
  ingestFirebase,
  ingestFirst,
  ingestStatbotics,
  ingestStatboticsEvents,
  ingestStatboticsMatches,
  ingestTba
} from './data/ingest.ts';
import { buildSyntheticResearchData } from './data/synthetic.ts';
import { buildWalkForwardDataset, summarizeDataset } from './modeling/features.ts';
import { candidateModelConfigs, runModelSearch } from './modeling/train.ts';
import { refreshDashboardBrowserQa } from './reporting/browserQaDashboard.ts';
import { writeJudgeDashboardArtifacts } from './reporting/judgeDashboard.ts';
import { writeCrossRunSummaryArtifacts, writeResidualDiagnosticArtifacts, writeRunArtifacts } from './reporting/report.ts';
import { verifyJudgeDashboardArtifacts } from './reporting/verifyDashboard.ts';
import type { EventKeyHashFilter, ExperimentManifest, FeatureRow, ModelConfig } from './types.ts';
import { getBooleanFlag, getNumberFlag, getStringFlag, parseArgs, readJsonFile, stableStringHash } from './util.ts';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const usage = () => {
  console.log(`Offline FIRST match modeling commands

  npm run model:init
  npm run model:demo
  npm run model:import -- --file path/to/admin-backup.json
  npm run model:ingest:tba -- --year 2026 --event 2026mnum
  npm run model:ingest:tba -- --start-year 2024 --end-year 2026 --limit-events 5
  npm run model:ingest:first -- --year 2026 --event-code MNUM
  npm run model:ingest:statbotics-events -- --start-year 2024 --end-year 2026
  npm run model:ingest:statbotics-matches -- --year 2025 --limit-matches 1000
  npm run model:ingest:statbotics -- --event 2026mnum
  npm run model:ingest:firebase
  npm run model:audit:statbotics-predictions
  npm run model:audit:scout-coverage
  npm run model:audit:event-metadata
  npm run model:audit:local-backups -- --paths .playwright-cli
  npm run model:train -- --event 2026mnum
  npm run model:train -- --year 2026 --model-filter "Monte Carlo,Online EPA K=1.20,Published"
  npm run model:train -- --manifest modeling/experiments/current-2026-archetype.json
  npm run model:report
  npm run model:report -- --run-dirs modeling/artifacts/runs/run-a,modeling/artifacts/runs/run-b
  npm run model:diagnose -- --run-dirs modeling/artifacts/runs/run-a,modeling/artifacts/runs/run-b
  npm run model:dashboard
  npm run model:qa-dashboard
  npm run model:verify-dashboard

Credentials come from .env.local / environment:
  MODEL_TBA_API_KEY or VITE_TBA_API_KEY
  FIRST_EVENTS_USERNAME and FIRST_EVENTS_AUTH_TOKEN
  MODEL_FIREBASE_PROJECT_ID and MODEL_FIREBASE_ACCESS_TOKEN
`);
};

const getDbPath = (command: string, flags: Record<string, string | boolean>) => {
  const fromFlag = getStringFlag(flags, 'db');
  if (fromFlag) return path.resolve(fromFlag);
  if (command === 'demo') return path.resolve('modeling/artifacts/demo/research.sqlite');
  return DEFAULT_MODELING_DB_PATH;
};

const hashBucket = (value: string, modulus: number) => stableStringHash(value) % modulus;

const buildEvaluationFilter = (filter: EventKeyHashFilter | undefined) => {
  if (!filter) return { predicate: undefined, description: undefined };
  const buckets = new Set(filter.buckets);
  const description = `${filter.label ? `${filter.label}: ` : ''}event-key hash bucket(s) ${filter.buckets.join(
    ','
  )} of ${filter.modulus}`;
  return {
    predicate: (row: FeatureRow) => buckets.has(hashBucket(row.eventKey, filter.modulus)),
    description
  };
};

const trainFromStore = (
  store: ResearchStore,
  options: {
    eventKey?: string;
    season?: number;
    outputDir?: string;
    modelFilter?: string;
    modelNames?: string[];
    experimentManifest?: ExperimentManifest;
  }
) => {
  const matches = store.getMatches({ eventKey: options.eventKey, season: options.season });
  const observations = store.getScoutingObservations();
  const statboticsSignals = store.getStatboticsSignals();
  const eventMetadata = store.getEventMetadata({ eventKey: options.eventKey, season: options.season });
  const dataset = buildWalkForwardDataset(matches, observations, statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: statboticsSignals.length > 0
  }, eventMetadata);
  const summary = summarizeDataset(dataset);
  console.log(`Dataset: ${summary.matches} matches, ${summary.rows} alliance rows, ${summary.features} features.`);
  console.log(
    `Scout-enriched rows: ${summary.scoutEnrichedRows}; role-defense rows: ${summary.roleDefenseRows}; event metadata rows: ${summary.eventMetadataRows}.`
  );
  const evaluationFilter = buildEvaluationFilter(options.experimentManifest?.evaluationEventKeyHashFilter);
  const evaluationRows = evaluationFilter.predicate ? dataset.rows.filter(evaluationFilter.predicate) : dataset.rows;
  const evaluationMatchCount = new Set(evaluationRows.map(row => row.matchKey)).size;
  if (evaluationFilter.description) {
    console.log(`Evaluation filter: ${evaluationFilter.description}.`);
    console.log(`Evaluation subset: ${evaluationMatchCount} matches, ${evaluationRows.length} alliance rows.`);
  }

  if (dataset.rows.length < 20) {
    throw new Error('Not enough cached match rows to train. Ingest TBA/FIRST data or run npm run model:demo first.');
  }
  if (evaluationRows.length < 20) {
    throw new Error('Not enough evaluation rows after manifest filtering. Widen the holdout bucket or ingest more matches.');
  }

  const filters = (options.modelFilter ?? '')
    .split(',')
    .map(filter => filter.trim().toLowerCase())
    .filter(Boolean);
  const configs = resolveModelConfigs({ filters, modelNames: options.modelNames });
  if (configs.length === 0) {
    throw new Error(`No model configs matched the requested experiment.`);
  }
  if ((options.modelNames?.length ?? 0) > 0) {
    console.log(`Exact benchmark: ${configs.length} model config(s) loaded from manifest.`);
  } else if (filters.length > 0) {
    console.log(`Focused benchmark: ${configs.length} model config(s) matched --model-filter.`);
  }

  console.log(`Evaluating ${configs.length} model config(s) with walk-forward replay...`);
  const run = runModelSearch(dataset, configs, {
    evaluationRowFilter: evaluationFilter.predicate,
    extraNotes: [
      ...(evaluationFilter.description
        ? [
            `Evaluation metrics are restricted to ${evaluationFilter.description}. Walk-forward state updates still use all selected dataset rows before each predicted match.`
          ]
        : [])
    ],
    onModelResult: (result, index, total) => {
      console.log(
        `[${index}/${total}] ${result.config.name}: score MAE ${result.scoreMae.toFixed(2)}, margin MAE ${result.marginMae.toFixed(
          2
        )}, Brier ${result.winBrier.toFixed(4)}, worst event ${result.worstEventScoreMae.toFixed(2)}`
      );
    }
  });
  try {
    store.saveResearchRun(run);
  } catch (error) {
    console.warn(
      `Warning: model replay completed, but saving the compact run to SQLite failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const outputDir = writeRunArtifacts(run, options.outputDir, { experimentManifest: options.experimentManifest });
  console.log(`Best model: ${run.bestModelName ?? 'none promoted yet'}`);
  run.modelResults.slice(0, 5).forEach(result => {
    console.log(
      `${result.promoted ? '[PROMOTED]' : '[review]'} #${result.benchmarkRank} ${result.config.name}: benchmark ${result.benchmarkScore.toFixed(
        3
      )}, fixed ${result.fixedBenchmarkScore.toFixed(
        3
      )}, score MAE ${result.scoreMae.toFixed(
        2
      )}, margin MAE ${result.marginMae.toFixed(2)}, Brier ${result.winBrier.toFixed(4)}`
    );
    if (result.promotionConfidence !== 'not_promoted') {
      console.log(`  Promotion confidence: ${result.promotionConfidence}`);
    }
    if (result.promotionNotes.length > 0) {
      console.log(`  Promotion notes: ${result.promotionNotes.join('; ')}`);
    }
    if (result.rejectionReasons.length > 0) {
      console.log(`  Rejections: ${result.rejectionReasons.join('; ')}`);
    }
  });
  console.log(`Artifacts: ${outputDir}`);
};

const resolveModelConfigs = ({ filters, modelNames }: { filters: string[]; modelNames?: string[] }): ModelConfig[] => {
  if (modelNames && modelNames.length > 0) {
    const configsByName = new Map(candidateModelConfigs.map(config => [config.name, config]));
    const missing = modelNames.filter(name => !configsByName.has(name));
    if (missing.length > 0) {
      throw new Error(`Manifest references unknown model config(s): ${missing.join('; ')}`);
    }
    const seen = new Set<string>();
    return modelNames.flatMap(name => {
      if (seen.has(name)) return [];
      seen.add(name);
      const config = configsByName.get(name);
      return config ? [config] : [];
    });
  }

  return filters.length === 0
    ? candidateModelConfigs
    : candidateModelConfigs.filter(config => filters.some(filter => config.name.toLowerCase().includes(filter)));
};

const loadExperimentManifest = (filePath: string): ExperimentManifest => {
  const manifest = readJsonFile<ExperimentManifest>(path.resolve(filePath));
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error(`Experiment manifest ${filePath} must include a string "name".`);
  }
  if (!Array.isArray(manifest.modelNames) || manifest.modelNames.length === 0) {
    throw new Error(`Experiment manifest ${filePath} must include at least one exact model name in "modelNames".`);
  }
  if (manifest.year != null && !Number.isFinite(manifest.year)) {
    throw new Error(`Experiment manifest ${filePath} has an invalid "year".`);
  }
  if (manifest.evaluationEventKeyHashFilter) {
    const filter = manifest.evaluationEventKeyHashFilter;
    if (!Number.isInteger(filter.modulus) || filter.modulus < 2) {
      throw new Error(`Experiment manifest ${filePath} has an invalid evaluationEventKeyHashFilter.modulus.`);
    }
    if (!Array.isArray(filter.buckets) || filter.buckets.length === 0) {
      throw new Error(`Experiment manifest ${filePath} must include at least one evaluationEventKeyHashFilter bucket.`);
    }
    filter.buckets.forEach(bucket => {
      if (!Number.isInteger(bucket) || bucket < 0 || bucket >= filter.modulus) {
        throw new Error(`Experiment manifest ${filePath} has invalid evaluationEventKeyHashFilter bucket ${bucket}.`);
      }
    });
  }
  return manifest;
};

const parsePathList = (flags: Record<string, string | boolean>) => {
  const rawPaths = getStringFlag(flags, 'paths') || getStringFlag(flags, 'path');
  return rawPaths
    .split(',')
    .map(source => source.trim())
    .filter(Boolean);
};

const runTbaIngest = async (store: ResearchStore, flags: Record<string, string | boolean>) => {
  const eventKey = getStringFlag(flags, 'event');
  const year = getNumberFlag(flags, 'year', new Date().getFullYear());
  const startYear = getNumberFlag(flags, 'start-year', year);
  const endYear = getNumberFlag(flags, 'end-year', year);
  const limitEvents = getNumberFlag(flags, 'limit-events', Number.POSITIVE_INFINITY);
  let totalEvents = 0;
  let totalMatches = 0;

  if (eventKey) {
    const result = await ingestTba(store, { eventKey, year });
    console.log(`TBA ingested ${result.matches} matches from ${result.events} event.`);
    return;
  }

  for (let season = startYear; season <= endYear; season += 1) {
    const result = await ingestTba(store, { year: season, limitEvents });
    totalEvents += result.events;
    totalMatches += result.matches;
    console.log(`TBA ${season}: ${result.events} events, ${result.matches} matches.`);
  }
  console.log(`TBA total: ${totalEvents} events, ${totalMatches} matches.`);
};

const runFirstIngest = async (store: ResearchStore, flags: Record<string, string | boolean>) => {
  const eventCode = getStringFlag(flags, 'event-code');
  const year = getNumberFlag(flags, 'year', new Date().getFullYear());
  const startYear = getNumberFlag(flags, 'start-year', year);
  const endYear = getNumberFlag(flags, 'end-year', year);
  const limitEvents = getNumberFlag(flags, 'limit-events', Number.POSITIVE_INFINITY);
  let totalEvents = 0;
  let totalMatches = 0;

  for (let season = startYear; season <= endYear; season += 1) {
    const result = await ingestFirst(store, { year: season, eventCode, limitEvents });
    totalEvents += result.events;
    totalMatches += result.matches;
    console.log(`FIRST ${season}: ${result.events} events, ${result.matches} matches.`);
    if (eventCode) break;
  }
  console.log(`FIRST total: ${totalEvents} events, ${totalMatches} matches.`);
};

const main = async () => {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const command = positionals[0] ?? 'help';

  if (command === 'help' || getBooleanFlag(flags, 'help')) {
    usage();
    return;
  }

  if (command === 'audit:local-backups') {
    const audit = auditLocalBackupInventory(parsePathList(flags), getStringFlag(flags, 'output-dir') || undefined);
    console.log(
      `Local backup inventory: ${audit.parsedFiles}/${audit.jsonFilesFound} JSON file(s) parsed; ${audit.skippedSensitiveName} sensitive-looking filename(s) skipped.`
    );
    console.log(
      `Importable match/defense records: ${audit.totalImportableMatchRecords}; defense records: ${audit.totalDefenseRecords}; pit records: ${audit.totalPitRecords}.`
    );
    console.log(`Audit artifacts: ${path.resolve(getStringFlag(flags, 'output-dir') || 'modeling/artifacts/audits/local-backup-inventory')}`);
    return;
  }

  if (command === 'verify-dashboard') {
    const result = verifyJudgeDashboardArtifacts(getStringFlag(flags, 'output-dir') || undefined);
    const errors = result.issues.filter(issue => issue.severity === 'error');
    const warnings = result.issues.filter(issue => issue.severity === 'warning');
    console.log(
      `Dashboard verification: ${errors.length === 0 ? 'PASS' : 'FAIL'}; ${result.checkedFiles} files, ${
        result.checkedStrings
      } strings, ${result.checkedMarkdownFiles} markdown files, ${result.checkedManifestPaths} manifest paths, ${
        result.checkedReferencePaths
      } reference paths, ${result.checkedAnchorTargets} anchor targets, ${result.checkedBrowserQaSummaries} browser QA summaries, ${result.checkedFreshnessRules} freshness rules, ${
        result.checkedFingerprints
      } fingerprints, ${result.checkedScreenshots} screenshots, ${result.checkedScreenshotDimensions} screenshot dimension checks.`
    );
    if (warnings.length > 0) console.log(`Warnings: ${warnings.length}`);
    console.log(`Verification summary: ${result.summaryPath}`);
    if (errors.length > 0) {
      errors.forEach(issue => console.error(`ERROR: ${issue.message}`));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'qa-dashboard') {
    const summary = await refreshDashboardBrowserQa({
      outputDir: getStringFlag(flags, 'output-dir') || undefined,
      host: getStringFlag(flags, 'host') || undefined,
      port: getNumberFlag(flags, 'port', 4177),
      chromePath: getStringFlag(flags, 'chrome') || undefined
    });
    const missingBodyText = summary.desktopCheck.missingText.length + summary.mobileCheck.missingText.length;
    const missingHeaderText = summary.desktopCheck.missingHeaderText.length + summary.mobileCheck.missingHeaderText.length;
    const forbiddenMatches = summary.desktopCheck.forbiddenMatches.length + summary.mobileCheck.forbiddenMatches.length;
    const outsideTableOffenders =
      summary.desktopCheck.outsideTableOffenders.length + summary.mobileCheck.outsideTableOffenders.length;
    const pageOverflow = summary.desktopCheck.pageOverflow || summary.mobileCheck.pageOverflow;
    console.log(
      `Dashboard browser QA: ${missingBodyText} missing body text, ${missingHeaderText} missing header text, ${forbiddenMatches} forbidden matches, ${outsideTableOffenders} outside-table offender(s), ${
        pageOverflow ? 'overflow detected' : 'no page overflow'
      }, ${summary.consoleIssues.length} console issue(s), ${summary.pageErrors.length} page error(s).`
    );
    console.log(
      `Screenshots: ${summary.screenshots.map(screenshotPath => path.relative(process.cwd(), screenshotPath)).join(', ')}`
    );
    console.log(`Browser QA summary: ${path.relative(process.cwd(), path.join(path.resolve(getStringFlag(flags, 'output-dir') || 'modeling/artifacts/reports/final-judge-dashboard'), 'browser-qa-summary.json'))}`);
    if (
      missingBodyText > 0 ||
      missingHeaderText > 0 ||
      forbiddenMatches > 0 ||
      outsideTableOffenders > 0 ||
      pageOverflow ||
      summary.consoleIssues.length > 0 ||
      summary.pageErrors.length > 0
    ) {
      console.error('ERROR: Dashboard browser QA failed. Inspect browser-qa-summary.json for the exact missing text, overflow offenders, console issues, or page errors.');
      process.exitCode = 1;
    }
    return;
  }

  const store = new ResearchStore(getDbPath(command, flags));
  try {
    if (command === 'init') {
      console.log(`Initialized modeling cache at ${getDbPath(command, flags)}`);
      return;
    }

    if (command === 'demo') {
      const synthetic = buildSyntheticResearchData({
        seasons: [2024, 2025, 2026],
        eventsPerSeason: getNumberFlag(flags, 'events-per-season', 3),
        teamsPerEvent: getNumberFlag(flags, 'teams-per-event', 24),
        matchesPerEvent: getNumberFlag(flags, 'matches-per-event', 36)
      });
      store.upsertMatches(synthetic.matches);
      store.upsertScoutingObservations(synthetic.observations);
      store.upsertStatboticsSignals(synthetic.statboticsSignals);
      console.log(
        `Synthetic cache: ${synthetic.matches.length} matches, ${synthetic.observations.length} scout observations, ${synthetic.statboticsSignals.length} Statbotics-like signals.`
      );
      trainFromStore(store, { outputDir: path.resolve('modeling/artifacts/demo/latest-run') });
      return;
    }

    if (command === 'import') {
      const file = getStringFlag(flags, 'file') || positionals[1];
      if (!file) throw new Error('Provide --file path/to/backup.json');
      const result = importLocalBackup(store, file);
      console.log(`Imported ${result.matches} matches and ${result.observations} scouting observations from ${file}`);
      return;
    }

    if (command === 'ingest:tba') {
      await runTbaIngest(store, flags);
      return;
    }

    if (command === 'ingest:first') {
      await runFirstIngest(store, flags);
      return;
    }

    if (command === 'ingest:statbotics') {
      const result = await ingestStatbotics(store, {
        eventKey: getStringFlag(flags, 'event') || undefined,
        season: Number.isFinite(getNumberFlag(flags, 'year', Number.NaN)) ? getNumberFlag(flags, 'year', Number.NaN) : undefined,
        limitTeams: getNumberFlag(flags, 'limit-teams', Number.POSITIVE_INFINITY)
      });
      console.log(`Statbotics ingested ${result.teams} team signals.`);
      return;
    }

    if (command === 'ingest:statbotics-events') {
      const result = await ingestStatboticsEvents(store, {
        eventKey: getStringFlag(flags, 'event') || undefined,
        year: Number.isFinite(getNumberFlag(flags, 'year', Number.NaN)) ? getNumberFlag(flags, 'year', Number.NaN) : undefined,
        startYear: Number.isFinite(getNumberFlag(flags, 'start-year', Number.NaN)) ? getNumberFlag(flags, 'start-year', Number.NaN) : undefined,
        endYear: Number.isFinite(getNumberFlag(flags, 'end-year', Number.NaN)) ? getNumberFlag(flags, 'end-year', Number.NaN) : undefined,
        limitEvents: getNumberFlag(flags, 'limit-events', Number.POSITIVE_INFINITY)
      });
      console.log(`Statbotics event ingest cached ${result.events} events across ${result.years} year(s).`);
      return;
    }

    if (command === 'ingest:statbotics-matches') {
      const result = await ingestStatboticsMatches(store, {
        eventKey: getStringFlag(flags, 'event') || undefined,
        year: Number.isFinite(getNumberFlag(flags, 'year', Number.NaN)) ? getNumberFlag(flags, 'year', Number.NaN) : undefined,
        startYear: Number.isFinite(getNumberFlag(flags, 'start-year', Number.NaN)) ? getNumberFlag(flags, 'start-year', Number.NaN) : undefined,
        endYear: Number.isFinite(getNumberFlag(flags, 'end-year', Number.NaN)) ? getNumberFlag(flags, 'end-year', Number.NaN) : undefined,
        limitMatches: getNumberFlag(flags, 'limit-matches', 1000)
      });
      console.log(`Statbotics match ingest cached ${result.matches} completed matches across ${result.years} year(s).`);
      return;
    }

    if (command === 'ingest:firebase') {
      const result = await ingestFirebase(store, {
        projectId: getStringFlag(flags, 'project-id') || undefined,
        accessToken: getStringFlag(flags, 'access-token') || undefined
      });
      console.log(`Firebase ingested ${result.observations} scouting observations.`);
      return;
    }

    if (command === 'audit:statbotics-predictions') {
      const audit = auditStatboticsPredictionProvenance(store, getStringFlag(flags, 'output-dir') || undefined);
      console.log(
        `Statbotics prediction audit: ${audit.matchesWithPredictions} prediction row(s), ${audit.matchesWithSpecificPredictionTimestamp} with prediction-specific timestamps.`
      );
      console.log(`Recommendation: ${audit.promotionRecommendation} (${audit.riskLevel} risk).`);
      return;
    }

    if (command === 'audit:scout-coverage') {
      const audit = auditScoutCoverage(store, getStringFlag(flags, 'output-dir') || undefined);
      console.log(
        `Scout coverage audit: ${audit.scoutingObservations} observation(s), ${audit.matchedObservations} matched to official match/team rows.`
      );
      console.log(`Observation match coverage: ${(audit.observationMatchCoverage * 100).toFixed(1)}%.`);
      return;
    }

    if (command === 'audit:event-metadata') {
      const audit = auditEventMetadataCoverage(store, getStringFlag(flags, 'output-dir') || undefined);
      console.log(
        `Event metadata audit: ${audit.officialEventsWithMetadata}/${audit.officialEvents} official event(s) have metadata.`
      );
      console.log(`Official event coverage: ${(audit.officialEventCoverage * 100).toFixed(1)}%.`);
      return;
    }

    if (command === 'train') {
      const manifestPath = getStringFlag(flags, 'manifest') || undefined;
      const manifest = manifestPath ? loadExperimentManifest(manifestPath) : undefined;
      trainFromStore(store, {
        eventKey: manifest?.eventKey ?? (getStringFlag(flags, 'event') || undefined),
        season:
          manifest?.year ??
          (Number.isFinite(getNumberFlag(flags, 'year', Number.NaN)) ? getNumberFlag(flags, 'year', Number.NaN) : undefined),
        outputDir: manifest?.outputDir ?? (getStringFlag(flags, 'output-dir') || undefined),
        modelFilter: manifest ? undefined : getStringFlag(flags, 'model-filter') || undefined,
        modelNames: manifest?.modelNames,
        experimentManifest: manifest
      });
      return;
    }

    if (command === 'report') {
      const runDirs = getStringFlag(flags, 'run-dirs') || getStringFlag(flags, 'runs');
      if (runDirs) {
        const outputDir = writeCrossRunSummaryArtifacts(
          runDirs
            .split(',')
            .map(source => source.trim())
            .filter(Boolean),
          getStringFlag(flags, 'output-dir') || undefined
        );
        console.log(`Cross-run report artifacts: ${outputDir}`);
        return;
      }
      const run = store.getLatestResearchRun();
      if (!run) throw new Error('No research run found. Run npm run model:train first.');
      const outputDir = writeRunArtifacts(run, getStringFlag(flags, 'output-dir') || undefined);
      console.log(`Report artifacts: ${outputDir}`);
      return;
    }

    if (command === 'diagnose') {
      const runDirs = getStringFlag(flags, 'run-dirs') || getStringFlag(flags, 'runs');
      if (!runDirs) throw new Error('Provide --run-dirs with one or more run directories or run.json files.');
      const outputDir = writeResidualDiagnosticArtifacts(
        runDirs
          .split(',')
          .map(source => source.trim())
          .filter(Boolean),
        getStringFlag(flags, 'output-dir') || undefined
      );
      console.log(`Residual diagnostic artifacts: ${outputDir}`);
      return;
    }

    if (command === 'dashboard') {
      const outputDir = writeJudgeDashboardArtifacts({
        summaryDir: getStringFlag(flags, 'summary-dir') || undefined,
        bestRunDir: getStringFlag(flags, 'best-run-dir') || undefined,
        outputDir: getStringFlag(flags, 'output-dir') || undefined,
        researchLogPath: getStringFlag(flags, 'research-log') || undefined,
        reportsRoot: getStringFlag(flags, 'reports-root') || undefined
      });
      console.log(`Judge dashboard artifacts: ${outputDir}`);
      return;
    }

    usage();
    throw new Error(`Unknown command: ${command}`);
  } finally {
    store.close();
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
