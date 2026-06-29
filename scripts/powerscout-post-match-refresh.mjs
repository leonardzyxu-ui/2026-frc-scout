import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.vite-env/.env.local', quiet: true });
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const outputDir = path.resolve('output/powerscout/post-match-refresh');
const now = new Date();

const parseArgs = (argv) => {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
};

const flags = parseArgs(process.argv.slice(2));
const eventKey = String(flags.event || process.env.POWER_SCOUT_EVENT_KEY || process.env.MODEL_EVENT_KEY || '2026mnum').toLowerCase();
const year = Number(flags.year || eventKey.match(/^(\d{4})/)?.[1] || new Date().getFullYear());
const eventCode = String(flags['event-code'] || eventKey.replace(/^\d{4}/, '')).toUpperCase();
const nodeCli = ['./node_modules/tsx/dist/cli.mjs', 'modeling/src/cli.ts'];
const localTbaKeyPath = path.join(homedir(), 'Library', 'Application Support', 'PowerScout', 'tba-api-key.json');

const extractKey = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;

  const parsed = JSON.parse(trimmed);
  if (typeof parsed === 'string') return parsed.trim();
  const candidateKeys = ['tbaApiKey', 'tba_api_key', 'apiKey', 'key', 'token', 'TBA_API_KEY', 'VITE_TBA_API_KEY'];
  for (const key of candidateKeys) {
    if (typeof parsed?.[key] === 'string' && parsed[key].trim()) return parsed[key].trim();
  }
  return '';
};

const readLocalTbaKey = () => {
  if (!existsSync(localTbaKeyPath)) return '';
  try {
    return extractKey(readFileSync(localTbaKeyPath, 'utf8'));
  } catch {
    return '';
  }
};

const tbaApiKey = process.env.MODEL_TBA_API_KEY || process.env.VITE_TBA_API_KEY || readLocalTbaKey();
const baseEnv = {
  ...process.env,
  ...(tbaApiKey ? { MODEL_TBA_API_KEY: tbaApiKey, VITE_TBA_API_KEY: tbaApiKey } : {}),
  https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || 'http://127.0.0.1:7890',
  http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || 'http://127.0.0.1:7890',
  all_proxy: process.env.all_proxy || process.env.ALL_PROXY || 'socks5://127.0.0.1:7890'
};

const hasTbaKey = Boolean(tbaApiKey);
const hasFirstCredentials = Boolean(process.env.FIRST_EVENTS_USERNAME && process.env.FIRST_EVENTS_AUTH_TOKEN);
const hasFirebaseCredentials = Boolean(process.env.MODEL_FIREBASE_PROJECT_ID && process.env.MODEL_FIREBASE_ACCESS_TOKEN);

const tail = (text, max = 1600) => {
  const clean = String(text || '').trim();
  if (clean.length <= max) return clean;
  return `...${clean.slice(-max)}`;
};

const redacted = (text) => tail(text).replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]');

const runStep = ({ id, label, args, enabled = true, skippedReason = '' }) => {
  if (!enabled) {
    return {
      id,
      label,
      status: 'skipped',
      skippedReason,
      exitCode: null,
      stdoutTail: '',
      stderrTail: ''
    };
  }

  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: baseEnv,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8
  });

  return {
    id,
    label,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr || result.error?.message || '')
  };
};

const steps = [
  runStep({
    id: 'tba',
    label: 'Refresh TBA matches',
    enabled: hasTbaKey,
    skippedReason: 'No local TBA key found in env vars or PowerScout Application Support.',
    args: [...nodeCli, 'ingest:tba', '--year', String(year), '--event', eventKey]
  }),
  runStep({
    id: 'first',
    label: 'Refresh FIRST Events data',
    enabled: hasFirstCredentials,
    skippedReason: 'FIRST_EVENTS_USERNAME and FIRST_EVENTS_AUTH_TOKEN are not available locally.',
    args: [...nodeCli, 'ingest:first', '--year', String(year), '--event-code', eventCode]
  }),
  runStep({
    id: 'statbotics',
    label: 'Refresh Statbotics context',
    args: [...nodeCli, 'ingest:statbotics', '--event', eventKey]
  }),
  runStep({
    id: 'firebase',
    label: 'Refresh Firebase scout data',
    enabled: hasFirebaseCredentials,
    skippedReason: 'MODEL_FIREBASE_PROJECT_ID and MODEL_FIREBASE_ACCESS_TOKEN are not available locally.',
    args: [...nodeCli, 'ingest:firebase']
  }),
  runStep({
    id: 'model',
    label: 'Rerun event model inference',
    args: [...nodeCli, 'train', '--event', eventKey, '--model-filter', 'Conservative TailGuard,RoleV3,Online EPA']
  })
];

const failedSteps = steps.filter(step => step.status === 'failed');
const skippedSteps = steps.filter(step => step.status === 'skipped');
const sourceFreshness = steps.map(step => ({
  id: step.id,
  source: step.label,
  state: step.status,
  detail: step.status === 'skipped'
    ? step.skippedReason
    : step.status === 'failed'
      ? `Command failed with exit ${step.exitCode ?? 'unknown'}${step.stderrTail ? `: ${redacted(step.stderrTail)}` : ''}.`
      : `Command completed with exit ${step.exitCode ?? 0}.`,
  durationMs: step.durationMs ?? null
}));
const driverBriefing = {
  state: failedSteps.length ? 'use_cached_with_attention' : skippedSteps.length ? 'degraded_ready' : 'ready',
  outputs: [
    {
      title: 'Win probability',
      detail: failedSteps.length
        ? 'Use the newest cached prediction until failed refresh steps are fixed.'
        : 'Use the refreshed model artifact for red/blue win probability.'
    },
    {
      title: 'Role plan',
      detail: 'Use the refreshed role-combination strategy output for offense, defense, and stockpile assignments.'
    },
    {
      title: 'Expected margin',
      detail: 'Read mean margin together with contribution and defense deviation before deciding whether to gamble.'
    },
    {
      title: 'Data-quality flags',
      detail: skippedSteps.length
        ? 'Some sources were credential-gated or unavailable; label the briefing as degraded.'
        : 'All configured sources were available; still inspect scout conflict flags before queueing.'
    }
  ]
};
const summary = {
  generatedAt: now.toISOString(),
  eventKey,
  year,
  eventCode,
  status: failedSteps.length ? 'needs_attention' : skippedSteps.length ? 'degraded' : 'ready',
  note: 'No secrets are written or printed. Missing credentials are skipped so PowerScout still returns a usable post-match status.',
  sourceFreshness,
  driverBriefing,
  steps
};

const markdown = [
  '# PowerScout Post-Match Refresh',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Event: ${eventKey}`,
  `- Status: ${summary.status}`,
  '',
  '| Step | Status | Detail |',
  '| --- | --- | --- |',
  ...steps.map(step => `| ${step.label} | ${step.status} | ${step.status === 'skipped' ? step.skippedReason : `exit ${step.exitCode ?? '-'}`} |`),
  '',
  '## Data Source Freshness',
  '',
  '| Source | State | Detail |',
  '| --- | --- | --- |',
  ...sourceFreshness.map(source => `| ${source.source} | ${source.state} | ${source.detail} |`),
  '',
  '## Driver-Team Output',
  '',
  failedSteps.length
    ? 'Refresh completed with failures. Use the latest cached model output and inspect failed steps before trusting a new inference.'
    : 'Refresh completed with available sources. Use the latest model artifact and local scout cache for the next-match briefing.',
  '',
  ...driverBriefing.outputs.map(output => `- **${output.title}:** ${output.detail}`),
  ''
].join('\n');

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, 'latest.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
writeFileSync(path.join(outputDir, 'latest.md'), markdown, 'utf8');

console.log(markdown);
if (failedSteps.length) {
  console.log(`Details: ${path.join(outputDir, 'latest.json')}`);
}
