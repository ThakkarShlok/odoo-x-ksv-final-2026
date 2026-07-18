import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loading } from '@/components/common/Loading';
import { Scan, ClipboardList, TrendingUp, Compass, CheckCircle2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function FieldDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pickupsToday: 0, returnsToday: 0 });
  const [activeJobs, setActiveJobs] = useState([]);
  const [scanBarcode, setScanBarcode] = useState('');
  const [openScanModal, setOpenScanModal] = useState(false);

  useEffect(() => {
    // Fetch dashboard reports metrics and rentals
    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/rentals')
    ]).then(([reportsRes, rentalsRes]) => {
      const vol = reportsRes.data.data.volumes;
      setStats({
        pickupsToday: vol.upcomingPickups || 3,
        returnsToday: vol.upcomingReturns || 4
      });

      // Filter rentals that are CONFIRMED or IN_RENTAL for the agent dashboard
      const rentals = rentalsRes.data.data || [];
      const jobs = rentals.filter(r => r.status === 'CONFIRMED' || r.status === 'IN_RENTAL');
      setActiveJobs(jobs);
    }).catch(err => {
      toast.error(getErrorMessage(err, 'Failed to sync ops metrics.'));
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scanBarcode.trim()) return;

    setLoading(true);
    try {
      // Find the rental corresponding to the unit barcode or order number
      const barcode = scanBarcode.trim().toUpperCase();
      const match = activeJobs.find(job => 
        job.orderNumber.toUpperCase().includes(barcode) ||
        job.lines?.some(l => l.productUnit?.serialNumber?.toUpperCase() === barcode)
      );

      if (!match) {
        toast.error(`Barcode "${barcode}" not associated with any active today's order.`);
        return;
      }

      setOpenScanModal(false);
      
      // Route based on order status: 
      // If CONFIRMED -> agent performs handover.
      // If IN_RENTAL -> agent performs quality inspection return scan.
      if (match.status === 'CONFIRMED') {
        // Perform handover
        await api.post(`/rentals/${match.id}/handover`);
        toast.success(`Handover confirmed! Serial ${barcode} active.`);
        // Reload dashboard
        window.location.reload();
      } else {
        // Redirect to Quality Inspection wizard
        navigate(`/app/field-ops/inspection/${match.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Barcode scan resolution failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading label="Syncing agent operations portal..." />;
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-20 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Field Operations</h1>
          <p className="text-muted-foreground text-xs">Courier and warehouse inventory inspection checkpoint.</p>
        </div>
        <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10">
          Agent Workspace
        </Badge>
      </div>

      {/* finger friendly metrics widgets */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-emerald-500/5 border border-emerald-500/20">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <span className="text-emerald-500 text-2xl font-black font-mono">{stats.pickupsToday}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Pickups Due</span>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-500/5 border border-amber-500/20">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <span className="text-amber-500 text-2xl font-black font-mono">{stats.returnsToday}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Inspections</span>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs list */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Today's Route Schedule</h2>
        
        {activeJobs.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">
            All routes and collections are completed for today.
          </Card>
        ) : (
          activeJobs.map(job => (
            <Card 
              key={job.id} 
              className={`hover:bg-muted/40 cursor-pointer transition-colors border border-border ${
                job.status === 'CONFIRMED' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-500'
              }`}
              onClick={() => {
                if (job.status === 'CONFIRMED') {
                  setScanBarcode(job.orderNumber);
                  setOpenScanModal(true);
                } else {
                  navigate(`/app/field-ops/inspection/${job.id}`);
                }
              }}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{job.orderNumber}</span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 uppercase font-medium">
                      {job.status === 'CONFIRMED' ? 'Pickup' : 'Return'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {job.fulfillmentMethod === 'DELIVERY' ? 'Address Shipments Delivery' : ' Ahmedabed Hub Collect'}
                  </p>
                  <p className="text-[10px] font-semibold text-muted-foreground">
                    Units: {job.lines?.map(l => l.productUnit?.serialNumber).join(', ') || 'SN-ALLOC'}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Scanner float button */}
      <Dialog open={openScanModal} onOpenChange={setOpenScanModal}>
        <DialogTrigger asChild>
          <Button 
            className="fixed bottom-6 right-6 size-14 rounded-full shadow-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center p-0 z-40 transition-transform hover:scale-105"
            aria-label="Scan barcode"
          >
            <Scan className="size-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode Simulator</DialogTitle>
            <DialogDescription>
              Simulate barcode camera scanner. Enter serial/order number to process handovers or quality inspection checklist.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="barcodeInput">Asset / Order Barcode</Label>
              <div className="relative">
                <Scan className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  id="barcodeInput" 
                  placeholder="e.g. SN-DSLR-01, RO-2026-A..." 
                  className="pl-9 text-base"
                  value={scanBarcode}
                  onChange={e => setScanBarcode(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tip: Enter <code className="font-mono font-bold">RO-2026-F</code> for pickup or <code className="font-mono font-bold">RO-2026-B</code> for returns.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Simulate Capture Scan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
