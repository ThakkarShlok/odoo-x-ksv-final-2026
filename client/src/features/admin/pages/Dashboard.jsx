import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/common/Loading';
import { TelemetryMap } from '@/components/common/TelemetryMap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, FileText, AlertTriangle, IndianRupee, ShieldAlert, Award } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState('1');

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(res => {
        setData(res.data.data);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to fetch analytics dashboard.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return <Loading label="Compiling master dashboard analytics..." />;
  }

  // Mock forecast chart data
  const chartData = [
    { name: 'Jul 18', demand: 12, capacity: 20 },
    { name: 'Jul 19', demand: 15, capacity: 20 },
    { name: 'Jul 20', demand: 18, capacity: 20 },
    { name: 'Jul 21', demand: 22, capacity: 20 }, // shortfall warning
    { name: 'Jul 22', demand: 14, capacity: 20 },
    { name: 'Jul 23', demand: 10, capacity: 20 },
  ];

  const volumes = data.volumes;
  const financials = data.financials;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading">Operations Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time telemetry, collections, and predictive demand forecasts.</p>
        </div>
        <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10 uppercase tracking-widest font-bold">
          System Admin Panel
        </Badge>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Fleet Rentals</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">{volumes.activeRentals}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {volumes.rentalsDueToday} returns due scheduled today
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Rental Revenue</CardTitle>
            <IndianRupee className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">₹{parseFloat(financials.grossRevenue).toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Accumulated from confirmed orders</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Deposits Held</CardTitle>
            <ShieldAlert className="size-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">₹{parseFloat(financials.securityDepositsHeld).toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Collateral credit holds active</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overdue Penalty Fees</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">₹{parseFloat(financials.lateFeesCollected).toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              From {volumes.overdueRentals} currently overdue assets
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* TSP optimized Route Map */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">IoT Operations Fleet Tracking Map</h3>
          <TelemetryMap 
            selectedAssetId={selectedAsset}
            onSelectAsset={setSelectedAsset}
          />
        </div>

        {/* Predictive demand charts */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">30-Day Demand Forecasts</h3>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Demand vs. Capacity</CardTitle>
              <CardDescription>Shortfall alert triggered for Jul 21.</CardDescription>
            </CardHeader>
            <CardContent className="h-[240px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={10} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid var(--border)' }} />
                  <Bar dataKey="demand" fill="#10b981" rx={3} />
                  <Bar dataKey="capacity" fill="rgba(16, 185, 129, 0.1)" rx={3} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
