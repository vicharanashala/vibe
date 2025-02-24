import { createContext, useContext, useState, useEffect } from 'react';

type Role = 'teacher' | 'student' | null;

const AuthContext = createContext({
  role: null as Role,
  login: (_role: Role) => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    return localStorage.getItem('lms-role') as Role || null;
  });

  useEffect(() => {
    if (role) {
      localStorage.setItem('lms-role', role);
    } else {
      localStorage.removeItem('lms-role');
    }
  }, [role]);

  const login = (selectedRole: Role) => setRole(selectedRole);
  const logout = () => setRole(null);

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
