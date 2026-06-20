import { test, expect } from 'playwright/test';

test('core routes render without a blank page', async ({ page }) => {
  for (const route of ['/scout', '/pit', '/history', '/admin', '/adminv4']) {
    await page.goto(route);
    await expect(page.locator('body')).toContainText(/scout|pit|history|admin|access|required/i);
  }
});

const adminFixtureRoute = '/adminv4?fixture=test-mode';
const impossiblePercentPattern = /\b(?:[2-9]\d{2}|\d{4,})(?:\.\d+)?%/;
const meetingModePattern = /m\s*e\s*e\s*t\s*i\s*n\s*g\s*m\s*o\s*d\s*e/i;

const expectNoImpossiblePercent = async (page) => {
  const textNodes = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const values: string[] = [];
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent?.trim();
      if (value) values.push(value);
      node = walker.nextNode();
    }
    return values;
  });
  expect(textNodes.filter(text => impossiblePercentPattern.test(text))).toEqual([]);
};

const openAdminWorkflow = async (page, label, value) => {
  const workflowSelect = page.locator('select[aria-label="Admin workflow"]');
  if (await workflowSelect.isVisible()) {
    await workflowSelect.selectOption(value);
    return;
  }

  const primaryButton = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await primaryButton.isVisible()) {
    await primaryButton.click();
    return;
  }

  await page.getByRole('button', { name: /Admin workflows|More/i }).click();
  await page.getByRole('menuitem', { name: new RegExp(label, 'i') }).click();
};

test('Admin V4 fixture workflows preserve context and stay task-focused', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop workflow loop avoids duplicating the focused mobile navigation regression.');

  await page.goto(adminFixtureRoute);
  await expect(page.getByPlaceholder('Search team number or name')).toBeVisible();
  await expect(page.locator('body')).toContainText(/Next Best Action/);
  await expectNoImpossiblePercent(page);

  await openAdminWorkflow(page, 'Collect Missing Data', 'import');
  await expect(page).toHaveURL(/fixture=test-mode/);
  await expect(page).toHaveURL(/panel=collection/);
  await expect(page.locator('body')).toContainText(/What to send scouts to collect next/);

  const workflows = [
    ['Teams', 'sorter', /Team Decision Board/],
    ['Matches', 'predictor', /Automatic Future Match Simulations/],
    ['Pick List', 'pickList', meetingModePattern],
    ['Visualize', 'visualize', /Choose The Question/],
    ['Data Health', 'import', /Data Control Room/],
    ['Reports', 'export', /Audience Report Packs/]
  ];

  for (const [label, value, expectedText] of workflows) {
    await openAdminWorkflow(page, label, value);
    await expect(page).toHaveURL(/fixture=test-mode/);
    await expect(page.locator('body')).toContainText(expectedText);
    await expectNoImpossiblePercent(page);
  }
});

test('Admin V4 fixture treats the selected cutoff match as future and never renders impossible defense percentages', async ({ page }) => {
  await page.goto(`${adminFixtureRoute}&tab=matches`);
  await expect(page.locator('body')).toContainText(/Automatic Future Match Simulations/);
  await expect(page.locator('body')).toContainText(/Test Mode rewind before QM3/);
  await expect(page.locator('body')).toContainText(/Next Known Match\s*QM3/);
  await expect(page.locator('body')).not.toContainText(/Red 91\s*\/\s*Blue 89/);
  await expectNoImpossiblePercent(page);
});

test('Admin V4 search opens teams by name with enter and button', async ({ page }) => {
  await page.goto(adminFixtureRoute);
  const search = page.getByPlaceholder('Search team number or name');
  await expect(search).toHaveValue('103');

  await search.fill('Cheesy Poofs');
  await expect(search).toHaveValue('Cheesy Poofs');
  await search.press('Enter');
  await expect(page.locator('body')).toContainText(/Team 254|Cheesy Poofs/);
  await expect(page).toHaveURL(/team=254/);

  await page.goto(adminFixtureRoute);
  await search.fill('Citrus Circuits');
  await page.getByRole('button', { name: /Open searched team/i }).click();
  await expect(page.locator('body')).toContainText(/Team 1678|Citrus Circuits/);
  await expect(page).toHaveURL(/team=1678/);
});

test('Admin V4 background refresh keeps the visible list anchored', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop scroll anchoring covers the dense table experience.');

  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto(`${adminFixtureRoute}&tab=teams`);
  await expect(page.locator('body')).toContainText(/Team Decision Board/);

  const main = page.locator('main');
  await expect.poll(async () => main.evaluate(element => element.scrollHeight > element.clientHeight)).toBeTruthy();
  await main.evaluate(element => {
    element.scrollTop = Math.min(520, Math.max(0, element.scrollHeight - element.clientHeight));
  });
  const beforeRefreshScrollTop = await main.evaluate(element => element.scrollTop);
  expect(beforeRefreshScrollTop).toBeGreaterThan(0);

  const refreshButton = page.getByRole('button', { name: /Refresh data/i });
  await openAdminWorkflow(page, 'Teams', 'sorter');
  await expect.poll(async () => refreshButton.evaluate(button => {
    const svg = button.querySelector('svg');
    return button.hasAttribute('disabled') && Boolean(svg?.classList.contains('animate-spin'));
  }), { intervals: [50, 100, 150, 250, 500] }).toBeTruthy();
  await expect(refreshButton).toBeEnabled();

  const afterRefreshScrollTop = await main.evaluate(element => element.scrollTop);
  expect(Math.abs(afterRefreshScrollTop - beforeRefreshScrollTop)).toBeLessThanOrEqual(4);
});

test('Admin V4 stages sensitive data operations behind clear review surfaces', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop data safety coverage avoids duplicating mobile navigation checks.');

  await page.goto(`${adminFixtureRoute}&tab=data&panel=backup`);
  await expect(page.locator('body')).toContainText(/Sync And Backup/);
  await expect(page.locator('body')).toContainText(/remote write to Firebase/i);
  await expect(page.locator('body')).toContainText(/team strategy, scout names/i);
  await expect(page.getByText(/Export Safe Summary/i)).toBeVisible();
  await expect(page.getByText(/Preview Import Backup/i)).toBeVisible();

  await page.getByRole('button', { name: /Export Full Backup/i }).click();
  await expect(page.getByRole('dialog', { name: /Export Full Local Backup/i })).toContainText(/team strategy, scout names/i);
  await expect(page.getByRole('dialog', { name: /Export Full Local Backup/i })).toContainText(/FIRST tokens are not included/i);
  await page.getByRole('button', { name: /^Cancel$/i }).click();

  await page.getByRole('button', { name: /^Settings$/i }).click();
  await expect(page.getByRole('dialog', { name: /^Settings$/i })).toContainText(/stored only in this browser on this device/i);
  await expect(page.getByRole('dialog', { name: /^Settings$/i })).toContainText(/Local Credential Danger Zone/i);
  await page.getByRole('button', { name: /^Clear TBA$/i }).click();
  await expect(page.getByRole('dialog', { name: /Clear TBA API Key/i })).toContainText(/from this browser\/device/i);
  await expect(page.getByRole('dialog', { name: /Clear TBA API Key/i })).toContainText(/upload it again/i);
});

test('Admin V4 visualize renders real vertical charts and Stats Wiki opens from context help', async ({ page }) => {
  await page.goto(`${adminFixtureRoute}&tab=visualize`);
  await expect.poll(async () => page.locator('.recharts-cartesian-axis').count()).toBeGreaterThan(1);
  await expect.poll(async () => page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll('.recharts-bar-rectangle rect, .recharts-bar-rectangle path, svg rect'));
    return rects.filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    }).length;
  })).toBeGreaterThan(0);

  await page.goto(`${adminFixtureRoute}&tab=matches`);
  await expect(page.getByPlaceholder('Search team number or name')).toBeVisible();
  const expectedRangeButton = page.getByRole('button', { name: /Expected Range/i }).first();
  await expect(expectedRangeButton).toBeVisible();
  await expectedRangeButton.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Get Info/i }).click();
  await expect(page.locator('body')).toContainText(/Stats Wiki/);
  await expect(page.locator('body')).toContainText(/Formula/);
  await expect(page).toHaveURL(/stat=ppa/);
});

test('Admin V4 mobile keeps workflows compact and avoids horizontal overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile regression belongs to the mobile Chrome project');

  await page.goto(adminFixtureRoute);
  await expect(page.locator('select[aria-label="Admin workflow"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Admin workflows/i })).toBeVisible();
  await expect(page.locator('body')).toContainText(/Next Best Action/);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
});

test('Scout history export opens a privacy review before sharing evidence', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop history privacy coverage keeps this check focused and stable.');

  await page.goto('/history');
  const usernameInput = page.getByPlaceholder('Your scout name');
  await usernameInput.fill('QA Scout', { timeout: 10000 });
  await page.getByRole('button', { name: /Attach Name To This Device/i }).click();
  await expect(usernameInput).toBeHidden();

  await expect(page.locator('body')).toContainText(/Local Scouting Ledger/);
  await page.getByRole('button', { name: /Download Evidence JSON/i }).click();
  const dialog = page.getByRole('dialog', { name: /Export Device Evidence JSON/i });
  await expect(dialog).toContainText(/Privacy Review/i);
  await expect(dialog).toContainText(/scout names, team strategy notes, match evidence/i);
  await expect(dialog).toContainText(/Export Compact Summary/i);
  await expect(dialog).toContainText(/Export Evidence JSON/i);
});
