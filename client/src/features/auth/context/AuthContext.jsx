/**
 * App-wide auth state, wired to the REAL backend:
 *   - access token (15 min) stored in localStorage under TOKEN_KEY; axios attaches it and
 *     transparently refreshes it via the httpOnly cookie on a 401.
 *   - login reads `accessToken` (not `token`); user carries `fullName`, `role`, etc.
 *   - register returns no token, so we register-then-login to obtain a session.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '@/api/axios';
import { login as loginApi, register as registerApi, logout as logoutApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  // On mount with a persisted token, confirm it (and refresh role) via /auth/me. A 401 here is
  // caught by the axios interceptor, which will try the refresh cookie before giving up.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const fresh = res.data.data.user;
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((token, nextUser) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { accessToken, user: nextUser } = await loginApi(credentials);
      persist(accessToken, nextUser);
      return nextUser;
    },
    [persist]
  );

  const register = useCallback(
    async (details) => {
      // Backend register creates the account but returns NO token — immediately log in with the
      // same credentials to establish the session (access token + refresh cookie).
      await registerApi(details);
      const { accessToken, user: nextUser } = await loginApi({
        email: details.email,
        password: details.password,
      });
      persist(accessToken, nextUser);
      return nextUser;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    await logoutApi();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within an <AuthProvider>.');
  return ctx;
}
