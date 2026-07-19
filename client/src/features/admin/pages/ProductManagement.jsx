import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';
import { Boxes, ChevronLeft, ChevronRight, Search, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateCategoryDialog } from '../components/CreateCategoryDialog';

export default function ProductManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, meta, loading, error, refetch } = useApi('/products', {
    params: { page, limit: 12, search: search || undefined },
  });

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Categories</h1>
          <p className="text-sm text-muted-foreground">Manage rental categories and base pricing rules</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                className="pl-9 w-56"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
          <Button size="sm" className="gap-1.5" onClick={() => {
            setEditingCategory(null);
            setIsCreateOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Add Category
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
        <Card><CardContent className="p-0"><EmptyState icon={Boxes} title="No categories found" message="No product categories match your search." /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((cat) => (
              <Card key={cat.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Boxes className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{cat.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground">{cat.slug}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Daily</span>
                      <span className="tabular-nums font-medium">{formatCurrency(cat.baseDailyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Hourly</span>
                      <span className="tabular-nums font-medium">{formatCurrency(cat.baseHourlyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deposit Rule</span>
                      <span className="font-medium">
                        {cat.depositMethod === 'PERCENTAGE' ? `${cat.depositValue}%` : formatCurrency(cat.depositValue)}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsCreateOpen(true);
                    }}
                  >
                    Edit Configuration
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

      <CreateCategoryDialog 
        key={editingCategory ? editingCategory.id : 'new'} // force remount on edit
        open={isCreateOpen} 
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingCategory(null);
        }} 
        category={editingCategory}
        onSuccess={() => {
          setPage(1);
          refetch();
        }}
      />
    </div>
  );
}
