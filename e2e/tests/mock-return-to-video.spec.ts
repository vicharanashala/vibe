import { test, expect } from '@playwright/test';

const COURSE_ID = 'course-mock-1';
const VERSION_ID = 'version-mock-1';
const MODULE_ID = 'module-mock-1';
const SECTION_ID = 'section-mock-1';
const VIDEO_ID = 'item-video-1';
const QUIZ_ID = 'item-quiz-1';
const COHORT_ID = 'cohort-mock-1';

const videoItem = {
  _id: VIDEO_ID,
  name: 'Mock Video Lesson',
  description: 'Video item for navigation test',
  type: 'video',
  order: '01',
  isCompleted: false,
  details: {
    URL: 'https://example.com/not-a-youtube-video',
    startTime: '00:00',
    endTime: '00:15',
    points: '1',
  },
  isAlreadyWatched: false,
};

const quizItem = {
  _id: QUIZ_ID,
  name: 'Mock Quiz Lesson',
  description: 'Quiz item for navigation test',
  type: 'quiz',
  order: '02',
  isCompleted: false,
  details: {
    questionBankRefs: [{ bankId: 'bank-1', count: 1 }],
    passThreshold: 0.5,
    maxAttempts: 3,
    quizType: 'DEADLINE',
    questionVisibility: 0,
    approximateTimeToComplete: '2m',
    allowPartialGrading: false,
    allowHint: false,
    allowSkip: false,
    showCorrectAnswersAfterSubmission: false,
    showExplanationAfterSubmission: false,
    showScoreAfterSubmission: true,
  },
  isAlreadyWatched: false,
};

function json(body: unknown, status = 200) {
  return {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

test('Return to video from quiz works with full mocks only', async ({ page }) => {
  const saveCalls: string[] = [];
  const fallbackApiCalls: string[] = [];

  await page.addInitScript(
    (seed) => {
      localStorage.setItem('firebase-auth-token', seed.token);

      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            user: seed.user,
            token: seed.token,
            isAuthenticated: true,
          },
          version: 0,
        }),
      );

      localStorage.setItem(
        'course-store',
        JSON.stringify({
          state: {
            currentCourse: seed.currentCourse,
          },
          version: 0,
        }),
      );

      (window as any).__E2E__ = true;
    },
    {
      token: 'mock-token',
      user: {
        uid: 'student-1',
        email: 'student@example.com',
        firstName: 'Mock',
        lastName: 'Student',
        role: 'student',
      },
      currentCourse: {
        courseId: COURSE_ID,
        versionId: VERSION_ID,
        moduleId: MODULE_ID,
        sectionId: SECTION_ID,
        itemId: QUIZ_ID,
        watchItemId: null,
        cohortId: COHORT_ID,
        cohortName: 'Mock Cohort',
      },
    },
  );

  await page.route('**/*', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;
    const apiPath = path.startsWith('/api/') ? path.slice(4) : path;
    const strippedApiPath = apiPath.replace(/^\/v\d+\//, '/');
    const apiCoreMatch = strippedApiPath.match(
      /\/(users|courses|quizzes|setting|notifications|auth)\/.*$/,
    );
    const coreApiPath = apiCoreMatch ? apiCoreMatch[0] : strippedApiPath;

    const isApiPath = Boolean(apiCoreMatch);

    if (method === 'OPTIONS' && isApiPath) {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        },
      });
    }

    if (url.hostname.includes('youtube.com') && path === '/iframe_api') {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body:
          'window.YT = window.YT || { PlayerState: { PLAYING: 1, ENDED: 0 }, Player: function () {} };' +
          'if (window.onYouTubeIframeAPIReady) { window.onYouTubeIframeAPIReady(); }',
      });
    }

    if (method === 'GET' && /^\/setting\/course-setting\/[^/]*\/[^/]*\/?$/.test(coreApiPath)) {
      return route.fulfill(
        json({
          _id: 'setting-1',
          studentId: 'student-1',
          courseId: COURSE_ID,
          versionId: VERSION_ID,
          settings: {
            linearProgressionEnabled: true,
            seekForwardEnabled: true,
            proctors: {
              detectors: [
                {
                  detectorName: 'blurDetection',
                  settings: { enabled: false },
                },
              ],
            },
          },
        }),
      );
    }

    if (method === 'GET' && /^\/courses\/versions\/[^/]*\/?$/.test(coreApiPath)) {
      return route.fulfill(
        json({
          _id: VERSION_ID,
          name: 'Mock Course Version',
          modules: [
            {
              moduleId: MODULE_ID,
              name: 'Mock Module',
              sections: [
                {
                  sectionId: SECTION_ID,
                  name: 'Mock Section',
                },
              ],
            },
          ],
        }),
      );
    }

    if (
      method === 'GET' &&
      /^\/users\/progress\/courses\/[^/]*\/versions\/[^/]*\/modules\/?$/.test(coreApiPath)
    ) {
      return route.fulfill(
        json([
          {
            moduleId: MODULE_ID,
            moduleName: 'Mock Module',
            totalItems: 2,
            completedItems: 0,
          },
        ]),
      );
    }

    if (
      method === 'GET' &&
      /^\/users\/progress\/courses\/[^/]*\/versions\/[^/]*\/?$/.test(coreApiPath)
    ) {
      return route.fulfill(
        json({
          currentModule: MODULE_ID,
          currentSection: SECTION_ID,
          currentItem: QUIZ_ID,
        }),
      );
    }

    if (
      method === 'GET' &&
      /^\/courses\/versions\/[^/]*\/modules\/[^/]*\/sections\/[^/]*\/items\/?$/.test(coreApiPath)
    ) {
      return route.fulfill(json([videoItem, quizItem]));
    }

    const itemPathMatch = coreApiPath.match(
      /^\/courses\/[^/]*\/versions\/[^/]*\/modules\/[^/]*\/sections\/[^/]*\/item\/([^/]+)\/?$/,
    );

    if (method === 'GET' && itemPathMatch) {
      const itemId = itemPathMatch[1];
      const item = itemId === VIDEO_ID ? videoItem : quizItem;
      return route.fulfill(json(item));
    }

    if (method === 'POST' && /^\/users\/progress\/courses\/[^/]+\/versions\/[^/]+\/start\/?$/.test(coreApiPath)) {
      return route.fulfill(json({ watchItemId: 'watch-1' }));
    }

    if (method === 'POST' && /^\/users\/progress\/courses\/[^/]+\/versions\/[^/]+\/stop\/?$/.test(coreApiPath)) {
      return route.fulfill(json({ ok: true }));
    }

    if (method === 'POST' && /^\/quizzes\/[^/]+\/attempt\/?$/.test(coreApiPath)) {
      return route.fulfill(
        json({
          attemptId: 'attempt-1',
          userAttempts: 1,
          questionRenderViews: [
            {
              _id: 'q-1',
              type: 'SELECT_ONE_IN_LOT',
              isParameterized: false,
              text: '2 + 2 = ?',
              hint: '',
              points: 1,
              timeLimitSeconds: 30,
              parameterMap: {},
              lotItems: [
                { _id: 'o-1', text: '4', explaination: '' },
                { _id: 'o-2', text: '5', explaination: '' },
              ],
            },
          ],
        }),
      );
    }

    if (method === 'POST' && /\/quizzes\/[^/]+\/attempt\/[^/]+\/save\/?$/.test(coreApiPath)) {
      saveCalls.push(coreApiPath);
      return route.fulfill(json({ result: 'CORRECT' }));
    }

    if (isApiPath) {
      fallbackApiCalls.push(`${method} ${coreApiPath}`);
      console.log(`[mock:fallback] ${method} ${coreApiPath}`);
      return route.fulfill(json({}));
    }

    return route.continue();
  });

  await page.goto('/student/learn');

  const title = page.locator('[data-testid="current-item-title"]');

  await expect(title).toHaveAttribute('data-item-id', QUIZ_ID, { timeout: 30000 });

  await expect(page.getByTestId('course-item').first()).toBeVisible();
  await expect(page.getByTestId('course-item').nth(1)).toBeVisible();

  const rewatchButton = page.getByRole('button', {
    name: /Rewatch Previous Video|Rewatch Video/i,
  });

  await expect(rewatchButton).toBeVisible({ timeout: 30000 });
  await rewatchButton.click();

  await expect(title).toHaveAttribute('data-item-id', VIDEO_ID, { timeout: 15000 });
  await expect(title).toContainText('Mock Video Lesson');

  expect(saveCalls.length).toBe(0);
  if (fallbackApiCalls.length > 0) {
    console.log('Unhandled mock API calls:', fallbackApiCalls.join(', '));
  }
});
