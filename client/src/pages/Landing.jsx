import { Link } from 'react-router-dom';
import { Boxes, ShieldCheck, Activity, Bell, GitBranch, Database, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DEMO_CREDENTIALS } from '@/lib/demo-credentials';
import { AnimatedList, AnimatedListItem } from '@/components/common/AnimatedList';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { motion } from 'framer-motion';

const FEATURES = [
  { icon: ShieldCheck, title: 'Role-based access', body: 'Three-layer RBAC: authenticate, authorize by role, scope by ownership.' },
  { icon: Database, title: 'Real data integrity', body: 'Postgres constraints enforce the rules — no-overlap booking, conditional uniqueness.' },
  { icon: Bell, title: 'Persistent notifications', body: 'A durable notification store, separate from transient toasts.' },
  { icon: Activity, title: 'Observable health', body: 'Live server and database readiness checks with retry.' },
];

const ROLES = [
  { role: 'Admin', can: 'Full access, user promotion, all records.' },
  { role: 'Customer', can: 'Browse catalog, create quotations, pay, and view history.' },
];

export default function Landing() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }}
    >
      {/* HERO */}
      <section className="zenith-hero-gradient text-primary-foreground relative overflow-hidden">
        {/* Subtle animated background shapes */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-white/20 blur-3xl pointer-events-none" 
        />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-32 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-2 text-sm font-medium opacity-90"
          >
            <Boxes className="h-5 w-5" aria-hidden="true" />
            RentFlow
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl drop-shadow-sm"
          >
            The operational backbone for any resource you run.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 max-w-xl text-lg opacity-90 leading-relaxed"
          >
            A domain-neutral rental management foundation — assets, fleet, bookings, procurement — built on
            defensible database architecture, not framework magic.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Button asChild size="lg" variant="secondary" className="shadow-lg transition-transform hover:scale-105 active:scale-95">
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
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight">Built on fundamentals</h2>
          <p className="mt-2 text-lg text-muted-foreground">The parts that survive tomorrow's problem statement.</p>
        </motion.div>
        
        <AnimatedList className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <AnimatedListItem key={f.title}>
                <Card className="h-full transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">{f.body}</CardDescription>
                  </CardHeader>
                </Card>
              </AnimatedListItem>
            );
          })}
        </AnimatedList>
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
            <p className="mt-2 text-muted-foreground">Log in instantly — these are seeded and ready.</p>
            <AnimatedList className="mt-8 space-y-4">
              {DEMO_CREDENTIALS.map((c) => (
                <AnimatedListItem key={c.email}>
                  <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                    <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{c.label}</p>
                    <p className="mt-1 font-mono text-sm text-foreground">{c.email}</p>
                    <p className="font-mono text-sm text-muted-foreground">{c.password}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="transition-all duration-200 active:scale-95 hover:shadow-md group-hover:bg-primary group-hover:text-primary-foreground">
                    <Link to="/login" state={{ email: c.email, password: c.password }}>
                      Login as {c.label}
                    </Link>
                  </Button>
                </div>
                </AnimatedListItem>
              ))}
            </AnimatedList>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
