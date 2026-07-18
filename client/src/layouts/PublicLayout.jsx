import { Link, Outlet } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <Boxes className="h-6 w-6 text-primary" aria-hidden="true" />
            <span>Zenith ERP</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
          Zenith ERP — hackathon boilerplate. Domain-neutral by design.
        </p>
      </footer>
    </div>
  );
}
