import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "@/pages/auth-page";
import teacherRoutes from "./teacher-routes";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { JSX } from "react";
import React from "react";

// ✅ Role-Based Route Guard
function ProtectedRoute({ role, children }: { role: "teacher" | "student"; children: JSX.Element }) {
    const user = useSelector((state: RootState) => state.auth.user);

    if (!user) return <Navigate to="/auth" replace />;
    if (user.role !== role) return <Navigate to="/auth" replace />;

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


                <Route path="/" element={<Navigate to="/auth" />} />
            </Routes>
        </BrowserRouter>
    );
}
