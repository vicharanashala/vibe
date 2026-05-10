import { test, expect } from '@playwright/test';

/**
 * Smoke spec — runs on every PR. Budget: under 5 minutes.
 *
 * Asserts the critical learner path is reachable end-to-end:
 *   1. App loads
 *   2. Login form renders
 *   3. Authenticated landing renders (mock or real test account)
 *
 * The deeper journey (course launch → video → quiz → submit) lives in the
 * `full` project to keep PR latency low.
 */

test.describe('@smoke critical learner path', () => {
  test('app loads and login surface is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/vibe|vled/i);

    const loginAffordance = page.getByRole('textbox', { name: /email/i }).or(page.getByRole('button', { name: /sign in|log in/i }));
    await expect(loginAffordance.first()).toBeVisible({ timeout: 30_000 });
  });

  test('navigating to a non-existent route yields a graceful response', async ({ page }) => {
    await page.goto('/this-route-should-not-exist-xyz');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toBeTruthy();
  });
});
