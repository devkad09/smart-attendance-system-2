import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface LecturerUser {
  id: number;
  email: string;
  name: string;
  department: string;
}

interface AuthContextType {
  user: LecturerUser | null;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  signup: (data: { name: string; email: string; department: string; password: string }) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "smart_access_lecturer_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LecturerUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse saved user", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async ({ email, password }: { email: string; password: string }) => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    const lecturer: LecturerUser = data;
    setUser(lecturer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lecturer));
  };

  const signup = async ({
    name,
    email,
    department,
    password,
  }: {
    name: string;
    email: string;
    department: string;
    password: string;
  }) => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, department, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Signup failed");
    }

    const lecturer: LecturerUser = data;
    setUser(lecturer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lecturer));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    fetch(`${import.meta.env.BASE_URL}api/auth/logout`, { method: "POST" }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
