import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "../api/client";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(values: { mobile: string; password: string }): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      if (import.meta.env.VITE_DEMO_MODE === "true") {
        api.login({ mobile: "12345678900", password: "12345678900" })
          .then((result) => {
            setToken(result.token);
            setUser(result.user);
          })
          .catch(() => {
            clearToken();
            setUser(null);
          })
          .finally(() => setLoading(false));
        return;
      }
      setLoading(false);
      return;
    }
    api.profile()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(values) {
      const result = await api.login(values);
      setToken(result.token);
      setUser(result.user);
    },
    logout() {
      clearToken();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
