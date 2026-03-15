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
import React, { useEffect } from 'react'

// Import pages and layouts
import AuthPage from '@/app/pages/auth-page'
import TeacherLayout from '@/layouts/teacher-layout'
import StudentLayout from '@/layouts/student-layout'
import StudentDashboard from "@/app/pages/student/dashboard";
import StudentCourses from "@/app/pages/student/courses";
import StudentProfile from "@/app/pages/student/profile";
import StudentAnnouncements from "../pages/student/announcements/StudentAnnouncements";
import AddCoursePage from '@/app/pages/teacher/AddCoursePage';
import TeacherProfile from "@/app/pages/teacher/profile";
import { AudioTranscripter } from '@/app/pages/teacher/AudioTranscripter'
import CoursePage from '@/app/pages/student/course-page'
import TeacherCoursePage from "@/app/pages/teacher/teacher-course-page";
import TeacherCoursesPage from '@/app/pages/teacher/course-page'
import Editor from '@/app/pages/teacher/create-article'
import { NotFoundComponent } from '@/components/not-found'
import { useCourseStore } from '@/store/course-store'
import CourseEnrollments from '../pages/teacher/course-enrollments'
import InvitePage from '../pages/teacher/invite'
import GenerateSectionPage from '@/app/pages/teacher/create-job'
import AISectionPage from '@/app/pages/teacher/AISectionPage';
import FlaggedList from '../pages/teacher/FlaggedList'
import StudentRouteGuard from '@/components/StudentRouteGuard'
import AiWorkflow from '../pages/teacher/AiWorkflow'
import AnomaliesList from '../pages/teacher/AnomaliesList'
import CourseInstructors from '../pages/teacher/course-instructors'
import RegisteredUsers from '../pages/teacher/CourseRegistrationRequests'
import CourseRegistration from '../pages/student/CourseRegistration'
import CourseIssueReports from '../pages/student/FlagResponse'
// import LoginPage from '../pages/LoginPage'
import FeedbackFormEditor from '../pages/teacher/FeedbackFormEditor'
import TeacherAnnouncements from '../pages/teacher/announcements'
import Leaderboard from '../pages/student/leaderboard'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import StudentLogin from '../pages/student/StudentLogin'
import TeacherLogin from '../pages/teacher/TeacherLogin'
import SelectRolePage from '../pages/SelectRolePage'
import AuditPage from '../pages/teacher/AuditPage'
import ConfigureCohorts from '../pages/teacher/configure-cohorts'

import HpSystemVersions from '../pages/teacher/hp-system/HpSystemPage'
import HpSystemCohorts from '../pages/teacher/hp-system/CohortsList'
import HpSystemDashboard from '../pages/teacher/hp-system/CohortDetails'
import CreateHpActivityPage from '../pages/teacher/hp-system/create-activity'
import StudentLedgerPage from '../pages/teacher/hp-system/student-ledger'
import StudentSubmissionsPage from '../pages/teacher/hp-system/student-submissions'
import StudentCohorts from '@/app/pages/student/hp-system/cohorts'
import StudentActivities from '@/app/pages/student/hp-system/activities'
import StudentSubmissions from '@/app/pages/student/hp-system/submissions'
import StudentMyLedgerPage from '@/app/pages/student/hp-system/student-ledger'

// Root route with error and notFound handling
const rootRoute = new RootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ({ error }) => {
    console.error('Router error:', error);
    // reload page on error
    setTimeout(() => {
      // window.location.reload();
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

// Forgot Password route - accessible only when NOT authenticated
const forgotPasswordRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
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

// Reset Password route - accessible only when NOT authenticated
const resetPasswordRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
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
  beforeLoad: async () => {
    const { isAuthReady } = useAuthStore.getState();

    // If auth isn't ready, wait for it (max 5 seconds)
    if (!isAuthReady) {
      await new Promise<void>((resolve) => {
        const unsubscribe = useAuthStore.subscribe((state) => {
          if (state.isAuthReady) {
            unsubscribe();
            resolve();
          }
        });
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 5000);
      });
    }

    // Re-check auth state after waiting
    const currentState = useAuthStore.getState();
    if (!currentState.isAuthenticated) {
      throw redirect({ to: '/auth' });
    }

    // Role check - must be a teacher
    if (currentState.user?.role !== 'teacher') {
      if (currentState.user?.role === 'student') {
        throw redirect({ to: '/student' });
      } else {
        throw redirect({ to: '/auth' });
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
  beforeLoad: async () => {
    const { isAuthReady } = useAuthStore.getState();

    // If auth isn't ready, wait for it (max 5 seconds)
    if (!isAuthReady) {
      await new Promise<void>((resolve) => {
        const unsubscribe = useAuthStore.subscribe((state) => {
          if (state.isAuthReady) {
            unsubscribe();
            resolve();
          }
        });
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 5000);
      });
    }

    // Re-check auth state after waiting
    const currentState = useAuthStore.getState();
    if (!currentState.isAuthenticated) {
      throw redirect({ to: '/auth' });
    }
    // Role check - must be a student
    if (currentState.user?.role !== 'student') {
      if (currentState.user?.role === 'teacher') {
        throw redirect({ to: '/teacher' }); // Redirect teachers to their dashboard
      } else {
        throw redirect({ to: '/auth' }); // Redirect others to auth
      }
    }
  },
  component: StudentLayout
  ,
});

// Teacher dashboard route
// const teacherDashboardRoute = new Route({
//   getParentRoute: () => teacherLayoutRoute,
//   path: '/',
//   component: Dashboard,
// });

// Teacher profile route
const teacherProfileRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/profile',
  component: TeacherProfile,
});

const teacherAudioManagerRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/transcribe',
  component: AudioTranscripter,
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
      throw redirect({ to: '/teacher' });
    }
  },
});
// Teacher courses page route
const teacherCoursesPageRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/',
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

// Teacher Course Instructors route
const teacherCourseInstructorsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/instructors',
  component: CourseInstructors,
});

// Teacher Course Instructors route
const teacherConfigureCohortsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/cohorts',
  component: ConfigureCohorts,
});

// Teacher Course Regstration requests
const teacherCourseRegistrationRequests = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/registration-requests',
  component: RegisteredUsers
})



// Teacher Course Flags route
const teacherCourseFlagsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/flags',
  component: FlaggedList,
});

// Teacher Course Anomalies route
const teacherCourseAnomaliesRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/courses/anomalies',
  component: AnomaliesList,
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

//Teacher feedback form route 
const teacherFeedBackEditorRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: 'editor/feedback',
  component: FeedbackFormEditor
})

// Teacher Announcements route
const teacherAnnouncementsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/announcements',
  component: TeacherAnnouncements,
})

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

// Teacher AI Section route
const teacherAIWorkflowSectionRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/ai-workflow',
  component: AiWorkflow,
});

const teacherAuditRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/audit',
  component: AuditPage,
})

const teacherHpSystemVersionsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system',
  component: HpSystemVersions,
})

const teacherHpSystemCohortsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system/$courseVersionId/cohorts',
  component: HpSystemCohorts,
})

const teacherHpSystemDashboardRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system/$courseVersionId/cohort/$cohortName/activities',
  component: HpSystemDashboard,
})

const teacherCreateHpActivityRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system/$courseVersionId/cohort/$cohortName/activities/create',
  component: CreateHpActivityPage,
})

const teacherStudentLedgerRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system/$courseVersionId/cohort/$cohortName/student/$studentId/ledger',
  component: StudentLedgerPage,
})

const teacherStudentSubmissionsRoute = new Route({
  getParentRoute: () => teacherLayoutRoute,
  path: '/hp-system/$courseVersionId/cohort/$cohortName/student/$studentId/submissions',
  component: StudentSubmissionsPage,
})

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

// student issues routes 

const studentIssuesRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/issues',
  component: CourseIssueReports,
})

// Student leaderboard route
const studentLeaderboardRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/leaderboard',
  component: Leaderboard,
});

// Student profile route
const studentProfileRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/profile',
  component: StudentProfile,
});

// Student announcements route
const studentAnnouncementsRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/announcements',
  component: StudentAnnouncements,
});

// Student cohorts route
const studentHpSystemCohortsRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/hp-system/cohorts',
  component: StudentCohorts,
});

// Student activities route
const studentHpSystemActivitiesRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/hp-system/$courseVersionId/$cohortName/activities',
  component: StudentActivities,
});

const studentHpSystemSubmissionsRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/hp-system/$courseVersionId/$cohortName/submissions',
  component: StudentSubmissions,
});

const studentHpSystemLedgerRoute = new Route({
  getParentRoute: () => studentLayoutRoute,
  path: '/hp-system/ledger',
  component: StudentMyLedgerPage,
});

// export const studentCourseInviteRegistration = new Route({
//   getParentRoute: () => studentLayoutRoute,
//   path: "/course-registration/$versionId",
//   component: CourseRegistration,
// })

export const studentCourseInviteRegistration = new Route({
  getParentRoute: () => rootRoute, // 👈 IMPORTANT: NOT studentLayoutRoute
  // path: "/student/course-registration/$versionId",
  path: "/student/course-registration/$versionId/{-$cohort}",
  component: CourseRegistration,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();

    // ❌ Not logged in → go to student login
    if (!isAuthenticated) {
      throw redirect({
        to: '/student/login',
        search: {
          redirect: window.location.pathname + window.location.search,
        },
      });
    }

    // ❌ Logged in but not a student
    if (user?.role !== 'student') {
      throw redirect({ to: '/auth' });
    }
  },
});


const coursePageRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/student/learn',
  component: () => (
    <StudentRouteGuard>
      <CoursePage />
    </StudentRouteGuard>
  ),
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
// export const loginRoute = new Route({
//   getParentRoute: () => rootRoute,
//   path: '/login',
//   component: LoginPage,
// })

//student login route
export const studentLoginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/student/login',
  component: StudentLogin
})

//teacher login route
export const teacherLoginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/teacher/login',
  component: TeacherLogin
})

//select role route
export const selectRoleRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/select-role',
  component: SelectRolePage
})

// Create the router with the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  //   loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  // loginRoute,
  selectRoleRoute,
  studentLoginRoute,
  teacherLoginRoute,
  teacherLayoutRoute.addChildren([
    // teacherDashboardRoute,
    teacherCreateArticleRoute,
    teacherCoursesPageRoute,
    teacherViewCourseRoute, teacherCourseFlagsRoute,
    teacherProfileRoute,
    teacherCourseEnrollmentsRoute,
    teacherAudioManagerRoute,
    teacherAddCourseRoute,
    teacherCourseInviteRoute,
    teacherGenerateSectionRoute,
    teacherAISectionRoute,
    teacherAIWorkflowSectionRoute,
    testAISectionModalRoute,
    teacherCourseAnomaliesRoute,
    teacherCourseInstructorsRoute,
    teacherCourseRegistrationRequests,
    teacherFeedBackEditorRoute,
    teacherAnnouncementsRoute,
    teacherAuditRoute,
    teacherHpSystemVersionsRoute,
    teacherHpSystemCohortsRoute,
    teacherHpSystemDashboardRoute,
    teacherCreateHpActivityRoute,
    teacherStudentLedgerRoute,
    teacherStudentSubmissionsRoute,
    teacherConfigureCohortsRoute
  ]),
  studentLayoutRoute.addChildren([
    studentDashboardRoute,
    studentCoursesRoute,
    studentProfileRoute,
    studentCourseInviteRegistration,
    studentIssuesRoute,
    studentLeaderboardRoute,
    studentAnnouncementsRoute,
    studentHpSystemCohortsRoute,
    studentHpSystemActivitiesRoute,
    studentHpSystemSubmissionsRoute,
    studentHpSystemLedgerRoute
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
