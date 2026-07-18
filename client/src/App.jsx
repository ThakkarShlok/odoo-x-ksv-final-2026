import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

import { PublicLayout } from '@/layouts/PublicLayout';
import { AppShell } from '@/layouts/AppShell';

import Landing from '@/pages/Landing';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';
import Catalogue from '@/features/catalog/pages/Catalogue';
import ProductDetail from '@/features/catalog/pages/ProductDetail';
import MyOrders from '@/features/rentals/pages/MyOrders';
import OrderDetail from '@/features/rentals/pages/OrderDetail';
import Dashboard from '@/features/admin/pages/Dashboard';
import AdminRentals from '@/features/admin/pages/AdminRentals';
import AdminInventory from '@/features/admin/pages/AdminInventory';
import AdminProducts from '@/features/admin/pages/AdminProducts';
import AdminProductForm from '@/features/admin/pages/AdminProductForm';
import SystemStatus from '@/features/system-status/pages/SystemStatus';
import NotFound from '@/pages/NotFound';

// The /app index is role-aware: admins land on the ops dashboard, customers on the catalogue.
function AppHome() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <Navigate to="/app/admin" replace /> : <Catalogue />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Authenticated shell */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<AppHome />} />

            {/* Customer */}
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />

            {/* Admin-only. ProtectedRoute roles bounces a CUSTOMER back to /app. */}
            <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><Dashboard /></ProtectedRoute>} />
            <Route path="rentals" element={<ProtectedRoute roles={['ADMIN']}><AdminRentals /></ProtectedRoute>} />
            <Route path="products" element={<ProtectedRoute roles={['ADMIN']}><AdminProducts /></ProtectedRoute>} />
            <Route path="products/new" element={<ProtectedRoute roles={['ADMIN']}><AdminProductForm /></ProtectedRoute>} />
            <Route path="products/:id/edit" element={<ProtectedRoute roles={['ADMIN']}><AdminProductForm /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute roles={['ADMIN']}><AdminInventory /></ProtectedRoute>} />

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
          success: { iconTheme: { primary: 'hsl(142 72% 29%)', secondary: 'white' } },
        }}
      />
    </AuthProvider>
  );
}
