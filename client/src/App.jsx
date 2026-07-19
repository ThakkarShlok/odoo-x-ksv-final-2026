import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

import { PublicLayout } from '@/layouts/PublicLayout';
import { AppShell } from '@/layouts/AppShell';

import Landing from '@/pages/Landing';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';

// Customer Pages
import CatalogBrowse from '@/features/catalog/pages/CatalogBrowse';
import ProductDetail from '@/features/catalog/pages/ProductDetail';
import MyOrders from '@/features/rentals/pages/MyOrders';
import OrderDetail from '@/features/rentals/pages/OrderDetail';
import Profile from '@/features/profile/pages/Profile';
import AddressBook from '@/features/profile/pages/AddressBook';

// Admin Pages
import Dashboard from '@/features/admin/pages/Dashboard';
import AdminOrders from '@/features/admin/pages/AdminOrders';
import AdminOrderDetail from '@/features/admin/pages/AdminOrderDetail';
import InventoryManagement from '@/features/admin/pages/InventoryManagement';
import ProductManagement from '@/features/admin/pages/ProductManagement';
import PricelistManagement from '@/features/admin/pages/PricelistManagement';
import UserManagement from '@/features/admin/pages/UserManagement';
import RentalSettings from '@/features/admin/pages/RentalSettings';
import PickupReturnSchedule from '@/features/admin/pages/PickupReturnSchedule';

import NotFound from '@/pages/NotFound';

function AppIndex() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Dashboard />;
  return <CatalogBrowse />;
}

function OrdersIndex() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <AdminOrders />;
  return <MyOrders />;
}

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
            {/* Index Route resolves based on role */}
            <Route index element={<AppIndex />} />

            {/* Customer Routes */}
            <Route path="catalog/item/:productId" element={<ProtectedRoute roles={['CUSTOMER']}><ProductDetail /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute roles={['CUSTOMER']}><Profile /></ProtectedRoute>} />
            <Route path="addresses" element={<ProtectedRoute roles={['CUSTOMER']}><AddressBook /></ProtectedRoute>} />
            <Route path="orders/:orderId" element={<ProtectedRoute roles={['CUSTOMER']}><OrderDetail /></ProtectedRoute>} />

            {/* Shared Routes */}
            <Route path="orders" element={<OrdersIndex />} />

            {/* Admin Routes */}
            <Route path="admin-orders/:orderId" element={<ProtectedRoute roles={['ADMIN']}><AdminOrderDetail /></ProtectedRoute>} />
            <Route path="schedule" element={<ProtectedRoute roles={['ADMIN']}><PickupReturnSchedule /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute roles={['ADMIN']}><InventoryManagement /></ProtectedRoute>} />
            <Route path="products" element={<ProtectedRoute roles={['ADMIN']}><ProductManagement /></ProtectedRoute>} />
            <Route path="pricelists" element={<ProtectedRoute roles={['ADMIN']}><PricelistManagement /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute roles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute roles={['ADMIN']}><RentalSettings /></ProtectedRoute>} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          success: { iconTheme: { primary: 'hsl(142 76% 36%)', secondary: 'white' } },
        }}
      />
    </AuthProvider>
  );
}
