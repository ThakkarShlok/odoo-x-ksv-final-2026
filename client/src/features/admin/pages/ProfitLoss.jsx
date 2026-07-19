/**
 * Profit and Loss Page for Admins.
 * Utilizes pre-existing tables to compute product-level profitability,
 * Net Operating Income trends, and actual cash flow liquidity (cash in/out).
 */
import { useCallback, useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Percent,
  Layers,
  Wrench,
  BadgeAlert
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Legend, 
  ComposedChart,
  Line
} from 'recharts';
import { fetchProfitLoss } from '../api/reports';
import { getErrorMessage } from '@/api/axios';
import { money } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';

export default function ProfitLoss() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PROFITABLE, LOSS_INCURRING
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await fetchProfitLoss();
      setState({ status: 'ready', data, error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <Loading label="Loading financial reports…" />;
  if (state.status === 'error') {
    return <ErrorState title="Couldn't load Profit & Loss data" message={state.error} onRetry={load} />;
  }

  const { productProfitability, noiTrend, cashFlowTrend } = state.data;

  // Compute overall summary stats
  const totalIncome = productProfitability.reduce((sum, p) => sum + parseFloat(p.income), 0);
  const totalExpenses = productProfitability.reduce((sum, p) => sum + parseFloat(p.expenses), 0);
  const totalNoi = totalIncome - totalExpenses;
  
  const currentMonthCF = cashFlowTrend[cashFlowTrend.length - 1] || { cashIn: '0', cashOut: '0', netCashFlow: '0' };
  const totalCashIn = cashFlowTrend.reduce((sum, m) => sum + parseFloat(m.cashIn), 0);
  const totalCashOut = cashFlowTrend.reduce((sum, m) => sum + parseFloat(m.cashOut), 0);
  const netLiquidity = totalCashIn - totalCashOut;

  const profitableCount = productProfitability.filter(p => p.status === 'PROFITABLE').length;
  const lossIncurringCount = productProfitability.filter(p => p.status === 'LOSS_INCURRING').length;

  // Extract unique categories for filters
  const categories = ['ALL', ...new Set(productProfitability.map(p => p.category))];

  // Filter products
  const filteredProducts = productProfitability.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'ALL' || 
      product.status === statusFilter;
      
    const matchesCategory = 
      categoryFilter === 'ALL' || 
      product.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Format month label for Recharts
  const formatMonthLabel = (mStr) => {
    const [year, month] = mStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('default', { month: 'short', year: '2-digit' });
  };

  const chartNoiData = noiTrend.map(item => ({
    ...item,
    name: formatMonthLabel(item.month),
    Income: parseFloat(item.income),
    Expenses: parseFloat(item.expenses),
    NOI: parseFloat(item.noi)
  }));

  const chartCashFlowData = cashFlowTrend.map(item => ({
    ...item,
    name: formatMonthLabel(item.month),
    'Cash In (Inflow)': parseFloat(item.cashIn),
    'Cash Out (Outflow)': parseFloat(item.cashOut),
    'Net Cash Flow': parseFloat(item.netCashFlow)
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profit & Loss Analysis</h1>
          <p className="text-muted-foreground">Admin visibility into product profitability, Net Operating Income (NOI), and total liquidity cash flows.</p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="h-9">
          Refresh Data
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Income</span>
              <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tabular-nums text-foreground">{money(totalIncome)}</h3>
              <p className="text-xs text-muted-foreground mt-1">Rentals + penalty late fees</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
              <div className="rounded-full bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tabular-nums text-foreground">{money(totalExpenses)}</h3>
              <p className="text-xs text-muted-foreground mt-1">Maintenance + refunds + ops</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Net Operating Income</span>
              <div className={`rounded-full p-2 ${totalNoi >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                {totalNoi >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </div>
            <div className="mt-3">
              <h3 className={`text-2xl font-bold tabular-nums ${totalNoi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {money(totalNoi)}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">NOI (Income - Expenses)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Account Liquidity (Cash Flow)</span>
              <div className={`rounded-full p-2 ${netLiquidity >= 0 ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className={`text-2xl font-bold tabular-nums ${netLiquidity >= 0 ? 'text-primary' : 'text-rose-600 dark:text-rose-400'}`}>
                {money(netLiquidity)}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">6-Month Net Cash Position</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphs */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Net Operating Income Graph */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Net Operating Income (NOI) Trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">Monthly breakdown of rental income, calculated expenses, and Net Operating Income.</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartNoiData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 72% 29%)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(142 72% 29%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 84.2% 60.2%)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(0 84.2% 60.2%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNoi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, backgroundColor: 'var(--card)' }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Income" stroke="hsl(142 72% 29%)" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Expenses" stroke="hsl(0 84.2% 60.2%)" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
                  <Area type="monotone" dataKey="NOI" stroke="hsl(221.2 83.2% 53.3%)" fillOpacity={1} fill="url(#colorNoi)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Liquidity Graph */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Cash Flow Liquidity Position
            </CardTitle>
            <p className="text-xs text-muted-foreground">Inflows (payments received) vs. Outflows (refunds + maintenance) and Net Cash Flow.</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartCashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, backgroundColor: 'var(--card)' }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Cash In (Inflow)" fill="hsl(142 72% 29%)" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.8} />
                  <Bar dataKey="Cash Out (Outflow)" fill="hsl(0 84.2% 60.2%)" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.8} />
                  <Line type="monotone" dataKey="Net Cash Flow" stroke="hsl(221.2 83.2% 53.3%)" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Profitability Section */}
      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Product Profitability Ledger</CardTitle>
            <p className="text-xs text-muted-foreground">List of all items in the rental catalog showing aggregated revenue, calculated overheads, and profitability status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-200 dark:border-emerald-500/20">
              Profitable: {profitableCount}
            </span>
            <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs px-2.5 py-1 rounded-full font-medium border border-rose-200 dark:border-rose-500/20">
              Loss Incurring: {lossIncurringCount}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search products, SKU or category..." 
                className="pl-8 h-9" 
              />
            </div>
            
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)} 
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter by financial status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PROFITABLE">Profitable Only</option>
              <option value="LOSS_INCURRING">Loss Incurring Only</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)} 
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter by category"
            >
              <option value="ALL">All Categories</option>
              {categories.filter(c => c !== 'ALL').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border border-border/80">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product / SKU</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Rentals Count</th>
                  <th className="px-4 py-3 text-right font-medium">Income</th>
                  <th className="px-4 py-3 text-right font-medium">Expenses</th>
                  <th className="px-4 py-3 text-right font-medium">NOI</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No products match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isProfit = parseFloat(p.noi) > 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{p.category}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-medium">{p.rentalsCount}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{money(p.income)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-rose-500 font-medium">{money(p.expenses)}</td>
                        <td className={`px-4 py-3.5 text-right tabular-nums font-semibold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {parseFloat(p.noi) >= 0 ? '+' : ''}{money(p.noi)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {p.status === 'PROFITABLE' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-200 dark:border-emerald-500/20">
                              <ArrowUpRight className="h-3 w-3" />
                              Profitable
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs px-2.5 py-0.5 rounded-full font-medium border border-rose-200 dark:border-rose-500/20">
                              <ArrowDownRight className="h-3 w-3" />
                              Loss Incurring
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
