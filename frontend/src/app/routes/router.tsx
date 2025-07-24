import {
  Router,
  Route,
  RootRoute,
  redirect,
  createMemoryHistory,
  Outlet,
  NotFoundRoute,
  useNavigate
} from '@tanstack/react-router'
import { useAuthStore } from '@/store/auth-store'
import { useEffect } from 'react'

// Import pages and layouts
import AuthPage from '@/app/pages/auth-page'
import TeacherLayout from '@/layouts/teacher-layout'
import StudentLayout from '@/layouts/student-layout'
import StudentDashboard from "@/app/pages/student/dashboard";
import StudentCourses from "@/app/pages/student/courses";
import StudentProfile from "@/app/pages/student/profile";
import AddCoursePage from '@/app/pages/teacher/AddCoursePage';
import TeacherProfile from "@/app/pages/teacher/profile";
import { LiveQuiz } from '@/app/pages/teacher/live-quiz'
import CoursePage from '@/app/pages/student/course-page'
import Dashboard from '@/app/pages/teacher/dashboard'
import TeacherCoursePage from "@/app/pages/teacher/teacher-course-page";
import TeacherCoursesPage from '@/app/pages/teacher/course-page'
import Editor from '@/app/pages/teacher/create-article'
import { NotFoundComponent } from '@/components/not-found'
import { useCourseStore } from '@/store/course-store'
import CourseEnrollments from '../pages/teacher/course-enrollments'
import InvitePage from '../pages/teacher/invite'
import GenerateSectionPage from '@/app/pages/teacher/create-job'
import AISectionPage from '@/app/pages/teacher/AISectionPage';
import AISectionModal from '@/app/pages/teacher/components/AISectionModal';


// Root route with error and notFound handling
const rootRoute = new RootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ({ error }) => {
    console.error('Router error:', error);
    // reload page on error
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center p-8 bg-red-50 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Something went wrong. Please Reload if error Persists.</h1>
          <p className="text-red-600 mb-6">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.href = '/auth'}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
});

// Auth route - accessible only when NOT authenticated
const authRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    // Redirect to appropriate dashboard if already authenticated
    if (isAuthenticated && user?.role) {
      if (user.role === 'teacher') {
        throw redirect({ to: '/teacher' });
      } else if (user.role === 'student') {
        throw redirect({ to: '/student' });
      }
    }
  },
});

// Index route with redirect
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // Redirect to appropriate dashboard or auth
    const { isAuthenticated, user } = useAuthStore.getState();
    if (isAuthenticated && user?.role) {
      if (user.role === 'teacher') {
        throw redirect({ to: '/teacher' });
      } else if (user.role === 'student') {
        throw redirect({ to: '/student' });
      }
    }
    // Default redirect to auth if not authenticated or role unknown
    throw redirect({ to: '/auth' });
  },
  component: () => null,
});

// Teacher layout route with auth check and role verification
const teacherLayoutRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/teacher',
  notFoundComponent: NotFoundComponent,
  beforeLoad: () => {
    // Auth and role check
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Role check - must be a teacher
    if (user?.role !== 'teacher') {
      if (user?.role === 'student') {
        throw redirect({ to: '/student' }); // Redirect students to their dashboard
      } else {
        throw redirect({ to: '/auth' }); // Redirect others to auth
      }
    }
  },
  component: TeacherLayout,
});

// Student layout route with auth check and role verification
const studentLayoutRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/student',
  notFoundComponent: NotFoundComponent,
  beforeLoad: () => {
    // Auth and role check
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Role check - must be a student
    if (user?.role !== 'student') {
      if (user?.role === 'teacher') {
        throw redirect({ to: '/teacher' }); // Redirect teachers to their dashboard
      } else {
        throw redirect({ to: '/auth' }); // Redirect others to auth
      }
    }
  },
  component: StudentLayout,
});

// Teacher dashboard route
const teacherDashboardRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/',
  component: Dashboard,
});

// Teacher profile route
const teacherProfileRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/profile',
  component: TeacherProfile,
});

const teacherAudioManagerRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/transcribe',
  component: LiveQuiz,
});

const teacherViewCourseRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/teacher/courses/view',
  component: TeacherCoursePage, // View a specific course
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Ensure user is a teacher
    if (user?.role !== 'teacher') {
      throw redirect({ to: '/auth' });
    }

    // Ensure courseId and versionId are in zustand store
    const { currentCourse } = useCourseStore.getState();
    if (!currentCourse || !currentCourse.courseId || !currentCourse.versionId) {
      throw redirect({ to: '/teacher/courses/list' });
    }
  },
});
// Teacher courses page route
const teacherCoursesPageRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/list',
  component: TeacherCoursesPage,
});

// Teacher create article route
const teacherCreateArticleRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/articles/create',
  component: Editor,
});

// Teacher Course Enrollments route
const teacherCourseEnrollmentsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/enrollments',
  component: CourseEnrollments,
});

// Teacher Course Invites route
const teacherCourseInviteRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/invite',
  component: InvitePage,
});


const teacherAddCourseRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/create',
  component: AddCoursePage,
});

// Teacher generate section route
const teacherGenerateSectionRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/jobs/create',
  component: GenerateSectionPage,
});

// Teacher AI Section route
const teacherAISectionRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/ai-section',
  component: AISectionPage,
});

// Student dashboard route
const studentDashboardRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/',
  component: StudentDashboard,
});

// Student courses route
const studentCoursesRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/courses',
  component: StudentCourses,
});

// Student profile route
const studentProfileRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/profile',
  component: StudentProfile,
});

const coursePageRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/student/learn',
  component: CoursePage,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Ensure user is a student
    if (user?.role !== 'student') {
      throw redirect({ to: '/auth' });
    }

    // Ensure courseId and versionId are in zustand store
    const { currentCourse } = useCourseStore.getState();
    if (!currentCourse || !currentCourse.courseId || !currentCourse.versionId) {
      throw redirect({ to: '/student/courses' });
    }
  },
});

// Create a catch-all not found route
const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: NotFoundComponent,
});

// Remove TestAISectionModalPage and use AISectionPage for the test route
const testAISectionModalRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/test-ai-section-modal',
  component: AISectionPage,
});

// Create the router with the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  teacherLayoutRoute.addChildren([
    teacherDashboardRoute,
    teacherCreateArticleRoute,
    teacherCoursesPageRoute,
    teacherViewCourseRoute,
    teacherProfileRoute,
    teacherCourseEnrollmentsRoute,
    teacherAudioManagerRoute,
    teacherAddCourseRoute,
    teacherCourseInviteRoute,
    teacherGenerateSectionRoute,
    teacherAISectionRoute,
    testAISectionModalRoute,
  ]),
  studentLayoutRoute.addChildren([
    studentDashboardRoute,
    studentCoursesRoute,
    studentProfileRoute,
  ]),
  coursePageRoute,
]);

// For server-side rendering compatibility
const memoryHistory = typeof window !== 'undefined' ? undefined : createMemoryHistory();

// Create router instance with additional options
export const router = new Router({
  routeTree,
  defaultPreload: false,
  // Use memory history for SSR
  history: memoryHistory,
  // Global not found component
  defaultNotFoundComponent: NotFoundComponent,
  notFoundRoute,
});

// Add a navigation guard for redirecting based on roles
export const useRedirectBasedOnRole = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const path = window.location.pathname;

      // If the user is at root or auth page and already authenticated, redirect to their role's dashboard
      if (path === '/' || path === '/auth') {
        navigate({ to: `/${user.role.toLowerCase()}` });
      }

      // If user is trying to access a different role's route, redirect to their proper route
      else if (
        (path.startsWith('/teacher') && user.role !== 'teacher') ||
        (path.startsWith('/student') && user.role !== 'student')
      ) {
        navigate({ to: `/${user.role.toLowerCase()}` });
      }
    }
  }, [isAuthenticated, user, navigate]);
};

// Export the types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
