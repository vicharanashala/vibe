import { RouteObject } from "react-router-dom";
import TeacherLayout from "@/layouts/teacher-layout";
import Dashboard from "@/app/pages/teacher/dashboard";
import Editor from "@/app/pages/teacher/create-article";
import FaceDetectors from "@/app/pages/testing-proctoring/face-detectors";
import GetCourse from "@/app/pages/teacher/get-course";
import TeacherCoursesPage from "@/app/pages/teacher/course-page";
import TeacherProfile from "@/app/pages/teacher/profile";
import TeacherCoursePage from "@/app/pages/teacher/teacher-course-page";
import { LiveQuiz } from "@/app/pages/teacher/AudioTranscripter" // Uncomment if you want to use AudioManager
import CourseEnrollments from "../pages/teacher/course-enrollments";
import FlaggedList from "../pages/teacher/FlaggedList";
import AddCoursePage from "@/app/pages/teacher/AddCoursePage";
import InvitePage from "../pages/teacher/invite";
import AISectionPage from "@/app/pages/teacher/AISectionPage";
import AnomaliesList from "../pages/teacher/AnomaliesList";
import RegisteredUsers from "../pages/teacher/CourseRegistrationRequests";
import FeedbackFormEditor from "../pages/teacher/FeedbackFormEditor";
import TeacherAnnouncements from "../pages/teacher/announcements";
import AuditPage from "../pages/teacher/AuditPage";
import HpSystemVersions from "../pages/teacher/hp-system/HpSystemPage";
import HpSystemCohorts from "../pages/teacher/hp-system/CohortsList";
import HpSystemDashboard from "../pages/teacher/hp-system/CohortDetails";
import StudentLedgerPage from "../pages/teacher/hp-system/student-ledger";
import StudentSubmissionsPage from "../pages/teacher/hp-system/student-submissions";
import SubmissionDetailsPage from "../pages/teacher/hp-system/submission-details";
const teacherRoutes: RouteObject = {
  path: "/teacher",
  element: <TeacherLayout />,
  children: [
    // {
    //   path: "dashboard",
    //   element: <Dashboard />,
    // },
    {
      path: "profile",
      element: <TeacherProfile />,
    },
    {
      path: "courses/get",
      element: <GetCourse />
    },
    // {
    //   path: "courses/create",
    //   element: <CreateCourse />,
    // },

    {
      path: "courses/articles/create",
      element: <Editor />,
    },
    {
      path: "courses/list",
      element: <TeacherCoursesPage />,
    },
    {
      path: "courses/enrollments",
      element: <CourseEnrollments />,
    },
    {
      path: "courses/flags",
      element: <FlaggedList />,
    },
    {
      path: "courses/anomalies",
      element: <AnomaliesList />,
    },
    {
      index: true,
      element: <TeacherCoursesPage />, // Default to Dashboard
    },
    {
      path: "testing",
      element: <FaceDetectors />,
    },
    {
      path: "courses/view",
      element: <TeacherCoursePage />, // View a specific course
    },
    {
      path: "courses/invite",
      element: <InvitePage />, // Invite page for enrolling users in a course
    },
    {
      path: "transcribe",
      element: <LiveQuiz />, // Uncomment if you want to use AudioManager
    },
    {
      path: "courses/create",
      element: <AddCoursePage />,
    },
    {
      path: "ai-section",
      element: <AISectionPage />, // Page for generating sections using AI
    }, {
      path: "requests",
      element: <RegisteredUsers />
    }, {
      path: "editor/feedback",
      element: <FeedbackFormEditor />
    }, {
      path: "announcements",
      element: <TeacherAnnouncements />
    }, {
      path: "audit",
      element: <AuditPage />
    }, {
      path: "hp-system",
      element: <HpSystemVersions />
    }, {
      path: "hp-system/:courseVersionId/cohorts",
      element: <HpSystemCohorts />
    }, {
      path: "hp-system/:courseVersionId/cohort/:cohortName/activities",
      element: <HpSystemDashboard />
    }, {
      path: "hp-system/:courseVersionId/cohort/:cohortName/student/:studentId/ledger",
      element: <StudentLedgerPage />
    }, {
      path: "hp-system/:courseVersionId/cohort/:cohortName/student/:studentId/submissions",
      element: <StudentSubmissionsPage />
    }, {
      path: "hp-system/:courseVersionId/cohort/:cohortName/student/:studentId/submission/:submissionId",
      element: <SubmissionDetailsPage />
    }
  ],
};

export default teacherRoutes;
