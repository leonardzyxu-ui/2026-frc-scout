#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const commandTimeoutMs = Number(process.env.SCOUTING_STATUS_TIMEOUT_MS || 30000);
const siteBaseUrl = (process.env.SCOUTING_BASE_URL || 'https://scout-rebuilt-2026.web.app').replace(/\/$/, '');

const runCommand = async (command, args, options = {}) => {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 12 * 1024 * 1024,
      timeout: commandTimeoutMs,
      ...options
    });
    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: (error.stdout || '').trim(),
      stderr: (error.stderr || '').trim(),
      error: error.message
    };
  }
};

const firstLine = (value) => value.split('\n').find(Boolean) || '';

const parseReadiness = (stdout, ok) => {
  const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
  const okLines = lines.filter(line => line.startsWith('[ok]'));
  const warnLines = lines.filter(line => line.startsWith('[warn]'));
  const failLines = lines.filter(line => line.startsWith('[fail]'));
  const criticalReady = lines.some(line => line.includes('Critical readiness checks passed.'));
  const adminV2 = okLines.find(line => line.includes('Admin V2 route')) || '';
  const adminV4 = okLines.find(line => line.includes('Admin V4 route')) || '';
  const directChat = lines.find(line => line.includes('DirectChat')) || '';
  const theButton = lines.find(line => line.includes('The Button')) || '';

  return {
    ready: ok && criticalReady && failLines.length === 0,
    okCount: okLines.length,
    warnLines,
    failLines,
    adminV2,
    adminV4,
    theButton,
    directChat
  };
};

const parseCi = (stdout) => {
  if (!stdout) return null;
  try {
    const runs = JSON.parse(stdout);
    return Array.isArray(runs) ? runs[0] || null : null;
  } catch {
    return null;
  }
};

const summarizeWorkingTree = (stdout) => {
  const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
  const meaningful = lines.filter(line => !line.includes('.firebase/hosting.ZGlzdA.cache'));
  if (meaningful.length === 0) {
    return lines.length === 0 ? 'Clean' : 'Only Firebase hosting cache changed';
  }
  return `${meaningful.length} meaningful change(s): ${meaningful.slice(0, 4).join('; ')}`;
};

const now = new Date();
const branchResult = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const branch = process.env.SCOUTING_STATUS_BRANCH || firstLine(branchResult.stdout) || 'unknown';
const commitResult = await runCommand('git', ['log', '-1', '--pretty=%h %s']);
const statusResult = await runCommand('git', ['status', '--short']);
const readinessResult = await runCommand(process.execPath, [join('scripts', 'scouting-competition-readiness.mjs')]);
const ciResult = await runCommand('gh', [
  'run',
  'list',
  '--branch',
  branch,
  '--limit',
  '1',
  '--json',
  'databaseId,headSha,status,conclusion,name,createdAt,url'
]);

const readiness = parseReadiness(readinessResult.stdout, readinessResult.ok);
const latestCi = parseCi(ciResult.stdout);

console.log('Head Scout Status');
console.log(`Generated: ${now.toLocaleString()}`);
console.log(`Branch: ${branch}`);
console.log(`Commit: ${firstLine(commitResult.stdout) || 'unknown'}`);
console.log(`Working tree: ${summarizeWorkingTree(statusResult.stdout)}`);
console.log(`Admin V4: ${siteBaseUrl}/adminv4`);
console.log(`Admin V2 prediction graph: ${siteBaseUrl}/adminv2/prediction-vs-actual`);
console.log('');
console.log(`Official site: ${readiness.ready ? 'READY' : 'NEEDS ATTENTION'} (${readiness.okCount} live checks passed)`);
if (readiness.adminV2) console.log(`- ${readiness.adminV2}`);
if (readiness.adminV4) console.log(`- ${readiness.adminV4}`);
const printedRelayLines = new Set([readiness.theButton, readiness.directChat].filter(Boolean));
if (readiness.theButton) console.log(`- ${readiness.theButton}`);
if (readiness.directChat) console.log(`- ${readiness.directChat}`);
readiness.warnLines
  .filter(line => !printedRelayLines.has(line))
  .forEach(line => console.log(`- ${line}`));
readiness.failLines
  .filter(line => !printedRelayLines.has(line))
  .forEach(line => console.log(`- ${line}`));
if (!readinessResult.ok) {
  console.log(`- readiness command failed: ${readinessResult.error || readinessResult.stderr || 'unknown error'}`);
}
console.log('');
if (latestCi) {
  const conclusion = latestCi.conclusion || latestCi.status || 'unknown';
  console.log(`Latest CI: ${latestCi.name} ${conclusion} (${latestCi.databaseId})`);
  console.log(`CI URL: ${latestCi.url}`);
} else {
  console.log(`Latest CI: unavailable${ciResult.error ? ` (${ciResult.error})` : ''}`);
}
console.log('');
console.log('Morning operating cues');
console.log('- Open Admin V4 -> Now, set the Competition Phase, then follow the highlighted action.');
console.log('- Before each match block, use Data -> Model Trust -> Save Forecast Snapshot, then export the full evidence workbook.');
console.log('- During alliance selection, use Pick List -> Live Pick Status Entry immediately after each public pick.');
console.log('- Use DirectChat relay drafts if The Button still returns 404.');
