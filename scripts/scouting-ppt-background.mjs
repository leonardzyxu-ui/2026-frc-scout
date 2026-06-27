#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outputDir = process.env.SCOUTING_PPT_OUTPUT_DIR || join(process.cwd(), 'output', 'playwright');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const findOpenPort = async (startPort = 4240) => {
  for (let port = startPort; port < startPort + 50; port += 1) {
    const open = await new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (open) return port;
  }
  throw new Error(`No open localhost port found starting at ${startPort}.`);
};

const waitForPreview = async (url, timeoutMs = 25000) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw lastError || new Error(`Preview did not become ready at ${url}.`);
};

const waitForExit = child => new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => {
    if (code === 0) resolve();
    else reject(new Error(`Process exited with code ${code ?? 'unknown'}.`));
  });
});

const spawnNode = (args, options = {}) => spawn(process.execPath, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_LOCAL_MODE: 'true',
    ...options.env
  },
  stdio: options.stdio || ['ignore', 'pipe', 'pipe']
});

const capturePage = async (page, url, label, outputName, assertText, preparePage = null) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.body.innerText.includes('ADMIN V4') && document.body.innerText.length > 100,
    null,
    { timeout: 20000 }
  );
  await page.waitForTimeout(1800);
  if (preparePage) {
    await preparePage(page);
    await page.waitForTimeout(700);
  }
  const text = await page.locator('body').innerText();
  if (!assertText.test(text)) {
    throw new Error(`${label} did not render expected text: ${assertText}`);
  }
  const outputPath = join(outputDir, outputName);
  await page.screenshot({ path: outputPath, fullPage: false });
  return outputPath;
};

console.log('Building local Admin V4 fixture for PPT background captures...');
const build = spawnNode(['./node_modules/vite/bin/vite.js', 'build']);
build.stdout.on('data', chunk => process.stdout.write(`[build] ${chunk}`));
build.stderr.on('data', chunk => process.stderr.write(`[build] ${chunk}`));
await waitForExit(build);

await mkdir(outputDir, { recursive: true });

const port = await findOpenPort();
const localAdminUrl = `http://127.0.0.1:${port}/adminv4?fixture=test-mode`;
const preview = spawnNode(
  ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)]
);
preview.stdout.on('data', chunk => process.stdout.write(`[preview] ${chunk}`));
preview.stderr.on('data', chunk => process.stderr.write(`[preview] ${chunk}`));

let browser;
try {
  await waitForPreview(localAdminUrl);
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const screenshots = [];
  screenshots.push(await capturePage(
    page,
    `${localAdminUrl}&tab=visualize`,
    'Analytics background',
    'scouting-ppt-background-analytics.png',
    /Event Visualizer|Team Strength Matrix|Charts|Visualize/i,
    async capturePage => {
      await capturePage.locator('main').evaluate(container => {
        container.scrollTop = 760;
      });
    }
  ));
  screenshots.push(await capturePage(
    page,
    `${localAdminUrl}&tab=picklist`,
    'Pick list background',
    'scouting-ppt-background-picklist.png',
    /Live Pick Call Sheet/i
  ));

  await page.goto(localAdminUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.body.innerText.includes('ADMIN V4') && document.body.innerText.length > 100,
    null,
    { timeout: 20000 }
  );
  await page.keyboard.press('Shift+D');
  await page.waitForFunction(
    () => /Model Demo Proof|Audience Report Packs/i.test(document.body.innerText),
    null,
    { timeout: 12000 }
  );
  await page.waitForTimeout(1000);
  const proofPath = join(outputDir, 'scouting-ppt-background-model-proof.png');
  await page.screenshot({ path: proofPath, fullPage: false });
  screenshots.push(proofPath);

  console.log(JSON.stringify({
    ok: true,
    baseUrl: localAdminUrl,
    viewport: '1920x1080',
    screenshots
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (!preview.killed) preview.kill('SIGTERM');
}
