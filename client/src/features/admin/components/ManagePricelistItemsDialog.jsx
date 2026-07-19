import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ManagePricelistItemsDialog({ open, onOpenChange, pricelist }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (open && pricelist) {
      loadData();
    }
  }, [open, pricelist]);

  async function loadData() {
    setLoading(true);
    try {
      const [plRes, prodRes] = await Promise.all([
        api.get(`/pricelists/${pricelist.id}`),
        api.get('/products?limit=100')
      ]);
      setItems(plRes.data.data.items || []);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function onAddItem(values) {
    setSubmitting(true);
    try {
      await api.post(`/pricelists/${pricelist.id}/items`, {
        productId: values.productId,
        durationUnit: values.durationUnit,
        rate: Number(values.rate)
      });
      toast.success('Rate added successfully');
      reset();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add rate');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(itemId) {
    try {
      await api.delete(`/pricelists/${pricelist.id}/items/${itemId}`);
      toast.success('Rate removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove rate');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Pricelist: {pricelist?.name}</DialogTitle>
          <DialogDescription>
            Add specific product rates to override the base category pricing.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            <form onSubmit={handleSubmit(onAddItem)} className="grid gap-4 py-4 grid-cols-12 items-end border-b pb-6">
              <div className="col-span-5 space-y-2">
                <Label>Product</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('productId', { required: 'Required' })}
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {errors.productId && <span className="text-[10px] text-destructive">{errors.productId.message}</span>}
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Duration</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('durationUnit', { required: 'Required' })}
                >
                  <option value="HOURLY">Hourly</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Rate (₹)</Label>
                <Input type="number" step="0.01" {...register('rate', { required: 'Required', min: 0 })} />
              </div>
              <div className="col-span-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  Add
                </Button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto pt-4 space-y-2 min-h-[200px]">
              {items.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No custom rates defined for this pricelist.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.durationUnit}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium tabular-nums">{formatCurrency(item.rate)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
