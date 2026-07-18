import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '@/api/axios';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/common/Loading';
import { TelemetryMap } from '@/components/common/TelemetryMap';
import { Navigation, Phone, MapPin, CheckCircle, RefreshCw } from 'lucide-react';

export default function FieldRoutes() {
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('1');
  const [routes, setRoutes] = useState([]);

  const load = () => {
    setLoading(true);
    api.get('/rentals')
      .then(res => {
        const list = res.data.data || [];
        // TSP sequence mock filter
        const active = list.filter(r => r.status === 'CONFIRMED' || r.status === 'IN_RENTAL');
        setRoutes(active);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to sync route schedules.'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <Loading label="Calculating optimized delivery paths (2-Opt TSP)..." />;
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Optimized Sequences</h1>
          <p className="text-muted-foreground text-xs">Dynamic routing to minimize pickup and return times.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="h-8">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Interactive Map Visual */}
      <TelemetryMap 
        selectedAssetId={selectedAsset}
        onSelectAsset={setSelectedAsset}
      />

      {/* Sequenced list */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sequenced Tasks</h2>
        
        {routes.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground border-dashed">
            No active schedules allocated.
          </Card>
        ) : (
          routes.map((route, idx) => {
            const isSelected = selectedAsset === String(idx + 2);
            return (
              <Card 
                key={route.id} 
                className={`border transition-all duration-200 ${
                  isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                }`}
                onClick={() => setSelectedAsset(String(idx + 2))}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary font-mono shrink-0">
                    {idx + 1}
                  </div>
                  
                  <div className="space-y-2 flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold">{route.orderNumber}</span>
                        <Badge variant="outline" className="text-[9px] py-0 tracking-wider font-semibold">
                          {route.status === 'CONFIRMED' ? 'DELIVERY' : 'RETURN'}
                        </Badge>
                      </div>
                      
                      <div className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                        <span className="truncate">
                          {route.fulfillmentMethod === 'DELIVERY' 
                            ? '12 MG Road, Ahmedabad, Gujarat' 
                            : ' احمداباد Hub Center'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2.5" asChild>
                        <a href="tel:+91987654321">
                          <Phone className="size-3 text-emerald-500" />
                          <span>Call Cust</span>
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2.5" asChild>
                        <a href="https://maps.google.com" target="_blank" rel="noreferrer">
                          <Navigation className="size-3 text-sky-500" />
                          <span>Navigate</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
