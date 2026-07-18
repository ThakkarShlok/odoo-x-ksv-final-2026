/**
 * Admin operations dashboard — real /api/reports/dashboard KPIs. Volume tiles + a Recharts bar
 * chart of the operational pipeline (a chart beats five loose numbers for at-a-glance shape), plus
 * financial cards. Money right-aligned, 2 decimals, one currency symbol via lib/format.
 */
import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, Truck, RotateCcw, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { fetchDashboard } from '../api/reports';
import { getErrorMessage } from '@/api/axios';
import { money } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';

const VOLUME_TILES = [
  { key: 'activeRentals', label: 'Active rentals', icon: Activity, color: 'var(--chart-1)' },
  { key: 'rentalsDueToday', label: 'Due today', icon: CalendarClock, color: 'var(--chart-2)' },
  { key: 'upcomingPickups', label: 'Upcoming pickups', icon: Truck, color: 'var(--chart-3)' },
  { key: 'upcomingReturns', label: 'Upcoming returns', icon: RotateCcw, color: 'var(--chart-4)' },
  { key: 'overdueRentals', label: 'Overdue', icon: AlertTriangle, color: 'var(--chart-5)', danger: true },
];

export default function Dashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await fetchDashboard();
      setState({ status: 'ready', data, error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <Loading label="Loading dashboard…" />;
  if (state.status === 'error') {
    return <ErrorState title="Couldn't load the dashboard" message={state.error} onRetry={load} />;
  }

  const { volumes, financials } = state.data;
  const chartData = VOLUME_TILES.map((t) => ({ name: t.label, value: volumes[t.key] ?? 0, color: t.color }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations dashboard</h1>
        <p className="text-muted-foreground">Live rental volumes and financial position.</p>
      </div>

      {/* Volume tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {VOLUME_TILES.map((t) => {
          const Icon = t.icon;
          const value = volumes[t.key] ?? 0;
          return (
            <Card key={t.key}>
              <CardContent className="p-5">
                <Icon className={`h-5 w-5 ${t.danger && value > 0 ? 'text-destructive' : 'text-muted-foreground'}`} aria-hidden="true" />
                <p className={`mt-3 text-3xl font-bold tabular-nums ${t.danger && value > 0 ? 'text-destructive' : ''}`}>{value}</p>
                <p className="text-sm text-muted-foreground">{t.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Operational pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Financials */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Financials</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Gross revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums text-right">{money(financials.grossRevenue)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Security deposits held</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums text-right text-accent">{money(financials.securityDepositsHeld)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Late fees collected</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums text-right">{money(financials.lateFeesCollected)}</p></CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
