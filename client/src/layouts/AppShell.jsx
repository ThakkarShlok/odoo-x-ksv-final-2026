/**
 * WHAT: The authenticated shell — role-aware sidebar + top bar with the notification bell and a
 *   logout control. Child routes render into <Outlet />.
 * WHY ROLE-AWARE NAV IS DATA, NOT JSX: NAV_ITEMS below declares each entry with the roles that
 *   may see it. Rendering filters on user.role. Adding tomorrow's "Reports (ADMIN only)" page is
 *   one array entry, not a new conditional block. Entries marked `stub:true` are visible but
 *   inert — they show the intended IA without pretending to work, which is honest at a demo.
 * SECURITY NOTE: hiding a nav item is UX. The route guard (ProtectedRoute roles=…) and the API
 *   (requireRole) are the real boundaries. A user who types the URL still gets bounced/403'd.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, LayoutGrid, Activity, LogOut, Users, Settings, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { NotificationBell } from '@/components/common/NotificationBell.jsx';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// roles: who may see it. stub: rendered disabled, no route wired (tomorrow's expansion points).
const NAV_ITEMS = [
  { to: '/app', label: 'Items', icon: LayoutGrid, end: true, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/app/status', label: 'System Status', icon: Activity, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/app/reports', label: 'Reports', icon: FileText, roles: ['ADMIN', 'MANAGER'], stub: true },
  { to: '/app/users', label: 'Users', icon: Users, roles: ['ADMIN'], stub: true },
  { to: '/app/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'], stub: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-bold">
          <Boxes className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>Zenith ERP</span>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            if (item.stub) {
              // Visible but inert: shows the planned structure without faking a working page.
              return (
                <span
                  key={item.to}
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  title="Stub — wire this up for your domain"
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
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-secondary'
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
          <div className="mt-0.5 font-medium text-foreground">{user.name}</div>
          <div className="uppercase tracking-wide">{user.role}</div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          {/* Brand shows on mobile where the sidebar is hidden. */}
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
