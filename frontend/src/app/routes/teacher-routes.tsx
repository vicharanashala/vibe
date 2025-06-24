import { RouteObject } from "react-router-dom";
import TeacherLayout from "@/layouts/teacher-layout";
import Dashboard from "@/pages/teacher/dashboard";
import CreateCourse from "@/pages/teacher/create-course";
import Editor from "@/pages/teacher/create-article";
import FaceDetectors from "@/pages/testing-proctoring/face-detectors";
import GetCourse from "@/pages/teacher/get-course";
import AddCoursePage from "@/pages/teacher/AddCoursePage";


const teacherRoutes: RouteObject = {
  path: "/teacher",
  element: <TeacherLayout />,
  children: [
    {
      path: "dashboard",
      element: <Dashboard />,
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
      index: true,
      element: <Dashboard />, // Default to Dashboard
    },
    {
      path: "testing",
      element: <FaceDetectors />,
    }
    {path:"add-course",
      element:<AddCoursePage /> 
    }
  ],
};

export default teacherRoutes;
