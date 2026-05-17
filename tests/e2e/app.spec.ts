import { test, expect } from 'playwright/test';

test('core routes render without a blank page', async ({ page }) => {
  for (const route of ['/scout', '/pit', '/history', '/admin', '/adminv4']) {
    await page.goto(route);
    await expect(page.locator('body')).toContainText(/scout|pit|history|admin|access|required/i);
  }
});
