import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loading } from '@/components/common/Loading';
import { ShieldCheck, Calendar, Truck, Store, CreditCard, ArrowLeft } from 'lucide-react';

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [availableAsset, setAvailableAsset] = useState(null);
  const [fulfillment, setFulfillment] = useState('STORE_PICKUP');
  
  // Card details mock
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('zenith.checkout_draft');
    if (!saved) {
      toast.error('No active reservation draft found.');
      navigate('/app/catalog');
      return;
    }

    const parsed = JSON.parse(saved);
    setDraft(parsed);

    // Fetch an available physical asset unit for this product
    api.get(`/inventory?status=AVAILABLE`)
      .then(res => {
        // Filter units belonging to this product
        const units = res.data.data || [];
        const match = units.find(u => u.product?.id === parsed.product.id);
        
        if (!match) {
          toast.error(`All units of "${parsed.product.name}" are currently booked or undergoing maintenance.`);
          navigate('/app/catalog');
          return;
        }
        setAvailableAsset(match);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to verify unit availability.'));
        navigate('/app/catalog');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  if (loading || !draft || !availableAsset) {
    return <Loading label="Locking asset and preparing checkout..." />;
  }

  const baseDaily = parseFloat(draft.product.baseDailyRate || '0');
  const baseCost = baseDaily * draft.days;
  const isPct = draft.product.depositMethod === 'PERCENTAGE';
  const depVal = parseFloat(draft.product.depositValue || '0');
  const deposit = isPct ? (baseCost * (depVal / 100)) : depVal;
  const taxes = baseCost * 0.18; // 18% GST standard
  const grandTotal = baseCost + taxes;

  const handleSubmitCheckout = async (e) => {
    e.preventDefault();

    if (!cardName || !cardNumber || !cardExpiry || !cardCvc) {
      toast.error('Please enter complete payment details for authorization hold.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the rental quotation in backend
      const rentalPayload = {
        rentalStart: new Date(draft.startDate).toISOString(),
        rentalEnd: new Date(draft.endDate).toISOString(),
        fulfillmentMethod: fulfillment,
        items: [
          { assetId: availableAsset.id }
        ]
      };

      const res = await api.post('/rentals', rentalPayload);
      const order = res.data.data;

      // 2. Perform mock payment authorization
      await api.post(`/payments/authorize`, {
        orderId: order.id,
        amount: grandTotal + deposit,
        method: 'card',
        reference: `ch_${Math.random().toString(36).substr(2, 9)}`
      });

      toast.success(`Booking Confirmed! Order #${order.orderNumber}`);
      localStorage.removeItem('zenith.checkout_draft');
      navigate('/app/dashboard/orders');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Checkout failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/catalog')}>
          <ArrowLeft className="size-4" /> Back to Catalog
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Method</CardTitle>
              <CardDescription>Choose how you want to collect the rental asset.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={fulfillment} onValueChange={setFulfillment} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Label
                  htmlFor="pickup"
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 hover:bg-muted/40 ${
                    fulfillment === 'STORE_PICKUP' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Store className="size-5 text-primary" />
                    <div>
                      <span className="font-semibold block text-sm">Store Collection</span>
                      <span className="text-xs text-muted-foreground">Pick up from Ahmedabad Hub</span>
                    </div>
                  </div>
                  <RadioGroupItem value="STORE_PICKUP" id="pickup" className="sr-only" />
                </Label>

                <Label
                  htmlFor="delivery"
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 hover:bg-muted/40 ${
                    fulfillment === 'DELIVERY' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="size-5 text-primary" />
                    <div>
                      <span className="font-semibold block text-sm">Home Delivery</span>
                      <span className="text-xs text-muted-foreground">Shipped to default address</span>
                    </div>
                  </div>
                  <RadioGroupItem value="DELIVERY" id="delivery" className="sr-only" />
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit Hold Authorization</CardTitle>
              <CardDescription>Enter card details to authorize the rental subtotal and deposit hold.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitCheckout} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cardName">Cardholder Name</Label>
                  <Input 
                    id="cardName" 
                    placeholder="John Doe" 
                    value={cardName} 
                    onChange={e => setCardName(e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      id="cardNumber" 
                      placeholder="4111 2222 3333 4444" 
                      className="pl-9"
                      value={cardNumber} 
                      onChange={e => setCardNumber(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cardExpiry">Expiration Date</Label>
                    <Input 
                      id="cardExpiry" 
                      placeholder="MM/YY" 
                      value={cardExpiry} 
                      onChange={e => setCardExpiry(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cardCvc">CVC</Label>
                    <Input 
                      id="cardCvc" 
                      placeholder="123" 
                      value={cardCvc} 
                      onChange={e => setCardCvc(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-500 flex items-start gap-2.5">
                  <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                  <p>
                    By clicking authorize, a temporary credit hold of ₹{deposit.toFixed(2)} will be placed. 
                    This will be fully released upon timely return of the asset in flawless condition.
                  </p>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-bold bg-emerald-600 hover:bg-emerald-700">
                  Authorize Hold & Confirm Order (₹{(grandTotal + deposit).toFixed(2)})
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cost Breakdown */}
        <div className="space-y-6">
          <Card className="border border-border">
            <CardHeader className="bg-muted/40 border-b border-border">
              <CardTitle className="text-base">Order Summary</CardTitle>
              <CardDescription>Physical Unit: {availableAsset.serialNumber}</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Item</span>
                <p className="font-semibold text-foreground">{draft.product.name}</p>
                <p className="text-xs text-muted-foreground">Brand: {draft.product.brand || 'Premium'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Rental Window</span>
                <div className="flex items-center gap-2 text-xs text-foreground font-semibold">
                  <Calendar className="size-3.5 text-primary" />
                  <span>{draft.startDate} to {draft.endDate} ({draft.days} Days)</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm font-medium">
                <div className="flex justify-between text-muted-foreground">
                  <span>Rental Subtotal:</span>
                  <span className="font-mono">₹{baseCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Estimated GST (18%):</span>
                  <span className="font-mono">₹{taxes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-500 font-semibold">
                  <span>Security Deposit Hold:</span>
                  <span className="font-mono">₹{deposit.toFixed(2)}</span>
                </div>

                <div className="border-t border-border pt-4 flex justify-between text-lg font-extrabold text-foreground">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-500">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
