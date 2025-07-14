import { RouteObject } from "react-router-dom";
import TeacherLayout from "@/layouts/teacher-layout";
import Dashboard from "@/app/pages/teacher/dashboard";
import CreateCourse from "@/app/pages/teacher/create-course";
import Editor from "@/app/pages/teacher/create-article";
import FaceDetectors from "@/app/pages/testing-proctoring/face-detectors";
import GetCourse from "@/app/pages/teacher/get-course";
import TeacherCoursesPage from "@/app/pages/teacher/course-page";
import TeacherProfile from "@/app/pages/teacher/profile";
import { LiveQuiz } from "@/app/pages/teacher/live-quiz" // Uncomment if you want to use AudioManager
import CourseEnrollments from "../pages/teacher/course-enrollments";
import AddCoursePage from "@/app/pages/teacher/AddCoursePage";
import InvitePage from "../pages/teacher/invite";
import ViewProgress from "../pages/teacher/view-progress";
import GenerateSectionPage from "@/app/pages/teacher/create-job";

const teacherRoutes: RouteObject = {
  path: "/teacher",
  element: <TeacherLayout />,
  children: [
    {
      path: "dashboard",
      element: <Dashboard />,
    },
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
      index: true,
      element: <Dashboard />, // Default to Dashboard
    },
    {
      path: "testing",
      element: <FaceDetectors />,
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
      path:"courses/create",
      element:<AddCoursePage /> 
    },
    {
      path: "courses/progress",
      element: <ViewProgress />, // View progress of courses
    },
    {
      path: "jobs/create",
      element: <GenerateSectionPage />, // Page for generating sections using AI
    }
  ],
};

export default teacherRoutes;
