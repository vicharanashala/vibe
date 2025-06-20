import { RouteObject } from "react-router-dom";
import TeacherLayout from "@/layouts/teacher-layout";
import Dashboard from "@/app/pages/teacher/dashboard";
import CreateCourse from "@/app/pages/teacher/create-course";
import Editor from "@/app/pages/teacher/create-article";
import FaceDetectors from "@/app/pages/testing-proctoring/face-detectors";
import GetCourse from "@/app/pages/teacher/get-course";

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
  ],
};

export default teacherRoutes;
