/**
 * Admin rentals management — every order, filterable by lifecycle status. Rows link to the shared
 * OrderDetail, where the admin drives handover / return / deposit settlement.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRentals } from '@/features/rentals/api/rentals';
import { getErrorMessage } from '@/api/axios';
import { money, fmtDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

const FILTERS = ['ALL', 'QUOTATION', 'CONFIRMED', 'IN_RENTAL', 'RETURNED', 'CLOSED', 'CANCELLED'];

export default function AdminRentals() {
  const [filter, setFilter] = useState('ALL');
  const [state, setState] = useState({ status: 'loading', items: [], error: null });

  const load = useCallback(async (status) => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchRentals({ limit: 100, status: status === 'ALL' ? undefined : status });
      setState({ status: 'ready', items: res.data, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rentals</h1>
        <p className="text-muted-foreground">Manage the order lifecycle — handover, return, and deposit settlement.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
          >
            {f === 'ALL' ? 'All' : f.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {state.status === 'loading' ? <Loading label="Loading rentals…" /> : null}
      {state.status === 'error' ? <ErrorState message={state.error} onRetry={() => load(filter)} /> : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <EmptyState title="No orders" message="No rentals match this filter." />
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Deposit</th>
                  <th className="px-4 py-3 text-right font-medium">Penalties</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.items.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.rentalStart)} → {fmtDate(o.rentalEnd)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(o.totalBaseCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(o.totalDeposit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(o.totalPenalties) > 0 ? money(o.totalPenalties) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/orders/${o.id}`} className="font-medium text-primary hover:underline">Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
