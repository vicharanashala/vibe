import { test, expect } from '@playwright/test';
import { loginAsStudent, runCourseVideoAndQuiz, getCourseCard } from './common-utils';

const COURSE_NAME =
  process.env.COURSE_NAME ?? 'MERN Developer Sprint: For MERN developer team testing';

test('Test progress status', async ({ page }) => {
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

  // ---  Open landing page ---
  await page.goto('/');

  await loginAsStudent(page);

  console.log('URL after login:', page.url());

  await runCourseVideoAndQuiz(page, COURSE_NAME);

  // Click Dashboard (adjust if it's a link instead of button)
  //await page.getByRole('button', { name: /dashboard/i }).click();

  const courseCard = await getCourseCard(page, COURSE_NAME);

  // Locate the "Completion Percentage" container
  const percentageValue = courseCard.locator(
    'div:has-text("Completion Percentage") >> text=/\\d+(\\.\\d+)?%/',
  );

  await expect(percentageValue).toHaveText('100%', { timeout: 30000 });
});
