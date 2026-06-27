import { chromium } from 'playwright';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = process.env.ADMINV4_QA_URL || 'http://127.0.0.1:4180/adminv4?fixture=test-mode';
const smartSearchSelector = 'input[placeholder="Search or ask: team, stat, scouts, export, API keys"]';

const waitForAdmin = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3500);
  await page.waitForFunction(
    () => document.body.innerText.includes('ADMIN V4') && document.body.innerText.length > 100,
    null,
    { timeout: 15000 }
  );
};

const visit = async (page, params = '') => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  await page.goto(params ? `${baseUrl}${separator}${params}` : baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForAdmin(page);
};

const assertText = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertNoText = (text, forbidden, message) => {
  for (const pattern of forbidden) {
    assertText(!pattern.test(text), `${message}: ${pattern}`);
  }
};

const impossiblePercentPattern = /\b(?:[2-9]\d{2}|\d{4,})(?:\.\d+)?%/;
const meetingModePattern = /m\s*e\s*e\s*t\s*i\s*n\s*g\s*m\s*o\s*d\s*e/i;

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage'
  ]
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

  await visit(page);
  await page.screenshot({ path: '/private/tmp/adminv4-final-now.png', fullPage: true });
  const nowText = await page.locator('body').innerText();
  assertText(/Next Best Action/i.test(nowText), 'Now screen does not expose one primary next action.');
  assertText(/Match-Day Trust/i.test(nowText), 'Now screen does not show a match-day trust label.');
  assertText(/Required Action/i.test(nowText), 'Now screen does not show the required action.');
  assertNoText(
    nowText,
    [/High model trust/i, /Medium model trust/i, /Low model trust/i, /Fallback Only/i, /Official source cache is missing/i, /Strategy Brain/i, /Scout Ops/i, /Sidebar/i, impossiblePercentPattern],
    'Now screen leaked old expert/sidebar language'
  );

  await page.locator(smartSearchSelector).fill('Cheesy Poofs');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/private/tmp/adminv4-final-search-enter.png', fullPage: true });
  const enterSearchText = await page.locator('body').innerText();
  assertText(/254|Cheesy Poofs/i.test(enterSearchText), 'Enter search did not open team 254 by name.');
  assertText(page.url().includes('fixture=test-mode'), 'Enter search dropped fixture test-mode context.');

  await visit(page);
  await page.locator(smartSearchSelector).fill('Citrus Circuits');
  await page.getByRole('button', { name: /Open Team 1678 - Citrus Circuits/i }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/private/tmp/adminv4-final-search-button.png', fullPage: true });
  const buttonSearchText = await page.locator('body').innerText();
  assertText(/1678|Citrus Circuits/i.test(buttonSearchText), 'Open Team button did not open team 1678 by name.');
  assertText(page.url().includes('fixture=test-mode'), 'Open Team button dropped fixture test-mode context.');

  await visit(page, 'tab=data&panel=collection');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/private/tmp/adminv4-final-collection.png', fullPage: true });
  const collectionText = await page.locator('body').innerText();
  assertText(/What to send scouts to collect next/i.test(collectionText), 'Collect Missing Data did not open the collection pipeline.');
  assertText(page.url().includes('fixture=test-mode'), 'Collect Missing Data route dropped fixture test-mode context.');

  await visit(page, 'tab=matches');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/private/tmp/adminv4-final-matches.png', fullPage: true });
  const matchesText = await page.locator('body').innerText();
  assertText(/Automatic Future Match Simulations/i.test(matchesText), 'Matches did not open automatic future simulations.');
  assertText(/Test Mode rewind before QM3/i.test(matchesText), 'Matches did not show the selected fixture cutoff.');
  assertText(/Next Known Match\s+QM3/i.test(matchesText), 'Selected fixture match is not treated as the next future match.');
  assertNoText(
    matchesText,
    [/Red 91\s*\/\s*Blue 89/i, impossiblePercentPattern],
    'Matches leaked played selected-match score or impossible percentages'
  );

  await visit(page, 'tab=visualize');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/private/tmp/adminv4-final-visualize.png', fullPage: true });
  const chartInfo = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll('.recharts-bar-rectangle rect, .recharts-bar-rectangle path, svg rect'));
    const positiveBars = rects.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    }).length;
    return {
      positiveBars,
      axes: document.querySelectorAll('.recharts-cartesian-axis').length
    };
  });
  assertText(chartInfo.positiveBars > 0, 'Visualize did not render visible vertical bar marks.');
  assertText(chartInfo.axes >= 2, 'Visualize did not render x/y axes.');

  await visit(page, 'tab=picklist');
  await page.screenshot({ path: '/private/tmp/adminv4-final-picklist.png', fullPage: true });
  const pickText = await page.locator('body').innerText();
  assertText(meetingModePattern.test(pickText), 'Pick List did not open in meeting-mode framing.');
  assertText(/Live Pick Call Sheet/i.test(pickText), 'Pick List is missing the live pick call sheet.');
  assertText(/Primary choice/i.test(pickText), 'Pick List call sheet does not show the primary choice.');

  await visit(page, 'tab=wiki&stat=ppa');
  await page.screenshot({ path: '/private/tmp/adminv4-final-wiki.png', fullPage: true });
  const wikiText = await page.locator('body').innerText();
  const normalizedWikiText = wikiText.toLowerCase();
  const wikiHasRequiredFields = ['definition', 'formula', 'source', 'interpret', 'limitations', 'where'].every((label) =>
    normalizedWikiText.includes(label)
  );
  assertText(wikiHasRequiredFields, 'Stats Wiki is missing required explanation fields.');

  await visit(page);
  await page.getByRole('button', { name: /^Settings$/i }).click();
  await page.screenshot({ path: '/private/tmp/adminv4-final-settings.png', fullPage: true });
  const settingsText = await page.locator('body').innerText();
  assertText(/stored only in this browser on this device/i.test(settingsText), 'Settings does not warn that local API keys stay on this browser/device.');
  assertText(/Local Credential Danger Zone/i.test(settingsText), 'Settings is missing the local credential danger zone.');

  await visit(page);
  await page.keyboard.press('Shift+D');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/private/tmp/adminv4-final-demo-proof-shortcut.png', fullPage: true });
  const demoText = await page.locator('body').innerText();
  assertText(/Audience Report Packs/i.test(demoText), 'Demo proof shortcut did not open Reports.');
  assertText(/Do This First\s+Model Demo Proof/i.test(demoText), 'Demo proof shortcut did not spotlight Model Demo Proof.');
  assertNoText(
    demoText,
    [/judge mode/i, /judges are here/i],
    'Demo proof shortcut exposed judge-mode wording'
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await visit(mobile);
  await mobile.screenshot({ path: '/private/tmp/adminv4-final-mobile.png', fullPage: true });
  const mobileText = await mobile.locator('body').innerText();
  const mobileInfo = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasWorkflowMenuButton: Boolean(document.querySelector('button[aria-label="Admin workflows"]'))
  }));
  assertText(/Next Decision|Next Best Action/i.test(mobileText), 'Mobile first workflow is missing the primary next action copy.');
  assertText(/Match-Day Trust/i.test(mobileText), 'Mobile first workflow is missing match-day trust copy.');
  assertText(/Required Action/i.test(mobileText), 'Mobile first workflow is missing required action copy.');
  assertNoText(
    mobileText,
    [/High model trust/i, /Fallback Only/i, /Official source cache is missing/i, /Strategy Brain/i, /Scout Ops/i],
    'Mobile layout leaked old expert/sidebar language'
  );
  assertText(mobileInfo.hasWorkflowMenuButton, 'Mobile layout is missing compact workflow menu button.');
  assertText(mobileInfo.scrollWidth <= mobileInfo.clientWidth + 2, 'Mobile layout has horizontal overflow.');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    chartInfo,
    mobileInfo,
    screenshots: [
      '/private/tmp/adminv4-final-now.png',
      '/private/tmp/adminv4-final-search-enter.png',
      '/private/tmp/adminv4-final-search-button.png',
      '/private/tmp/adminv4-final-collection.png',
      '/private/tmp/adminv4-final-matches.png',
      '/private/tmp/adminv4-final-visualize.png',
      '/private/tmp/adminv4-final-picklist.png',
      '/private/tmp/adminv4-final-wiki.png',
      '/private/tmp/adminv4-final-settings.png',
      '/private/tmp/adminv4-final-demo-proof-shortcut.png',
      '/private/tmp/adminv4-final-mobile.png'
    ]
  }, null, 2));
} finally {
  await browser.close();
}
