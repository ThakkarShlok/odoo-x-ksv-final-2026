/**
 * WHAT: App-wide auth state — the current user, the token, and login/logout/register actions.
 * WHY CONTEXT AND NOT REDUX: auth is a single, rarely-changing slice of state read in many
 *   places. That is precisely what React Context is for. Redux would add a store, reducers, and
 *   middleware to manage one object and a boolean — ceremony with no payoff at this size. The
 *   stack decision explicitly excludes Redux; this is why it is not missed.
 * WHY TOKEN + USER IN localStorage: so a page refresh does not log the user out. The token is
 *   the credential; the user object is a cache of {id,email,name,role} for instant render
 *   without a round-trip. axios.js owns clearing both on a 401 — see its interceptor.
 * REVIEWER QUESTION: "Where does role-based UI come from?" -> user.role here, surfaced by the
 *   useAuth() hook. The SERVER still enforces every rule; this only decides what to render.
 *   Hiding an admin button is UX, not security — the API rejects the call regardless.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '@/api/axios.js';
import { login as loginApi, register as registerApi } from '@/api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialise from localStorage synchronously so there is no flash of "logged out" on refresh.
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // Corrupt JSON in storage should not crash the whole app on boot.
      return null;
    }
  });

  // `loading` covers the brief window where a persisted session is being validated. It starts
  // true only if we have a token to check, so a fresh visitor renders instantly.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  // On mount with a persisted token, confirm it is still valid by fetching /auth/me. This also
  // refreshes role if it changed server-side since the token was issued (see middleware/auth.js).
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
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
      .catch(() => {
        // A 401 here is already handled by the axios interceptor (clears storage + redirects).
        // Any other failure: fall back to the cached user rather than logging them out over a
        // transient network blip.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { token, user: nextUser } = await loginApi(credentials);
      persist(token, nextUser);
      return nextUser;
    },
    [persist]
  );

  const register = useCallback(
    async (details) => {
      const { token, user: nextUser } = await registerApi(details);
      persist(token, nextUser);
      return nextUser;
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The one hook every component uses to read auth state. Throws if used outside the provider —
 *  a clear error at dev time beats a confusing `null` deref at runtime. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
