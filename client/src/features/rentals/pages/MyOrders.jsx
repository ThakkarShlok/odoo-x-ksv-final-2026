import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ShoppingCart, ChevronLeft, ChevronRight, Calendar, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import toast from 'react-hot-toast';
import { AnimatedList, AnimatedListItem } from '@/components/common/AnimatedList';
import { AnimatedPage as AnimatedPageWrapper } from '@/components/common/AnimatedPage';

export default function MyOrders() {
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const { data, meta, loading, error, refetch } = useApi('/rentals', {
    params: { page, limit: 10 },
  });

  async function handlePayAndConfirm(orderId) {
    setProcessingId(orderId);
    try {
      await api.post(`/rentals/${orderId}/action`, { action: 'CONFIRM' });
      toast.success('Payment successful. Order confirmed!');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm order');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
          <p className="text-sm text-muted-foreground">View and manage your rental orders</p>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse p-6 bg-muted" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>;
  }

  if (!data?.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
          <p className="text-sm text-muted-foreground">View and manage your rental orders</p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={ShoppingCart} title="No orders yet" message="You haven't placed any rental orders." />
            <div className="flex justify-center pb-8">
              <Button onClick={() => navigate('/app')}>Browse Catalog</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AnimatedPageWrapper className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
        <p className="text-sm text-muted-foreground">View and manage your rental orders</p>
      </div>

      <AnimatedList className="space-y-4">
        {data.map((order) => (
          <AnimatedListItem key={order.id}>
          <Card className="transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-primary overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="flex-1 p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Rental Period</p>
                        <p className="text-sm font-medium">{formatDateShort(order.rentalStart)} — {formatDateShort(order.rentalEnd)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fulfillment</p>
                        <p className="text-sm font-medium">{order.fulfillmentMethod.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Cost</p>
                      <p className="text-sm font-medium tabular-nums">{formatCurrency(order.subtotal)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row items-center justify-end gap-3 border-t border-border bg-muted/20 p-5 sm:w-48 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0">
                  <Button variant="outline" size="sm" className="transition-all duration-200 active:scale-95 hover:shadow-md w-full" onClick={() => navigate(`/app/orders/${order.id}`)}>
                    View Details
                  </Button>
                  {order.status === 'QUOTATION' && (
                    <Button 
                      size="sm" 
                      className="transition-all duration-200 active:scale-95 hover:shadow-md w-full"
                      disabled={processingId === order.id}
                      onClick={() => handlePayAndConfirm(order.id)}
                    >
                      {processingId === order.id ? 'Processing...' : 'Pay & Confirm'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </AnimatedListItem>
        ))}
      </AnimatedList>

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
    </AnimatedPageWrapper>
  );
}
