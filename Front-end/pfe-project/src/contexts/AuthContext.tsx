"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  type AuthUser,
  type Org,
  type RegisterData,
  ApiError,
} from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  orgs: Org[];
  currentOrgId: string | null;
  setOrgs: (orgs: Org[]) => void;
  setCurrentOrgId: (orgId: string) => void;
  login: (email: string, password: string) => Promise<{ orgs?: Org[]; current_org_id?: string }>;
  register: (data: RegisterData) => Promise<{ orgs?: Org[]; current_org_id?: string }>;
  logout: () => void;
  updateToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgsState] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);

  // On mount, check for a stored token and validate it
  useEffect(() => {
    const stored = localStorage.getItem("token");
    const storedOrgId = localStorage.getItem("currentOrgId");
    if (storedOrgId) setCurrentOrgIdState(storedOrgId);

    if (!stored) {
      setLoading(false);
      return;
    }

    setToken(stored);

    getMe()
      .then((res) => {
        setUser({
          id: res.user.user_id,
          name: "",
          email: res.user.email,
          role: res.user.role,
        });
        if (res.orgs) {
          setOrgsState(res.orgs);
          // If no org selected yet, auto-select first
          if (!storedOrgId && res.orgs.length > 0) {
            const defaultOrg = res.orgs[0];
            setCurrentOrgIdState(defaultOrg.id);
            localStorage.setItem("currentOrgId", defaultOrg.id);
          }
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("currentOrgId");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setOrgs = useCallback((newOrgs: Org[]) => {
    setOrgsState(newOrgs);
  }, []);

  const setCurrentOrgId = useCallback((orgId: string) => {
    setCurrentOrgIdState(orgId);
    localStorage.setItem("currentOrgId", orgId);
  }, []);

  const updateToken = useCallback((newToken: string) => {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);

    if (res.orgs) {
      setOrgsState(res.orgs);
    }
    if (res.current_org_id) {
      setCurrentOrgIdState(res.current_org_id);
      localStorage.setItem("currentOrgId", res.current_org_id);
    }

    return { orgs: res.orgs, current_org_id: res.current_org_id };
  }, []);

  const register = useCallback(
    async (data: RegisterData) => {
      const res = await apiRegister(data);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);

      if (res.orgs) {
        setOrgsState(res.orgs);
      }
      if (res.current_org_id) {
        setCurrentOrgIdState(res.current_org_id);
        localStorage.setItem("currentOrgId", res.current_org_id);
      }

      return { orgs: res.orgs, current_org_id: res.current_org_id };
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    localStorage.removeItem("currentOrgId");
    setToken(null);
    setUser(null);
    setOrgsState([]);
    setCurrentOrgIdState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, token, loading, orgs, currentOrgId,
        setOrgs, setCurrentOrgId, updateToken,
        login, register, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
