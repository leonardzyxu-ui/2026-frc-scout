import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const baseEnv = {
  ...process.env,
  https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || 'http://127.0.0.1:7890',
  http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || 'http://127.0.0.1:7890',
  all_proxy: process.env.all_proxy || process.env.ALL_PROXY || 'socks5://127.0.0.1:7890'
};

const hasTbaKey = Boolean(process.env.MODEL_TBA_API_KEY || process.env.VITE_TBA_API_KEY);
const hasFirstCredentials = Boolean(process.env.FIRST_EVENTS_USERNAME && process.env.FIRST_EVENTS_AUTH_TOKEN);
const hasFirebaseCredentials = Boolean(process.env.MODEL_FIREBASE_PROJECT_ID && process.env.MODEL_FIREBASE_ACCESS_TOKEN);

const tail = (text, max = 1600) => {
  const clean = String(text || '').trim();
  if (clean.length <= max) return clean;
  return `...${clean.slice(-max)}`;
};

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
    skippedReason: 'MODEL_TBA_API_KEY or VITE_TBA_API_KEY is not available locally.',
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
const summary = {
  generatedAt: now.toISOString(),
  eventKey,
  year,
  eventCode,
  status: failedSteps.length ? 'needs_attention' : skippedSteps.length ? 'degraded' : 'ready',
  note: 'No secrets are written or printed. Missing credentials are skipped so PowerScout still returns a usable post-match status.',
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
  '## Driver-Team Output',
  '',
  failedSteps.length
    ? 'Refresh completed with failures. Use the latest cached model output and inspect failed steps before trusting a new inference.'
    : 'Refresh completed with available sources. Use the latest model artifact and local scout cache for the next-match briefing.',
  ''
].join('\n');

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, 'latest.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
writeFileSync(path.join(outputDir, 'latest.md'), markdown, 'utf8');

console.log(markdown);
if (failedSteps.length) {
  console.log(`Details: ${path.join(outputDir, 'latest.json')}`);
}
