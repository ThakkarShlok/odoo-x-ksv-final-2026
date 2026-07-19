import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ClipboardList, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { AnimatedPage } from '@/components/common/AnimatedPage';

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const { data, meta, loading, error } = useApi('/rentals', {
    params: { page, limit: 10, status: statusFilter || undefined },
  });

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders Management</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage all rental lifecycles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-input bg-background pl-3 focus-within:ring-1 focus-within:ring-ring shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              className="h-9 w-36 border-none bg-transparent text-sm outline-none focus:ring-0 cursor-pointer pr-3"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="QUOTATION">Quotation</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_RENTAL">In Rental</option>
              <option value="RETURNED">Returned (Pending)</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="h-20 animate-pulse p-6 bg-muted" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
      ) : !data?.length ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={ClipboardList} title="No orders found" message="No orders match the current filter." />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Order Number</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Rental Period</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{order.customer?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateShort(order.rentalStart)} — {formatDateShort(order.rentalEnd)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(order.totalBaseCost)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="transition-all duration-200 active:scale-95 hover:shadow-md" onClick={() => navigate(`/app/admin-orders/${order.id}`)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </AnimatedPage>
  );
}
