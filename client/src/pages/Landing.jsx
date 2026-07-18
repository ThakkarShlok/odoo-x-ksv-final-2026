import { Link } from 'react-router-dom';
import { Boxes, ShieldCheck, Activity, Bell, GitBranch, Database, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DEMO_CREDENTIALS } from '@/lib/demo-credentials';

const FEATURES = [
  { icon: ShieldCheck, title: 'Role-based access', body: 'Three-layer RBAC: authenticate, authorize by role, scope by ownership.' },
  { icon: Database, title: 'Real data integrity', body: 'Postgres constraints enforce the rules — no-overlap booking, conditional uniqueness.' },
  { icon: Bell, title: 'Persistent notifications', body: 'A durable notification store, separate from transient toasts.' },
  { icon: Activity, title: 'Observable health', body: 'Live server and database readiness checks with retry.' },
];

const ROLES = [
  { role: 'Admin', can: 'Full access, user promotion, all records.' },
  { role: 'Manager', can: 'Team-level operations and reports (stubbed for your domain).' },
  { role: 'Employee', can: 'Create and manage their own records.' },
];

export default function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="zenith-hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <Boxes className="h-5 w-5" aria-hidden="true" />
            Zenith ERP
          </div>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            The operational backbone for any resource you run.
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">
            A domain-neutral ERP foundation — assets, fleet, bookings, procurement — built on
            defensible database architecture, not framework magic.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">Built on fundamentals</h2>
        <p className="mt-1 text-muted-foreground">The parts that survive tomorrow's problem statement.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ROLES + DEMO CREDENTIALS */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Roles at a glance</h2>
            <p className="mt-1 text-muted-foreground">Roles are assigned server-side, never self-selected.</p>
            <dl className="mt-6 space-y-4">
              {ROLES.map((r) => (
                <div key={r.role} className="flex gap-4">
                  <dt className="w-24 shrink-0 font-semibold text-foreground">{r.role}</dt>
                  <dd className="text-sm text-muted-foreground">{r.can}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <GitBranch className="h-5 w-5 text-primary" aria-hidden="true" />
              Demo credentials
            </h2>
            <p className="mt-1 text-muted-foreground">Log in instantly — these are seeded and ready.</p>
            <div className="mt-6 space-y-3">
              {DEMO_CREDENTIALS.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{c.label}</p>
                    <p className="mt-1 font-mono text-sm text-foreground">{c.email}</p>
                    <p className="font-mono text-sm text-muted-foreground">{c.password}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/login" state={{ email: c.email, password: c.password }}>
                      Use
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
