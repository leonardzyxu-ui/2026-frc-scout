#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasFlag = name => args.includes(name);

const season = Number(getArg('--season', '2026'));
const eventKeysArg = getArg('--event-keys', '');
const limit = Number(getArg('--limit', eventKeysArg ? '999' : '6'));
const minMatches = Number(getArg('--min-matches', '30'));
const artifactRoot = path.resolve(getArg('--artifact-root', 'SyntheticFullSystemTest/artifacts'));
const catalogPath = path.join(artifactRoot, 'agentic-event-replay-catalog.jsonl');
const summaryPath = path.join(artifactRoot, 'agentic-event-replay-catalog-summary.json');
const replayScript = path.resolve('SyntheticFullSystemTest/scripts/real-event-replay.mjs');
const eventListUrl = getArg('--events-url', `https://www.thebluealliance.com/events/${season}`);
const includeExisting = hasFlag('--include-existing');

mkdirSync(artifactRoot, { recursive: true });

const stableHash = value => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

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

const loadText = async url => {
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

const existingAgenticSuccesses = () => {
  const successes = new Map();
  for (const entry of readdirSync(artifactRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('sft-real-')) continue;
    const summary = readJsonIfExists(path.join(artifactRoot, entry.name, 'run-summary.json'));
    if (
      summary?.eventKey &&
      summary.scoutSimulationMode === 'agentic-score-consistent' &&
      summary.gates?.noFutureLeakage === 'passed' &&
      summary.gates?.scoutCoverage === 'passed' &&
      summary.gates?.scoreConsistency === 'passed'
    ) {
      successes.set(summary.eventKey, {
        eventKey: summary.eventKey,
        eventName: summary.eventName,
        sourceUrl: summary.sourceUrl,
        runId: summary.runId,
        outputDir: summary.outputDir,
        pretendOwnTeam: summary.pretendOwnTeam,
        ownTeamLabel: summary.ownTeamLabel,
        counts: summary.counts,
        gates: summary.gates,
        metrics: summary.metrics,
        totalMatches: summary.counts?.totalMatches ?? 0
      });
    }
  }
  if (existsSync(catalogPath)) {
    for (const line of readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean)) {
      try {
        const entry = JSON.parse(line);
        if (entry.status === 'success' && entry.eventKey) {
          successes.set(entry.eventKey, {
            eventKey: entry.eventKey,
            eventName: entry.eventName,
            sourceUrl: entry.sourceUrl,
            runId: entry.runId,
            outputDir: entry.outputDir,
            pretendOwnTeam: entry.pretendOwnTeam,
            ownTeamLabel: entry.ownTeamLabel,
            counts: entry.counts,
            gates: entry.gates,
            metrics: entry.metrics,
            totalMatches: entry.counts?.totalMatches ?? 0
          });
        }
      } catch {
        // Ignore corrupt local catalog lines.
      }
    }
  }
  return successes;
};

const requiredArtifacts = [
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
];

const manifestFor = event => {
  const seed = stableHash(`agentic:${event.eventKey}`);
  return {
    schemaVersion: 1,
    simulation: {
      name: `${event.eventKey}-agentic-score-consistent-replay`,
      mode: 'public-real-event',
      scoutMode: 'agentic-score-consistent',
      seed,
      description: `Agentic score-consistent scout replay for ${event.eventName || event.eventKey}.`
    },
    fixture: {
      eventKey: event.eventKey,
      season,
      eventName: event.eventName || event.eventKey,
      sourceUrl: event.sourceUrl,
      excludedTeamKeys: [],
      pretendOwnTeamPolicy: {
        strategy: 'seeded-random-participant',
        seed
      }
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
      requiredArtifacts
    },
    artifacts: {
      root: 'SyntheticFullSystemTest/artifacts',
      keepGeneratedOutOfGit: true
    }
  };
};

const appendCatalog = entry => {
  appendFileSync(catalogPath, `${JSON.stringify({ recordedAt: new Date().toISOString(), ...entry })}\n`);
};

const writeSummary = (batchEntries, knownSuccesses) => {
  const allEntries = existsSync(catalogPath)
    ? readFileSync(catalogPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];
  const successes = allEntries.filter(entry => entry.status === 'success');
  const knownAgenticSuccesses = [...knownSuccesses.values()].sort((a, b) => a.eventKey.localeCompare(b.eventKey));
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        artifactRoot,
        catalogPath,
        totalEntries: allEntries.length,
        successes: successes.length,
        failures: allEntries.filter(entry => entry.status === 'failed').length,
        skipped: allEntries.filter(entry => entry.status === 'skipped').length,
        knownAgenticSuccesses: knownAgenticSuccesses.length,
        latestBatch: batchEntries,
        successfulEvents: knownAgenticSuccesses.map(entry => ({
          eventKey: entry.eventKey,
          eventName: entry.eventName,
          runId: entry.runId,
          outputDir: entry.outputDir,
          totalMatches: entry.counts?.totalMatches ?? entry.totalMatches ?? null,
          matchScoutV4Records: entry.counts?.matchScoutV4Records ?? null,
          scoreReconciliationRows: entry.counts?.scoreReconciliationRows ?? null,
          winnerAccuracy: entry.metrics?.winnerAccuracy ?? null
        }))
      },
      null,
      2
    )}\n`
  );
};

const eventKeys = eventKeysArg
  ? eventKeysArg.split(',').map(value => value.trim()).filter(Boolean)
  : [];
const discovered = eventKeys.length
  ? eventKeys.map(eventKey => ({ eventKey, eventName: eventKey, sourceUrl: `https://www.thebluealliance.com/event/${eventKey}` }))
  : parseEvents(await loadText(eventListUrl));
const successes = existingAgenticSuccesses();
const generatedManifestRoot = path.join(artifactRoot, '_agentic-generated-manifests');
mkdirSync(generatedManifestRoot, { recursive: true });

const batchEntries = [];
let attempts = 0;

console.log('Agentic event replay batch');
console.log(`Season: ${season}`);
console.log(`Discovered: ${discovered.length}`);
console.log(`Existing agentic successes: ${successes.size}`);
console.log(`Limit: ${limit}; min matches: ${minMatches}`);
console.log(`Catalog: ${catalogPath}`);

for (const event of discovered) {
  if (attempts >= limit) break;
  const existing = successes.get(event.eventKey);
  if (existing && !includeExisting) {
    const entry = {
      status: 'skipped',
      reason: 'already-agentic-success',
      eventKey: event.eventKey,
      eventName: event.eventName,
      sourceUrl: event.sourceUrl,
      runId: existing.runId,
      outputDir: existing.outputDir,
      counts: { totalMatches: existing.totalMatches }
    };
    batchEntries.push(entry);
    appendCatalog(entry);
    continue;
  }

  attempts += 1;
  const manifestPath = path.join(generatedManifestRoot, `${event.eventKey}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(manifestFor(event), null, 2)}\n`);
  console.log(`\n[${attempts}/${limit}] ${event.eventKey} ${event.eventName}`);
  try {
    const stdout = execFileSync(process.execPath, [replayScript, '--manifest', manifestPath], {
      encoding: 'utf8',
      maxBuffer: 80 * 1024 * 1024
    });
    const summary = JSON.parse(stdout);
    const entry = {
      status: 'success',
      eventKey: summary.eventKey,
      eventName: summary.eventName,
      sourceUrl: summary.sourceUrl,
      runId: summary.runId,
      outputDir: summary.outputDir,
      pretendOwnTeam: summary.pretendOwnTeam,
      ownTeamLabel: summary.ownTeamLabel,
      counts: summary.counts,
      gates: summary.gates,
      metrics: summary.metrics,
      artifacts: summary.artifacts
    };
    batchEntries.push(entry);
    appendCatalog(entry);
    successes.set(summary.eventKey, { runId: summary.runId, outputDir: summary.outputDir, totalMatches: summary.counts.totalMatches });
    console.log(
      `[ok] ${summary.eventKey}: ${summary.counts.totalMatches} matches, ${summary.counts.matchScoutV4Records} V4 rows, ${Math.round(summary.metrics.winnerAccuracy * 1000) / 10}% accuracy`
    );
  } catch (error) {
    const message = error.stderr?.toString?.() || error.stdout?.toString?.() || error.message || String(error);
    const entry = {
      status: 'failed',
      eventKey: event.eventKey,
      eventName: event.eventName,
      sourceUrl: event.sourceUrl,
      error: message.split('\n').slice(0, 12).join('\n')
    };
    batchEntries.push(entry);
    appendCatalog(entry);
    console.log(`[failed] ${event.eventKey}: ${entry.error.split('\n')[0]}`);
  }
}

writeSummary(batchEntries, successes);

console.log(`\nBatch complete: ${batchEntries.filter(entry => entry.status === 'success').length} success, ${batchEntries.filter(entry => entry.status === 'skipped').length} skipped, ${batchEntries.filter(entry => entry.status === 'failed').length} failed.`);
console.log(`Summary: ${summaryPath}`);
