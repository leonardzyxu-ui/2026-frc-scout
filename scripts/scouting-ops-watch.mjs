#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const once = args.has('--once') || process.env.SCOUTING_WATCH_ONCE === '1';
const jsonMode = args.has('--json') || process.env.SCOUTING_WATCH_JSON === '1';
const notifyEnabled = args.has('--notify') || process.env.SCOUTING_WATCH_NOTIFY === '1';
const intervalMs = Math.max(15000, Number(process.env.SCOUTING_WATCH_INTERVAL_MS || 120000));
const maxTicks = Math.max(0, Number(process.env.SCOUTING_WATCH_MAX_TICKS || 0));
const commandTimeoutMs = Math.max(10000, Number(process.env.SCOUTING_WATCH_TIMEOUT_MS || 45000));
const tbaEventKey = process.env.SCOUTING_TBA_EVENT_KEY || '2026mnum';
const tbaAuthKey = process.env.SCOUTING_TBA_AUTH_KEY || process.env.TBA_AUTH_KEY || '';

let previousFingerprint = '';
let tickCount = 0;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runCommand = async (command, commandArgs, options = {}) => {
  try {
    const result = await execFileAsync(command, commandArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
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

const runCurl = async (url, headers = []) => {
  const curlArgs = [
    '--silent',
    '--show-error',
    '--location',
    '--max-time',
    String(Math.ceil(commandTimeoutMs / 1000)),
    '--write-out',
    '\n__SCOUT_HTTP_STATUS__:%{http_code}',
    ...headers.flatMap(header => ['--header', header]),
    url
  ];
  const result = await runCommand('curl', curlArgs);
  const marker = '\n__SCOUT_HTTP_STATUS__:';
  const markerIndex = result.stdout.lastIndexOf(marker);
  if (markerIndex === -1) {
    return {
      ok: false,
      status: 0,
      body: result.stdout,
      error: result.stderr || result.error || 'curl did not return status marker'
    };
  }
  const status = Number(result.stdout.slice(markerIndex + marker.length).trim());
  return {
    ok: result.ok && status >= 200 && status < 300,
    status,
    body: result.stdout.slice(0, markerIndex),
    error: result.stderr || result.error || ''
  };
};

const lineStarting = (lines, prefix) => lines.find(line => line.startsWith(prefix)) || '';
const lineContaining = (lines, fragment) => lines.find(line => line.includes(fragment)) || '';
const cleanStatusLine = (line) => line.replace(/^-\s*/, '');

const parseStatus = (stdout) => {
  const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);
  return {
    generated: lineStarting(lines, 'Generated:'),
    branch: lineStarting(lines, 'Branch:'),
    commit: lineStarting(lines, 'Commit:'),
    workingTree: lineStarting(lines, 'Working tree:'),
    officialSite: lineStarting(lines, 'Official site:'),
    adminV4: lineStarting(lines, 'Admin V4:'),
    adminV2: lineStarting(lines, 'Admin V2 prediction graph:'),
    ci: lineStarting(lines, 'Latest CI:'),
    ciUrl: lineStarting(lines, 'CI URL:'),
    theButton: cleanStatusLine(lineContaining(lines, 'The Button')),
    directChat: cleanStatusLine(lineContaining(lines, 'DirectChat')),
    cloudflare: cleanStatusLine(lineContaining(lines, 'Cloudflare DirectChat'))
  };
};

const getRelayDecision = ({ theButton, directChat, cloudflare }) => {
  const primaryReady = /\bHTTP 2\d\d\b/.test(theButton) || /\bok\b/i.test(theButton);
  const mainlandBackupReady = /\bHTTP 2\d\d\b/.test(directChat) || /\bok\b/i.test(directChat);
  const globalBackupReady = /\bHTTP 2\d\d\b/.test(cloudflare) || /\bok\b/i.test(cloudflare);
  if (primaryReady) return 'Use The Button primary; keep DirectChat as Sanya backup and Cloudflare for VPN/global fallback.';
  if (mainlandBackupReady) return 'Use DirectChat as the mainland/Sanya backup; The Button is not healthy.';
  if (globalBackupReady) return 'Only Cloudflare is healthy; use it with VPN/US/global access, not as the Sanya-only path.';
  return 'No relay is healthy; stay on Firebase/local backup workflow.';
};

const getMatchOrder = (match) => {
  const order = { pm: 0, qm: 1, ef: 2, qf: 3, sf: 4, f: 5 };
  return {
    compOrder: order[match.comp_level] ?? 99,
    matchNumber: Number(match.match_number || 0),
    setNumber: Number(match.set_number || 1)
  };
};

const matchPlayed = (match) =>
  match?.alliances?.red?.score !== -1 &&
  match?.alliances?.blue?.score !== -1 &&
  match?.alliances?.red?.score != null &&
  match?.alliances?.blue?.score != null;

const matchLabel = (match) => {
  const shortKey = String(match.key || '').split('_').pop();
  return shortKey ? shortKey.toUpperCase() : `${String(match.comp_level || '').toUpperCase()}${match.match_number || ''}`;
};

const fetchTbaSummary = async () => {
  if (!tbaAuthKey) {
    return {
      configured: false,
      ok: true,
      detail: `TBA ${tbaEventKey}: skipped; set SCOUTING_TBA_AUTH_KEY or TBA_AUTH_KEY to poll event matches.`
    };
  }

  const url = `https://www.thebluealliance.com/api/v3/event/${encodeURIComponent(tbaEventKey)}/matches/simple`;
  const result = await runCurl(url, [`X-TBA-Auth-Key: ${tbaAuthKey}`]);
  if (!result.ok) {
    return {
      configured: true,
      ok: false,
      detail: `TBA ${tbaEventKey}: HTTP ${result.status || 'failed'}${result.error ? ` (${result.error})` : ''}`
    };
  }

  try {
    const matches = JSON.parse(result.body);
    const matchList = Array.isArray(matches) ? matches : [];
    const practiceOrQual = matchList.filter(match => match.comp_level === 'pm' || match.comp_level === 'qm');
    const played = practiceOrQual.filter(matchPlayed);
    const future = practiceOrQual.filter(match => !matchPlayed(match));
    const [next] = [...future].sort((left, right) => {
      const leftOrder = getMatchOrder(left);
      const rightOrder = getMatchOrder(right);
      if (leftOrder.compOrder !== rightOrder.compOrder) return leftOrder.compOrder - rightOrder.compOrder;
      if (leftOrder.matchNumber !== rightOrder.matchNumber) return leftOrder.matchNumber - rightOrder.matchNumber;
      return leftOrder.setNumber - rightOrder.setNumber;
    });
    return {
      configured: true,
      ok: true,
      detail: `TBA ${tbaEventKey}: ${played.length}/${practiceOrQual.length} practice+qual played${next ? `; next ${matchLabel(next)}` : '; no future practice/qual matches'}`
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      detail: `TBA ${tbaEventKey}: JSON parse failed (${error.message})`
    };
  }
};

const notify = async (title, message) => {
  if (!notifyEnabled || process.platform !== 'darwin') return;
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
  await runCommand('osascript', ['-e', script], { timeout: 5000 });
};

const buildSnapshot = async () => {
  const statusResult = await runCommand(process.execPath, [join('scripts', 'scouting-head-scout-status.mjs')]);
  const parsed = parseStatus(statusResult.stdout);
  const tba = await fetchTbaSummary();
  const relayDecision = getRelayDecision(parsed);
  const healthy =
    statusResult.ok &&
    parsed.officialSite.includes('READY') &&
    parsed.ci.includes('success') &&
    (parsed.theButton.includes('HTTP 200') || parsed.directChat.includes('HTTP 200')) &&
    tba.ok;
  const fingerprint = [
    parsed.officialSite,
    parsed.ci,
    parsed.theButton,
    parsed.directChat,
    parsed.cloudflare,
    tba.detail,
    statusResult.ok ? 'status-ok' : 'status-failed'
  ].join('|');

  return {
    generatedAt: new Date().toISOString(),
    healthy,
    changed: previousFingerprint !== '' && previousFingerprint !== fingerprint,
    fingerprint,
    statusCommandOk: statusResult.ok,
    statusCommandError: statusResult.error || statusResult.stderr || '',
    relayDecision,
    ...parsed,
    tba
  };
};

const printSnapshot = (snapshot) => {
  if (jsonMode) {
    console.log(JSON.stringify(snapshot));
    return;
  }
  console.log(`\n[${new Date(snapshot.generatedAt).toLocaleString()}] Head Scout Ops Watch`);
  console.log(`Health: ${snapshot.healthy ? 'READY' : 'WATCH'}`);
  console.log(snapshot.officialSite || 'Official site: unavailable');
  console.log(snapshot.ci || 'Latest CI: unavailable');
  console.log(snapshot.workingTree || 'Working tree: unavailable');
  if (snapshot.theButton) console.log(snapshot.theButton);
  if (snapshot.directChat) console.log(snapshot.directChat);
  if (snapshot.cloudflare) console.log(snapshot.cloudflare);
  console.log(`Relay path: ${snapshot.relayDecision}`);
  console.log(snapshot.tba.detail);
  if (snapshot.adminV4) console.log(snapshot.adminV4);
  if (snapshot.adminV2) console.log(snapshot.adminV2);
  if (snapshot.statusCommandError) console.log(`Status command warning: ${snapshot.statusCommandError}`);
};

console.log('Head Scout Ops Watch');
console.log(`Interval: ${once ? 'once' : `${Math.round(intervalMs / 1000)}s`}`);
console.log(`TBA event: ${tbaEventKey}${tbaAuthKey ? '' : ' (key not set)'}`);
console.log(`Notifications: ${notifyEnabled ? 'on' : 'off'}`);

do {
  tickCount += 1;
  const snapshot = await buildSnapshot();
  printSnapshot(snapshot);
  if (snapshot.changed || !snapshot.healthy) {
    await notify(
      snapshot.healthy ? 'Scouting Status Changed' : 'Scouting Needs Attention',
      `${snapshot.officialSite || 'Site unknown'}; ${snapshot.ci || 'CI unknown'}`
    );
  }
  previousFingerprint = snapshot.fingerprint;
  if (once || (maxTicks > 0 && tickCount >= maxTicks)) break;
  await sleep(intervalMs);
} while (true);
