"use client";

// Real session state backed by the FastAPI backend. The token lives in
// localStorage; on mount we restore the session via /auth/me (which also
// re-checks the whitelist — removed users are logged out immediately).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  clearToken,
  fetchMe,
  getToken,
  loginDev,
  loginWithGoogle,
} from "@/lib/api";
import type { Role, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  devLogin: (email: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const devLogin = useCallback(async (email: string) => {
    const result = await loginDev(email);
    setUser(result.user);
  }, []);

  const googleLogin = useCallback(async (idToken: string) => {
    const result = await loginWithGoogle(idToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, role: user?.role ?? null, loading, devLogin, googleLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Convenience for pages that render only when authenticated. */
export function useSessionUser(): { user: User; role: Role } {
  const { user, role } = useAuth();
  if (!user || !role) throw new Error("Not authenticated");
  return { user, role };
}
