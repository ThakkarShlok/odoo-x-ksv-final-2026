import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/common/Loading';
import { Calendar, Eye, Receipt, MapPin, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function CustomerOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    api.get('/rentals')
      .then(res => {
        setOrders(res.data.data);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to fetch your orders.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'QUOTATION':
        return <Badge variant="outline" className="border-sky-500 text-sky-500 bg-sky-500/10">Quotation</Badge>;
      case 'CONFIRMED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10">Confirmed</Badge>;
      case 'IN_RENTAL':
        return <Badge variant="outline" className="border-accent-500 text-accent-500 bg-accent-500/10">Active Rental</Badge>;
      case 'RETURNED':
        return <Badge variant="outline" className="border-indigo-500 text-indigo-500 bg-indigo-500/10">Returned</Badge>;
      case 'CLOSED':
        return <Badge variant="outline" className="border-slate-500 text-slate-500 bg-slate-500/10">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <Loading label="Loading order records..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order Tracking</h1>
        <p className="text-muted-foreground text-sm">Monitor active rentals, download invoices, and check security deposits.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Orders Table */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Your Rental History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Order #</th>
                      <th className="p-4">Dates</th>
                      <th className="p-4">Deposit</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No orders found. Head to the catalog to start a reservation.
                        </td>
                      </tr>
                    ) : (
                      orders.map(order => (
                        <tr 
                          key={order.id} 
                          className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                            selectedOrder?.id === order.id ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="p-4 font-mono font-semibold">{order.orderNumber}</td>
                          <td className="p-4 text-xs">
                            {format(new Date(order.rentalStart), 'PP')} - {format(new Date(order.rentalEnd), 'PP')}
                          </td>
                          <td className="p-4 font-mono">₹{parseFloat(order.depositTotal).toFixed(2)}</td>
                          <td className="p-4 font-mono font-bold text-foreground">₹{parseFloat(order.total).toFixed(2)}</td>
                          <td className="p-4">{getStatusBadge(order.status)}</td>
                          <td className="p-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Order Detail Sidebar Panel */}
        <div className="space-y-6">
          {selectedOrder ? (
            <Card className="border border-border">
              <CardHeader className="bg-muted/40 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-primary">{selectedOrder.orderNumber}</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <CardDescription className="text-xs mt-1">
                  Created on {format(new Date(selectedOrder.createdAt), 'PPP p')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-sm">
                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Rental Duration</h4>
                  <div className="flex items-center gap-2 text-xs text-foreground font-semibold">
                    <Calendar className="size-3.5 text-primary" />
                    <span>{format(new Date(selectedOrder.rentalStart), 'PP')} to {format(new Date(selectedOrder.rentalEnd), 'PP')}</span>
                  </div>
                </div>

                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fulfillment Mode</h4>
                  <div className="flex items-center gap-2 text-xs text-foreground font-semibold">
                    <MapPin className="size-3.5 text-sky-400" />
                    <span>{selectedOrder.fulfillmentMethod === 'DELIVERY' ? 'Home Delivery Address' : ' احمداباد Hub Store Collection'}</span>
                  </div>
                </div>

                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Line Items Allocated</h4>
                  <div className="space-y-2">
                    {selectedOrder.lines?.map(line => (
                      <div key={line.id} className="flex justify-between text-xs">
                        <div>
                          <span className="font-semibold">{line.product?.name || 'Asset'}</span>
                          <span className="block text-muted-foreground text-[10px]">Barcode: {line.productUnit?.serialNumber || 'SN-ALLOC'}</span>
                        </div>
                        <span className="font-mono">₹{parseFloat(line.lineSubtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-yellow-500">Security Deposit Settlement</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Collateral Credit Hold:</span>
                    <span className="font-mono font-semibold text-yellow-600">₹{parseFloat(selectedOrder.depositTotal).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base cost:</span>
                    <span className="font-mono">₹{parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxes & GST (18%):</span>
                    <span className="font-mono">₹{parseFloat(selectedOrder.taxTotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-border">
                    <span>Charged Total:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-500">₹{parseFloat(selectedOrder.total).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-dashed border-border p-8 text-center">
              <Receipt className="mx-auto size-8 text-muted-foreground/60" />
              <p className="text-sm mt-3 text-muted-foreground">Select an order row to view transaction breakdown and tracker logs.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
