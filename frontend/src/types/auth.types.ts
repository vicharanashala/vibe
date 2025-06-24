import { ReactNode } from "react";

export type Role = 'teacher' | 'student' | 'admin' | null;

export interface AuthContextType {
  role: Role;
  isAuthenticated: boolean;
  login: (selectedRole: Role, uid: string, email: string, name?: string) => void;
  loginWithGoogle: () => Promise<any>;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  logout: () => void;
}

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'teacher' | 'student' | 'admin' | ('teacher' | 'student' | 'admin')[];
}