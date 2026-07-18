/**
 * Customer order history — the caller's own rentals (server scopes by owner). Links to the order
 * detail where they confirm/pay or track lifecycle. Money right-aligned, one date format.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRentals } from '../api/rentals';
import { getErrorMessage } from '@/api/axios';
import { money, fmtDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

export default function MyOrders() {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchRentals({ limit: 50 });
      setState({ status: 'ready', items: res.data, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My orders</h1>
        <p className="text-muted-foreground">Your rental quotations and orders.</p>
      </div>

      {state.status === 'loading' ? <Loading label="Loading orders…" /> : null}
      {state.status === 'error' ? <ErrorState message={state.error} onRetry={load} /> : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Browse the catalogue to rent your first item."
          action={
            <Link to="/app" className="text-sm font-medium text-primary hover:underline">
              Browse equipment →
            </Link>
          }
        />
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Deposit</th>
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
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/orders/${o.id}`} className="font-medium text-primary hover:underline">View</Link>
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
