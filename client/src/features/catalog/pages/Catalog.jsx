import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/common/Loading';
import { Search, Calendar, ShieldAlert, ArrowRight, ShoppingCart, Info } from 'lucide-react';

export default function Catalog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [search, setSearch] = useState('');
  
  // Booking parameters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    api.get('/products')
      .then(res => {
        setProducts(res.data.data);
        setFilteredProducts(res.data.data);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to fetch catalog.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    setFilteredProducts(
      products.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        (p.brand && p.brand.toLowerCase().includes(lower))
      )
    );
  }, [search, products]);

  // Duration in days calculation
  const getDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    if (isNaN(diff) || diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const days = getDays();

  const handleBook = (product) => {
    if (days <= 0) {
      toast.error('Please select a valid booking date range.');
      return;
    }

    // Save configuration and proceed to checkout
    const selection = {
      product,
      startDate,
      endDate,
      days,
    };
    localStorage.setItem('zenith.checkout_draft', JSON.stringify(selection));
    navigate('/app/checkout');
  };

  if (loading) {
    return <Loading label="Retrieving rental catalog..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading text-emerald-500">Rental Catalog</h1>
          <p className="text-muted-foreground text-sm">Select dates and discover premium high-value items available for rent.</p>
        </div>
        
        {/* Date Selector Header block */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Select Window:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="h-8 text-xs max-w-[130px]" 
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="h-8 text-xs max-w-[130px]" 
            />
          </div>
          <Badge variant="secondary" className="h-6 font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
            {days > 0 ? `${days} Days` : 'Invalid range'}
          </Badge>
        </div>
      </div>

      {/* Search block */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input 
          type="search" 
          placeholder="Search camera kits, tools, banquets..." 
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Catalog Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Info className="mx-auto size-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold">No products found</h3>
          <p className="text-muted-foreground text-sm">Try modifying your query or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map(product => {
            const baseDaily = parseFloat(product.baseDailyRate || '0');
            const baseHourly = parseFloat(product.baseHourlyRate || '0');
            const totalBase = baseDaily * days;
            
            // Calculate security deposit
            const isPct = product.depositMethod === 'PERCENTAGE';
            const depVal = parseFloat(product.depositValue || '0');
            const calculatedDeposit = isPct ? (totalBase * (depVal / 100)) : depVal;

            return (
              <Card key={product.id} className="group overflow-hidden border border-border bg-card transition-all duration-300 hover:scale-[1.01] hover:shadow-md">
                <div className="aspect-video w-full bg-slate-900 flex items-center justify-center p-4 relative text-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                  <div className="z-10">
                    <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                      {product.brand || 'Premium'}
                    </span>
                    <h3 className="text-lg font-bold text-white font-heading px-2">{product.name}</h3>
                  </div>
                  <Badge className="absolute right-3 top-3" variant="outline">
                    {product.depositMethod === 'PERCENTAGE' ? `${depVal}% Hold` : `₹${depVal} Deposit`}
                  </Badge>
                </div>

                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 divide-x divide-border">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Daily Rate</span>
                      <p className="text-lg font-extrabold text-foreground font-mono">₹{baseDaily.toFixed(2)}</p>
                    </div>
                    <div className="pl-4 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Hourly Rate</span>
                      <p className="text-sm font-semibold text-muted-foreground font-mono">₹{baseHourly.toFixed(2)}</p>
                    </div>
                  </div>

                  {days > 0 && (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 border border-border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Cost ({days} Days):</span>
                        <span className="font-semibold font-mono">₹{totalBase.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-amber-500">
                        <span className="flex items-center gap-1">
                          <ShieldAlert className="size-3" /> Security Deposit hold:
                        </span>
                        <span className="font-semibold font-mono">₹{calculatedDeposit.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="px-5 pb-5 pt-0">
                  <Button 
                    className="w-full group" 
                    onClick={() => handleBook(product)}
                    disabled={days <= 0}
                  >
                    <ShoppingCart data-icon="inline-start" />
                    Reserve & Authorize
                    <ArrowRight className="ml-auto size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
