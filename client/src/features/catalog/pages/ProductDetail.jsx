import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import api from '@/api/axios';
import { formatCurrency, formatDate, getProductImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Calendar, Store, Info, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState('STORE_PICKUP');

  // We fetch the entire catalog and find our specific product, 
  // since we didn't build a dedicated single-product endpoint yet.
  const { data: catalog, loading, error } = useApi('/products/catalog');

  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (catalog?.length) {
      let found = null;
      // Search categories and subcategories
      for (const cat of catalog) {
        found = cat.products?.find(p => p.id === productId);
        if (found) {
          found.category = cat;
          break;
        }
        for (const sub of cat.children || []) {
          found = sub.products?.find(p => p.id === productId);
          if (found) {
            found.category = sub;
            break;
          }
        }
        if (found) break;
      }
      setProduct(found);
    }
  }, [catalog, productId]);

  // Default dates for quotation (tomorrow to day after)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 1);

  const [dates, setDates] = useState({
    start: tomorrow.toISOString().slice(0, 16),
    end: nextWeek.toISOString().slice(0, 16)
  });

  async function handleQuotation() {
    setSubmitting(true);
    try {
      const res = await api.post('/rentals/quotation', {
        rentalStart: new Date(dates.start).toISOString(),
        rentalEnd: new Date(dates.end).toISOString(),
        fulfillmentMethod: method,
        items: [{ productId: product.id }]
      });
      toast.success('Quotation generated successfully!');
      navigate(`/app/orders/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Loading product details...</div>;
  }
  if (error || (!loading && !product)) {
    return <div className="p-8 text-center text-destructive">Product not found.</div>;
  }

  // Cost estimation logic for UI feedback
  const diffTime = Math.abs(new Date(dates.end) - new Date(dates.start));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  const baseTotal = diffDays * parseFloat(product.category.baseDailyRate);
  let estDeposit = 0;
  if (product.category.depositMethod === 'PERCENTAGE') {
    estDeposit = baseTotal * (parseFloat(product.category.depositValue) / 100);
  } else {
    estDeposit = parseFloat(product.category.depositValue);
  }
  const estTotal = baseTotal + estDeposit;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Catalog
      </Button>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left: Image & Details */}
        <div className="space-y-6">
          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border">
            <img 
              src={getProductImageUrl(product.name, product.category?.name, product.id)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{product.name}</h1>
            <p className="text-lg text-muted-foreground">{product.brand || 'Standard Brand'} {product.color ? `— ${product.color}` : ''}</p>
          </div>

          <div className="prose prose-sm dark:prose-invert">
            <p>{product.description || `High quality ${product.category.name} available for rent.`}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Daily Rate</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(product.category.baseDailyRate)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Deposit</p>
                <p className="text-2xl font-bold text-primary">
                  {product.category.depositMethod === 'PERCENTAGE' 
                    ? `${product.category.depositValue}%` 
                    : formatCurrency(product.category.depositValue)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: Quotation Form */}
        <Card className="sticky top-6 border-primary/20 shadow-lg">
          <CardContent className="p-6 space-y-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Select Rental Period
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={dates.start}
                  onChange={e => setDates(d => ({ ...d, start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={dates.end}
                  onChange={e => setDates(d => ({ ...d, end: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Fulfillment Method</label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${method === 'STORE_PICKUP' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <input type="radio" checked={method === 'STORE_PICKUP'} onChange={() => setMethod('STORE_PICKUP')} className="hidden" />
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${method === 'STORE_PICKUP' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {method === 'STORE_PICKUP' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium">Store Pickup</span>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${method === 'DELIVERY' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <input type="radio" checked={method === 'DELIVERY'} onChange={() => setMethod('DELIVERY')} className="hidden" />
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${method === 'DELIVERY' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {method === 'DELIVERY' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium">Delivery</span>
                </label>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{diffDays} days rental</span>
                <span className="font-medium">{formatCurrency(baseTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Security deposit</span>
                <span className="font-medium">{formatCurrency(estDeposit)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-bold">Estimated Total</span>
                <span className="font-bold text-lg">{formatCurrency(estTotal)}</span>
              </div>
            </div>

            <Button 
              className="w-full text-lg h-12" 
              onClick={handleQuotation}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Create Quotation'}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Info className="h-3 w-3" /> No payment required until quotation is confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
