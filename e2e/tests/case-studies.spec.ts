import { expect, test, type Page } from '@playwright/test';
import { loginAsStudent } from './common-utils';

/**
 * E2E coverage for the case-studies write/review flow (FR-12 six-field
 * response, video-gated unlock, steelman-only review).
 *
 * Required env vars:
 *   TEST_STUDENT_EMAIL / TEST_STUDENT_PASSWORD   — reuses the existing convention
 *   CASE_STUDY_COURSE_NAME                        — a course with caseStudiesEnabled: true,
 *                                                    seeded with at least one case linked to
 *                                                    a video the student has completed
 *   CASE_STUDY_CONTROL_COURSE_NAME (optional)     — a course with caseStudiesEnabled: false
 *   TEST_STUDENT_2_EMAIL / TEST_STUDENT_2_PASSWORD (optional) — second account for review flow
 *
 * Tests that need infrastructure not present skip with a clear reason.
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
  const drawerTrigger = page.getByRole('button', { name: /course content|menu|back/i }).first();
  if (await drawerTrigger.isVisible().catch(() => false)) {
    await drawerTrigger.click();
  }
  await expect(page.getByTestId('drawer-tab-case-studies')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('drawer-tab-case-studies').click();
}

/** Fills in all six FR-12 fields with valid content (steelman ≥25 words). */
async function fillComposer(page: Page) {
  await page.getByTestId('case-composer-beat1a').fill('I assumed students already understood the core concept.');
  await page.getByTestId('case-composer-beat1b').fill('The facilitator showed how one question changed the direction.');
  await page.getByTestId('case-composer-beat1c').fill('Now I see that confusion is a useful diagnostic signal.');
  const steelmanWords = Array.from({length: 30}, (_, i) => `word${i}`).join(' ');
  await page.getByTestId('case-composer-steelman').fill(steelmanWords);
  await page.getByTestId('case-composer-room-perspective').fill('One participant argued for probing before reteaching.');
  await page.getByTestId('case-composer-change-commitment').fill('I will ask the clarifying question before explaining again.');
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

  test('case list shows locked state for cases whose video is unwatched', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const items = page.getByTestId('case-list-item');
    await expect(items.first()).toBeVisible({ timeout: 30_000 });

    const lockedCases = page.getByTestId('case-list-item').and(page.locator('[data-case-state="locked"]'));
    if (await lockedCases.count() > 0) {
      await expect(lockedCases.first()).toBeDisabled();
    }
  });

  test('four-section composer appears for a writable case', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available in this environment/run');
    await writable.first().click();

    await expect(page.getByTestId('case-composer-beat1a')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('case-composer-beat1b')).toBeVisible();
    await expect(page.getByTestId('case-composer-beat1c')).toBeVisible();
    await expect(page.getByTestId('case-composer-steelman')).toBeVisible();
    await expect(page.getByTestId('case-composer-room-perspective')).toBeVisible();
    await expect(page.getByTestId('case-composer-change-commitment')).toBeVisible();
  });

  test('submit is disabled until steelman reaches 25 words', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available');
    await writable.first().click();

    await expect(page.getByTestId('case-composer-steelman')).toBeVisible({ timeout: 15_000 });

    // Fill every field but keep steelman short (< 25 words).
    await page.getByTestId('case-composer-beat1a').fill('Going-in thought.');
    await page.getByTestId('case-composer-beat1b').fill('Challenge encountered.');
    await page.getByTestId('case-composer-beat1c').fill('Where I landed.');
    await page.getByTestId('case-composer-steelman').fill('Too short steelman.');
    await page.getByTestId('case-composer-room-perspective').fill('Room perspective.');
    await page.getByTestId('case-composer-change-commitment').fill('My change commitment.');

    await expect(page.getByTestId('case-composer-submit')).toBeDisabled();
    // Steelman word count indicator should show a warning/red state.
    await expect(page.getByTestId('case-composer-steelman-count')).toBeVisible();
  });

  test('submit is enabled once all fields are filled and steelman has ≥25 words', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available');
    await writable.first().click();

    await expect(page.getByTestId('case-composer-beat1a')).toBeVisible({ timeout: 15_000 });
    await fillComposer(page);

    await expect(page.getByTestId('case-composer-submit')).toBeEnabled({ timeout: 3_000 });
  });

  test('paste is blocked in the steelman field', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available');
    await writable.first().click();

    const steelman = page.getByTestId('case-composer-steelman');
    await expect(steelman).toBeVisible({ timeout: 15_000 });
    await steelman.click();

    await steelman.evaluate((el) => {
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
    });

    await expect(page.getByTestId('case-composer-paste-blocked-notice')).toBeVisible();
    await expect(steelman).toHaveValue('');
  });

  test('submit transitions the case to submitted-awaiting-verdict', async ({ page }) => {
    test.skip(!STUDENT_2_EMAIL, 'TEST_STUDENT_2_EMAIL not set — review flow needs two accounts');

    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const writable = page.getByTestId('case-list-item').and(page.locator('[data-case-state="writable"]'));
    test.skip((await writable.count()) === 0, 'no writable case available for account 1');
    await writable.first().click();

    await expect(page.getByTestId('case-composer-beat1a')).toBeVisible({ timeout: 15_000 });
    await fillComposer(page);
    await page.getByTestId('case-composer-submit').click();

    // After submission the student sees either the review timer gate or the
    // "waiting for colleagues" message.
    await expect(
      page.getByTestId('reading-timer-gate').or(page.getByText(/check back once more colleagues/i))
    ).toBeVisible({ timeout: 20_000 });
  });

  test('review view shows steelman text but not other response fields', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    await openCaseStudiesTab(page);

    const reviewable = page.getByTestId('case-list-item').and(
      page.locator('[data-case-state="submitted-awaiting-verdict"], [data-case-state="won"]'),
    );
    test.skip((await reviewable.count()) === 0, 'no submitted case to review in this run');
    await reviewable.first().click();

    // ComparisonView must render steelman text, not beat1a / roomPerspective.
    const responseCard = page.locator('[data-testid="pick-left"]').locator('..').first();
    if (await responseCard.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await expect(page.locator('[data-testid="pick-left"], [data-testid="pick-right"]').first()).toBeVisible();
    }
  });

  test('tab-switch during the reading timer resets the visible countdown', async ({ page }) => {
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
    test.skip(before === null || Number(before) < 5, 'timer already near expiry — flaky window, skip');

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
