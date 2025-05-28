import { RouteObject } from "react-router-dom";
import StudentLayout from "@/layouts/student-layout";
import StudentDashboard from "@/pages/student/dashboard";
import StudentCourses from "@/pages/student/courses";
import StudentProfile from "@/pages/student/profile";
import ItemContainer from "@/components/Item-container";
import { Item } from "@/components/Item-container"; // Assuming Item is defined in Item-container

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
      path: "profile",
      element: <StudentProfile />,
    },
    {
      path: "video",
      element: <ItemContainer item={{name:"abc", itemtype:"video", content:"https://www.youtube.com/watch?v=vBH6GRJ1REM"} as Item} courseId="" courseVersionId="" userId="" />
    },
    {
      index: true,
      element: <StudentDashboard />, // Default to Dashboard
    }
  ],
};

export default studentRoutes;
