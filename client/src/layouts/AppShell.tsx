import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, LayoutGrid, Activity, LogOut, Users, Settings, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  roles: string[];
  stub?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Items', icon: LayoutGrid, end: true, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/app/status', label: 'System Status', icon: Activity, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/app/reports', label: 'Reports', icon: FileText, roles: ['ADMIN', 'MANAGER'], stub: true },
  { to: '/app/users', label: 'Users', icon: Users, roles: ['ADMIN'], stub: true },
  { to: '/app/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'], stub: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

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
