import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/api/axios';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function CreateAssetDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { data: categories } = useApi('/products', { params: { limit: 100 } });
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  async function onSubmit(data) {
    setLoading(true);
    try {
      await api.post('/inventory', data);
      toast.success('Asset added successfully');
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
          <DialogDescription>
            Register a new physical unit to your inventory fleet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            <select 
              id="categoryId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register('categoryId', { required: 'Category is required' })}
            >
              <option value="">Select a category</option>
              {categories?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode / Serial Number</Label>
            <Input 
              id="barcode" 
              placeholder="e.g. EB-2026-001" 
              {...register('barcode', { required: 'Barcode is required' })} 
            />
            {errors.barcode && <p className="text-xs text-destructive">{errors.barcode.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input 
                id="brand" 
                placeholder="e.g. Specialized"
                {...register('brand', { required: 'Required' })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input 
                id="manufacturer" 
                placeholder="e.g. Giant"
                {...register('manufacturer', { required: 'Required' })} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input 
                id="color" 
                placeholder="e.g. Matte Black"
                {...register('color', { required: 'Required' })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input 
                id="size" 
                placeholder="e.g. Medium / 54cm"
                {...register('size', { required: 'Required' })} 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
