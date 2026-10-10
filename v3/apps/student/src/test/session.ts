/**
 * Test doubles for Firebase Auth and the HTTP client, so app tests run the real
 * pages + router without a network. API responses come from src/test/fixtures,
 * which were captured from the local backend (tools/local-api), not invented.
 *
 * Usage in a spec file:
 *   vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
 *   vi.mock('firebase/auth', async (orig) => ({ ...(await orig()), ...(await import('@/test/session')).firebaseAuthFns }));
 *   vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));
 */
import { vi, type Mock } from 'vitest';

import courseSettings from './fixtures/course-settings.json';
import courseVersion from './fixtures/version.json';
import currentPath from './fixtures/current-path.json';
import enrollments from './fixtures/enrollments.json';
import ethics from './fixtures/ethics.json';
import face from './fixtures/face.json';
import invitesEmpty from './fixtures/invites-empty.json';
import notificationsEmpty from './fixtures/notifications-empty.json';
import userMe from './fixtures/user-me.json';
import itemBlog from './fixtures/item-blog.json';
import itemVideo from './fixtures/item-video.json';
import itemQuiz from './fixtures/item-quiz.json';
import quizAttempt from './fixtures/quiz-attempt.json';
import quizSubmit from './fixtures/quiz-submit.json';
import registrationDetails from './fixtures/registration-details.json';
import registrationForm from './fixtures/registration-form.json';
import registrationPending from './fixtures/registration-pending.json';
import registrationPendingEmpty from './fixtures/registration-pending-empty.json';
import registrationRejectedEmpty from './fixtures/registration-rejected-empty.json';
import registrationSubmit from './fixtures/registration-submit.json';
import modulesProgress from './fixtures/modules-progress.json';
import percentage from './fixtures/percentage.json';
import sectionItems from './fixtures/section-items.json';

export const fixtures = {
  courseSettings,
  courseVersion,
  currentPath,
  enrollments,
  ethics,
  face,
  invitesEmpty,
  itemBlog,
  itemQuiz,
  itemVideo,
  modulesProgress,
  notificationsEmpty,
  percentage,
  quizAttempt,
  quizSubmit,
  registrationDetails,
  registrationForm,
  registrationPending,
  registrationPendingEmpty,
  registrationRejectedEmpty,
  registrationSubmit,
  sectionItems,
  userMe,
};

type FakeUser = { uid: string; email: string; displayName: string | null; providerData: { providerId: string }[]; getIdToken: () => Promise<string>; reload: () => Promise<void> };

export const STUDENT: FakeUser = {
  uid: 'student-uid',
  email: 'student@vibe.local',
  displayName: 'Asha Student',
  providerData: [{ providerId: 'password' }],
  getIdToken: async () => 'test-token',
  reload: async () => undefined,
};

const listeners = new Set<(u: FakeUser | null) => void>();

export const fakeAuth = {
  currentUser: null as FakeUser | null,
  authStateReady: async () => undefined,
};

export function setSignedIn(user: FakeUser | null) {
  fakeAuth.currentUser = user;
  listeners.forEach((l) => l(user));
}

export const firebaseModule = { auth: fakeAuth, googleProvider: {} };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>;

export const firebaseAuthFns: {
  onIdTokenChanged: (auth: unknown, cb: (u: FakeUser | null) => void) => () => boolean;
  signInWithEmailAndPassword: AnyMock;
  signOut: AnyMock;
  sendPasswordResetEmail: AnyMock;
  signInWithPopup: AnyMock;
  getAdditionalUserInfo: AnyMock;
  updateProfile: AnyMock;
} = {
  onIdTokenChanged: (_auth: unknown, cb: (u: FakeUser | null) => void) => {
    listeners.add(cb);
    cb(fakeAuth.currentUser);
    return () => listeners.delete(cb);
  },
  signInWithEmailAndPassword: vi.fn(async (_a: unknown, email: string) => {
    setSignedIn({ ...STUDENT, email });
    return { user: fakeAuth.currentUser };
  }),
  signOut: vi.fn(async () => setSignedIn(null)),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  signInWithPopup: vi.fn(),
  getAdditionalUserInfo: vi.fn(() => ({ isNewUser: false })),
  updateProfile: vi.fn(async (user: FakeUser, profile: { displayName?: string }) => {
    user.displayName = profile.displayName ?? user.displayName;
  }),
};

const ok = (data: unknown, status = 200) => ({ data, error: undefined, response: new Response(null, { status }) });

/** Route → fixture, matched on the OpenAPI path template the app calls. */
function respond(path: string) {
  switch (path) {
    case '/api/users/enrollments':
      return ok(fixtures.enrollments);
    case '/api/courses/versions/{versionId}':
      return ok(fixtures.courseVersion);
    case '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items':
      return ok(fixtures.sectionItems);
    case '/api/users/progress/courses/{courseId}/versions/{versionId}/percentage':
      return ok(fixtures.percentage);
    case '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path':
      return ok(fixtures.currentPath);
    case '/api/users/progress/courses/{courseId}/versions/{versionId}/modules':
      return ok(fixtures.modulesProgress);
    case '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent':
      return ok(fixtures.ethics);
    case '/api/users/me/face-reference':
      return ok(fixtures.face);
    case '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}':
      return ok(fixtures.itemBlog);
    case '/api/setting/course-setting/{courseId}/{versionId}':
      return ok(fixtures.courseSettings);
    case '/api/users/me':
      return ok(fixtures.userMe);
    case '/api/notifications/user/':
      return ok(fixtures.notificationsEmpty);
    case '/api/notifications/invite/':
      return ok(fixtures.invitesEmpty);
    case '/api/course/registration/version/{versionId}':
      return ok(fixtures.registrationDetails);
    case '/api/course/registration/form/version/{versionId}':
      return ok(fixtures.registrationForm);
    case '/api/course/registration/pending/student':
      return ok(fixtures.registrationPendingEmpty);
    case '/api/course/registration/rejected/student':
      return ok(fixtures.registrationRejectedEmpty);
    default:
      throw new Error(`No test fixture for GET ${path}`);
  }
}

/** Writes: start returns a watch-time id like the backend; everything else succeeds empty. */
function respondPost(path: string) {
  if (path === '/api/users/progress/courses/{courseId}/versions/{versionId}/start') return ok({ watchItemId: 'watch-1' }, 201);
  if (path === '/api/quizzes/{quizId}/attempt') return ok(fixtures.quizAttempt);
  if (path === '/api/quizzes/{quizId}/attempt/{attemptId}/submit') return ok(fixtures.quizSubmit);
  if (path === '/api/course/registration/version/{versionId}') return ok(fixtures.registrationSubmit, 201);
  return ok({});
}

export const api: { GET: AnyMock; POST: AnyMock; PATCH: AnyMock } = {
  GET: vi.fn(async (path: string) => respond(path)),
  POST: vi.fn(async (path: string) => respondPost(path)),
  PATCH: vi.fn(async () => ok({})),
};

export const apiModule = { api };
export { ok };

export function resetSession() {
  listeners.clear();
  fakeAuth.currentUser = null;
  vi.clearAllMocks();
  api.GET.mockImplementation(async (path: string) => respond(path));
  api.POST.mockImplementation(async (path: string) => respondPost(path));
  api.PATCH.mockImplementation(async () => ok({}));
}

/** Signs the test student in and marks onboarding as done, so /home etc. render directly. */
export function signInStudent({ onboarded = true } = {}) {
  fakeAuth.currentUser = STUDENT;
  if (onboarded) localStorage.setItem(`vibe:onboarding:${STUDENT.uid}`, JSON.stringify({ completedAt: '2026-10-07T00:00:00Z' }));
}
