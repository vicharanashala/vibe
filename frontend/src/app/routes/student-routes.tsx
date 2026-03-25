import { RouteObject } from "react-router-dom";
import StudentLayout from "@/layouts/student-layout";
import StudentDashboard from "@/app/pages/student/dashboard";
import StudentCourses from "@/app/pages/student/courses";
import StudentProfile from "@/app/pages/student/profile";
import CoursePage from "@/app/pages/student/course-page";
import CourseDetails from "../pages/student/CourseRegistration";
import CourseIssueReports from "../pages/student/FlagResponse";
import Leaderboard from "../pages/student/leaderboard";
import StudentAnnouncements from "../pages/student/announcements/StudentAnnouncements";
import StudentCohorts from "@/app/pages/student/hp-system/cohorts";
import StudentLedgerPage from "@/app/pages/student/hp-system/student-ledger";

const studentRoutes: RouteObject = {
  path: "/student",
  element: <StudentLayout />,
  children: [
    {
      path: "dashboard",
      element: <StudentDashboard />,
    },
    {
      path: "courses",
      element: <StudentCourses />,
    },
    {
      path: "announcements",
      element: <StudentAnnouncements />,
    },
    {
      path: "profile",
      element: <StudentProfile />,
    },
    {
      path: "courseDetails",
      element: <CourseDetails />
    },
    {
      path: "issues",
      element: <CourseIssueReports />
    },
    {
      path: "leaderboard",
      element: <Leaderboard />
    },
    {
      path: "hp-system/cohorts",
      element: <StudentCohorts />
    },
    {
      path: "hp-system/ledger",
      element: <StudentLedgerPage />
    },
    {
      index: true,
      element: <StudentDashboard />, // Default to Dashboard
    }
  ],
};

const learnRoutes: RouteObject = {
  path: "student/learn",
  element: <CoursePage />
};


export default { studentRoutes, learnRoutes };
