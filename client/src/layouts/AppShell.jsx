import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  Boxes, LayoutGrid, Activity, LogOut, Users, Settings, 
  FileText, Shield, Compass, BookOpen, User, ShoppingCart, 
  ListOrdered, Smartphone, Sliders, Database, BadgeAlert
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Specific Navigation items for each role
const ADMIN_NAV = [
  { to: '/app/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/app/admin/inventory', label: 'Inventory Fleet', icon: Database },
  { to: '/app/admin/pricing', label: 'Pricing Rules', icon: Sliders },
  { to: '/app/admin/orders/new', label: 'Offline Checkout', icon: ShoppingCart },
  { to: '/app/admin/audit-logs', label: 'Audit Logs', icon: Shield },
];

const AGENT_NAV = [
  { to: '/app/field-ops', label: 'Ops Dashboard', icon: Smartphone, end: true },
  { to: '/app/field-ops/routes', label: 'TSP Routes', icon: Compass },
];

const CUSTOMER_NAV = [
  { to: '/app/catalog', label: 'Rental Catalog', icon: BookOpen, end: true },
  { to: '/app/dashboard/orders', label: 'My Orders', icon: ListOrdered },
  { to: '/app/dashboard/profile', label: 'Profile Settings', icon: User },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // reviewer mode: override active role dynamically in client view
  const [activeRole, setActiveRole] = useState(user?.role || 'CUSTOMER');

  if (!user) return null;

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // Sidebar item renderer based on role
  const getNavItems = () => {
    switch (activeRole) {
      case 'ADMIN':
        return ADMIN_NAV;
      case 'FIELD_AGENT':
        return AGENT_NAV;
      case 'CUSTOMER':
      default:
        return CUSTOMER_NAV;
    }
  };

  const navItems = getNavItems();

  return (
    <div className="flex min-h-screen bg-background">
      {/* 1. ADMIN SIDEBAR SHELL LAYOUT */}
      {activeRole === 'ADMIN' && (
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-background/50 backdrop-blur-lg h-screen sticky top-0 py-6 px-4 xl:flex">
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-2 font-bold text-lg font-heading">
              <Boxes className="h-6 w-6 text-primary animate-pulse" />
              <span>Zenith ERP</span>
              <Badge variant="outline" className="text-[9px] border-emerald-500 text-emerald-500 bg-emerald-500/10">
                Admin
              </Badge>
            </div>

            <nav className="flex flex-col gap-1.5" aria-label="Admin console navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all duration-300',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="px-2 text-xs">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Signed in as</span>
              <span className="font-semibold text-foreground block truncate">{user.fullName || user.name}</span>
            </div>
            {/* Sandbox Role Switcher */}
            <div className="px-2">
              <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1.5">Sandbox Role Switcher</span>
              <select
                className="w-full text-xs rounded border border-border bg-card p-1.5 font-semibold text-muted-foreground"
                value={activeRole}
                onChange={e => {
                  setActiveRole(e.target.value);
                  if (e.target.value === 'CUSTOMER') navigate('/app/catalog');
                  else if (e.target.value === 'FIELD_AGENT') navigate('/app/field-ops');
                  else if (e.target.value === 'ADMIN') navigate('/app/admin');
                }}
              >
                <option value="ADMIN">Admin Console</option>
                <option value="FIELD_AGENT">Field Operations</option>
                <option value="CUSTOMER">Customer Portal</option>
              </select>
            </div>
          </div>
        </aside>
      )}

      {/* 2. CUSTOMER & FIELD AGENT TOPBAR / GENERAL WRAPPER */}
      <div className="flex flex-1 flex-col pb-16 xl:pb-0">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-card/75 border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 font-semibold font-heading">
            <Boxes className="h-5 w-5 text-primary" />
            <span className="tracking-tight">Zenith ERP</span>
            
            {/* Customer Header Links (for Desktop view) */}
            {activeRole === 'CUSTOMER' && (
              <nav className="hidden md:flex items-center gap-1.5 ml-6 text-sm">
                {CUSTOMER_NAV.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'px-3 py-1.5 rounded-md font-semibold transition-colors',
                        isActive 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Reviewer Role Switcher inside top-bar for mobile viewports */}
            <select
              className="text-xs rounded border border-border bg-card p-1.5 font-semibold text-muted-foreground xl:hidden"
              value={activeRole}
              onChange={e => {
                setActiveRole(e.target.value);
                if (e.target.value === 'CUSTOMER') navigate('/app/catalog');
                else if (e.target.value === 'FIELD_AGENT') navigate('/app/field-ops');
                else if (e.target.value === 'ADMIN') navigate('/app/admin');
              }}
            >
              <option value="ADMIN">Admin Role</option>
              <option value="FIELD_AGENT">Agent Role</option>
              <option value="CUSTOMER">Customer Role</option>
            </select>

            <NotificationBell />
            
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>

        {/* Content Pane */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>

        {/* 3. FIELD AGENT & CUSTOMER BOTTOM NAV MOBILE WRAPPER */}
        {activeRole === 'FIELD_AGENT' && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border flex justify-around py-3" aria-label="Field Agent mobile navigation">
            {AGENT_NAV.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-all duration-300',
                      isActive ? 'text-primary' : 'hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        {/* Customer bottom mobile navigation links */}
        {activeRole === 'CUSTOMER' && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border flex justify-around py-3 md:hidden" aria-label="Customer mobile navigation">
            {CUSTOMER_NAV.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-all duration-300',
                      isActive ? 'text-primary' : 'hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

