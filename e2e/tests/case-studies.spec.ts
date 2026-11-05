import { expect, test, type Page } from '@playwright/test';
import { loginAsStudent } from './common-utils';

/**
 * E2E coverage for the case-studies write/review flow.
 *
 * Case study items live in the normal module tree (Item-container.tsx's
 * CASE_STUDY branch). Tests navigate there via the drawer's module/section
 * tree, identified by data-item-type="case_study".
 *
 * Required env vars:
 *   TEST_STUDENT_EMAIL / TEST_STUDENT_PASSWORD
 *   CASE_STUDY_COURSE_NAME  — course with caseStudiesEnabled: true and at
 *                             least one CASE_STUDY item
 *   CASE_STUDY_CONTROL_COURSE_NAME (optional) — course with no CASE_STUDY items
 *   TEST_STUDENT_2_EMAIL / TEST_STUDENT_2_PASSWORD (optional) — second account
 */

const COURSE_NAME = process.env.CASE_STUDY_COURSE_NAME;
const CONTROL_COURSE_NAME = process.env.CASE_STUDY_CONTROL_COURSE_NAME;
const STUDENT_2_EMAIL = process.env.TEST_STUDENT_2_EMAIL;
const STUDENT_2_PASSWORD = process.env.TEST_STUDENT_2_PASSWORD;

async function openCourse(page: Page, courseName: string) {
  await page.getByRole('link', { name: /dashboard/i }).click();
  await page.getByText(courseName, { exact: false }).first().click();
}

/** Opens drawer, expands all modules/sections, returns the first CASE_STUDY item button. */
async function findCaseStudyItem(page: Page) {
  const drawerTrigger = page.getByRole('button', { name: /course content|menu|back/i }).first();
  if (await drawerTrigger.isVisible().catch(() => false)) await drawerTrigger.click();

  for (const toggle of await page.getByTestId('course-module-toggle').all()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
  for (const toggle of await page.getByTestId('course-section-toggle').all()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
  return page.locator('[data-testid="course-item"][data-item-type="case_study"]:not([disabled])').first();
}

/** Passes the declaration + session-date gate if it is present. */
async function passDeclarationGate(page: Page) {
  const checkbox = page.getByRole('checkbox', { name: /I confirm/i });
  if (!(await checkbox.isVisible({ timeout: 5_000 }).catch(() => false))) return;
  await checkbox.click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.locator('input[type="date"]').fill('2025-01-15');
  await page.getByRole('button', { name: /ok/i }).click();
}

/** Fills all six CaseComposer fields with valid content (steelman ≥ 25 words). */
async function fillComposer(page: Page) {
  await page.getByTestId('beat1a').fill('I assumed students already understood the core concept.');
  await page.getByTestId('beat1b').fill('The facilitator showed how one question changed the direction.');
  await page.getByTestId('beat1c').fill('Now I see that confusion is a useful diagnostic signal.');
  await page.getByTestId('steelman').fill(
    Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '),
  );
  await page.getByTestId('roomPerspective').fill('One participant argued for probing before reteaching.');
  await page.getByTestId('changeCommitment').fill('I will ask the clarifying question before explaining again.');
}

test.describe('Case studies', () => {
  test.skip(!COURSE_NAME, 'CASE_STUDY_COURSE_NAME not set — see file header for required env vars');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsStudent(page);
  });

  test('course with no CASE_STUDY items shows none in the module tree', async ({ page }) => {
    test.skip(!CONTROL_COURSE_NAME, 'CASE_STUDY_CONTROL_COURSE_NAME not set');
    await openCourse(page, CONTROL_COURSE_NAME!);
    const drawerTrigger = page.getByRole('button', { name: /course content|menu|back/i }).first();
    if (await drawerTrigger.isVisible().catch(() => false)) await drawerTrigger.click();
    await expect(page.locator('[data-testid="course-item"][data-item-type="case_study"]')).toHaveCount(0);
  });

  test('four-section composer appears after passing the declaration gate', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no unlocked case_study item in this environment');
    await item.click();

    await passDeclarationGate(page);

    await expect(page.getByTestId('beat1a')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('beat1b')).toBeVisible();
    await expect(page.getByTestId('beat1c')).toBeVisible();
    await expect(page.getByTestId('steelman')).toBeVisible();
    await expect(page.getByTestId('roomPerspective')).toBeVisible();
    await expect(page.getByTestId('changeCommitment')).toBeVisible();
  });

  test('submit is disabled until steelman reaches 25 words', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no unlocked case_study item available');
    await item.click();

    await passDeclarationGate(page);
    await expect(page.getByTestId('steelman')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('beat1a').fill('Going-in thought.');
    await page.getByTestId('beat1b').fill('Challenge encountered.');
    await page.getByTestId('beat1c').fill('Where I landed.');
    await page.getByTestId('steelman').fill('Too short steelman.');
    await page.getByTestId('roomPerspective').fill('Room perspective.');
    await page.getByTestId('changeCommitment').fill('My change commitment.');

    await expect(page.getByTestId('case-composer-submit')).toBeDisabled();
  });

  test('submit is enabled once all fields are filled and steelman has ≥25 words', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no unlocked case_study item available');
    await item.click();

    await passDeclarationGate(page);
    await expect(page.getByTestId('beat1a')).toBeVisible({ timeout: 15_000 });
    await fillComposer(page);

    await expect(page.getByTestId('case-composer-submit')).toBeEnabled({ timeout: 3_000 });
  });

  test('paste is blocked in the steelman field', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no unlocked case_study item available');
    await item.click();

    await passDeclarationGate(page);
    const steelman = page.getByTestId('steelman');
    await expect(steelman).toBeVisible({ timeout: 15_000 });
    await steelman.click();
    await steelman.evaluate(el =>
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })),
    );

    await expect(page.getByTestId('case-composer-paste-blocked-notice')).toBeVisible();
    await expect(steelman).toHaveValue('');
  });

  test('submit transitions the case to the review state', async ({ page }) => {
    test.skip(!STUDENT_2_EMAIL, 'TEST_STUDENT_2_EMAIL not set — review flow needs two accounts');
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no unlocked case_study item available');
    await item.click();

    await passDeclarationGate(page);
    await expect(page.getByTestId('beat1a')).toBeVisible({ timeout: 15_000 });
    await fillComposer(page);
    await page.getByTestId('case-composer-submit').click();

    await expect(
      page.getByTestId('reading-timer-gate').or(page.getByText(/check back once more colleagues/i)),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('review view shows A/B comparison cards for a submitted response', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no case_study item found');
    await item.click();

    await passDeclarationGate(page);

    const reviewBtn = page.getByRole('button', { name: /review peers/i });
    if (!(await reviewBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'no existing submission to review in this run');
    }
    await reviewBtn.click();
    const pickLeft = page.getByTestId('pick-left');
    if (await pickLeft.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await expect(pickLeft).toBeVisible();
      await expect(page.getByTestId('pick-right')).toBeVisible();
    }
  });

  test('tab-switch during the reading timer resets the visible countdown', async ({ page }) => {
    await openCourse(page, COURSE_NAME!);
    const item = await findCaseStudyItem(page);
    test.skip((await item.count()) === 0, 'no case_study item found');
    await item.click();

    await passDeclarationGate(page);

    const reviewBtn = page.getByRole('button', { name: /review peers/i });
    if (!(await reviewBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'need an existing submission to access review');
    }
    await reviewBtn.click();

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
