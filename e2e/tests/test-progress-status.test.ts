import { test, expect } from '@playwright/test';
import { loginAsStudent, runCourseVideoAndQuiz, getCourseCard } from './common-utils';

// Scenario: run the learner completion flow and verify dashboard progress output.
// Expected result: the selected course card shows 100% completion percentage.
const COURSE_NAME =
  process.env.COURSE_NAME ?? 'MERN Developer Sprint: For MERN developer team testing';

test('Test progress status', async ({ page }) => {
  // Log browser-side signals to speed up root-cause analysis in CI failures.
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}]`, msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
  });

  page.on('requestfailed', (request) => {
    console.error('[requestfailed]', request.url(), request.failure()?.errorText);
  });

  await page.addInitScript(() => {
    (window as any).__E2E__ = true;
  });

  // Open landing page and execute learner flow against configured course.
  await page.goto('/');

  await loginAsStudent(page);

  console.log('URL after login:', page.url());

  await runCourseVideoAndQuiz(page, COURSE_NAME);

  const courseCard = await getCourseCard(page, COURSE_NAME);

  // Scope assertion to the selected course card to avoid false positives.
  const percentageValue = courseCard.locator(
    'div:has-text("Completion Percentage") >> text=/\\d+(\\.\\d+)?%/',
  );

  await expect(percentageValue).toHaveText('100%', { timeout: 30000 });
});
