import { test } from '@playwright/test';
import { loginAsStudent, runCourseVideoAndQuiz } from './common-utils';

// Scenario: validate the core learner journey can execute end-to-end for a course.
// Coverage: login, open course, traverse lessons, complete video/quiz/project items.
// Credentials are read by helpers from TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD.
const COURSE_NAME =
  process.env.COURSE_NAME ?? 'MERN Developer Sprint: For MERN developer team testing';

test('Test course video playback and quiz', async ({ page }) => {
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
});
