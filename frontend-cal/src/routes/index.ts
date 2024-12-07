import React from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";
import About from "../pages/About";
import LoginPage from "../pages/LoginPage";
import AdminHome from "@/pages/Admins/AdminHome";
import SuperHome from "@/pages/Admins/SuperHome";
import Admins from "@/pages/Admins/Admins";
import Courses from "@/pages/Students/Courses";
import DummyForm from "@/pages/Students/DummyForm";
import StudentHome from "@/pages/Students/StudentHome";
import AllCourses from "@/pages/Students/AllCourses";
import Assignments from "@/pages/Students/Assignments";
import Testing from "@/pages/Students/Testing";
import SingleCourse from "@/pages/Students/SingleCourse";

const router = createBrowserRouter([
    {
        path: "/",
        element: React.createElement(App),
        children: [
            {
                path: "",
                element: React.createElement(Home),
                children:[
                    {
                        path : "",
                        element: React.createElement(StudentHome)
                    },
                    {
                        path: "/courses",
                        element: React.createElement(Courses)
                    },
                    {
                        path: "/dummyform",
                        element: React.createElement(DummyForm)
                    },
                    {
                        path : "/allCourses",
                        element: React.createElement(AllCourses)
                    },
                    {
                        path : "/assignments",
                        element: React.createElement(Assignments)
                    },
                    {
                        path : "/testing",
                        element: React.createElement(Testing)
                    },
                    {
                        path : "/singleCourse/:courseId",
                        element: React.createElement(SingleCourse)
                    }
                ]
            },
            {
                path: "/login",
                element: React.createElement(LoginPage)
            },
            {
                path: "/about",
                element: React.createElement(About)
            },
            {
                path: "/adminHome",
                element: React.createElement(AdminHome)
            },
            {
                path: "/superHome",
                element: React.createElement(SuperHome),
                children:[
                    {
                        path: "admins",
                        element: React.createElement(Admins)
                    }
                ]
            }
        ]
    }
]);

export default router;