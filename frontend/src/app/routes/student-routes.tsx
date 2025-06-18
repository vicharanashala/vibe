import { RouteObject } from "react-router-dom";
import StudentLayout from "@/layouts/student-layout";
import StudentDashboard from "@/app/pages/student/dashboard";
import StudentCourses from "@/app/pages/student/courses";
import StudentProfile from "@/app/pages/student/profile";
import ItemContainer from "@/components/Item-container";
import CoursePage from "@/app/pages/student/course-page";
// import ParentComponent from "@/ai-components/ParentComponent";
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
      path:"article",
      element: <ItemContainer item={{name:"abc", itemtype:"article", content:"This is a sample article content."} as Item} courseId="" courseVersionId="" userId="" />
    },
    {
      path: "quiz",
      element: <ItemContainer item={{name:"abc", itemtype:"quiz", content:"This is a sample quiz content."} as Item} courseId="" courseVersionId="" userId="" />
    },
    // {
    //   path: "test-ai",
    //   element: <ParentComponent />, // AI component for testing
    // },
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


export default {studentRoutes, learnRoutes};
