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

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 150) || `HTTP ${res.status} ${res.statusText}` };
  }
}

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
    const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseResponse(res);
    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
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
    const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name, email, department, password }),
    });

    const data = await parseResponse(res);
    if (!res.ok) {
      throw new Error(data.error || `Signup failed (${res.status})`);
    }

    const lecturer: LecturerUser = data;
    setUser(lecturer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lecturer));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    fetch(`${baseUrl}/api/auth/logout`, { method: "POST" }).catch(() => {});
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
