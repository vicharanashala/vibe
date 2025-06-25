import { RouteObject } from "react-router-dom";
import TeacherLayout from "@/layouts/teacher-layout";
import Dashboard from "@/app/pages/teacher/dashboard";
import CreateCourse from "@/app/pages/teacher/create-course";
import Editor from "@/app/pages/teacher/create-article";
import FaceDetectors from "@/app/pages/testing-proctoring/face-detectors";
import GetCourse from "@/app/pages/teacher/get-course";
import TeacherCoursesPage from "@/app/pages/teacher/course-page";
import TeacherProfile from "@/app/pages/teacher/profile";
import { LiveQuiz } from "@/app/pages/teacher/live-quiz" 
import AddCoursePage from "@/app/pages/teacher/AddCoursePage";


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
    {
      path: "courses/create",
      element: <CreateCourse />,
    },
    
    {
      path: "courses/articles/create",
      element: <Editor />,
    },
      {
      path: "courses/list",
      element: <TeacherCoursesPage />,
    },
    {
      index: true,
      element: <Dashboard />, // Default to Dashboard
    },
    {
      path: "testing",
      element: <FaceDetectors />,
    }
     {
      path: "transcribe",
      element: <LiveQuiz />, // Uncomment if you want to use AudioManager
    },
    {path:"add-course",
      element:<AddCoursePage /> 
    }
  ],
};

export default teacherRoutes;
