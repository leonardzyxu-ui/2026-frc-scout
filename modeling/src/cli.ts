import path from 'node:path';
import dotenv from 'dotenv';
import { ResearchStore, DEFAULT_MODELING_DB_PATH } from './data/store.ts';
import {
  importLocalBackup,
  ingestFirebase,
  ingestFirst,
  ingestStatbotics,
  ingestStatboticsMatches,
  ingestTba
} from './data/ingest.ts';
import { buildSyntheticResearchData } from './data/synthetic.ts';
import { buildWalkForwardDataset, summarizeDataset } from './modeling/features.ts';
import { candidateModelConfigs, runModelSearch } from './modeling/train.ts';
import { writeRunArtifacts } from './reporting/report.ts';
import { getBooleanFlag, getNumberFlag, getStringFlag, parseArgs } from './util.ts';

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
  npm run model:ingest:statbotics-matches -- --year 2025 --limit-matches 1000
  npm run model:ingest:statbotics -- --event 2026mnum
  npm run model:ingest:firebase
  npm run model:train -- --event 2026mnum
  npm run model:train -- --year 2026 --model-filter "Monte Carlo,Online EPA K=1.20,Published"
  npm run model:report

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

const trainFromStore = (
  store: ResearchStore,
  options: { eventKey?: string; season?: number; outputDir?: string; modelFilter?: string }
) => {
  const matches = store.getMatches({ eventKey: options.eventKey, season: options.season });
  const observations = store.getScoutingObservations();
  const statboticsSignals = store.getStatboticsSignals();
  const dataset = buildWalkForwardDataset(matches, observations, statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: statboticsSignals.length > 0
  });
  const summary = summarizeDataset(dataset);
  console.log(`Dataset: ${summary.matches} matches, ${summary.rows} alliance rows, ${summary.features} features.`);
  console.log(`Scout-enriched rows: ${summary.scoutEnrichedRows}; role-defense rows: ${summary.roleDefenseRows}.`);

  if (dataset.rows.length < 20) {
    throw new Error('Not enough cached match rows to train. Ingest TBA/FIRST data or run npm run model:demo first.');
  }

  const filters = (options.modelFilter ?? '')
    .split(',')
    .map(filter => filter.trim().toLowerCase())
    .filter(Boolean);
  const configs =
    filters.length === 0
      ? candidateModelConfigs
      : candidateModelConfigs.filter(config => filters.some(filter => config.name.toLowerCase().includes(filter)));
  if (configs.length === 0) {
    throw new Error(`No model configs matched --model-filter "${options.modelFilter}".`);
  }
  if (filters.length > 0) {
    console.log(`Focused benchmark: ${configs.length} model config(s) matched --model-filter.`);
  }

  const run = runModelSearch(dataset, configs);
  store.saveResearchRun(run);
  const outputDir = writeRunArtifacts(run, options.outputDir);
  console.log(`Best model: ${run.bestModelName ?? 'none promoted yet'}`);
  run.modelResults.slice(0, 5).forEach(result => {
    console.log(
      `${result.promoted ? '[PROMOTED]' : '[review]'} #${result.benchmarkRank} ${result.config.name}: benchmark ${result.benchmarkScore.toFixed(
        3
      )}, score MAE ${result.scoreMae.toFixed(
        2
      )}, margin MAE ${result.marginMae.toFixed(2)}, Brier ${result.winBrier.toFixed(4)}`
    );
    if (result.rejectionReasons.length > 0) {
      console.log(`  Rejections: ${result.rejectionReasons.join('; ')}`);
    }
  });
  console.log(`Artifacts: ${outputDir}`);
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

    if (command === 'train') {
      trainFromStore(store, {
        eventKey: getStringFlag(flags, 'event') || undefined,
        season: Number.isFinite(getNumberFlag(flags, 'year', Number.NaN)) ? getNumberFlag(flags, 'year', Number.NaN) : undefined,
        outputDir: getStringFlag(flags, 'output-dir') || undefined,
        modelFilter: getStringFlag(flags, 'model-filter') || undefined
      });
      return;
    }

    if (command === 'report') {
      const run = store.getLatestResearchRun();
      if (!run) throw new Error('No research run found. Run npm run model:train first.');
      const outputDir = writeRunArtifacts(run, getStringFlag(flags, 'output-dir') || undefined);
      console.log(`Report artifacts: ${outputDir}`);
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
