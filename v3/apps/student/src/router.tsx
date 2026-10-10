import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router';

import { AdminPage } from '@/features/admin/admin-page';
import { AdminShell } from '@/features/admin/admin-shell';
import { CourseDetailPage } from '@/features/admin/course-detail-page';
import { UsersPage } from '@/features/admin/users-page';
import { AppShell } from '@/features/app-shell/app-shell';
import { authReady } from '@/features/auth/auth-provider';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { SignupPage } from '@/features/auth/signup-page';
import { CoursePage } from '@/features/courses/course-page';
import { CoursesPage } from '@/features/courses/courses-page';
import { HomePage } from '@/features/home/home-page';
import { LessonPage } from '@/features/learn/lesson-page';
import { parseTrack, readTrack } from '@/features/learn/tracks';
import { LandingPage } from '@/features/landing/landing-page';
import { OnboardingPage } from '@/features/onboarding/onboarding-page';
import { readOnboarding } from '@/features/onboarding/onboarding-state';
import { ProfilePage } from '@/features/profile/profile-page';
import { RegistrationPage } from '@/features/registration/registration-page';

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});

const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage });

/** `?redirect=` — where to go after sign-in / sign-up / onboarding. Same-origin paths only. */
type RedirectSearch = { redirect?: string };
const validateRedirect = (search: Record<string, unknown>): RedirectSearch => ({
  redirect:
    typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
      ? search.redirect
      : undefined,
});

/** Auth pages are for signed-out visitors; signed-in users go straight to the app. */
async function redirectIfSignedIn() {
  if (await authReady()) throw redirect({ to: '/home' });
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateRedirect,
  beforeLoad: redirectIfSignedIn,
  component: function LoginRoute() {
    const { redirect: to } = loginRoute.useSearch();
    return <LoginPage redirect={to} />;
  },
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: validateRedirect,
  beforeLoad: redirectIfSignedIn,
  component: function SignupRoute() {
    const { redirect: to } = signupRoute.useSearch();
    return <SignupPage redirect={to} />;
  },
});
const forgotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
});

async function requireUser(location: { href: string }) {
  const user = await authReady();
  if (!user) throw redirect({ to: '/login', search: { redirect: location.href } });
  return user;
}

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  validateSearch: validateRedirect,
  beforeLoad: ({ location }) => requireUser(location),
  component: function OnboardingRoute() {
    const { redirect: to } = onboardingRoute.useSearch();
    return <OnboardingPage redirect={to} />;
  },
});

async function requireOnboardedUser(location: { href: string; pathname: string }) {
  const user = await requireUser(location);
  if (!readOnboarding(user.uid).completedAt) {
    throw redirect({ to: '/onboarding', search: { redirect: location.pathname === '/home' ? undefined : location.href } });
  }
}

/** Signed-in area. First-time users see onboarding once before anything else. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: AppShell,
});

/** Full-screen lesson player (outside the app shell, like Uxcel's lesson view). */
const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId',
  validateSearch: (search: Record<string, unknown>): { track?: 'blue' | 'green' } => ({ track: parseTrack(search.track) }),
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: function LearnRoute() {
    const params = learnRoute.useParams();
    const { track } = learnRoute.useSearch();
    return <LessonPage key={`${params.itemId}:${track}`} {...params} track={track ?? readTrack(params.versionId)} />;
  },
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/home', component: HomePage });
const coursesRoute = createRoute({ getParentRoute: () => appRoute, path: '/courses', component: CoursesPage });
const courseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/courses/$courseId/$versionId',
  component: function CourseRoute() {
    const { courseId, versionId } = courseRoute.useParams();
    return <CoursePage key={versionId} courseId={courseId} versionId={versionId} />;
  },
});
const profileRoute = createRoute({ getParentRoute: () => appRoute, path: '/profile', component: ProfilePage });

/**
 * Admin gets its own shell/nav, separate from the student Home/My courses/Profile sidebar.
 * Role check happens inside AdminPage/CourseDetailPage (needs the user's Mongo profile, not just Firebase auth) -
 * a signed-in non-admin hitting these routes sees an "Admins only" message, not a redirect loop.
 */
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin',
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: AdminShell,
});
const adminIndexRoute = createRoute({ getParentRoute: () => adminLayoutRoute, path: '/admin', component: AdminPage });
const adminUsersRoute = createRoute({ getParentRoute: () => adminLayoutRoute, path: '/admin/users', component: UsersPage });
const adminCourseRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/courses/$courseId/$versionId',
  component: function AdminCourseRoute() {
    const { courseId, versionId } = adminCourseRoute.useParams();
    return <CourseDetailPage key={versionId} courseId={courseId} versionId={versionId} />;
  },
});

/** The registration link instructors share. Needs an account (every registration API does). */
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register/$versionId/{-$cohortId}',
  beforeLoad: ({ location }) => requireOnboardedUser(location),
  component: function RegisterRoute() {
    const { versionId, cohortId } = registerRoute.useParams();
    return <RegistrationPage key={`${versionId}:${cohortId ?? ''}`} versionId={versionId} cohortId={cohortId} />;
  },
});

/** Links already shared from the previous frontend keep working. */
const legacyRegisterRoutes = ['/student/course-registration/$versionId/{-$cohortId}', '/course-registration/$versionId/{-$cohortId}'].map((path) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: ({ params }) => {
      const { versionId, cohortId } = params as { versionId: string; cohortId?: string };
      throw redirect({ to: '/register/$versionId/{-$cohortId}', params: { versionId, cohortId }, replace: true });
    },
  }),
);

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  signupRoute,
  forgotRoute,
  onboardingRoute,
  learnRoute,
  registerRoute,
  ...legacyRegisterRoutes,
  appRoute.addChildren([homeRoute, coursesRoute, courseRoute, profileRoute]),
  adminLayoutRoute.addChildren([adminIndexRoute, adminCourseRoute, adminUsersRoute]),
]);

export function createAppRouter(options: { initialPath?: string } = {}) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    // Tests start at a given URL without touching window.location.
    ...(options.initialPath ? { history: createMemoryHistory({ initialEntries: [options.initialPath] }) } : {}),
  });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-aleo text-5xl">404</p>
        <p className="mt-2 text-muted-foreground">We couldn’t find that page.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
