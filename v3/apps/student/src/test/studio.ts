/**
 * Studio (admin) test helpers. Responses come from src/test/fixtures/studio,
 * captured from the local backend (tools/local-api) and trimmed to the
 * @vibe.local test accounts. Anything not listed here falls back to the
 * student fixtures in session.ts.
 */
import { api, fakeAuth, ok, respond, type STUDENT } from './session';

import courses from './fixtures/studio/courses.json';
import enrollments from './fixtures/studio/enrollments.json';
import feedbackItem from './fixtures/studio/feedback-item.json';
import feedbackSectionItems from './fixtures/studio/feedback-section-items.json';
import feedbackSubmissions from './fixtures/studio/feedback-submissions.json';
import feedbackVersion from './fixtures/studio/feedback-version.json';
import quizBank from './fixtures/studio/quiz-bank.json';
import quizBankRefs from './fixtures/studio/quiz-bank-refs.json';
import quizItem from './fixtures/studio/quiz-item.json';
import quizQuestions from './fixtures/studio/quiz-questions.json';
import userMeAdmin from './fixtures/studio/user-me-admin.json';
import incidentStats from './fixtures/studio/incident-stats.json';
import incidents from './fixtures/studio/incidents.json';
import registrationRequests from './fixtures/studio/registration-requests.json';
import registrationSettings from './fixtures/studio/registration-settings.json';
import removalHistory from './fixtures/studio/removal-history.json';
import resultsAnalytics from './fixtures/studio/results-analytics.json';
import resultsBank from './fixtures/studio/results-bank.json';
import resultsBankRefs from './fixtures/studio/results-bank-refs.json';
import resultsItem from './fixtures/studio/results-item.json';
import resultsPerformance from './fixtures/studio/results-performance.json';
import resultsQuestions from './fixtures/studio/results-questions.json';
import resultsSubmissions from './fixtures/studio/results-submissions.json';
import teacherEnrollments from './fixtures/studio/teacher-enrollments.json';
import userMeTeacher from './fixtures/studio/user-me-teacher.json';
import users from './fixtures/studio/users.json';

export const studio = {
  courses,
  enrollments,
  feedbackItem,
  feedbackSectionItems,
  feedbackSubmissions,
  feedbackVersion,
  quizBank,
  quizBankRefs,
  quizItem,
  quizQuestions,
  userMeAdmin,
  userMeTeacher,
  teacherEnrollments,
  users,
  registration: {
    settings: registrationSettings,
    requests: registrationRequests,
  },
  /** Incidents on the feedback course (the no-face one came from the real proctoring pipeline). */
  integrity: { incidents, stats: incidentStats, history: removalHistory },
  results: {
    item: resultsItem,
    analytics: resultsAnalytics,
    performance: resultsPerformance,
    questions: resultsQuestions,
    submissions: resultsSubmissions,
  },
};

/** ObjectIds arrive as hex strings or as raw BSON buffers, depending on the endpoint. */
export const hex = (raw: unknown): string =>
  typeof raw === 'string'
    ? raw
    : ((raw as { buffer?: { data?: number[] } })?.buffer?.data ?? [])
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

/** The sample course used across studio tests (first non-throwaway course in the fixture). */
export const SAMPLE = (() => {
  const c =
    courses.courses.find((x) => x.name.startsWith('Sample: Foundations')) ??
    courses.courses[0];
  return { courseId: hex(c._id), versionId: hex(c.versions[0]), name: c.name };
})();

/** Where the feedback form fixture lives. */
export const FEEDBACK = {
  courseId: feedbackVersion.courseId,
  versionId: feedbackVersion._id,
  moduleId: feedbackVersion.modules[0].moduleId,
  sectionId: feedbackVersion.modules[0].sections[0].sectionId,
  itemId: feedbackItem.item._id,
};

export const QUIZ_ITEM_ID = quizItem.item._id;

/**
 * A quiz with real submitted attempts (the sample course's checkpoint). Students
 * other than the @vibe.local test accounts were given pseudonyms (student2@…,
 * student3@…) when captured; scores and answers are as recorded.
 */
/** The course with a registration form and two waiting requests (Sample: Introduction to Algorithms). */
export const REGISTRATION = {
  courseId: registrationRequests.registrations[0].courseId,
  versionId: registrationRequests.registrations[0].versionId,
};

export const RESULTS_QUIZ_ID = resultsItem.item._id;

type Params = {
  params?: { path?: Record<string, string>; query?: Record<string, string> };
};

export function studioGet(path: string, opts?: Params) {
  const p = opts?.params?.path ?? {};
  switch (path) {
    case '/api/users/me':
      return ok(userMeAdmin);
    case '/api/courses/':
      return ok(courses);
    case '/api/users/':
      return ok(users);
    case '/api/users/enrollments/courses/{courseId}/versions/{versionId}':
      return ok(enrollments);
    case '/api/courses/{courseId}': {
      const c = courses.courses.find((x) => hex(x._id) === p.courseId);
      return ok(
        c
          ? { _id: p.courseId, name: c.name, description: c.description }
          : { _id: p.courseId, name: 'Course', description: '' },
      );
    }
    case '/api/courses/versions/{versionId}':
      return p.versionId === feedbackVersion._id
        ? ok(feedbackVersion)
        : respond(path);
    case '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items':
      return p.versionId === feedbackVersion._id
        ? ok(feedbackSectionItems)
        : respond(path);
    case '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}':
      if (p.itemId === FEEDBACK.itemId) return ok(feedbackItem);
      if (p.itemId === QUIZ_ITEM_ID) return ok(quizItem);
      if (p.itemId === RESULTS_QUIZ_ID) return ok(resultsItem);
      return respond(path);
    case '/api/quizzes/quiz/{quizId}/bank':
      return ok(p.quizId === RESULTS_QUIZ_ID ? resultsBankRefs : quizBankRefs);
    case '/api/quizzes/question-bank/{questionBankId}':
      return ok(
        hex(resultsBank._id) === p.questionBankId ? resultsBank : quizBank,
      );
    case '/api/quizzes/questions/{questionId}':
      return ok(
        [...quizQuestions, ...resultsQuestions].find(
          (q) => hex(q._id) === p.questionId,
        ),
      );
    case '/api/quizzes/quiz/{quizId}/analytics':
      return ok(
        p.quizId === RESULTS_QUIZ_ID
          ? resultsAnalytics
          : {
              totalAttempts: 0,
              submissions: 0,
              passRate: 0,
              averageScore: 0,
              averagePercentage: 0,
            },
      );
    case '/api/quizzes/quiz/{quizId}/performance':
      return ok(p.quizId === RESULTS_QUIZ_ID ? resultsPerformance : []);
    case '/api/quizzes/quiz/{quizId}/submissions':
      return ok(
        p.quizId === RESULTS_QUIZ_ID
          ? resultsSubmissions
          : { data: [], totalCount: 0, currentPage: 1, totalPages: 0 },
      );
    case '/api/anomalies/course/{courseId}/version/{versionId}/stats':
      return ok(
        p.versionId === FEEDBACK.versionId
          ? incidentStats
          : Object.fromEntries(Object.keys(incidentStats).map((k) => [k, 0])),
      );
    case '/api/anomalies/course/{courseId}/version/{versionId}':
      return ok(
        p.versionId === FEEDBACK.versionId
          ? incidents
          : {
              data: [],
              currentPage: 1,
              totalDocuments: 0,
              totalPages: 1,
              limit: 10,
            },
      );
    case '/api/ejections/history':
      return ok(
        opts?.params?.query?.courseVersionId === FEEDBACK.versionId
          ? removalHistory
          : { history: [], totalDocuments: 0, totalPages: 0 },
      );
    case '/api/appeals/':
      return ok([]);
    case '/api/course/registration/build-form/version/{versionId}':
      return ok(
        p.versionId === REGISTRATION.versionId
          ? registrationSettings
          : {
              jsonSchema: null,
              uiSchema: null,
              isActive: true,
              cohortSettings: [],
              cohortSettingDetails: [],
            },
      );
    case '/api/course/registration/requests/version/{versionId}': {
      const status = opts?.params?.query?.status ?? 'ALL';
      const mine =
        p.versionId === REGISTRATION.versionId
          ? registrationRequests.registrations
          : [];
      const shown =
        status === 'ALL' ? mine : mine.filter((r) => r.status === status);
      return ok({
        totalDocuments: shown.length,
        totalPages: shown.length ? 1 : 0,
        currentPage: 1,
        registrations: shown,
      });
    }
    case '/api/courses/{courseId}/item/{feedbackId}/feedback/submissions':
      return ok(feedbackSubmissions);
    default:
      return respond(path);
  }
}

export const ADMIN: typeof STUDENT = {
  uid: 'admin-uid',
  email: 'instructor@vibe.local',
  displayName: 'Ira Instructor',
  providerData: [{ providerId: 'password' }],
  getIdToken: async () => 'test-token',
  reload: async () => undefined,
};

/** Signs in the admin test account (onboarded) and routes GETs to the studio fixtures. */
export function signInAdmin() {
  fakeAuth.currentUser = ADMIN;
  localStorage.setItem(
    `vibe:onboarding:${ADMIN.uid}`,
    JSON.stringify({ completedAt: '2026-10-07T00:00:00Z' }),
  );
  api.GET.mockImplementation(async (path: string, opts?: Params) =>
    studioGet(path, opts),
  );
}

export const TEACHER: typeof STUDENT = {
  uid: 'teacher-uid',
  email: 'teacher@vibe.local',
  displayName: 'Tara Teacher',
  providerData: [{ providerId: 'password' }],
  getIdToken: async () => 'test-token',
  reload: async () => undefined,
};

const forbidden = (message: string) => ({
  data: undefined,
  error: { message },
  response: new Response(null, { status: 403 }),
});

/**
 * Signs in a non-admin teacher: INSTRUCTOR on the feedback course only
 * (captured from the local backend). Admin-only endpoints answer 403 with the
 * backend's own messages.
 */
export function signInTeacher() {
  fakeAuth.currentUser = TEACHER;
  localStorage.setItem(
    `vibe:onboarding:${TEACHER.uid}`,
    JSON.stringify({ completedAt: '2026-10-07T00:00:00Z' }),
  );
  api.GET.mockImplementation(async (path: string, opts?: Params) => {
    switch (path) {
      case '/api/users/me':
        return ok(userMeTeacher);
      case '/api/users/enrollments':
        return opts?.params?.query?.role === 'INSTRUCTOR'
          ? ok(teacherEnrollments)
          : ok({ totalDocuments: 0, totalPages: 0, currentPage: 1, enrollments: [], activeCount: 0, archivedCount: 0, message: 'No enrollments found for the user' });
      case '/api/courses/':
        return forbidden('Only admins can list all courses');
      case '/api/users/':
        return forbidden('Only admins can list all users');
      case '/api/ejections/history':
        return forbidden('Only administrators can access ejection history');
      default:
        return studioGet(path, opts);
    }
  });
}
