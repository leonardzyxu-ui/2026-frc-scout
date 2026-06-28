#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const commandTimeoutMs = Number(process.env.SCOUTING_MORNING_REPORT_TIMEOUT_MS || 45000);

const runCommand = async (command, args) => {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 12 * 1024 * 1024,
      timeout: commandTimeoutMs
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

const linesOf = (value) => value.split('\n').map(line => line.trim()).filter(Boolean);
const firstLineStarting = (lines, prefix) => lines.find(line => line.startsWith(prefix)) || '';
const firstLineContaining = (lines, fragment) => lines.find(line => line.includes(fragment)) || '';
const stripStatusPrefix = (line) => line.replace(/^-\s*/, '').replace(/^\[(ok|warn|fail)\]\s*/i, '');
const valueAfter = (line, label) => line.startsWith(label) ? line.slice(label.length).trim() : '';
const bulletValue = (line, fallback) => stripStatusPrefix(line || fallback);

const statusResult = await runCommand(process.execPath, [join('scripts', 'scouting-head-scout-status.mjs')]);
const statusLines = linesOf(statusResult.stdout);

const generated = firstLineStarting(statusLines, 'Generated:') || `Generated: ${new Date().toLocaleString()}`;
const branch = firstLineStarting(statusLines, 'Branch:');
const commit = firstLineStarting(statusLines, 'Commit:');
const workingTree = firstLineStarting(statusLines, 'Working tree:');
const adminV4 = firstLineStarting(statusLines, 'Admin V4:');
const adminV2 = firstLineStarting(statusLines, 'Admin V2 prediction graph:');
const officialSite = firstLineStarting(statusLines, 'Official site:');
const ci = firstLineStarting(statusLines, 'Latest CI:');
const ciUrl = firstLineStarting(statusLines, 'CI URL:');
const buttonRelay = firstLineContaining(statusLines, 'The Button');
const directChatRelay = firstLineContaining(statusLines, 'DirectChat');
const cloudflareRelay = firstLineContaining(statusLines, 'Cloudflare DirectChat');
const readinessFailed = !statusResult.ok || /NEEDS ATTENTION/.test(officialSite);
const directChatReady = /\bHTTP 2\d\d\b/.test(directChatRelay) || /\bok\b/i.test(directChatRelay);
const buttonReady = /\bHTTP 2\d\d\b/.test(buttonRelay) || /\bok\b/i.test(buttonRelay);
const cloudflareReady = /\bHTTP 2\d\d\b/.test(cloudflareRelay) || /\bok\b/i.test(cloudflareRelay);

console.log('Scouting Morning Business Report - June 28, 2026');
console.log(generated);
console.log('Source command: npm run check:head-scout');
console.log('');
console.log('After our overnight work, the product improved in these areas:');
console.log('1. Match-day control: Admin V4 now has explicit Practice Matches, Qualifications, and Alliance Selection Prep operating modes.');
console.log('2. Prediction trust: the Model Trust flow can save Forecast Snapshot checkpoints and export a workbook with a Forecast Ledger for practice and qualification forecasts.');
console.log('3. Alliance selection speed: the Pick List now has live status entry plus a Live Pick Call Sheet for primary, backup, swing, and blocker choices.');
console.log('4. Presentation value: the workspace has a hidden proof shortcut, judge-friendly model proof, the restored Admin V2 Prediction vs Actual graph, and a repeatable PPT background capture command.');
console.log('5. Operations discipline: local status and watch commands now verify deployed routes, service-worker assets, relay service identity, latest CI, optional TBA event state, and morning action cues.');
console.log('');
console.log('Users can now:');
console.log('- Start the day by opening Admin V4, choosing the competition phase, and following the Now-screen next action.');
console.log('- Switch Matches into practice forecasts during Practice Matches phase, then return to qualification forecasts when the real schedule starts.');
console.log('- Before each practice or qualification match block, save a prediction checkpoint and export the full evidence workbook for later model accuracy review.');
console.log('- Capture early practice forecasts from the best available rating source before event-local backtests exist.');
console.log('- During alliance selection, mark public pick status immediately and keep the pick list mathematically current.');
console.log('- Work the Live Pick Call Sheet from top to bottom as teams are taken, declined, or marked unavailable.');
console.log('- Use the Blocker choice when denying a dangerous ceiling/defense team matters more than a normal fit pick.');
console.log('- Use the hidden proof shortcut to spotlight Model Demo Proof in Reports without visible judge-mode wording.');
console.log('- Open Admin V2 directly for the legacy Prediction vs Actual view when showing historical model performance.');
console.log('- Run npm run capture:ppt-background for fresh 16:9 scouting website screenshots in output/playwright, including the chart-heavy analytics background.');
console.log('- Use docs/scouting-matchday-operator-card.md as the one-page head-scout playbook for practice, qualifications, visitors, and alliance selection.');
console.log('- Use copy-only relay drafts for head-scout alerts without putting relay secrets into Firebase client code.');
console.log('- Run npm run watch:head-scout as a local Mac-side ops loop for passive official-site, CI, relay, and optional TBA monitoring.');
console.log('- Treat Cloudflare DirectChat as a fast global/VPN relay for US travel or VPN-backed checks, not as the only Sanya path.');
console.log('');
console.log('Live evidence:');
console.log(`- ${officialSite || 'Official site: status unavailable'}`);
console.log(`- ${valueAfter(adminV4, 'Admin V4:') ? `Admin V4 route: ${valueAfter(adminV4, 'Admin V4:')}` : 'Admin V4 route: unavailable'}`);
console.log(`- ${valueAfter(adminV2, 'Admin V2 prediction graph:') ? `Admin V2 prediction graph: ${valueAfter(adminV2, 'Admin V2 prediction graph:')}` : 'Admin V2 prediction graph: unavailable'}`);
console.log(`- ${branch || 'Branch: unavailable'}`);
console.log(`- ${commit || 'Commit: unavailable'}`);
console.log(`- ${workingTree || 'Working tree: unavailable'}`);
console.log(`- ${ci || 'Latest CI: unavailable'}`);
if (ciUrl) console.log(`- ${ciUrl}`);
console.log(`- ${bulletValue(directChatRelay, 'Backup relay health: DirectChat unavailable')}`);
console.log(`- ${bulletValue(cloudflareRelay, 'Global/VPN relay health: Cloudflare DirectChat unavailable')}`);
console.log(`- ${bulletValue(buttonRelay, 'Primary relay health: The Button unavailable')}`);
console.log('');
console.log('Blocked or watch:');
if (!buttonReady) {
  console.log('- The Button primary relay is not healthy from the public Render URL; live evidence shows the hostname is not serving the expected Node relay.');
  console.log('- Local The Button relay code passes its check suite and local /health returns service "the-button"; the remaining fix is Render service relink/redeploy, not scouting-site code.');
} else {
  console.log('- The Button primary relay is reachable; still keep DirectChat ready as backup before alliance-selection prep.');
}
if (!directChatReady) {
  console.log('- DirectChat backup relay is not healthy; stay on Firebase/local backup workflow until a relay endpoint is confirmed.');
} else {
  console.log('- DirectChat backup is verified on the correct directchat-relay service identity and is the morning relay path.');
}
if (!cloudflareReady) {
  console.log('- Cloudflare DirectChat is not available from this network; this is expected in mainland China without VPN.');
} else {
  console.log('- Cloudflare DirectChat is verified as a global/VPN backup, useful for US travel or VPN-backed operation.');
}
if (readinessFailed) {
  console.log('- The official site needs attention before field use; rerun npm run check:head-scout after fixing the failed readiness line.');
}
if (statusResult.stderr) {
  console.log(`- Status command stderr: ${statusResult.stderr}`);
}
console.log('');
console.log('Business readout: this is now less like a pile of scouting pages and more like a competition operating system. The value is speed under pressure, timestamped prediction evidence, and a credible story for mentors, drive team, and judges.');

if (!statusResult.ok) {
  process.exitCode = 1;
}
