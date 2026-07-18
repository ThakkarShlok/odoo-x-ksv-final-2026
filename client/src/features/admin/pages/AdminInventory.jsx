/**
 * Admin inventory — physical units with serial (barcode), category, and current status. Read-only
 * for the demo (asset creation exists at POST /api/inventory but is off the demo path).
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchInventory } from '../api/inventory';
import { getErrorMessage } from '@/api/axios';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

// Map unit status → the StatusBadge palette by meaning.
const UNIT_STATUS = {
  AVAILABLE: 'ACTIVE',
  RESERVED: 'QUOTATION',
  RENTED: 'IN_RENTAL',
  MAINTENANCE: 'PENDING',
  DAMAGED: 'CANCELLED',
  RETIRED: 'INACTIVE',
};

export default function AdminInventory() {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchInventory({ limit: 100 });
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
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Physical units and their current availability.</p>
      </div>

      {state.status === 'loading' ? <Loading label="Loading inventory…" /> : null}
      {state.status === 'error' ? <ErrorState message={state.error} onRetry={load} /> : null}
      {state.status === 'ready' && state.items.length === 0 ? <EmptyState title="No assets" /> : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Barcode</th>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.items.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{a.barcode}</td>
                    <td className="px-4 py-3">{a.brand || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.categoryName || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={UNIT_STATUS[a.status] ?? 'INACTIVE'} /></td>
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
