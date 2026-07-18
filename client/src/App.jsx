/**
 * WHAT: The app's route table and top-level providers.
 * WHY BrowserRouter + <Routes> (library mode), NOT the framework/data-router APIs: we are a
 *   plain SPA served by Vite. The declarative <Route> tree is the most reviewable form — the
 *   entire URL surface is visible in one file — and needs no loaders, actions, or SSR. React
 *   Router 7's framework mode buys data-fetching-per-route that we do not use here.
 * PROVIDER ORDER: AuthProvider wraps the router so every route can call useAuth(); Toaster sits
 *   at the top level so react-hot-toast can fire from anywhere, over any route.
 *
 * ROUTE MAP:
 *   /            public landing
 *   /login       public
 *   /register    public
 *   /app         protected shell -> /app (Items)  and  /app/status (System Status)
 *   *            404
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext.jsx';
import { ProtectedRoute } from '@/routes/ProtectedRoute.jsx';

import { PublicLayout } from '@/layouts/PublicLayout.jsx';
import { AppShell } from '@/layouts/AppShell.jsx';

import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login.jsx';
import Register from '@/pages/Register.jsx';
import Items from '@/pages/Items.jsx';
import SystemStatus from '@/pages/SystemStatus.jsx';
import NotFound from '@/pages/NotFound.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes share the minimal public chrome. */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Authenticated area. AppShell renders the sidebar + top bar; child routes render
              into its <Outlet />. The whole subtree is gated by ProtectedRoute. */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Items />} />
            <Route path="status" element={<SystemStatus />} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>

      {/* Transient feedback ("Item created"), distinct from persistent notifications (the bell).
          Positioned once here; every page fires into it via toast(). */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          success: { iconTheme: { primary: 'hsl(158 64% 24%)', secondary: 'white' } },
        }}
      />
    </AuthProvider>
  );
}
