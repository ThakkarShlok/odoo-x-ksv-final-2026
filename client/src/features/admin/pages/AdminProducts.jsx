/**
 * Admin product management — the list. Create / edit / delete products that customers then browse,
 * closing the "an admin can't create a product" gap. Real data from /api/admin/products (paginated,
 * searchable, category-filterable server-side). Loading / error / empty states throughout.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { fetchAdminProducts, fetchAdminCategories, deleteProduct } from '../api/catalog';
import { getErrorMessage } from '@/api/axios';
import { money } from '@/lib/format';
import { assetUrl } from '@/lib/assets';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

const PAGE_SIZE = 20;

export default function AdminProducts() {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchAdminProducts({ page, limit: PAGE_SIZE, search: search || undefined, categoryId: categoryId || undefined });
      setState({ status: 'ready', items: res.data, meta: res.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error: getErrorMessage(error) });
    }
  }, [page, search, categoryId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchAdminCategories().then(setCategories).catch(() => {}); }, []);

  async function onDelete(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setBusyId(p.id);
    try {
      await deleteProduct(p.id);
      toast.success('Product deleted.');
      load();
    } catch (error) {
      // 409 = has units/rental history — the message names the blocker.
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  const meta = state.meta;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Create and manage the rental catalogue. {meta ? `${meta.totalCount} total.` : ''}</p>
        </div>
        <Button asChild><Link to="/app/products/new"><Plus className="h-4 w-4" /> New product</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-8 sm:w-64" aria-label="Search products" />
        </form>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {state.status === 'loading' ? <Loading label="Loading products…" /> : null}
      {state.status === 'error' ? <ErrorState message={state.error} onRetry={load} /> : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <EmptyState title="No products yet" message="Create your first product to populate the catalogue." />
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Daily</th>
                    <th className="px-4 py-3 text-right font-medium">Units</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.items.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
                            {p.primaryImage ? <img src={assetUrl(p.primaryImage.url)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-4 w-4" /></div>}
                          </div>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.brand || '—'}{p.isRentable ? '' : ' · not rentable'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categoryName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.rates?.DAILY ? money(p.rates.DAILY) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.unitCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm"><Link to={`/app/products/${p.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(p)} disabled={busyId === p.id}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
