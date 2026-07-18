/**
 * WHAT: Route guard. Wraps authenticated pages; bounces anonymous users to /login and, when
 *   `roles` is given, users without an allowed role to /app (not a blank 403 screen).
 * WHY A ROUTE WRAPPER: it keeps the "are you allowed here?" check out of every page component.
 *   A page can assume, by virtue of being mounted, that a valid user is present.
 * SECURITY BOUNDARY NOTE: this is UX, not enforcement. It decides what to RENDER. The server
 *   rejects unauthorised API calls regardless of what the client shows — see the middleware
 *   chain on the backend. Never rely on a client-side guard for actual access control.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { Loading } from '@/components/common/Loading.jsx';

export function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Wait for the persisted-session check to finish before deciding — otherwise a refresh on a
  // protected page would flash the login screen before /auth/me resolves.
  if (loading) {
    return <Loading label="Checking your session…" />;
  }

  if (!isAuthenticated) {
    // Preserve where they were headed so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // Authenticated but wrong role: send to the app home rather than expose a route they
    // cannot use. The API would 403 the underlying calls anyway.
    return <Navigate to="/app" replace />;
  }

  return children;
}
