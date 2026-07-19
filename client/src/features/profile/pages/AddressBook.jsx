import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useApi } from '@/hooks/useApi';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function AddressBook() {
  const { data: addresses, loading, refetch } = useApi('/users/addresses');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  async function onAddAddress(values) {
    setSubmitting(true);
    try {
      await api.post('/users/addresses', values);
      toast.success('Address added successfully');
      reset();
      setIsAddOpen(false);
      refetch();
    } catch (err) {
      toast.error('Failed to add address');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteAddress(id) {
    if (!confirm('Delete this address?')) return;
    try {
      await api.delete(`/users/addresses/${id}`);
      toast.success('Address deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete address');
    }
  }

  async function onSetDefault(id, type) {
    try {
      // Find the address to keep its existing data
      const address = addresses.find(a => a.id === id);
      await api.put(`/users/addresses/${id}`, { ...address, isDefault: true });
      toast.success('Default address updated');
      refetch();
    } catch (err) {
      toast.error('Failed to update address');
    }
  }

  if (loading) return <div className="p-8">Loading addresses...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Address Book</h1>
          <p className="text-sm text-muted-foreground">Manage your shipping and billing addresses.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Address
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses?.map(address => (
          <Card key={address.id} className={address.isDefault ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> 
                  {address.label || address.type}
                </CardTitle>
                {address.isDefault && <StatusBadge status="DEFAULT" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1 mb-4 text-muted-foreground">
                <p className="text-foreground">{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>{address.city}, {address.state} {address.postalCode}</p>
                <p>{address.country}</p>
              </div>
              <div className="flex gap-2">
                {!address.isDefault && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => onSetDefault(address.id, address.type)}>
                    Set as Default
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDeleteAddress(address.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {addresses?.length === 0 && (
          <div className="col-span-full py-12 text-center border rounded-lg border-dashed">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No addresses found. Add one for easier checkout.</p>
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>Enter your address details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddAddress)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select 
                  {...register('type')} 
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="SHIPPING">Shipping</option>
                  <option value="BILLING">Billing</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Label (Optional)</Label>
                <Input placeholder="e.g. Home, Office" {...register('label')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address Line 1</Label>
              <Input {...register('line1', { required: 'Required' })} />
              {errors.line1 && <p className="text-xs text-destructive">{errors.line1.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Address Line 2 (Optional)</Label>
              <Input {...register('line2')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register('city', { required: 'Required' })} />
                {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>State / Province</Label>
                <Input {...register('state')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Postal Code</Label>
                <Input {...register('postalCode', { required: 'Required' })} />
                {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input defaultValue="India" {...register('country')} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isDefault" {...register('isDefault')} className="rounded border-input text-primary focus:ring-primary" />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">Set as default address</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Address'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'DEFAULT') {
    return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Default</span>;
  }
  return null;
}
