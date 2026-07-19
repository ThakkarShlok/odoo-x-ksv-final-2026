import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { Package, ChevronLeft, ChevronRight, Search, Plus, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateAssetDialog } from '../components/CreateAssetDialog';
import { AnimatedList, AnimatedListItem } from '@/components/common/AnimatedList';
import { AnimatedPage as AnimatedPageWrapper } from '@/components/common/AnimatedPage';

export default function InventoryManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, meta, loading, error, refetch } = useApi('/inventory', {
    params: { page, limit: 12, status: statusFilter || undefined, brand: search || undefined },
  });

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <AnimatedPageWrapper className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Manage physical assets and equipment units</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search brand..."
                className="pl-9 w-40"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background pl-3 focus-within:ring-1 focus-within:ring-ring shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              className="h-9 w-32 border-none bg-transparent text-sm outline-none focus:ring-0 cursor-pointer pr-3"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="RENTED">Rented</option>
              <option value="DAMAGED">Damaged</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          <Button size="sm" className="transition-all duration-200 active:scale-95 hover:shadow-md gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="h-32 animate-pulse p-6 bg-muted" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
      ) : !data?.length ? (
        <Card><CardContent className="p-0"><EmptyState icon={Package} title="No assets found" message="No physical assets match your filters." /></CardContent></Card>
      ) : (
        <>
          <AnimatedList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((asset) => (
              <AnimatedListItem key={asset.id}>
              <Card className="transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-primary overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-mono text-sm font-semibold">{asset.barcode}</h3>
                      <p className="text-sm font-medium text-foreground">{asset.brand} {asset.color}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{asset.categoryName}</p>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                    <span>Mfr: {asset.manufacturer || '—'}</span>
                    <span>Size: {asset.size || '—'}</span>
                  </div>
                </CardContent>
              </Card>
              </AnimatedListItem>
            ))}
          </AnimatedList>

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

      <CreateAssetDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          setPage(1);
          refetch();
        }}
      />
    </AnimatedPageWrapper>
  );
}
