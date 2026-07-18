import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

import { PublicLayout } from '@/layouts/PublicLayout';
import { AppShell } from '@/layouts/AppShell';

import Landing from '@/pages/Landing';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';
import Items from '@/features/items/pages/Items';
import SystemStatus from '@/features/system-status/pages/SystemStatus';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Authenticated area */}
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
