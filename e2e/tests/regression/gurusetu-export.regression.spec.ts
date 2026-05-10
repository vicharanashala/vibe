import { test, expect } from '@playwright/test';

/**
 * Regression — Gurusetu feedback export
 *
 * Bug: gurusetu export was previously dropping rows for enrolled students who
 * had not yet watched a given video, returning a partial dataset. Fix #984
 * (commit 60bc6f2ec) changed the export to emit every (enrolled student × video)
 * row with its watch percentage.
 *
 * This spec asserts the new contract: the export contains a row per
 * (enrolled student × video) tuple. Skipped until a fixture course is wired
 * into staging seed data; replace `test.skip` with `test` once seeded.
 */

test.describe('@regression gurusetu export — every (student × video) row', () => {
  test.skip('export CSV contains a row for each (enrolled-student × video) pair', async ({ page: _page }) => {
    // 1. Sign in as teacher with seeded course `Vibe Demo Course`.
    // 2. Navigate to course-enrollments → "Download Gurusetu Feedback".
    // 3. Capture downloaded CSV via page.waitForEvent('download').
    // 4. Read CSV rows; assert rows.length === enrolledStudentCount * videoItemCount.
    // 5. Assert each row has watchedPct in [0, 100].
    expect.fail('Pending: requires seeded fixture course in staging.');
  });
});
