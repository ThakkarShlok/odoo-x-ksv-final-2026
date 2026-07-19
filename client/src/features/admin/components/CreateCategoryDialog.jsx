import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/api/axios';
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

export function CreateCategoryDialog({ open, onOpenChange, onSuccess, category }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: category ? {
      name: category.name,
      baseHourlyRate: category.baseHourlyRate,
      baseDailyRate: category.baseDailyRate,
      depositMethod: category.depositMethod,
      depositValue: category.depositValue,
    } : {
      depositMethod: 'FIXED'
    }
  });

  const depositMethod = watch('depositMethod');

  async function onSubmit(data) {
    setLoading(true);
    try {
      // Convert to numbers
      const payload = {
        ...data,
        depositValue: Number(data.depositValue),
        baseHourlyRate: Number(data.baseHourlyRate),
        baseDailyRate: Number(data.baseDailyRate)
      };
      if (category) {
        await api.patch(`/products/${category.id}`, payload);
        toast.success('Category updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Category created successfully');
      }
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {category ? 'Update the category details and base pricing rules.' : 'Create a new product category and define its base pricing rules.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input 
              id="name" 
              placeholder="e.g. Electric Bicycles" 
              {...register('name', { required: 'Name is required' })} 
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseHourlyRate">Base Hourly Rate</Label>
              <Input 
                id="baseHourlyRate" 
                type="number" 
                step="0.01" 
                {...register('baseHourlyRate', { required: 'Required', min: 0 })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseDailyRate">Base Daily Rate</Label>
              <Input 
                id="baseDailyRate" 
                type="number" 
                step="0.01" 
                {...register('baseDailyRate', { required: 'Required', min: 0 })} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depositMethod">Deposit Method</Label>
              <select 
                id="depositMethod"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register('depositMethod')}
              >
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositValue">Deposit {depositMethod === 'PERCENTAGE' ? '%' : 'Amount'}</Label>
              <Input 
                id="depositValue" 
                type="number" 
                step="0.01" 
                {...register('depositValue', { required: 'Required', min: 0 })} 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (category ? 'Update Category' : 'Create Category')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
