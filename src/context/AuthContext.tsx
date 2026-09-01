import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  AuthUser,
  clearToken,
  fetchMe,
  getToken,
  ServerSettings,
  setToken,
} from '../utils/api';

type AuthContextType = {
  isLoggedIn: boolean;
  authReady: boolean;
  user: AuthUser | null;
  applySession: (token: string, user: AuthUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  serverFlag: boolean;
  serverFlagLoaded: boolean;
  setServerFlag: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [serverFlag, setServerFlagState] = useState(false);
  const [serverFlagLoaded, setServerFlagLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<ServerSettings>('/api/settings')
      .then((s) => {
        if (active) setServerFlagState(s.serverFlag);
      })
      .catch(() => {
        // If settings can't be reached, assume open mode.
      })
      .finally(() => {
        if (active) setServerFlagLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    fetchMe()
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        clearToken();
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback((token: string, nextUser: AuthUser) => {
    setToken(token);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetchMe();
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const setServerFlag = useCallback((v: boolean) => {
    setServerFlagState(v);
    setServerFlagLoaded(true);
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn: Boolean(user),
      authReady,
      user,
      applySession,
      refreshUser,
      logout,
      serverFlag,
      serverFlagLoaded,
      setServerFlag,
    }),
    [user, authReady, serverFlag, serverFlagLoaded, applySession, refreshUser, logout, setServerFlag]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
