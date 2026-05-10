import { test, expect } from '@playwright/test';

/**
 * Regression — stop API errors on rapid item switch
 *
 * Bug: switching items rapidly produced uncaught errors from the stop-progress
 * API. Fix #982 (commit 2e93bab07) made stop-API failures non-fatal and
 * de-duplicated repeated stop calls.
 *
 * This spec asserts rapid switching does not surface uncaught errors.
 */

test.describe('@regression stop API does not error on rapid item switch', () => {
  test.skip('rapid switch between video items completes cleanly', async ({ page: _page }) => {
    // 1. Sign in as student in a seeded course with multiple video items.
    // 2. Click item A → wait for player.
    // 3. Within 2s, click item B → wait for player.
    // 4. Within 2s, click item C → wait for player.
    // 5. Assert no console errors and no toast/error UI surfaced.
    expect.fail('Pending: requires seeded course with 3+ video items.');
  });
});
