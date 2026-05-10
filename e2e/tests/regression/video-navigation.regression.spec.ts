import { test, expect } from '@playwright/test';

/**
 * Regression — Video navigation / Rewatch
 *
 * Bug: "Rewatch Video" button routed incorrectly and triggered a 403 against
 * the stop-progress API. Fix #981 (commit de201cbd2) corrected routing so
 * Rewatch Video lands on the player without errors.
 *
 * This spec asserts the Rewatch path completes without API errors.
 */

test.describe('@regression video navigation — Rewatch routes correctly', () => {
  test.skip('Rewatch Video lands on the player without 403 from stop API', async ({ page: _page }) => {
    // 1. Sign in as student with a partially-completed video.
    // 2. From course-page, click "Rewatch Video".
    // 3. Wait for /api/progress/stop response — assert status !== 403.
    // 4. Assert video player surface is visible.
    expect.fail('Pending: requires seeded course with a completed video item.');
  });
});
