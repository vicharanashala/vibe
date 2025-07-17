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

export type User = {
  uid: string;
  email: string;
  name?: string;
  role: 'teacher' | 'student' | 'admin' | null;
  avatar?: string;
};

export type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
  hasRole: (role: string | string[]) => boolean;
};