import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, getProductImageUrl } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common/EmptyState';
import { Search, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatedList, AnimatedListItem } from '@/components/common/AnimatedList';
import { AnimatedPage as AnimatedPageWrapper } from '@/components/common/AnimatedPage';

export default function CatalogBrowse() {
  const navigate = useNavigate();
  const { data: categories, loading, error } = useApi('/products/catalog');
  
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (categories?.length && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return categories?.find(c => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const displayedProducts = useMemo(() => {
    let prods = [];
    if (!activeCategory) return prods;

    if (selectedSubcategoryId) {
      const sub = activeCategory.children?.find(c => c.id === selectedSubcategoryId);
      if (sub) {
        prods = (sub.products || []).map(p => ({ ...p, category: sub }));
      }
    } else {
      // Show products in main category + all subcategories
      prods = (activeCategory.products || []).map(p => ({ ...p, category: activeCategory }));
      activeCategory.children?.forEach(sub => {
        prods = prods.concat((sub.products || []).map(p => ({ ...p, category: sub })));
      });
    }

    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      prods = prods.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) || 
        (p.brand && p.brand.toLowerCase().includes(lowerSearch))
      );
    }

    return prods;
  }, [activeCategory, selectedSubcategoryId, search]);

  return (
    <AnimatedPageWrapper className="space-y-8">
      {/* Search Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">Rent top quality products easily</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-8 animate-pulse">
          <div className="flex gap-4 overflow-hidden"><div className="h-10 w-24 bg-muted rounded-full" /><div className="h-10 w-32 bg-muted rounded-full" /></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
      ) : !categories?.length ? (
        <EmptyState icon={Store} title="Catalog Empty" message="No products available for rent right now." />
      ) : (
        <div className="space-y-6">
          {/* Main Category Chips */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setSelectedSubcategoryId(null);
                }}
                className={`px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm
                  ${selectedCategoryId === cat.id 
                    ? 'bg-primary text-primary-foreground shadow-md scale-105' 
                    : 'bg-background border border-border hover:border-primary/50 text-foreground'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Subcategory Chips */}
          {activeCategory?.children?.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedSubcategoryId(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200
                  ${!selectedSubcategoryId 
                    ? 'bg-secondary text-secondary-foreground' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
              >
                All {activeCategory.name}
              </button>
              {activeCategory.children.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategoryId(sub.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200
                    ${selectedSubcategoryId === sub.id 
                      ? 'bg-secondary text-secondary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          {!displayedProducts.length ? (
            <EmptyState icon={Store} title="No items found" message="Try adjusting your filters or search." />
          ) : (
            <AnimatedList className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedProducts.map(product => (
                <AnimatedListItem key={product.id}>
                  <Card 
                    className="overflow-hidden group cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-primary border-border"
                    onClick={() => navigate(`/app/catalog/item/${product.id}`)}
                  >
                    {/* Image Placeholder */}
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      <img 
                        src={getProductImageUrl(product.name, product.category?.name, product.id)}
                        alt={product.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{product.brand || product.category?.name}</p>
                      </div>

                      <div className="flex items-end justify-between mt-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-0.5">Rent from</span>
                          <span className="font-bold text-xl tabular-nums text-primary">{formatCurrency(product.category?.baseDailyRate)}<span className="text-sm text-muted-foreground font-normal">/day</span></span>
                        </div>
                      </div>

                      <Button className="w-full mt-2 transition-all duration-200 active:scale-95 group-hover:bg-primary/90" size="sm">
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedListItem>
              ))}
            </AnimatedList>
          )}
        </div>
      )}
    </AnimatedPageWrapper>
  );
}
