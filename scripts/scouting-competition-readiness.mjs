#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const baseUrl = (process.env.SCOUTING_BASE_URL || 'https://scout-rebuilt-2026.web.app').replace(/\/$/, '');
const timeoutMs = Number(process.env.SCOUTING_READINESS_TIMEOUT_MS || 10000);
const shortTimeoutMs = Number(process.env.SCOUTING_RELAY_TIMEOUT_MS || 6000);

const checks = [];

const fetchText = async (url, timeout = timeoutMs) => {
  const statusMarker = '\n__SCOUT_HTTP_STATUS__:';
  const maxTimeSeconds = String(Math.max(1, Math.ceil(timeout / 1000)));
  try {
    const { stdout, stderr } = await execFileAsync(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--max-time',
        maxTimeSeconds,
        '--write-out',
        `${statusMarker}%{http_code}`,
        url
      ],
      {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024
      }
    );
    const markerIndex = stdout.lastIndexOf(statusMarker);
    if (markerIndex === -1) {
      return {
        ok: false,
        status: 0,
        body: stdout,
        error: stderr.trim() || 'curl did not return an HTTP status marker'
      };
    }
    return {
      ok: true,
      status: Number(stdout.slice(markerIndex + statusMarker.length).trim()),
      body: stdout.slice(0, markerIndex),
      error: stderr.trim()
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error.stdout || '',
      error: error.stderr?.trim() || error.message
    };
  }
};

const addCheck = (label, ok, detail = '', critical = true) => {
  checks.push({ label, ok, detail, critical });
};

const cacheBusted = (path) => `${baseUrl}${path}${path.includes('?') ? '&' : '?'}readiness=${Date.now()}`;

const requireHttpOk = async (label, path) => {
  const result = await fetchText(cacheBusted(path));
  const ok = result.ok && result.status >= 200 && result.status < 300;
  addCheck(label, ok, ok ? `HTTP ${result.status}` : `HTTP ${result.status || 'failed'} ${result.error || ''}`.trim());
  return result;
};

const resolveAsset = (swBody, prefix) => {
  const assets = Array.from(swBody.matchAll(/url:"(assets\/[^"]+\.js)"/g), match => match[1]);
  return assets.find(asset => asset.startsWith(`assets/${prefix}-`)) || '';
};

const requireMarkers = (label, source, markers) => {
  const missing = markers.filter(marker => !source.includes(marker));
  addCheck(label, missing.length === 0, missing.length === 0 ? markers.join(', ') : `Missing: ${missing.join(', ')}`);
};

const requireAssetText = async (label, assetPath) => {
  const result = await fetchText(cacheBusted(`/${assetPath}`), Math.max(timeoutMs, 20000));
  const ok = result.ok && result.status >= 200 && result.status < 300;
  addCheck(label, ok, ok ? `HTTP ${result.status}` : `HTTP ${result.status || 'failed'} ${result.error || ''}`.trim());
  return ok ? result.body : '';
};

const relayHealth = async (label, url) => {
  const result = await fetchText(url, shortTimeoutMs);
  const ok = result.ok && result.status >= 200 && result.status < 300;
  addCheck(label, ok, ok ? `HTTP ${result.status}` : `HTTP ${result.status || 'failed'} ${result.error || ''}`.trim(), false);
  return ok;
};

console.log('Scouting competition readiness');
console.log(`Base: ${baseUrl}`);

await requireHttpOk('Admin V2 route', '/adminv2');
await requireHttpOk('Admin V4 route', '/adminv4');

const sw = await requireHttpOk('Service worker manifest', '/sw.js');
const adminV4Asset = resolveAsset(sw.body, 'AdminV4View');
const adminV4PickListAsset = resolveAsset(sw.body, 'AdminV4PickListWorkflow');
const adminV4ModelAsset = resolveAsset(sw.body, 'AdminV4ModelValidationPanel');
const adminV2Asset = resolveAsset(sw.body, 'AdminMainframeView');

addCheck('Admin V4 asset resolved', Boolean(adminV4Asset), adminV4Asset || 'Missing AdminV4View asset');
addCheck('Admin V4 pick-list asset resolved', Boolean(adminV4PickListAsset), adminV4PickListAsset || 'Missing AdminV4PickListWorkflow asset');
addCheck('Admin V4 model asset resolved', Boolean(adminV4ModelAsset), adminV4ModelAsset || 'Missing AdminV4ModelValidationPanel asset');
addCheck('Admin V2 asset resolved', Boolean(adminV2Asset), adminV2Asset || 'Missing AdminMainframeView asset');

if (adminV4Asset) {
  const assetBody = await requireAssetText('Admin V4 asset fetched', adminV4Asset);
  if (assetBody) requireMarkers('Admin V4 competition cockpit markers', assetBody, [
    'Competition Phase',
    'Practice Matches',
    'Alliance Selection Prep',
    'Prediction checkpoint',
    'Save snapshot',
    'Relay Readiness',
    'Relay Outbox Drafts',
    'Copy-Only Head Scout Alerts',
    'Local Drafts Only'
  ]);
  if (assetBody) requireMarkers('Admin V4 Forecast Ledger export markers', assetBody, [
    'Forecast Ledger',
    'forecastSnapshots',
    'Row Kind',
    'Snapshot Created At'
  ]);
}

if (adminV4PickListAsset) {
  const assetBody = await requireAssetText('Admin V4 pick-list asset fetched', adminV4PickListAsset);
  if (assetBody) requireMarkers('Admin V4 pick-list live status markers', assetBody, [
    'Live Pick Status Entry',
    'Picked by, e.g. A3',
    'Declined',
    'Status change canceled',
    'Uses the same confirm and undo path as row status menus'
  ]);
}

if (adminV4ModelAsset) {
  const assetBody = await requireAssetText('Admin V4 model asset fetched', adminV4ModelAsset);
  if (assetBody) requireMarkers('Admin V4 model proof markers', assetBody, [
    'Prediction Evidence Is Time-Stamped',
    'Save Forecast Snapshot',
    'forecast snapshots',
    'Forecast Ledger'
  ]);
}

if (adminV2Asset) {
  const assetBody = await requireAssetText('Admin V2 asset fetched', adminV2Asset);
  if (assetBody) requireMarkers('Admin V2 legacy predictor markers', assetBody, [
    'Admin V2',
    'Prediction vs Actual',
    'TBA API Key'
  ]);
}

const buttonOk = await relayHealth('Primary relay health: The Button', 'https://the-button.onrender.com/health');
const directChatOk = await relayHealth('Backup relay health: DirectChat', 'https://directchat-relay.onrender.com/health');
addCheck(
  'At least one relay is reachable',
  buttonOk || directChatOk,
  buttonOk && directChatOk ? 'primary and backup reachable' : buttonOk ? 'primary reachable' : directChatOk ? 'backup reachable' : 'both relays failed'
);

console.log('');
for (const check of checks) {
  const state = check.ok ? 'ok' : check.critical ? 'fail' : 'warn';
  console.log(`[${state}] ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
}

const failed = checks.filter(check => check.critical && !check.ok);
if (failed.length > 0) {
  console.error(`\nReadiness failed: ${failed.length} critical check${failed.length === 1 ? '' : 's'} failed.`);
  process.exitCode = 1;
} else {
  console.log('\nCritical readiness checks passed.');
}
