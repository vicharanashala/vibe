import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "@/app/pages/auth-page";
import teacherRoutes from "./teacher-routes";
import studentRoutesExport from "./student-routes";
import { useAuthStore } from "@/store/auth-store";
import { JSX } from "react";
import React from "react";
import LoginPage from "../pages/LoginPage";

const { studentRoutes, learnRoutes } = studentRoutesExport;

// ✅ Role-Based Route Guard using Zustand
function ProtectedRoute({ role, children }: { role: "teacher" | "student"; children: JSX.Element }) {
    const user = useAuthStore(state => state.user);
    const hasAccess = user?.role === role;
    
    // Redirect if no access
    if (!hasAccess) {
        if (user?.role) {
            return <Navigate to={`/${user.role}`} replace />;
        }
        return <Navigate to="/auth" replace />;
    }

    return children;
}

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<AuthPage />} />
                {/* ✅ Register Teacher Routes */}
                <Route path={teacherRoutes.path} element={teacherRoutes.element && React.isValidElement(teacherRoutes.element) ? <ProtectedRoute role="teacher">{teacherRoutes.element}</ProtectedRoute> : <Navigate to="/auth" />}>
                    {teacherRoutes.children?.map((child, idx) => (
                        <Route
                            key={idx}
                            path={child.path}
                            element={child.element}
                            index={child.index}
                        />
                    ))}
                </Route>

                {/* ✅ Register Student Routes */}
                <Route path={studentRoutes.path} element={studentRoutes.element && React.isValidElement(studentRoutes.element) ? <ProtectedRoute role="student">{studentRoutes.element}</ProtectedRoute> : <Navigate to="/auth" />}>
                    {studentRoutes.children?.map((child, idx) => (
                        <Route
                            key={idx}
                            path={child.path}
                            element={child.element}
                            index={child.index}
                        />
                    ))}
                </Route>

                {/* ✅ Register Learn Route */}
                <Route path={learnRoutes.path} element={<ProtectedRoute role="student">{learnRoutes.element}</ProtectedRoute>} />

                <Route path="/" element={<Navigate to="/auth" />} />
                <Route path="/login" element={<LoginPage/>}/>
            </Routes>
        </BrowserRouter>
    );
}
