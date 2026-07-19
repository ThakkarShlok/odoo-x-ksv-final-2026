/**
 * Authenticated shell — role-aware sidebar for the rental domain. ADMIN sees the ops nav
 * (dashboard, rentals, inventory); CUSTOMER sees the storefront nav (browse, my orders). Nav is
 * data-driven and filtered by role; items marked `stub` render disabled ("soon") — they are wired
 * in build steps 2–3. Hiding a link is UX only; the route guards + API enforce real access.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, LayoutDashboard, PackageSearch, ClipboardList, Warehouse, Activity, LogOut, Package, TrendingUp } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = {
  ADMIN: [
    { to: '/app/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/products', label: 'Products', icon: Package },
    { to: '/app/rentals', label: 'Rentals', icon: ClipboardList },
    { to: '/app/inventory', label: 'Inventory', icon: Warehouse },
    { to: '/app/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
    { to: '/app/status', label: 'System Status', icon: Activity },
  ],
  CUSTOMER: [
    { to: '/app', label: 'Browse', icon: PackageSearch, end: true },
    { to: '/app/orders', label: 'My Orders', icon: ClipboardList },
    { to: '/app/status', label: 'System Status', icon: Activity },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = NAV[user.role] ?? NAV.CUSTOMER;

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-bold">
          <Boxes className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>Zenith Rentals</span>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
          {items.map((item) => {
            const Icon = item.icon;
            if (item.stub) {
              return (
                <span
                  key={item.to}
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  title="Coming in the next build step"
                  aria-disabled="true"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  <span className="ml-auto text-[0.65rem] uppercase tracking-wide">soon</span>
                </span>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          Signed in as
          <div className="mt-0.5 font-medium text-foreground">{user.fullName}</div>
          <div className="uppercase tracking-wide">{user.role}</div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 font-semibold md:hidden">
            <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
            Zenith
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
