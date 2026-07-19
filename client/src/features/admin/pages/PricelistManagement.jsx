import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/api/axios';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';
import { Tags, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ManagePricelistItemsDialog } from '../components/ManagePricelistItemsDialog';

export default function PricelistManagement() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [managingPricelist, setManagingPricelist] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { data, meta, loading, error, refetch } = useApi('/pricelists', {
    params: { page, limit: 12 },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  async function onCreateSubmit(values) {
    setSubmitting(true);
    try {
      await api.post('/pricelists', values);
      toast.success('Pricelist created successfully');
      reset();
      setIsCreateOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create pricelist');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricelists</h1>
          <p className="text-sm text-muted-foreground">Manage seasonal and dynamic pricing multipliers</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Pricelist
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="h-28 animate-pulse p-6 bg-muted" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
      ) : !data?.length ? (
        <Card><CardContent className="p-0"><EmptyState icon={Tags} title="No pricelists found" /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((list) => (
              <Card key={list.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{list.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateShort(list.validFrom)} — {formatDateShort(list.validTo)}</p>
                    </div>
                    <StatusBadge status={list.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="font-mono font-medium">{list.priority}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setManagingPricelist(list)}>
                    Manage Items
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pricelist</DialogTitle>
            <DialogDescription>
              Set up a new pricing multiplier or seasonal rate card.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input 
                placeholder="e.g. Summer 2026 Specials" 
                {...register('name', { required: 'Name is required' })} 
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valid From (Optional)</Label>
                <Input type="date" {...register('validFrom')} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid To (Optional)</Label>
                <Input type="date" {...register('validTo')} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isDefault" {...register('isDefault')} className="rounded border-input text-primary focus:ring-primary" />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">Set as default pricelist</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Pricelist'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Manage Items Dialog */}
      <ManagePricelistItemsDialog 
        open={!!managingPricelist} 
        onOpenChange={(open) => {
          if (!open) setManagingPricelist(null);
        }} 
        pricelist={managingPricelist} 
      />
    </div>
  );
}
