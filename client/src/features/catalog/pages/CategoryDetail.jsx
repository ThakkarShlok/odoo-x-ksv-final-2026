import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import api, { getErrorMessage } from '@/api/axios';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ArrowLeft, Calendar, ShoppingCart, CreditCard, Package } from 'lucide-react';

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState('select'); // select | review | confirmed
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch category info
  const { data: categories } = useApi('/products', { params: { limit: 100 } });
  const category = categories?.find(c => c.id === categoryId);

  // Fetch available inventory for this category
  const { data: inventory, loading, error } = useApi('/inventory', {
    params: { categoryId, status: 'AVAILABLE', limit: 50 },
    enabled: Boolean(user?.role === 'ADMIN' || user?.role === 'FIELD_AGENT'),
  });

  // For customers, we'll use a simulated approach since inventory is admin-only
  const isAdmin = user?.role === 'ADMIN';

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      rentalStart: '',
      rentalEnd: '',
      fulfillmentMethod: 'STORE_PICKUP',
    },
  });

  const rentalStart = watch('rentalStart');
  const rentalEnd = watch('rentalEnd');

  // Calculate duration and cost estimate
  let durationDays = 0;
  let estimatedCost = 0;
  let estimatedDeposit = 0;
  if (rentalStart && rentalEnd) {
    const start = new Date(rentalStart);
    const end = new Date(rentalEnd);
    durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (durationDays > 0 && category) {
      const dailyRate = parseFloat(category.baseDailyRate) || 50;
      estimatedCost = dailyRate * durationDays;
      const depositVal = parseFloat(category.depositValue) || 20;
      estimatedDeposit = category.depositMethod === 'PERCENTAGE'
        ? estimatedCost * (depositVal / 100)
        : depositVal;
    }
  }

  async function onCreateQuotation(values) {
    if (!selectedUnit && isAdmin) {
      toast.error('Please select a unit to rent.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        rentalStart: new Date(values.rentalStart).toISOString(),
        rentalEnd: new Date(values.rentalEnd).toISOString(),
        fulfillmentMethod: values.fulfillmentMethod,
        items: [{ categoryId, assetId: selectedUnit }],
      };
      const res = await api.post('/rentals', body);
      setQuotation(res.data.data);
      setStep('review');
      toast.success('Quotation created successfully!');
    } catch (err) {
      const msg = getErrorMessage(err);
      if (err.response?.status === 409) {
        toast.error(`Date conflict: ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirmPayment() {
    if (!quotation) return;
    setSubmitting(true);
    try {
      await api.post('/payments/authorize', {
        orderId: quotation.id,
        paymentMethodToken: 'tok_demo_visa',
      });
      setStep('confirmed');
      toast.success('Payment authorized! Order confirmed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'confirmed') {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/orders')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Go to My Orders
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <ShoppingCart className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">Order Confirmed!</h2>
            <p className="mt-2 text-muted-foreground">
              Your rental order <span className="font-mono font-medium text-foreground">{quotation?.orderNumber}</span> has been confirmed.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please visit the store at your scheduled pickup time.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => navigate('/app/orders')}>View My Orders</Button>
              <Button variant="outline" onClick={() => navigate('/app')}>Continue Browsing</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'review' && quotation) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Confirm & Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order</span>
                <span className="font-mono font-medium">{quotation.orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rental Cost</span>
                <span className="font-medium tabular-nums text-right">{formatCurrency(quotation.totalBaseCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Security Deposit</span>
                <span className="font-medium tabular-nums text-right">{formatCurrency(quotation.totalDeposit)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                <span>Total Due Now</span>
                <span className="tabular-nums text-right">
                  {formatCurrency(parseFloat(quotation.totalBaseCost) + parseFloat(quotation.totalDeposit))}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Payment Details</p>
              <Input placeholder="Card Number" defaultValue="4242 4242 4242 4242" disabled />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="MM/YY" defaultValue="12/28" disabled />
                <Input placeholder="CVC" defaultValue="123" disabled />
              </div>
              <p className="text-xs text-muted-foreground">Demo mode — payment is simulated</p>
            </div>

            <Button className="w-full" onClick={onConfirmPayment} disabled={submitting}>
              {submitting ? 'Processing...' : `Pay ${formatCurrency(parseFloat(quotation.totalBaseCost) + parseFloat(quotation.totalDeposit))}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Catalog
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Category Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold">{category?.name || 'Loading...'}</h1>
              {category && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily Rate</span>
                    <span className="font-medium tabular-nums">{formatCurrency(category.baseDailyRate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hourly Rate</span>
                    <span className="font-medium tabular-nums">{formatCurrency(category.baseHourlyRate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit</span>
                    <span className="font-medium tabular-nums">
                      {category.depositMethod === 'PERCENTAGE' ? `${category.depositValue}%` : formatCurrency(category.depositValue)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rental Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Select Rental Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onCreateQuotation)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rentalStart">Start Date & Time</Label>
                    <Input
                      id="rentalStart"
                      type="datetime-local"
                      {...register('rentalStart', { required: 'Start date is required.' })}
                    />
                    {errors.rentalStart && <p className="text-xs text-destructive">{errors.rentalStart.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rentalEnd">End Date & Time</Label>
                    <Input
                      id="rentalEnd"
                      type="datetime-local"
                      min={rentalStart}
                      {...register('rentalEnd', { required: 'End date is required.' })}
                    />
                    {errors.rentalEnd && <p className="text-xs text-destructive">{errors.rentalEnd.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Fulfillment Method</Label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" value="STORE_PICKUP" {...register('fulfillmentMethod')} className="accent-primary" />
                      Store Pickup
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" value="DELIVERY" {...register('fulfillmentMethod')} className="accent-primary" />
                      Delivery
                    </label>
                  </div>
                </div>

                {/* Available units (admin only) */}
                {isAdmin && inventory?.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Select Unit</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inventory.map((unit) => (
                        <label
                          key={unit.id}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                            selectedUnit === unit.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="unit"
                            value={unit.id}
                            checked={selectedUnit === unit.id}
                            onChange={() => setSelectedUnit(unit.id)}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">{unit.barcode}</p>
                            <p className="text-xs text-muted-foreground">{unit.brand} • <StatusBadge status={unit.status} /></p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* For customer: auto-select first available (we get this from admin flow) */}
                {!isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    An available unit will be automatically assigned when you create the booking.
                  </p>
                )}

                {/* Cost preview */}
                {durationDays > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                    <h3 className="text-sm font-medium">Cost Estimate</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{durationDays} day{durationDays > 1 ? 's' : ''} rental</span>
                      <span className="tabular-nums font-medium text-right">{formatCurrency(estimatedCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Security deposit</span>
                      <span className="tabular-nums font-medium text-right">{formatCurrency(estimatedDeposit)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                      <span>Estimated Total</span>
                      <span className="tabular-nums text-right">{formatCurrency(estimatedCost + estimatedDeposit)}</span>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting || (!selectedUnit && isAdmin)}>
                  {submitting ? 'Creating...' : 'Create Quotation'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
