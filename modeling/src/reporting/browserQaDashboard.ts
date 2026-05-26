import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDir, writeJsonFile } from '../util.ts';
import { forbiddenBrowserQaText, requiredBrowserQaText, requiredHeroQaText } from './verifyDashboard.ts';

interface BrowserQaViewport {
  width: number;
  height: number;
}

interface DashboardBrowserQaOptions {
  outputDir?: string;
  host?: string;
  port?: number;
  chromePath?: string;
}

interface DashboardBrowserQaViewportCheck {
  page: {
    url: string;
    viewport: BrowserQaViewport;
  };
  title: string;
  missingText: string[];
  missingHeaderText: string[];
  forbiddenMatches: string[];
  hasForbiddenText: boolean;
  width: number;
  scrollWidth: number;
  scrollHeight: number;
  pageOverflow: boolean;
  outsideTableOffenders: Array<{
    tag: string;
    className: string;
    left: number;
    right: number;
    width: number;
    text: string;
  }>;
}

type DashboardBrowserQaViewportMetrics = Pick<
  DashboardBrowserQaViewportCheck,
  'width' | 'scrollWidth' | 'scrollHeight' | 'pageOverflow' | 'outsideTableOffenders'
>;

export interface DashboardBrowserQaSummary {
  checkedAt: string;
  url: string;
  requiredBodyText: string[];
  desktopCheck: DashboardBrowserQaViewportCheck;
  mobileCheck: DashboardBrowserQaViewportCheck;
  consoleIssues: string[];
  pageErrors: string[];
  screenshots: string[];
}

const DEFAULT_OUTPUT_DIR = 'modeling/artifacts/reports/final-judge-dashboard';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4177;
const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

const createStaticServer = (rootDir: string) =>
  http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rootDir, relativePath);

    if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });

const listen = (server: http.Server, port: number, host: string) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : port);
    });
  });

const closeServer = (server: http.Server) =>
  new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });

const checkViewport = async (
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  url: string,
  viewport: BrowserQaViewport
) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleIssues: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  const bodyText = String(await page.evaluate('document.body.innerText || ""'));
  const headerText = String(await page.evaluate('document.querySelector("header")?.textContent || ""'));
  const missingText = requiredBrowserQaText.filter(text => !bodyText.includes(text));
  const missingHeaderText = requiredHeroQaText.filter(text => !headerText.includes(text));
  const forbiddenMatches = forbiddenBrowserQaText.filter(text => bodyText.includes(text));
  const metrics = (await page.evaluate(`(() => {
    const root = document.documentElement;
    const body = document.body;
    const width = window.innerWidth;
    const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
    const scrollHeight = Math.max(root.scrollHeight, body.scrollHeight);
    const outsideTableOffenders = Array.from(document.querySelectorAll('body *'))
      .filter(element => !element.closest('.table-wrap') && !element.closest('table'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          left: rect.left,
          right: rect.right,
          width: rect.width,
          text: (element.textContent || '').trim().slice(0, 90)
        };
      })
      .filter(item => item.width > 0 && (item.left < -1 || item.right > width + 1))
      .slice(0, 20);
    return { width, scrollWidth, scrollHeight, pageOverflow: scrollWidth > width + 1, outsideTableOffenders };
  })()`)) as DashboardBrowserQaViewportMetrics;

  return {
    page,
    consoleIssues,
    pageErrors,
    check: {
      page: {
        url: page.url(),
        viewport
      },
      title,
      missingText,
      missingHeaderText,
      forbiddenMatches,
      hasForbiddenText: forbiddenMatches.length > 0,
      ...metrics
    } satisfies DashboardBrowserQaViewportCheck
  };
};

export const refreshDashboardBrowserQa = async (
  options: DashboardBrowserQaOptions = {}
): Promise<DashboardBrowserQaSummary> => {
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const host = options.host ?? DEFAULT_HOST;
  const server = createStaticServer(outputDir);
  const port = await listen(server, options.port ?? DEFAULT_PORT, host);
  const url = `http://${host}:${port}/`;
  const chromePath = options.chromePath ?? DEFAULT_CHROME_PATH;
  const browser = await chromium
    .launch({
      headless: true,
      ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {})
    })
    .catch(async error => {
      await closeServer(server);
      throw error;
    });

  try {
    ensureDir(outputDir);

    const desktop = await checkViewport(browser, url, { width: 1440, height: 1100 });
    await desktop.page.screenshot({ path: path.join(outputDir, 'dashboard-hero-screenshot.png'), fullPage: false });
    await desktop.page.screenshot({ path: path.join(outputDir, 'dashboard-fullpage-screenshot.png'), fullPage: true });
    await desktop.page.emulateMedia({ media: 'print' });
    await desktop.page.evaluate('window.scrollTo(0, 0)');
    await desktop.page.screenshot({
      path: path.join(outputDir, 'dashboard-print-preview-screenshot.png'),
      fullPage: false
    });
    await desktop.page.emulateMedia({ media: 'screen' });
    const screenshotDesktopSection = async (selector: string, fileName: string) => {
      const box = await desktop.page.locator(selector).boundingBox();
      if (!box) throw new Error(`Cannot capture missing dashboard section: ${selector}`);
      await desktop.page.screenshot({
        path: path.join(outputDir, fileName),
        fullPage: true,
        clip: {
          x: 0,
          y: Math.max(0, Math.floor(box.y - 24)),
          width: 1440,
          height: 1100
        }
      });
    };
    await screenshotDesktopSection('#source-code-evidence-lock', 'dashboard-source-evidence-screenshot.png');
    await screenshotDesktopSection('#final-gate-proof', 'dashboard-final-gate-screenshot.png');
    await screenshotDesktopSection('#starred-html-coverage', 'dashboard-starred-coverage-screenshot.png');
    await screenshotDesktopSection('#judge-story-spine', 'dashboard-story-spine-screenshot.png');
    await screenshotDesktopSection('#model-anatomy', 'dashboard-model-anatomy-screenshot.png');
    await screenshotDesktopSection('#prediction-behavior', 'dashboard-accuracy-stats-screenshot.png');
    await screenshotDesktopSection('#model-leaderboard', 'dashboard-model-scores-screenshot.png');
    await desktop.page.close();

    const storyPage = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const storyConsoleIssues: string[] = [];
    const storyPageErrors: string[] = [];
    storyPage.on('console', message => {
      if (message.type() === 'error') storyConsoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    storyPage.on('pageerror', error => storyPageErrors.push(String(error)));
    await storyPage.goto(`${url}START_HERE_STORY.html`, { waitUntil: 'networkidle', timeout: 30000 });
    const storyText = String(await storyPage.evaluate('document.body.innerText || ""'));
    const missingStoryText = [
      'The model adventure in one quick walk',
      'If you only read one screen',
      'Starting point',
      'Rejected temptation',
      'Delivery target: Saturday May 23 2026 18:00 CST',
      'Generated (CST / Asia-Shanghai)',
      'Busy Judge Card',
      'Model in one sentence',
      'Honest caveat',
      'Judge Decision Trail',
      'Baseline because',
      'Next move: no-future replay',
      'RoleV3 because',
      'TailGuard because',
      'promote Conservative TailGuard Strong RoleV3',
      'Adventure Map',
      'No-future replay',
      'Final model',
      'Plain-English Decoder',
      'Replay old matches as if we were standing before each match',
      'win probabilities are honest',
      'What A Drive Team Gets',
      'Expected score',
      'Human boundary',
      'TailGuard Micro-Sensitivity Sweep',
      'TW=0.22 ranked first',
      'TW=0.21/TW=0.23',
      'Holdouts were mixed but useful',
      'The 90-Second Walkthrough',
      'The Adventure In Six Turns',
      'One-Minute Judge Script',
      'Conservative TailGuard Strong RoleV3'
    ].filter(text => !storyText.includes(text));
    missingStoryText.forEach(text => storyPageErrors.push(`START_HERE_STORY.html missing required text: ${text}`));
    const storyOverflow = (await storyPage.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'
    )) as boolean;
    if (storyOverflow) storyPageErrors.push('START_HERE_STORY.html has horizontal page overflow.');
    await storyPage.screenshot({ path: path.join(outputDir, 'start-here-story-screenshot.png'), fullPage: true });
    await storyPage.close();

    const onePageStoryPage = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const onePageStoryConsoleIssues: string[] = [];
    const onePageStoryPageErrors: string[] = [];
    onePageStoryPage.on('console', message => {
      if (message.type() === 'error') onePageStoryConsoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    onePageStoryPage.on('pageerror', error => onePageStoryPageErrors.push(String(error)));
    await onePageStoryPage.goto(`${url}ONE_PAGE_JUDGE_STORY.html`, { waitUntil: 'networkidle', timeout: 30000 });
    const onePageStoryText = String(await onePageStoryPage.evaluate('document.body.innerText || ""'));
    const missingOnePageStoryText = [
      'One-page model adventure',
      'Model in one sentence',
      'Conservative TailGuard Strong RoleV3',
      'Score MAE',
      '36.32',
      'Margin MAE',
      '49.73',
      'Deployment score',
      '0.126',
      'Plain-English number key',
      'typical alliance-score miss',
      'stability-adjusted selection score',
      'Three takeaways',
      'Reason: it stayed strongest after no-future replay',
      'Use: a pre-match score, win-chance, uncertainty, and role-risk briefing',
      'The adventure, without the proof wall',
      '30-second script',
      'no-future pre-match model',
      'Five proof beats',
      'Stop rule',
      'Judge Decision Trail',
      'Baseline because',
      'Next move: no-future replay',
      'RoleV3 because',
      'TailGuard because',
      'promote Conservative TailGuard Strong RoleV3',
      'Say this',
      'Avoid this',
      'Why the extra time mattered',
      'refreshed failure-mode diagnostics to TW=0.22',
      'older defaults cannot impersonate the final claim',
      'Dashboard proof',
      'Final gate proof'
    ].filter(text => !onePageStoryText.includes(text));
    missingOnePageStoryText.forEach(text => onePageStoryPageErrors.push(`ONE_PAGE_JUDGE_STORY.html missing required text: ${text}`));
    const onePageStoryOverflow = (await onePageStoryPage.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'
    )) as boolean;
    if (onePageStoryOverflow) onePageStoryPageErrors.push('ONE_PAGE_JUDGE_STORY.html has horizontal page overflow.');
    await onePageStoryPage.screenshot({ path: path.join(outputDir, 'one-page-judge-story-screenshot.png'), fullPage: true });
    await onePageStoryPage.close();

    const mobile = await checkViewport(browser, url, { width: 780, height: 1200 });
    await mobile.page.screenshot({ path: path.join(outputDir, 'dashboard-mobile-hero-screenshot.png'), fullPage: false });
    await mobile.page.screenshot({ path: path.join(outputDir, 'dashboard-mobile-screenshot.png'), fullPage: true });
    await mobile.page.close();

    const summary: DashboardBrowserQaSummary = {
      checkedAt: new Date().toISOString(),
      url,
      requiredBodyText: requiredBrowserQaText,
      desktopCheck: desktop.check,
      mobileCheck: mobile.check,
      consoleIssues: [...new Set([...desktop.consoleIssues, ...mobile.consoleIssues, ...storyConsoleIssues, ...onePageStoryConsoleIssues])],
      pageErrors: [...new Set([...desktop.pageErrors, ...mobile.pageErrors, ...storyPageErrors, ...onePageStoryPageErrors])],
      screenshots: [
        path.join(outputDir, 'dashboard-hero-screenshot.png'),
        path.join(outputDir, 'one-page-judge-story-screenshot.png'),
        path.join(outputDir, 'start-here-story-screenshot.png'),
        path.join(outputDir, 'dashboard-mobile-hero-screenshot.png'),
        path.join(outputDir, 'dashboard-print-preview-screenshot.png'),
        path.join(outputDir, 'dashboard-source-evidence-screenshot.png'),
        path.join(outputDir, 'dashboard-final-gate-screenshot.png'),
        path.join(outputDir, 'dashboard-starred-coverage-screenshot.png'),
        path.join(outputDir, 'dashboard-story-spine-screenshot.png'),
        path.join(outputDir, 'dashboard-model-anatomy-screenshot.png'),
        path.join(outputDir, 'dashboard-accuracy-stats-screenshot.png'),
        path.join(outputDir, 'dashboard-model-scores-screenshot.png'),
        path.join(outputDir, 'dashboard-mobile-screenshot.png'),
        path.join(outputDir, 'dashboard-fullpage-screenshot.png')
      ]
    };

    writeJsonFile(path.join(outputDir, 'browser-qa-summary.json'), summary);
    return summary;
  } finally {
    await browser.close();
    await closeServer(server);
  }
};
