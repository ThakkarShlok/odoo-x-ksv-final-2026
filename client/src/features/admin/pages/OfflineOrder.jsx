import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/common/Loading';
import { User, Barcode, ShieldAlert, CreditCard } from 'lucide-react';

export default function OfflineOrder() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [assets, setAssets] = useState([]);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [rentalStart, setRentalStart] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [rentalEnd, setRentalEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  // Override overrides state
  const [overrideDeposit, setOverrideDeposit] = useState('');
  const [overrideRate, setOverrideRate] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/users?role=CUSTOMER'),
      api.get('/inventory?status=AVAILABLE')
    ]).then(([usersRes, assetsRes]) => {
      setCustomers(usersRes.data.data || []);
      setAssets(assetsRes.data.data || []);
    }).catch(err => {
      toast.error(getErrorMessage(err, 'Failed to fetch directory lists.'));
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateDays = () => {
    const start = new Date(rentalStart);
    const end = new Date(rentalEnd);
    const diff = end.getTime() - start.getTime();
    if (isNaN(diff) || diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const days = calculateDays();
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const baseRate = selectedAsset ? parseFloat(selectedAsset.product?.baseDailyRate || '500') : 0;
  
  // Calculate regular costs
  const baseCost = baseRate * days;
  const deposit = selectedAsset ? (selectedAsset.product?.depositMethod === 'PERCENTAGE' 
    ? (baseCost * (parseFloat(selectedAsset.product?.depositValue || '20') / 100)) 
    : parseFloat(selectedAsset.product?.depositValue || '200')) : 0;

  // Apply overrides if typed
  const finalRate = overrideRate ? parseFloat(overrideRate) : baseRate;
  const finalCost = finalRate * days;
  const finalDeposit = overrideDeposit ? parseFloat(overrideDeposit) : deposit;
  const taxes = finalCost * 0.18;
  const grandTotal = finalCost + taxes;

  const handleWalkInCheckout = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedAssetId || days <= 0) {
      toast.error('Please configure customer, asset, and dates.');
      return;
    }

    if ((overrideRate || overrideDeposit) && !overrideRationale.trim()) {
      toast.error('An override rationale text is strictly required for auditing.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create walk-in quotation in backend
      const res = await api.post('/rentals', {
        rentalStart: new Date(rentalStart).toISOString(),
        rentalEnd: new Date(rentalEnd).toISOString(),
        fulfillmentMethod: 'STORE_PICKUP',
        customerId: selectedCustomerId,
        items: [
          { assetId: selectedAssetId }
        ]
      });
      const order = res.data.data;

      // 2. Perform payments capture hold
      await api.post(`/payments/authorize`, {
        orderId: order.id,
        amount: grandTotal + finalDeposit,
        method: 'swipe',
        reference: `sw_${Math.random().toString(36).substr(2, 9)}`
      });

      // 3. If override parameters were applied, trigger administrative override endpoint to record logs
      if (overrideRate || overrideDeposit) {
        await api.post(`/deposits/${order.id}/override`, {
          overrideDeposit: finalDeposit,
          overrideRate: finalRate,
          rationale: overrideRationale
        });
      }

      toast.success(`Walk-in Order #${order.orderNumber} successfully processed!`);
      // Reload
      setSelectedAssetId('');
      setSelectedCustomerId('');
      setOverrideRate('');
      setOverrideDeposit('');
      setOverrideRationale('');
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to checkout offline client.'));
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading label="Loading walk-in console buffers..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Offline Checkout Wizard</h1>
        <p className="text-muted-foreground text-xs">Register offline storefront client checkouts and asset allocations.</p>
      </div>

      <form onSubmit={handleWalkInCheckout} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Customer */}
        <Card className="border border-border h-fit">
          <CardHeader>
            <CardTitle className="text-base">1. Customer Search</CardTitle>
            <CardDescription>Allocate the target customer record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cust">Select Customer</Label>
              <select
                id="cust"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Choose Client</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.email})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start">Pickup Date</Label>
                <Input id="start" type="date" value={rentalStart} onChange={e => setRentalStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">Target Return</Label>
                <Input id="end" type="date" value={rentalEnd} onChange={e => setRentalEnd(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Center Column: Asset selection & Overrides */}
        <Card className="border border-border h-fit">
          <CardHeader>
            <CardTitle className="text-base">2. Fleet Unit & Adjustments</CardTitle>
            <CardDescription>Select asset and configure custom fees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asset">Allocated Asset Barcode</Label>
              <select
                id="asset"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
              >
                <option value="">Allocate Barcode</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.barcode} - {a.product?.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orRate">Override Day Rate (₹)</Label>
                <Input id="orRate" type="number" placeholder={baseRate} value={overrideRate} onChange={e => setOverrideRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orDep">Override Deposit (₹)</Label>
                <Input id="orDep" type="number" placeholder={deposit} value={overrideDeposit} onChange={e => setOverrideDeposit(e.target.value)} />
              </div>
            </div>

            {(overrideRate || overrideDeposit) && (
              <div className="space-y-1.5">
                <Label htmlFor="rationale">Override Audit Rationale</Label>
                <textarea
                  id="rationale"
                  rows={2}
                  placeholder="Reason for manual price/deposit alteration..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={overrideRationale}
                  onChange={e => setOverrideRationale(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Walk-in Summary */}
        <Card className="border border-border h-fit">
          <CardHeader className="bg-muted/40 border-b border-border">
            <CardTitle className="text-base">3. Checkout Confirmation</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span>Rental Duration:</span>
                <span>{days} Days</span>
              </div>
              <div className="flex justify-between">
                <span>Rate Applied:</span>
                <span>₹{finalRate.toFixed(2)}/day</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{finalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Security Deposit:</span>
                <span>₹{finalDeposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & GST (18%):</span>
                <span>₹{taxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                <span>Charged Total:</span>
                <span className="text-emerald-600 dark:text-emerald-500">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <CreditCard className="size-4" />
              Swipe & Process Checkout
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
