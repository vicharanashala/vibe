import { test, expect } from '@playwright/test';

test('frontend app loads and renders shell', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__E2E__ = true;
  });

  await page.goto('/');
  console.log('current URL :', page.url());

  await expect(page.locator('body')).toBeVisible();
});
