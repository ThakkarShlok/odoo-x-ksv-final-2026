import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import api from '@/api/axios';
import toast from 'react-hot-toast';
import { formatDateShort } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Calendar, ArrowRight, Truck, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function PickupReturnSchedule() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pickups'); // 'pickups' | 'returns'
  const { data: rentals, loading, refetch } = useApi('/rentals', {
    params: { limit: 100 },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter rentals
  const pickups = rentals?.filter(r => r.status === 'CONFIRMED').sort((a, b) => new Date(a.rentalStart) - new Date(b.rentalStart)) || [];
  const returns = rentals?.filter(r => r.status === 'IN_RENTAL').sort((a, b) => new Date(a.rentalEnd) - new Date(b.rentalEnd)) || [];

  const activeData = tab === 'pickups' ? pickups : returns;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today's Schedule</h1>
          <p className="text-sm text-muted-foreground">Manage upcoming handovers and returns</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pickups' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('pickups')}
        >
          Pickups ({pickups.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'returns' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('returns')}
        >
          Returns ({returns.length})
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="h-28 animate-pulse p-6 bg-muted" /></Card>
          ))}
        </div>
      ) : activeData.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={Calendar} title={`No scheduled ${tab} found`} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeData.map((order) => {
            const dateStr = tab === 'pickups' ? order.rentalStart : order.rentalEnd;
            const date = new Date(dateStr);
            const isToday = date.toDateString() === new Date().toDateString();
            const isOverdue = tab === 'returns' && date < new Date();

            return (
              <Card key={order.id} className={`overflow-hidden ${isOverdue ? 'border-destructive/50 shadow-sm shadow-destructive/10' : ''}`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-semibold text-foreground">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">{order.customer?.name || 'Unknown Customer'}</p>
                    </div>
                    {isToday && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">Today</span>}
                    {isOverdue && <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs font-medium">Overdue</span>}
                  </div>
                  
                  <div className="mt-auto space-y-4">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">{tab === 'pickups' ? 'Scheduled Pickup' : 'Due Return'}</span>
                      <span className="font-medium">{formatDateShort(dateStr)}</span>
                    </div>
                    <Button 
                      className="w-full" 
                      variant={isOverdue ? 'destructive' : 'default'}
                      onClick={() => navigate(`/app/admin-orders/${order.id}`)}
                    >
                      {tab === 'pickups' ? <Truck className="w-4 h-4 mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                      Process {tab === 'pickups' ? 'Handover' : 'Return'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
