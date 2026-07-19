import { useApi } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';
import {
  Activity, TrendingUp, Truck, RotateCcw, AlertTriangle,
  DollarSign, ShieldCheck, Clock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const KPI_CARDS = [
  { key: 'activeRentals', label: 'Active Rentals', icon: Activity, color: 'text-emerald-600' },
  { key: 'rentalsDueToday', label: 'Due Today', icon: Clock, color: 'text-amber-600' },
  { key: 'upcomingPickups', label: 'Upcoming Pickups', icon: Truck, color: 'text-blue-600' },
  { key: 'upcomingReturns', label: 'Upcoming Returns', icon: RotateCcw, color: 'text-violet-600' },
  { key: 'overdueRentals', label: 'Overdue', icon: AlertTriangle, color: 'text-red-600' },
];

const FINANCIAL_CARDS = [
  { key: 'grossRevenue', label: 'Gross Revenue', icon: DollarSign, color: 'text-emerald-600' },
  { key: 'securityDepositsHeld', label: 'Deposits Held', icon: ShieldCheck, color: 'text-amber-600' },
  { key: 'lateFeesCollected', label: 'Late Fees Collected', icon: TrendingUp, color: 'text-red-600' },
];

const PIE_COLORS = ['#B45309', '#0F766E', '#1E40AF', '#B91C1C', '#7C3AED'];

export default function Dashboard() {
  const { data, loading, error } = useApi('/reports/dashboard');

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="p-6 text-center text-destructive">
            Failed to load dashboard data: {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const volumes = data?.volumes || {};
  const financials = data?.financials || {};

  const volumeChartData = KPI_CARDS.map(k => ({
    name: k.label,
    value: volumes[k.key] || 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time visibility into rental activities</p>
      </div>

      {/* Volume KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const value = volumes[kpi.key] ?? 0;
          return (
            <Card key={kpi.key} className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-default">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
                  </div>
                  <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {FINANCIAL_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const value = financials[kpi.key] ?? '0.00';
          return (
            <Card key={kpi.key} className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-default">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground text-right">{formatCurrency(value)}</p>
                  </div>
                  <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Rental Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={volumeChartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {volumeChartData.filter(d => d.value > 0).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {volumeChartData.filter(d => d.value > 0).map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
