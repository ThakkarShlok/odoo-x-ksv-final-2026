import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { fetchItems, createItem } from '../api/items';
import type { Item } from '../api/items';
import { getErrorMessage } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

interface ItemsState {
  status: 'loading' | 'ready' | 'error';
  items: Item[];
  count: number;
  error: string | null;
}

export default function Items() {
  const [state, setState] = useState<ItemsState>({ status: 'loading', items: [], count: 0, error: null });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '' } });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchItems();
      setState({ status: 'ready', items: res.data, count: res.meta?.count ?? res.data.length, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], count: 0, error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(values: { name: string }) {
    try {
      const created = await createItem({ name: values.name.trim(), status: 'ACTIVE' });
      toast.success(`Created "${created.name}".`);
      reset();
      load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create item.'));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Items</h1>
        <p className="text-muted-foreground">
          The domain-neutral entity that proves the pipe. Rename it for your problem tomorrow.
        </p>
      </div>

      {/* CREATE FORM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New item</CardTitle>
          <CardDescription>Creating one writes a notification and an audit-log row server-side.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name" className="sr-only">
                Item name
              </Label>
              <Input
                id="name"
                placeholder="e.g. Loading Bay A"
                aria-invalid={Boolean(errors.name)}
                {...register('name', {
                  required: 'Name is required.',
                  maxLength: { value: 200, message: 'Too long (max 200).' },
                })}
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="h-4 w-4" />
              {isSubmitting ? 'Adding…' : 'Add item'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* LIST — three explicit states */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All items</h2>
          {state.status === 'ready' ? (
            <span className="text-sm text-muted-foreground">{state.count} total</span>
          ) : null}
        </div>

        {state.status === 'loading' ? <Loading label="Loading items…" /> : null}

        {state.status === 'error' ? (
          <ErrorState title="Couldn't load items" message={state.error} onRetry={load} />
        ) : null}

        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState title="No items yet" message="Create your first item with the form above." />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <Card>
            <ul className="divide-y divide-border">
              {state.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      by {item.createdBy?.name ?? 'unknown'} ·{' '}
                      {format(new Date(item.createdAt), 'PP p')}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
