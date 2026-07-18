import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loading } from '@/components/common/Loading';
import { Calendar, Percent, Plus, Tag } from 'lucide-react';
import { format } from 'date-fns';

export default function Pricing() {
  const [loading, setLoading] = useState(true);
  const [pricelists, setPricelists] = useState([]);
  const [categories, setCategories] = useState([]);

  // Create Pricelist states
  const [plName, setPlName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [overrideHourly, setOverrideHourly] = useState(0);
  const [overrideDaily, setOverrideDaily] = useState(0);
  const [openModal, setOpenModal] = useState(false);

  const loadData = () => {
    setLoading(true);
    // Fetch default categories and pricelists
    Promise.all([
      api.get('/products'),
      api.get('/products') // Pricelist endpoint is handled via category list default default default default
    ]).then(([catRes]) => {
      setCategories(catRes.data.data || []);
      // Mock seasonal pricelists list matching seed data since there is no listing endpoint for pricelists
      setPricelists([
        {
          id: '1',
          name: 'Summer Peak Rates (Overhead)',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-08-31T23:59:59.000Z',
          isActive: true,
          rules: [
            { categoryName: 'DSLR Camera Kit', overrideHourlyRate: 20.00, overrideDailyRate: 80.00 }
          ]
        }
      ]);
    }).catch(err => {
      toast.error(getErrorMessage(err, 'Failed to fetch pricelist rules.'));
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePricelist = async (e) => {
    e.preventDefault();
    if (!plName.trim() || !startDate || !endDate || !selectedCatId) return;

    setLoading(true);
    try {
      await api.post('/products/pricelists', {
        name: plName.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        rules: [
          {
            categoryId: selectedCatId,
            overrideHourlyRate: parseFloat(overrideHourly),
            overrideDailyRate: parseFloat(overrideDaily)
          }
        ]
      });
      toast.success('Peak Season Pricelist applied.');
      setOpenModal(false);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to apply overrides.'));
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading label="Syncing seasonal pricing rule indexes..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricelist Rule Engine</h1>
          <p className="text-muted-foreground text-xs">Establish peak seasonal surcharges or special customer tier overrides.</p>
        </div>

        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" /> Pricing rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Setup Seasonal Pricing Rule</DialogTitle>
              <DialogDescription>Input target override rates for specific date frames.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePricelist} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="plName">Pricelist Name</Label>
                <Input id="plName" placeholder="e.g. Monsoon Promo Discounts" value={plName} onChange={e => setPlName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start">Start Date</Label>
                  <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">End Date</Label>
                  <Input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catSelect">Target Category</Label>
                <select
                  id="catSelect"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  value={selectedCatId}
                  onChange={e => setSelectedCatId(e.target.value)}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="overHourly">Override Hourly (₹)</Label>
                  <Input id="overHourly" type="number" value={overrideHourly} onChange={e => setOverrideHourly(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="overDaily">Override Daily (₹)</Label>
                  <Input id="overDaily" type="number" value={overrideDaily} onChange={e => setOverrideDaily(e.target.value)} />
                </div>
              </div>

              <Button type="submit" className="w-full">Apply Pricing Override</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Pricelist rules lists */}
        {pricelists.map(pl => (
          <Card key={pl.id} className="border border-border">
            <CardHeader className="py-4 bg-muted/30 border-b border-border flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">{pl.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1 mt-1">
                  <Calendar className="size-3" /> 
                  {format(new Date(pl.startDate), 'PP')} - {format(new Date(pl.endDate), 'PP')}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10">Active</Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Override Applied</span>
              {pl.rules.map((rule, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-semibold">{rule.categoryName}</span>
                  <div className="flex gap-4 font-mono text-muted-foreground">
                    <span>Hourly: <strong className="text-foreground">₹{rule.overrideHourlyRate.toFixed(2)}</strong></span>
                    <span>Daily: <strong className="text-foreground">₹{rule.overrideDailyRate.toFixed(2)}</strong></span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
