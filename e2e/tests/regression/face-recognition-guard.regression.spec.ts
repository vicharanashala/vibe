import { test, expect } from '@playwright/test';

/**
 * Regression — Face-recognition settings guard
 *
 * Bug: settings page crashed/blocked when the user had not granted face
 * permission yet. Fix #983 (commit e438c588c) made the settings surface
 * accessible without requiring an active face-recognition session.
 *
 * This spec asserts the guard does not block the settings surface when the
 * camera permission has not been granted.
 */

test.describe('@regression face-recognition settings guard', () => {
  test.skip('settings page renders even without face-permission session', async ({ page: _page }) => {
    // 1. Sign in as student (fresh account — never granted face permission).
    // 2. Navigate to Settings.
    // 3. Assert settings sections render (profile, notifications, etc.).
    // 4. Assert no fatal error overlay or redirect to face-recognition setup.
    expect.fail('Pending: requires staging account and route paths.');
  });
});
