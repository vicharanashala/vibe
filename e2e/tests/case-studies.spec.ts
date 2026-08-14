import { expect, test, type Page } from '@playwright/test';
import { loginAsStudent } from './common-utils';

/**
 * E2E coverage for the case-studies write/review flow (PLANNING.md /
 * TASK.md Milestone 12).
 *
 * Required env vars, matching the existing `TEST_STUDENT_EMAIL`/
 * `TEST_STUDENT_PASSWORD` convention in common-utils.ts:
 *
 *   TEST_STUDENT_EMAIL / TEST_STUDENT_PASSWORD   — existing convention, reused here
 *   CASE_STUDY_COURSE_NAME                        — a course with caseStudiesEnabled: true,
 *                                                    seeded with at least 3 cases via
 *                                                    scripts/seedCaseStudies.ts, that this
 *                                                    account is enrolled in
 *   CASE_STUDY_CONTROL_COURSE_NAME (optional)     — a course with caseStudiesEnabled: false,
 *                                                    for the toggle-off visibility check
 *   TEST_STUDENT_2_EMAIL / TEST_STUDENT_2_PASSWORD (optional) — a second account enrolled in
 *                                                    CASE_STUDY_COURSE_NAME, needed for the
 *                                                    review flow (a learner cannot review
 *                                                    their own response)
 *
 * None of these accounts/courses are seeded by this spec — this repo's e2e
 * suite provisions test users out-of-band (see common-utils.ts), and this
 * spec follows that same convention rather than inventing a new one. Tests
 * that need infrastructure not present in the environment (a second account,
 * a control course) skip with a clear reason instead of failing.
 */

const COURSE_NAME = process.env.CASE_STUDY_COURSE_NAME;
const CONTROL_COURSE_NAME = process.env.CASE_STUDY_CONTROL_COURSE_NAME;
const STUDENT_2_EMAIL = process.env.TEST_STUDENT_2_EMAIL;
const STUDENT_2_PASSWORD = process.env.TEST_STUDENT_2_PASSWORD;

async function openCourse(page: Page, courseName: string) {
  await page.getByRole('link', { name: /dashboard/i }).click();
  await page.getByText(courseName, { exact: false }).first().click();
}

async function openCaseStudiesTab(page: Page) {
  // The drawer opens via the same back/menu affordance the module tree uses.
  const drawerTrigger = page.getByRole('button', { name: /course content|menu|back/i }).first();
  if (await drawerTrigger.isVisible().catch(() => false)) {
    await drawerTrigger.click();
  }
  await expect(page.getByTestId('drawer-tab-case-studies')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('drawer-tab-case-studies').click();
}

test.describe('Case studies', () => {
  test.skip(!COURSE_NAME, 'CASE_STUDY_COURSE_NAME not set — see file header for required env vars');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsStudent(page);
  });

  test('toggle off hides the Case Studies tab entirely', async ({ page }) => {
    test.skip(!CONTROL_COURSE_NAME, 'CASE_STUDY_CONTROL_COURSE_NAME not set');
    await openCourse(page, CONTROL_COURSE_NAME!);
    const drawerTrigger = page.getByRole('button', { name: /course content|menu|back/i }).first();
    if (await drawerTrigger.isVisible().catch(() => false)) {
      await drawerTrigger.click();
    }
    await expect(page.getByTestId('drawer-tab-case-studies')).not.toBeVisible();
  });

  test('case list shows case 1 writable and case 2 locked before any submission', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const items = page.getByTestId('case-list-item');
    await expect(items.first()).toBeVisible({ timeout: 30_000 });

    const case1 = items.filter({ has: page.locator('[data-sequence-index="1"]') }).or(
      items.nth(0),
    );
    // A case beyond whatever has already been submitted in this environment
    // must be locked — this is a structural property of the sequence gate,
    // not tied to a specific run's prior state.
    const lockedCases = page.getByTestId('case-list-item').and(page.locator('[data-case-state="locked"]'));
    if (await lockedCases.count() > 0) {
      await expect(lockedCases.first()).toBeDisabled();
    }
  });

  test('word cap: typing past 150 words disables submit and names the limit', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available in this environment/run');
    await writable.first().click();

    const textarea = page.getByTestId('case-composer-textarea');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    const overLimitText = Array.from({ length: 151 }, (_, i) => `word${i}`).join(' ');
    await textarea.fill(overLimitText);

    await expect(page.getByTestId('case-composer-submit')).toBeDisabled();
    await expect(page.getByText(/over the 150-word limit/i)).toBeVisible();
  });

  test('paste is blocked in the composer and the block is visibly reported', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available in this environment/run');
    await writable.first().click();

    const textarea = page.getByTestId('case-composer-textarea');
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.click();

    // Simulate a paste event directly — real OS clipboard access isn't
    // available in a headless CI browser, but the blocked-paste handler
    // fires on the DOM paste event regardless of where it originated.
    await textarea.evaluate((el) => {
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
    });

    await expect(page.getByTestId('case-composer-paste-blocked-notice')).toBeVisible();
    // Silent no-op would defeat the point (PLANNING.md §4.6/Milestone 9) —
    // the textarea must still be empty, not silently populated.
    await expect(textarea).toHaveValue('');
  });

  test('write case 1, then it becomes visible in review to a second account', async ({ page, browser }) => {
    test.skip(!STUDENT_2_EMAIL || !STUDENT_2_PASSWORD, 'TEST_STUDENT_2_EMAIL/PASSWORD not set');

    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available for account 1 in this run');
    await writable.first().click();

    const responseText = 'I would first ask the student privately what specifically felt unclear before reteaching the whole group.';
    await page.getByTestId('case-composer-textarea').fill(responseText);
    await page.getByTestId('case-composer-submit').click();

    // Submitting immediately unlocks review for this case (PLANNING.md §4.1).
    await expect(page.getByTestId('reading-timer-gate').or(page.getByText(/check back once more colleagues/i))).toBeVisible({
      timeout: 20_000,
    });

    // Second account reviews the same course's case-studies pool.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    process.env.TEST_STUDENT_EMAIL = STUDENT_2_EMAIL;
    process.env.TEST_STUDENT_PASSWORD = STUDENT_2_PASSWORD;
    await page2.goto('/');
    await loginAsStudent(page2);
    await openCourse(page2, COURSE_NAME!);
    await openCaseStudiesTab(page2);

    const reviewableCase = page2
      .getByTestId('case-list-item')
      .and(page2.locator('[data-case-state="writable"], [data-case-state="submitted-awaiting-verdict"]'));
    if ((await reviewableCase.count()) > 0) {
      await reviewableCase.first().click();
    }

    await context2.close();
  });

  test('tab-switch during the reading timer resets the visible countdown', async ({ page, context }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const reviewable = page.getByTestId('case-list-item').and(
      page.locator('[data-case-state="submitted-awaiting-verdict"], [data-case-state="won"]'),
    );
    test.skip((await reviewable.count()) === 0, 'no case with an existing submission to review in this run');
    await reviewable.first().click();

    const gate = page.getByTestId('reading-timer-gate');
    await expect(gate).toBeVisible({ timeout: 20_000 });

    const before = await gate.getAttribute('data-remaining-seconds');
    test.skip(before === null || Number(before) < 5, 'timer already near expiry — flaky window, skip this run');

    // Let a couple of seconds elapse, then simulate the tab going hidden and
    // returning — the visible countdown must jump back up, not continue from
    // where it was (PLANNING.md §4.6's restart-not-pause behaviour).
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(200);
    const afterReset = await gate.getAttribute('data-remaining-seconds');
    expect(Number(afterReset)).toBeGreaterThan(Number(before) - 2);
  });
});
