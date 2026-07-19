import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ArrowLeft, Box, Truck, CheckCircle2, RotateCcw, AlertTriangle, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: order, loading, error, refetch } = useApi(`/rentals/${orderId}`);

  async function performAction(actionStr) {
    try {
      await api.post(`/rentals/${orderId}/action`, { action: actionStr });
      toast.success(`Order ${actionStr.toLowerCase()} successfully`);
      refetch();
    } catch (err) {
      toast.error(`Action failed: ${err.response?.data?.message || err.message}`);
    }
  }

  function downloadInvoice() {
    window.open(`http://localhost:5001/api/invoices/${orderId}/download`, '_blank');
  }

  if (loading) return <div className="p-8">Loading order details...</div>;
  if (error || !order) return <div className="p-8 text-destructive">{error || 'Order not found'}</div>;

  const isConfirmed = order.status === 'CONFIRMED';
  const isInRental = order.status === 'IN_RENTAL';
  const isReturned = order.status === 'RETURNED';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin-orders')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Orders
        </Button>
        <StatusBadge status={order.status} className="text-sm px-3 py-1" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{order.customer?.name}</p>
                  <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fulfillment</p>
                  <p className="font-medium">{order.fulfillmentMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(order.rentalStart)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(order.rentalEnd)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-3">Rented Items</p>
                <div className="space-y-3">
                  {order.lines?.map((line) => (
                    <div key={line.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Box className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{line.unit?.serialNumber || 'Pending Assignment'}</p>
                          <p className="text-xs text-muted-foreground">{line.product?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(line.lineSubtotal)}</p>
                        <p className="text-xs text-muted-foreground">{line.durationCount} {line.durationUnit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {order.depositLedger?.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-3">Deposit Ledger</p>
                  <div className="space-y-2 text-sm">
                    {order.depositLedger.map(entry => (
                      <div key={entry.id} className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">{entry.reason}</span>
                        <span className={`font-medium tabular-nums ${entry.entryType === 'DEDUCTED' ? 'text-destructive' : ''}`}>
                          {entry.entryType === 'DEDUCTED' ? '-' : ''}{formatCurrency(entry.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t font-medium flex justify-between">
                      <span>Current Balance</span>
                      <span>{formatCurrency(order.depositSummary?.balance || 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Cost</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit</span>
                <span className="font-medium">{formatCurrency(order.depositTotal)}</span>
              </div>
              {order.lateFees?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late Fees</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(order.lateFees.reduce((sum, f) => sum + parseFloat(f.amount), 0))}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Total Paid</span>
                <span>{formatCurrency(parseFloat(order.total) + parseFloat(order.depositTotal))}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-primary/5 pb-4 border-b border-border">
              <CardTitle className="text-lg">Lifecycle Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {order.status === 'QUOTATION' && (
                <p className="text-sm text-muted-foreground text-center py-4">Waiting for customer payment</p>
              )}
              
              <Button 
                className="w-full justify-start" 
                variant={isConfirmed ? "default" : "outline"}
                disabled={!isConfirmed}
                onClick={() => performAction('HANDOVER')}
              >
                <Truck className="mr-2 h-4 w-4" /> 1. Handover to Customer
              </Button>

              <Button 
                className="w-full justify-start" 
                variant={isInRental ? "default" : "outline"}
                disabled={!isInRental}
                onClick={() => performAction('RETURN')}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> 2. Process Return
              </Button>

              <Button 
                className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white" 
                variant="outline"
                disabled={!isReturned}
                onClick={() => performAction('INSPECT')}
              >
                <AlertTriangle className="mr-2 h-4 w-4" /> 3. Mark Damaged
              </Button>

              <Button 
                className="w-full justify-start" 
                variant={isReturned ? "default" : "outline"}
                disabled={!isReturned}
                onClick={() => performAction('SETTLE')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> 4. Settle & Refund Deposit
              </Button>

              {/* Show invoice download if order is in progress or completed */}
              {['IN_RENTAL', 'RETURNED', 'CLOSED'].includes(order.status) && (
                <Button 
                  className="w-full justify-start mt-2" 
                  variant="secondary"
                  onClick={downloadInvoice}
                >
                  <Download className="mr-2 h-4 w-4" /> Download Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
