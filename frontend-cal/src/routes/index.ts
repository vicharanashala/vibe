import React from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";
import About from "../pages/About";
import LoginPage from "../pages/LoginPage";
import AdminHome from "@/pages/Admins/AdminHome";
import SuperHome from "@/pages/Admins/SuperHome";
import Admins from "@/pages/Admins/Admins";

const router = createBrowserRouter([
    {
        path: "/",
        element: React.createElement(App),
        children: [
            {
                path: "",
                element: React.createElement(Home)
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