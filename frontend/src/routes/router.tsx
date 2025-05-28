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
import { useAuthStore } from '@/lib/store/auth-store'
import { useEffect } from 'react'

// Import pages and layouts
import AuthPage from '@/pages/auth-page'
import TeacherLayout from '@/layouts/teacher-layout'
import StudentLayout from '@/layouts/student-layout'
import StudentDashboard from "@/pages/student/dashboard";
import StudentCourses from "@/pages/student/courses";
import StudentProfile from "@/pages/student/profile";
import ItemContainer from '@/components/Item-container'
import { Item } from '@/components/Item-container' // Assuming Item is defined in Item-container
import Dashboard from '@/pages/teacher/dashboard'
import CreateCourse from '@/pages/teacher/create-course'
import GetCourse from '@/pages/teacher/get-course'
import Editor from '@/pages/teacher/create-article'
import FaceDetectors from '@/pages/testing-proctoring/face-detectors'
import { NotFoundComponent } from '@/components/not-found'

// Root route with error and notFound handling
const rootRoute = new RootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ({ error }) => {
    console.error('Router error:', error);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center p-8 bg-red-50 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Something went wrong</h1>
          <p className="text-red-600 mb-6">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <button 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.href = '/auth'}
          >
            Go to Login
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

// Teacher create course route
const teacherCreateCourseRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/create',
  component: CreateCourse,
});

// Teacher get course route
const teacherGetCourseRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/get',
  component: GetCourse,
});

// Teacher create article route
const teacherCreateArticleRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/articles/create',
  component: Editor,
});

// Testing face detection route
const teacherTestingRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/testing',
  component: FaceDetectors,
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

const videoRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/video',
  component: () => <ItemContainer item={{name:"abc", itemtype:"video", content:"https://www.youtube.com/watch?v=vBH6GRJ1REM"} as Item} courseId="A" courseVersionId="B" userId="C" />
});

// Create a catch-all not found route
const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: NotFoundComponent,
});

// Create the router with the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  teacherLayoutRoute.addChildren([
    teacherDashboardRoute,
    teacherCreateCourseRoute,
    teacherCreateArticleRoute,
    teacherGetCourseRoute,
    teacherTestingRoute,
  ]),
  studentLayoutRoute.addChildren([
    studentDashboardRoute,
    studentCoursesRoute,
    studentProfileRoute,
    videoRoute,
  ]),
]);

// For server-side rendering compatibility
const memoryHistory = typeof window !== 'undefined' ? undefined : createMemoryHistory();

// Create router instance with additional options
export const router = new Router({
  routeTree,
  defaultPreload: 'intent',
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
