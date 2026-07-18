import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

import { PublicLayout } from '@/layouts/PublicLayout';
import { AppShell } from '@/layouts/AppShell';

import Landing from '@/pages/Landing';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';

// Customer views
import Catalog from '@/features/catalog/pages/Catalog';
import Checkout from '@/features/catalog/pages/Checkout';
import CustomerOrders from '@/features/catalog/pages/CustomerOrders';
import Profile from '@/features/profile/pages/Profile';

// Admin views
import AdminDashboard from '@/features/admin/pages/Dashboard';
import Inventory from '@/features/admin/pages/Inventory';
import Pricing from '@/features/admin/pages/Pricing';
import OfflineOrder from '@/features/admin/pages/OfflineOrder';
import AuditLogs from '@/features/admin/pages/AuditLogs';

// Field operations views
import FieldDashboard from '@/features/field-ops/pages/FieldDashboard';
import FieldRoutes from '@/features/field-ops/pages/FieldRoutes';
import FieldInspection from '@/features/field-ops/pages/FieldInspection';

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
            {/* Standard fallback */}
            <Route index element={<Navigate to="catalog" replace />} />
            
            {/* Customer portal routes */}
            <Route path="catalog" element={<Catalog />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="dashboard/orders" element={<CustomerOrders />} />
            <Route path="dashboard/profile" element={<Profile />} />

            {/* Admin console routes */}
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/inventory" element={<Inventory />} />
            <Route path="admin/pricing" element={<Pricing />} />
            <Route path="admin/orders/new" element={<OfflineOrder />} />
            <Route path="admin/audit-logs" element={<AuditLogs />} />

            {/* Field Operations routes */}
            <Route path="field-ops" element={<FieldDashboard />} />
            <Route path="field-ops/routes" element={<FieldRoutes />} />
            <Route path="field-ops/inspection/:orderId" element={<FieldInspection />} />

            {/* Boilerplate items and health */}
            <Route path="items" element={<Items />} />
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
